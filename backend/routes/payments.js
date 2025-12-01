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

    // Check if Lipia API call was successful
    if (!lipiaResponse.success) {
      throw new Error(lipiaResponse.error || "Failed to initiate STK Push");
    }

    // Update payment with Lipia details (handle both checkoutRequestID and checkoutRequestId)
    const checkoutRequestId =
      lipiaResponse.checkoutRequestID || lipiaResponse.checkoutRequestId;
    const merchantRequestId =
      lipiaResponse.merchantRequestID || lipiaResponse.merchantRequestId;

    payment.checkout_request_id = checkoutRequestId || reference;
    payment.merchant_request_id = merchantRequestId;
    await payment.save();

    console.log("💾 Payment record updated:", {
      paymentId: payment._id,
      checkout_request_id: payment.checkout_request_id,
      merchant_request_id: payment.merchant_request_id,
    });

    // Start polling for payment status using checkoutRequestId from Lipia
    console.log("🚀 Starting payment polling for:", {
      paymentId: payment._id,
      reference,
      checkoutRequestId,
      memberId,
      amount,
    });
    pollLipiaPaymentStatus(
      payment._id,
      checkoutRequestId,
      reference,
      memberId,
      amount,
      req.app
    );

    res.json({
      success: true,
      message: "STK Push sent to your phone",
      CheckoutRequestID: checkoutRequestId || reference,
      paymentId: payment._id,
      reference,
    });
  } catch (error) {
    console.error("❌ STK Push error:", error);

    // Update payment record as failed
    if (payment) {
      await Payment.findByIdAndUpdate(payment._id, {
        status: "failed",
        notes: error.message || "Failed to initiate STK Push",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to initiate payment",
    });
  }
});

