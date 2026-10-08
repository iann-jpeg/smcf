import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import TenXAuditLog from '../models/TenXAuditLog';
import TenXContribution from '../models/TenXContribution';
import TenXPeriod from '../models/TenXPeriod';
import Transaction from '../models/Transaction';
import { AuthRequest, authorize, protect } from '../middleware/auth';

const router = Router();
const readAccess = [protect, authorize('admin', 'treasurer', 'auditor')];
const writeAccess = [protect, authorize('admin', 'treasurer')];
const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.userId })
      .select('_id is10XMember')
      .lean();
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    if (!member.is10XMember) return res.status(403).json({ success: false, message: 'Member is not enrolled in 10X' });

    const period = await TenXPeriod.findOne({ period: currentPeriod(), status: 'OPEN' }).lean();
    const contributions = await TenXContribution.find({ member_id: member._id })
      .sort({ period: -1, created_at: -1 })
      .limit(24)
      .lean();
    return res.json({
      success: true,
      data: {
        currentPeriod: period ? { period: period.period, due_amount: period.due_amount, due_date: period.due_date } : null,
        contributions,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/progress', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.userId })
      .select('_id is10XMember tenXJoinedAt name memberId')
      .lean();
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    const enrolledMembers = await Member.countDocuments({ is10XMember: true, status: { $ne: 'deleted' } });
    const periods = await TenXPeriod.find().sort({ period: -1 }).limit(12).lean();
    const periodIds = periods.map((period) => period._id);
    const contributions = periodIds.length
      ? await TenXContribution.find({ period_id: { $in: periodIds } }).select('member_id period_id period amount_due amount_paid status payment_date').lean()
      : [];
    const memberContributions = contributions.filter((item) => String(item.member_id) === String(member._id));

    const history = periods.map((period) => {
      const periodContributions = contributions.filter((item) => String(item.period_id) === String(period._id));
      const successful = periodContributions.filter((item) => item.status === 'SUCCESSFUL');
      const collected = successful.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
      const paidMembers = new Set(successful.map((item) => String(item.member_id))).size;
      const expected = Number(period.due_amount || 0) * enrolledMembers;
      return {
        period: period.period,
        dueAmount: Number(period.due_amount || 0),
        expected,
        collected,
        outstanding: Math.max(0, expected - collected),
        paidMembers,
        paymentRate: enrolledMembers ? Math.round((paidMembers / enrolledMembers) * 100) : 0,
        status: period.status,
      };
    });
    const current = history[0] || {
      period: currentPeriod(), dueAmount: 0, expected: 0, collected: 0, outstanding: 0, paidMembers: 0, paymentRate: 0, status: 'OPEN',
    };
    const memberCurrent = memberContributions.find((item) => item.period === current.period);
    const cumulativeExpected = history.reduce((sum, item) => sum + item.expected, 0);
    const cumulativeCollected = history.reduce((sum, item) => sum + item.collected, 0);

    return res.json({
      success: true,
      data: {
        enrolled: Boolean(member.is10XMember),
        joinedAt: member.tenXJoinedAt,
        member: {
          dueAmount: Number(memberCurrent?.amount_due || current.dueAmount || 0),
          amountPaid: Number(memberCurrent?.amount_paid || 0),
          status: memberCurrent?.status || 'PENDING',
          paymentDate: memberCurrent?.payment_date || null,
        },
        group: {
          enrolledMembers,
          current,
          cumulativeExpected,
          cumulativeCollected,
          cumulativeRate: cumulativeExpected ? Math.round((cumulativeCollected / cumulativeExpected) * 100) : 0,
        },
        history,
      },
    });
  } catch (error) {
    return next(error);
  }
});

