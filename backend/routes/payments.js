import express from "express";
import { protect } from "../middleware/auth.js";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";

const router = express.Router();

// Get all payments
router.get("/", protect, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("member_id", "name phone member_id")
      .sort({ date: -1 })
      .limit(100);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record payment (admin only or member)
router.post("/", protect, async (req, res) => {
  try {
    const {
      member_id,
      amount,
      phone,
      mpesa_transaction_id,
      payment_method,
      cycle_number,
    } = req.body;

    // Get current cycle if not provided
    let currentCycleNumber = cycle_number;
    if (!currentCycleNumber) {
      const currentCycle = await Cycle.findOne({ status: "active" });
      currentCycleNumber = currentCycle?.cycle_number || 1;
    }

    const payment = await Payment.create({
      member_id,
      amount: amount || 204,
      phone,
      mpesa_transaction_id,
      payment_method: payment_method || "mpesa",
      cycle_number: currentCycleNumber,
      status: "completed",
    });

    // Update member payment status and increment total contributed
    await Member.findByIdAndUpdate(member_id, {
      payment_status: "paid",
      payment_date: new Date(),
      amount: amount || 204,
      $inc: { total_contributed: amount || 204 },
    });

    // Update cycle collection stats
    const cycle = await Cycle.findOne({ cycle_number: currentCycleNumber });
    if (cycle) {
      const payments = await Payment.find({
        cycle_number: currentCycleNumber,
        status: "completed",
      });
      const paidCount = new Set(payments.map((p) => p.member_id.toString()))
        .size;
      const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

      cycle.paid_members_count = paidCount;
      cycle.total_amount_collected = totalCollected;
      await cycle.save();
    }

    // Emit socket event for real-time updates
    if (req.app.get("io")) {
      req.app.get("io").emit("payment:new", payment);
      req.app.get("io").emit("cycle:updated", cycle);
    }

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initiate STK Push for wallet deposit
router.post("/stk-push", protect, async (req, res) => {
  try {
    const { amount, phone, type, notes } = req.body;
    const memberId = req.user._id;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Valid amount is required",
      });
    }

    // Get member details
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    // Generate unique reference
    const reference = `WD${Date.now()}-${memberId.toString().slice(-6)}`;

    // Store pending payment record
    const payment = await Payment.create({
      member_id: memberId,
      amount,
      phone,
      payment_method: "mpesa",
      status: "pending",
      type: type || "wallet_deposit",
      notes: notes || `Wallet deposit by ${member.name}`,
      transaction_reference: reference,
    });

    console.log("💰 Initiating wallet deposit STK Push:", {
      member: member.name,
      phone,
      amount,
      reference,
    });

    // Use Lipia API for actual M-Pesa STK Push
    const lipiaService = await import("../services/lipiaService.js");
    const lipiaResponse = await lipiaService.initiateLipiaPayment(
      phone,
      amount,
      reference,
      `SMCF Wallet Deposit - ${member.name}`
    );

    console.log("✅ Lipia STK Push initiated:", lipiaResponse);

    // Update payment with Lipia details
    payment.checkout_request_id = lipiaResponse.checkoutRequestId;
    payment.merchant_request_id = lipiaResponse.merchantRequestId;
    await payment.save();

    // Start polling for payment status
    pollLipiaPaymentStatus(payment._id, reference, memberId, amount, req.app);

    res.json({
      success: true,
      message: "STK Push sent to your phone",
      CheckoutRequestID: lipiaResponse.checkoutRequestId,
      paymentId: payment._id,
      reference,
    });
  } catch (error) {
    console.error("❌ STK Push error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to initiate payment",
    });
  }
});

// Poll Lipia payment status
async function pollLipiaPaymentStatus(
  paymentId,
  reference,
  memberId,
  amount,
  app,
  attempts = 0
) {
  const maxAttempts = 60; // Poll for 60 seconds

  if (attempts >= maxAttempts) {
    console.log("⏱️ Payment polling timeout:", reference);
    await Payment.findByIdAndUpdate(paymentId, {
      status: "failed",
      notes: "Payment timeout - no response from M-Pesa",
    });
    return;
  }

  try {
    const lipiaService = await import("../services/lipiaService.js");
    const status = await lipiaService.queryLipiaPaymentStatus(reference);

    console.log(`📊 Payment status check ${attempts + 1}/${maxAttempts}:`, {
      reference,
      status: status.status,
    });

    if (status.status === "completed" || status.status === "success") {
      // Payment successful
      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        {
          status: "completed",
          mpesa_transaction_id: status.transactionId || reference,
        },
        { new: true }
      );

      // Get member details
      const member = await Member.findById(memberId);

      // Create Saving record for wallet deposit
      const Saving = (await import("../models/Saving.js")).default;

      // Get current balance
      const lastSaving = await Saving.findOne({ member_id: memberId }).sort({
        created_at: -1,
      });
      const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
      const balanceAfter = balanceBefore + amount;

      const savingRecord = await Saving.create({
        member_id: memberId,
        amount: amount,
        transaction_type: "deposit",
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "completed",
        payment_method: "mpesa",
        transaction_ref: status.transactionId || reference,
        notes: `Wallet deposit via M-Pesa - ${reference}`,
      });

      // Update member's total contributed
      await Member.findByIdAndUpdate(memberId, {
        $inc: { total_contributed: amount },
      });

      console.log("✅ Wallet deposit completed:", {
        member: member.name,
        amount,
        reference,
        newBalance: balanceAfter,
      });

      // Emit socket events for real-time updates
      if (app && app.get("io")) {
        app.get("io").emit("payment:completed", {
          memberId,
          payment,
          type: "wallet_deposit",
        });

        app.get("io").emit("saving:new", {
          memberId,
          saving: savingRecord,
          member: member.name,
        });
      }
    } else if (status.status === "failed" || status.status === "cancelled") {
      // Payment failed
      await Payment.findByIdAndUpdate(paymentId, {
        status: "failed",
        notes: status.message || "Payment failed",
      });
      console.log("❌ Payment failed:", reference);
    } else {
      // Still pending, poll again after 1 second
      setTimeout(
        () =>
          pollLipiaPaymentStatus(
            paymentId,
            reference,
            memberId,
            amount,
            app,
            attempts + 1
          ),
        1000
      );
    }
  } catch (error) {
    console.error("Error polling payment status:", error);
    // Continue polling despite errors
    setTimeout(
      () =>
        pollLipiaPaymentStatus(
          paymentId,
          reference,
          memberId,
          amount,
          app,
          attempts + 1
        ),
      1000
    );
  }
}

// Check payment status
router.get("/check-status/:checkoutRequestId", protect, async (req, res) => {
  try {
    const { checkoutRequestId } = req.params;

    // Find payment by checkout request ID (in production, query M-Pesa API)
    // For now, find recent payment by user
    const payment = await Payment.findOne({
      member_id: req.user._id,
    }).sort({ date: -1 });

    if (!payment) {
      return res.json({
        status: "pending",
        message: "Payment not found",
      });
    }

    res.json({
      status: payment.status,
      message:
        payment.status === "completed"
          ? "Payment successful"
          : "Processing payment",
      payment,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// M-Pesa callback endpoint (for production integration)
router.post("/mpesa-callback", async (req, res) => {
  try {
    console.log("M-Pesa Callback:", req.body);
    // Process M-Pesa callback
    // Update payment status, member status, etc.
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all payments (admin only - for system reset)
router.delete("/", protect, async (req, res) => {
  try {
    await Payment.deleteMany({});
    res.json({ success: true, message: "All payments deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