// Poll Lipia payment status
async function pollLipiaPaymentStatus(
  paymentId,
  checkoutRequestId,
  reference,
  memberId,
  amount,
  app,
  attempts = 0
) {
  const maxAttempts = 60; // Poll for 60 seconds - faster detection

  if (attempts >= maxAttempts) {
    console.log("⏱️ Payment polling timeout after 60 seconds:", {
      checkoutRequestId,
      reference,
    });
    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      {
        status: "failed",
        notes: "Payment timed out - no response from M-Pesa after 60 seconds",
      },
      { new: true }
    );

    // Emit socket event for timeout
    console.log("🔔 Emitting payment:failed event for timeout");
    app.get("io").emit("payment:failed", {
      paymentId,
      memberId,
      message:
        "Payment timed out. If you entered your PIN, your wallet will update automatically.",
    });
    return;
  }

  try {
    const lipiaService = await import("../services/lipiaService.js");
    // Use checkoutRequestId from Lipia, not our custom reference
    const status = await lipiaService.queryLipiaPaymentStatus(
      checkoutRequestId
    );

    console.log(`📊 Payment status check ${attempts + 1}/${maxAttempts}:`, {
      checkoutRequestId,
      reference,
      status: status.status,
      success: status.success,
      resultCode: status.resultCode,
      resultDesc: status.resultDescription,
      error: status.error,
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

      // Update member's total_savings
      await Member.findByIdAndUpdate(memberId, {
        $inc: {
          total_savings: amount,
        },
      });

      console.log("✅ Wallet deposit completed:", {
        member: member.name,
        memberId,
        amount,
        reference,
        newBalance: balanceAfter,
      });

      // Emit socket events for real-time updates
      if (app && app.get("io")) {
        const io = app.get("io");
        console.log(
          "🔔 Emitting payment:completed event to all connected clients"
        );
        console.log("🔔 Event data:", {
          memberId: memberId.toString(),
          type: "wallet_deposit",
          amount,
        });

        // Emit to ALL clients (broadcast)
        io.emit("payment:completed", {
          memberId: memberId.toString(),
          payment: {
            _id: payment._id.toString(),
            amount: payment.amount,
            status: payment.status,
          },
          amount,
          type: "wallet_deposit",
        });

        io.emit("saving:new", {
          memberId: memberId.toString(),
          saving: savingRecord,
          member: member.name,
        });

        // Emit savingDeposit event for admin dashboard
        console.log("🔔 Emitting savingDeposit event for admin");
        io.emit("savingDeposit", {
          memberId: memberId.toString(),
          member: member.name,
          amount,
          newBalance: balanceAfter,
        });

        console.log("✅ All Socket.IO events emitted successfully");
      } else {
        console.error("⚠️ Socket.IO not available - events not emitted");
      }
    } else if (status.status === "failed" || status.status === "cancelled") {
      // Only treat as truly failed if we got a definitive FAILED status from Lipia
      // Not if it's just an API error
      if (status.success !== false) {
        const payment = await Payment.findByIdAndUpdate(
          paymentId,
          {
            status: "failed",
            notes:
              status.resultDescription ||
              status.message ||
              "Payment cancelled or failed",
          },
          { new: true }
        );

        console.log("❌ Payment definitively failed:", {
          reference,
          reason: status.resultDescription || status.message,
        });

        // Emit socket event for failed payment
        if (app && app.get("io")) {
          app.get("io").emit("payment:failed", {
            paymentId,
            memberId,
            message:
              status.resultDescription ||
              status.message ||
              "Payment cancelled or failed",
          });
        }
      } else {
        // It's an API error, keep polling
        console.log(
          "⚠️ API error but not treating as payment failure, continuing..."
        );
        setTimeout(
          () =>
            pollLipiaPaymentStatus(
              paymentId,
              checkoutRequestId,
              reference,
              memberId,
              amount,
              app,
              attempts + 1
            ),
          2000 // Wait 2 seconds before retrying after error
        );
      }
    } else {
      // Still pending, poll again after 1 second
      setTimeout(
        () =>
          pollLipiaPaymentStatus(
            paymentId,
            checkoutRequestId,
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
          checkoutRequestId,
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

    console.log("🔍 Checking payment status for:", checkoutRequestId);

    // Find payment by checkout request ID
    const payment = await Payment.findOne({
      checkout_request_id: checkoutRequestId,
    });

    if (!payment) {
      console.log(
        "⚠️ Payment not found for checkout request ID:",
        checkoutRequestId
      );
      return res.json({
        status: "pending",
        message: "Payment record not found, still processing...",
      });
    }

    console.log("✅ Payment found:", {
      id: payment._id,
      status: payment.status,
      amount: payment.amount,
      notes: payment.notes,
    });

    res.json({
      status: payment.status,
      message:
        payment.status === "completed"
          ? "Payment successful"
          : payment.status === "failed"
          ? payment.notes || "Payment failed"
          : "Processing payment...",
      payment,
    });
  } catch (error) {
    console.error("❌ Error checking payment status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint - check latest wallet deposits
router.get("/debug/latest-deposits", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const payments = await Payment.find({
      member_id: userId,
      type: "wallet_deposit",
    })
      .sort({ created_at: -1 })
      .limit(5);

    res.json({
      success: true,
      count: payments.length,
      payments: payments.map((p) => ({
        _id: p._id,
        amount: p.amount,
        status: p.status,
        reference: p.transaction_reference,
        checkout_id: p.checkout_request_id,
        notes: p.notes,
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lipia Online webhook/callback endpoint
router.post("/lipia-callback", async (req, res) => {
  try {
    console.log(
      "📥 Lipia callback received:",
      JSON.stringify(req.body, null, 2)
    );

    const { reference, status, amount, phone, mpesa_ref } = req.body;

    if (!reference) {
      return res
        .status(400)
        .json({ success: false, error: "Reference is required" });
    }

    // Find payment by transaction reference
    const payment = await Payment.findOne({ transaction_reference: reference });

    if (!payment) {
      console.log("⚠️ Payment not found for reference:", reference);
      return res.json({ success: false, error: "Payment not found" });
    }

    console.log(
      "✅ Found payment:",
      payment._id,
      "Current status:",
      payment.status
    );

    // Only process if payment is still pending
    if (payment.status !== "pending") {
      console.log("⚠️ Payment already processed with status:", payment.status);
      return res.json({ success: true, message: "Already processed" });
    }

    // Update payment based on callback status
    if (
      status === "SUCCESS" ||
      status === "success" ||
      status === "completed"
    ) {
      console.log("✅ Payment successful, updating records...");

      payment.status = "completed";
      payment.mpesa_transaction_id = mpesa_ref || reference;
      await payment.save();

      // If this is a wallet deposit, create Saving record
      if (payment.type === "wallet_deposit") {
        const Saving = (await import("../models/Saving.js")).default;
        const Member = (await import("../models/Member.js")).default;

        const member = await Member.findById(payment.member_id);
        const lastSaving = await Saving.findOne({
          member_id: payment.member_id,
        }).sort({ created_at: -1 });
        const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
        const balanceAfter = balanceBefore + payment.amount;

        const savingRecord = await Saving.create({
          member_id: payment.member_id,
          amount: payment.amount,
          transaction_type: "deposit",
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          status: "completed",
          payment_method: "mpesa",
          transaction_ref: mpesa_ref || reference,
          notes: `Wallet deposit via M-Pesa - ${reference}`,
        });

        // Update member's total_savings
        await Member.findByIdAndUpdate(payment.member_id, {
          $inc: { total_savings: payment.amount },
        });

        console.log("✅ Wallet deposit completed via callback:", {
          member: member.name,
          amount: payment.amount,
          newBalance: balanceAfter,
        });

        // Emit Socket.IO events
        const io = req.app.get("io");
        if (io) {
          io.emit("payment:completed", {
            memberId: payment.member_id.toString(),
            payment: {
              _id: payment._id,
              amount: payment.amount,
              status: "completed",
            },
            amount: payment.amount,
            type: "wallet_deposit",
          });

          io.emit("saving:new", {
            memberId: payment.member_id.toString(),
            saving: savingRecord,
            member: member.name,
          });

          io.emit("savingDeposit", {
            memberId: payment.member_id.toString(),
            amount: payment.amount,
          });
        }
      }

      return res.json({
        success: true,
        message: "Payment processed successfully",
      });
    } else {
      console.log("❌ Payment failed via callback");
      payment.status = "failed";
      payment.notes = `Payment failed: ${status}`;
      await payment.save();

      // Emit failure event
      const io = req.app.get("io");
      if (io) {
        io.emit("payment:failed", {
          paymentId: payment._id,
          memberId: payment.member_id,
          message: "Payment failed",
        });
      }

      return res.json({ success: true, message: "Payment marked as failed" });
    }
  } catch (error) {
    console.error("❌ Error processing Lipia callback:", error);
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

// Manual payment completion endpoint (for debugging/testing)
router.post("/manual-complete/:paymentId", protect, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, error: "Payment not found" });
    }

    if (payment.status === "completed") {
      return res.json({ success: true, message: "Payment already completed" });
    }

    console.log("🔧 Manually completing payment:", paymentId);

    // Mark as completed
    payment.status = "completed";
    payment.mpesa_transaction_id = payment.transaction_reference;
    await payment.save();

    // If wallet deposit, create Saving record
    if (payment.type === "wallet_deposit") {
      const Saving = (await import("../models/Saving.js")).default;
      const Member = (await import("../models/Member.js")).default;

      const member = await Member.findById(payment.member_id);
      const lastSaving = await Saving.findOne({
        member_id: payment.member_id,
      }).sort({ created_at: -1 });
      const balanceBefore = lastSaving ? lastSaving.balance_after : 0;
      const balanceAfter = balanceBefore + payment.amount;

      const savingRecord = await Saving.create({
        member_id: payment.member_id,
        amount: payment.amount,
        transaction_type: "deposit",
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "completed",
        payment_method: "mpesa",
        transaction_ref: payment.mpesa_transaction_id,
        notes: `Manual wallet deposit completion - ${payment.transaction_reference}`,
      });

      await Member.findByIdAndUpdate(payment.member_id, {
        $inc: {
          total_contributed: payment.amount,
          total_savings: payment.amount,
        },
      });

      // Emit events
      const io = req.app.get("io");
      if (io) {
        io.emit("payment:completed", {
          memberId: payment.member_id,
          payment,
          amount: payment.amount,
          type: "wallet_deposit",
        });

        io.emit("saving:new", {
          memberId: payment.member_id.toString(),
          saving: savingRecord,
          member: member.name,
        });
      }
    }

    res.json({ success: true, message: "Payment completed manually", payment });
  } catch (error) {
    console.error("Error manually completing payment:", error);
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
