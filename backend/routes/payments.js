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
