import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";
import TenXAuditLog from "../models/TenXAuditLog.js";
import TenXContribution from "../models/TenXContribution.js";
import TenXPeriod from "../models/TenXPeriod.js";
import { initiateLipiaPayment, queryLipiaPaymentStatus } from "../services/lipiaService.js";

const router = express.Router();
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const adminWrite = (req, res, next) => {
  if (["viewer", "auditor"].includes(req.user?.role)) return res.status(403).json({ success: false, error: "Insufficient 10X permissions" });
  next();
};
const requireTenXMember = (req, res, next) => {
  if (!req.member || !req.member.is10XMember) return res.status(403).json({ success: false, error: "10X membership required" });
  next();
};
const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const receiptNumber = async () => {
  const count = await TenXContribution.countDocuments({ receipt_number: { $exists: true } });
  return `SMCF-10X-${new Date().getFullYear()}-${String(count + 1).padStart(6, "0")}`;
};
const audit = (req, action, description, extra = {}) => TenXAuditLog.create({ admin_id: req.admin._id, action, description, ...extra });

router.use(protect);

router.get("/me", requireTenXMember, async (req, res) => {
  try {
    const period = await TenXPeriod.findOne({ period: getCurrentPeriod(), status: "OPEN" });
    const contributions = await TenXContribution.find({ member_id: req.member._id }).populate("period_id").sort({ period: -1, created_at: -1 });
    res.json({ success: true, data: { member: req.member, currentPeriod: period, contributions } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/receipts/:id", requireTenXMember, async (req, res) => {
  try {
    const contribution = await TenXContribution.findOne({ _id: req.params.id, member_id: req.member._id, status: "SUCCESSFUL" }).populate("member_id");
    if (!contribution) return res.status(404).json({ success: false, error: "Receipt not found" });
    res.json({ success: true, data: contribution });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post("/payments/stk-push", requireTenXMember, async (req, res) => {
  try {
    const { phone } = req.body;
    const period = await TenXPeriod.findOne({ period: req.body.period || getCurrentPeriod(), status: "OPEN" });
    if (!period) return res.status(400).json({ success: false, error: "Contribution period is not open" });
    const existing = await TenXContribution.findOne({ member_id: req.member._id, period_id: period._id, status: "SUCCESSFUL" });
    if (existing) return res.status(409).json({ success: false, error: "This contribution has already been paid", data: existing });
    const pending = await TenXContribution.findOne({ member_id: req.member._id, period_id: period._id, status: "PENDING" });
    if (pending) return res.status(409).json({ success: false, error: "A payment is already pending", data: pending });
    if (!phone) return res.status(400).json({ success: false, error: "Phone number is required" });
    const reference = `10X-${period.period}-${Date.now()}-${String(req.member._id).slice(-6)}`;
    const contribution = await TenXContribution.create({ member_id: req.member._id, period_id: period._id, period: period.period, amount_due: period.due_amount, payment_method: "mpesa", transaction_reference: reference });
    const payment = await Payment.create({ member_id: req.member._id, amount: period.due_amount, phone, payment_method: "mpesa", type: "ten_x_contribution", status: "pending", transaction_reference: reference, notes: `10X contribution ${period.period}`, });
    contribution.payment_id = payment._id;
    await contribution.save();
    const gateway = await initiateLipiaPayment(phone, period.due_amount, reference, `SMCF 10X Contribution - ${period.period}`);
    if (!gateway?.success) throw new Error(gateway?.error || "Failed to initiate payment");
    payment.checkout_request_id = gateway.checkoutRequestID || gateway.checkoutRequestId;
    payment.merchant_request_id = gateway.merchantRequestID || gateway.merchantRequestId;
    await payment.save();
    pollTenXPayment(payment._id, contribution._id, payment.checkout_request_id, reference, req.app);
    res.status(201).json({ success: true, paymentId: payment._id, contributionId: contribution._id, CheckoutRequestID: payment.checkout_request_id, reference });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/admin/overview", adminOnly, async (req, res) => {
  try {
    const period = await TenXPeriod.findOne({ period: getCurrentPeriod() });
    const members = await Member.countDocuments({ is10XMember: true });
    const contributions = period ? await TenXContribution.find({ period_id: period._id }) : [];
    const collected = contributions.filter((c) => c.status === "SUCCESSFUL").reduce((sum, c) => sum + c.amount_paid, 0);
    res.json({ success: true, data: { totalMembers: members, expected: (period?.due_amount || 0) * members, collected, outstanding: Math.max(0, (period?.due_amount || 0) * members - collected), paymentRate: members ? Math.round((contributions.filter((c) => c.status === "SUCCESSFUL").length / members) * 100) : 0, period, contributions } });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/admin/members", adminOnly, async (req, res) => {
  try { res.json({ success: true, data: await Member.find({ is10XMember: true }).select("name member_id phone is10XMember tenXJoinedAt") }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.patch("/admin/members/:id", adminOnly, adminWrite, async (req, res) => {
  try {
    const is10XMember = Boolean(req.body.is10XMember);
    const member = await Member.findByIdAndUpdate(req.params.id, { is10XMember, tenXJoinedAt: is10XMember ? new Date() : null }, { new: true }).select("name member_id is10XMember tenXJoinedAt");
    if (!member) return res.status(404).json({ success: false, error: "Member not found" });
    await audit(req, is10XMember ? "MEMBER_ADDED" : "MEMBER_REMOVED", `${is10XMember ? "Added" : "Removed"} ${member.member_id} ${is10XMember ? "to" : "from"} 10X`, { member_id: member._id });
    res.json({ success: true, data: member });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/admin/periods", adminOnly, async (req, res) => {
  try { res.json({ success: true, data: await TenXPeriod.find().sort({ period: -1 }) }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post("/admin/periods", adminOnly, adminWrite, async (req, res) => {
  try {
    const { period, due_amount, due_date, status } = req.body;
    if (!PERIOD_RE.test(period) || !Number.isFinite(Number(due_amount)) || Number(due_amount) < 0) return res.status(400).json({ success: false, error: "Valid period and amount are required" });
    const saved = await TenXPeriod.findOneAndUpdate({ period }, { period, due_amount: Number(due_amount), due_date, status: status || "OPEN", created_by: req.admin._id, updated_by: req.admin._id }, { new: true, upsert: true, setDefaultsOnInsert: true });
    await audit(req, "PERIOD_UPDATED", `Updated 10X period ${period} to KES ${due_amount}`);
    res.status(201).json({ success: true, data: saved });
  } catch (error) { res.status(500).json({ success: false, error: error.code === 11000 ? "Period already exists" : error.message }); }
});

router.get("/admin/contributions", adminOnly, async (req, res) => {
  try { const query = {}; if (req.query.period) query.period = req.query.period; if (req.query.status) query.status = req.query.status; const data = await TenXContribution.find(query).populate("member_id", "name member_id").sort({ created_at: -1 }); res.json({ success: true, data }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.get("/admin/reports.csv", adminOnly, async (req, res) => {
  try {
    const query = {};
    if (req.query.period) query.period = req.query.period;
    if (req.query.status) query.status = req.query.status;
    const rows = await TenXContribution.find(query).populate("member_id", "name member_id").sort({ period: 1, created_at: 1 });
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      ["SMART MOVES DEVELOPMENT AGENCY", "SMCF / 10X GROUP CONTRIBUTION REPORT"],
      ["Member", "Member Number", "Period", "Amount Due", "Amount Paid", "Balance", "Payment Date", "Reference", "Status", "Receipt"],
      ...rows.map((row) => [row.member_id?.name, row.member_id?.member_id, row.period, row.amount_due, row.amount_paid, row.amount_due - row.amount_paid, row.payment_date?.toISOString() || "", row.transaction_reference, row.status, row.receipt_number].map(escape)),
      ["Totals", "", "", rows.reduce((sum, row) => sum + row.amount_due, 0), rows.reduce((sum, row) => sum + row.amount_paid, 0), rows.reduce((sum, row) => sum + row.amount_due - row.amount_paid, 0)],
    ].map((row) => row.map(escape).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=smcf-10x-contributions.csv");
    res.send(csv);
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

router.post("/admin/contributions/manual", adminOnly, adminWrite, async (req, res) => {
  try {
    const { member_id, period, amount_paid, payment_date, payment_method, transaction_reference, notes } = req.body;
    const member = await Member.findOne({ _id: member_id, is10XMember: true });
    const periodDoc = await TenXPeriod.findOne({ period });
    if (!member || !periodDoc) return res.status(400).json({ success: false, error: "10X member and period are required" });
    const contribution = await TenXContribution.create({ member_id, period_id: periodDoc._id, period, amount_due: periodDoc.due_amount, amount_paid: Number(amount_paid), payment_date: payment_date || new Date(), payment_method: payment_method || "manual", transaction_reference, status: "SUCCESSFUL", source: "MANUAL", receipt_number: await receiptNumber(), recorded_by: req.admin._id, notes });
    await audit(req, "MANUAL_PAYMENT_RECORDED", `Recorded manual 10X payment for ${member.member_id}`, { member_id, contribution_id: contribution._id });
    res.status(201).json({ success: true, data: contribution });
  } catch (error) { res.status(500).json({ success: false, error: error.code === 11000 ? "A receipt number or payment already exists" : error.message }); }
});

router.get("/admin/audit", adminOnly, async (req, res) => {
  try { res.json({ success: true, data: await TenXAuditLog.find().populate("admin_id", "name").sort({ created_at: -1 }).limit(500) }); }
  catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

async function pollTenXPayment(paymentId, contributionId, checkoutRequestId, reference, app, attempts = 0) {
  if (!checkoutRequestId || attempts >= 60) return;
  try {
    const status = await queryLipiaPaymentStatus(checkoutRequestId);
    const verified = ["0", 0].includes(status?.resultCode) && status?.mpesaReceiptNumber && ["completed", "success"].includes(status?.status);
    if (verified) {
      const payment = await Payment.findByIdAndUpdate(paymentId, { status: "completed", mpesa_transaction_id: status.mpesaReceiptNumber, transaction_reference: status.mpesaReceiptNumber }, { new: true });
      await TenXContribution.findByIdAndUpdate(contributionId, { status: "SUCCESSFUL", amount_paid: payment.amount, payment_date: new Date(), transaction_reference: status.mpesaReceiptNumber, receipt_number: await receiptNumber() });
      app.get("io")?.emit("tenx:payment:completed", { memberId: payment.member_id, contributionId, reference: status.mpesaReceiptNumber });
      return;
    }
    if (status?.status === "failed" || status?.status === "cancelled") { await Payment.findByIdAndUpdate(paymentId, { status: "failed" }); await TenXContribution.findByIdAndUpdate(contributionId, { status: "FAILED" }); return; }
  } catch (error) { console.error("10X payment verification error:", error.message); }
  setTimeout(() => pollTenXPayment(paymentId, contributionId, checkoutRequestId, reference, app, attempts + 1), 2000);
}

export default router;