async function nextReceiptNumber() {
  const count = await TenXContribution.countDocuments({ receipt_number: { $exists: true } });
  return `SMCF-10X-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
}

async function recordAudit(req: AuthRequest, action: string, description: string, extra: Record<string, unknown> = {}) {
  await TenXAuditLog.create({ admin_id: req.user?._id, action, description, ...extra });
}

router.get('/admin/overview', ...readAccess, async (_req, res, next) => {
  try {
    const period = await TenXPeriod.findOne({ period: currentPeriod() });
    const memberCount = await Member.countDocuments({ is10XMember: true });
    const contributions = period ? await TenXContribution.find({ period_id: period._id }).lean() : [];
    const successful = contributions.filter((item) => item.status === 'SUCCESSFUL');
    const expected = Number(period?.due_amount || 0) * memberCount;
    const collected = successful.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    return res.json({ success: true, data: { totalMembers: memberCount, expected, collected, outstanding: Math.max(0, expected - collected), paymentRate: memberCount ? Math.round((successful.length / memberCount) * 100) : 0, period } });
  } catch (error) { return next(error); }
});

router.get('/admin/members', ...readAccess, async (_req, res, next) => {
  try {
    const members = await Member.find({ status: { $ne: 'deleted' } }).select('name memberId phone email is10XMember tenXJoinedAt status').sort({ name: 1 }).lean();
    return res.json({ success: true, data: members });
  } catch (error) { return next(error); }
});

router.patch('/admin/members/:id', ...writeAccess, async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid member id' });
    const enrolled = Boolean(req.body?.is10XMember);
    const member = await Member.findByIdAndUpdate(req.params.id, { is10XMember: enrolled, tenXJoinedAt: enrolled ? new Date() : null }, { new: true }).select('name memberId is10XMember tenXJoinedAt');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (enrolled) {
      const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      await TenXPeriod.findOneAndUpdate(
        { period },
        { $setOnInsert: { period, due_amount: 1000, status: 'OPEN', created_by: req.user?._id, updated_by: req.user?._id } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
    await recordAudit(req, enrolled ? 'MEMBER_ADDED' : 'MEMBER_REMOVED', `${enrolled ? 'Added' : 'Removed'} ${member.memberId} ${enrolled ? 'to' : 'from'} 10X`, { member_id: member._id });
    return res.json({ success: true, data: member });
  } catch (error) { return next(error); }
});

router.get('/admin/periods', ...readAccess, async (_req, res, next) => {
  try { return res.json({ success: true, data: await TenXPeriod.find().sort({ period: -1 }).lean() }); }
  catch (error) { return next(error); }
});

router.post('/admin/periods', ...writeAccess, async (req: AuthRequest, res, next) => {
  try {
    const { period, due_amount, due_date, status } = req.body || {};
    if (!periodPattern.test(String(period || '')) || !Number.isFinite(Number(due_amount)) || Number(due_amount) < 0) return res.status(400).json({ success: false, message: 'Valid period and amount are required' });
    const saved = await TenXPeriod.findOneAndUpdate({ period }, { period, due_amount: Number(due_amount), due_date: due_date || null, status: status || 'OPEN', created_by: req.user?._id, updated_by: req.user?._id }, { new: true, upsert: true, setDefaultsOnInsert: true });
    await recordAudit(req, 'PERIOD_UPDATED', `Updated 10X period ${period} to KES ${due_amount}`);
    return res.status(201).json({ success: true, data: saved });
  } catch (error) { return next(error); }
});

router.get('/admin/contributions', ...readAccess, async (req, res, next) => {
  try {
    const query: Record<string, string> = {};
    if (req.query.period) query.period = String(req.query.period);
    if (req.query.status) query.status = String(req.query.status);
    const data = await TenXContribution.find(query).populate('member_id', 'name memberId').sort({ created_at: -1 }).lean();
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.post('/admin/contributions/manual', ...writeAccess, async (req: AuthRequest, res, next) => {
  try {
    const { member_id, period, amount_paid, payment_date, payment_method, transaction_reference, notes } = req.body || {};
    const member = await Member.findOne({ _id: member_id, is10XMember: true }).select('name memberId');
    const periodDoc = await TenXPeriod.findOne({ period });
    if (!member || !periodDoc) return res.status(400).json({ success: false, message: '10X member and period are required' });
    const paidAmount = Number(amount_paid);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) return res.status(400).json({ success: false, message: 'A positive amount is required' });
    const reference = transaction_reference || `10X-MANUAL-${Date.now()}`;
    const contribution = await TenXContribution.create({ member_id, period_id: periodDoc._id, period, amount_due: periodDoc.due_amount, amount_paid: paidAmount, payment_date: payment_date || new Date(), payment_method: payment_method || 'manual', transaction_reference: reference, status: 'SUCCESSFUL', source: 'MANUAL', receipt_number: await nextReceiptNumber(), recorded_by: req.user?._id, notes });
    await Transaction.create({
      transactionRef: reference,
      memberId: member._id,
      type: 'tenx_contribution',
      amount: paidAmount,
      grossAmount: paidAmount,
      feeAmount: 0,
      netAmount: paidAmount,
      feeType: 'none',
      description: `Manual 10X contribution for ${period}`,
      status: 'completed',
      processedAt: payment_date || new Date(),
      createdBy: req.user?._id || null,
      mpesaRef: reference,
      paymentGateway: 'manual',
    });
    await recordAudit(req, 'MANUAL_PAYMENT_RECORDED', `Recorded manual 10X payment for ${member.memberId}`, { member_id, contribution_id: contribution._id });
    return res.status(201).json({ success: true, data: contribution });
  } catch (error) { return next(error); }
});

router.get('/admin/reports.csv', ...readAccess, async (req, res, next) => {
  try {
    const query: Record<string, string> = {};
    if (req.query.period) query.period = String(req.query.period);
    if (req.query.status) query.status = String(req.query.status);
    const rows = await TenXContribution.find(query).populate('member_id', 'name memberId').sort({ period: 1, created_at: 1 }).lean();
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csvRows = [
      ['SMART MOVES DEVELOPMENT AGENCY', 'SMCF / 10X GROUP CONTRIBUTION REPORT'],
      ['Member', 'Member Number', 'Period', 'Amount Due', 'Amount Paid', 'Balance', 'Payment Date', 'Reference', 'Status', 'Receipt'],
      ...rows.map((row: any) => [row.member_id?.name, row.member_id?.memberId, row.period, row.amount_due, row.amount_paid, Number(row.amount_due || 0) - Number(row.amount_paid || 0), row.payment_date ? new Date(row.payment_date).toISOString() : '', row.transaction_reference, row.status, row.receipt_number]),
      ['Totals', '', '', rows.reduce((sum, row) => sum + Number(row.amount_due || 0), 0), rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0), rows.reduce((sum, row) => sum + Number(row.amount_due || 0) - Number(row.amount_paid || 0), 0)],
    ].map((row) => row.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=smcf-10x-contributions.csv');
    return res.send(csvRows);
  } catch (error) { return next(error); }
});

router.get('/admin/audit', ...readAccess, async (_req, res, next) => {
  try { return res.json({ success: true, data: await TenXAuditLog.find().populate('admin_id', 'fullName email').sort({ created_at: -1 }).limit(500).lean() }); }
  catch (error) { return next(error); }
});

export default router;
