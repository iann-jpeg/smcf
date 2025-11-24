import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Cycle from "../models/Cycle.js";
import Member from "../models/Member.js";
import Payment from "../models/Payment.js";

const router = express.Router();

// Get current active cycle
router.get("/current", protect, async (req, res) => {
  try {
    let cycle = await Cycle.findOne({ status: "active" })
      .populate("next_recipient", "name phone member_id position")
      .sort({ cycle_number: -1 });

    if (!cycle) {
      // Create first cycle if none exists
      const totalMembers = await Member.countDocuments();
      const nextRecipient = await Member.findOne().sort({ position: 1 });

      cycle = await Cycle.create({
        cycle_number: 1,
        start_date: new Date(),
        end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        status: "active",
        total_members: totalMembers,
        next_recipient: nextRecipient?._id,
      });

      cycle = await cycle.populate(
        "next_recipient",
        "name phone member_id position"
      );
    }

    // Calculate real-time stats
    const payments = await Payment.find({
      cycle_number: cycle.cycle_number,
      status: "completed",
    });

    const paidMembersCount = new Set(
      payments.map((p) => p.member_id.toString())
    ).size;
    const totalAmountCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(cycle.end_date);
    const daysLeft = Math.max(
      0,
      Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
    );

    res.json({
      success: true,
      data: {
        ...cycle.toObject(),
        paid_members_count: paidMembersCount,
        total_amount_collected: totalAmountCollected,
        days_left: daysLeft,
        expected_amount: cycle.total_members * 204,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all cycles
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const cycles = await Cycle.find()
      .populate("next_recipient", "name phone member_id")
      .sort({ cycle_number: -1 });
    res.json({ success: true, data: cycles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start new cycle (admin only)
router.post("/start", protect, adminOnly, async (req, res) => {
  try {
    // Complete current cycle
    const currentCycle = await Cycle.findOne({ status: "active" });
    if (currentCycle) {
      currentCycle.status = "completed";
      await currentCycle.save();
    }

    // Determine next recipient
    const lastRecipientPosition = currentCycle?.next_recipient
      ? (await Member.findById(currentCycle.next_recipient))?.position || 0
      : 0;

    const nextRecipient = await Member.findOne({
      position: { $gt: lastRecipientPosition },
      status: "active",
    }).sort({ position: 1 });

    // If no next recipient, cycle back to first member
    const recipient =
      nextRecipient ||
      (await Member.findOne({ status: "active" }).sort({ position: 1 }));

    const totalMembers = await Member.countDocuments({ status: "active" });
    const newCycleNumber = (currentCycle?.cycle_number || 0) + 1;

    const newCycle = await Cycle.create({
      cycle_number: newCycleNumber,
      start_date: new Date(),
      end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      status: "active",
      total_members: totalMembers,
      next_recipient: recipient?._id,
    });

    // Reset all members payment status
    await Member.updateMany(
      {},
      { payment_status: "pending", payment_date: null }
    );

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("cycle:new", newCycle);
    }

    res.status(201).json({ success: true, data: newCycle });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get cycle statistics
router.get("/:cycleNumber/stats", protect, async (req, res) => {
  try {
    const cycleNumber = parseInt(req.params.cycleNumber);
    const cycle = await Cycle.findOne({ cycle_number: cycleNumber }).populate(
      "next_recipient",
      "name phone member_id"
    );

    if (!cycle) {
      return res.status(404).json({ success: false, error: "Cycle not found" });
    }

    const payments = await Payment.find({
      cycle_number: cycleNumber,
      status: "completed",
    }).populate("member_id", "name phone member_id");

    const paidMembers = new Set(payments.map((p) => p.member_id._id.toString()))
      .size;
    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        cycle,
        payments,
        stats: {
          paid_members: paidMembers,
          pending_members: cycle.total_members - paidMembers,
          total_collected: totalCollected,
          expected_amount: cycle.total_members * 204,
          collection_percentage: (
            (paidMembers / cycle.total_members) *
            100
          ).toFixed(1),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
