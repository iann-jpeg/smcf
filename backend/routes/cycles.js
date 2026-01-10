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

      // Official cycle start date: January 5, 2026
      const cycleStartDate = new Date('2026-01-05T00:00:00.000Z');
      const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from start

      cycle = await Cycle.create({
        cycle_number: 1,
        start_date: cycleStartDate,
        end_date: cycleEndDate,
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
        expected_amount: cycle.total_members * 224,
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
    const { recipient_id, member_number } = req.body;

    // Complete current cycle
    const currentCycle = await Cycle.findOne({ status: "active" });
    if (currentCycle) {
      currentCycle.status = "completed";
      await currentCycle.save();
    }

    let recipient;

    // If specific recipient_id or member_number provided, use that
    if (recipient_id) {
      recipient = await Member.findById(recipient_id);
    } else if (member_number) {
      recipient = await Member.findOne({ member_id: member_number });
    } else {
      // Determine next recipient automatically
      const lastRecipientPosition = currentCycle?.next_recipient
        ? (await Member.findById(currentCycle.next_recipient))?.position || 0
        : 0;

      const nextRecipient = await Member.findOne({
        position: { $gt: lastRecipientPosition },
        status: "active",
      }).sort({ position: 1 });

      // If no next recipient, cycle back to first member
      recipient =
        nextRecipient ||
        (await Member.findOne({ status: "active" }).sort({ position: 1 }));
    }

    if (!recipient) {
      return res.status(404).json({
        success: false,
        error: "No recipient found",
      });
    }

    const totalMembers = await Member.countDocuments({ status: "active" });
    const newCycleNumber = (currentCycle?.cycle_number || 0) + 1;

    // Calculate start date based on cycle number
    // First cycle starts on January 5, 2026, subsequent cycles are 5 days apart
    const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
    const cycleStartDate = new Date(firstCycleStart.getTime() + ((newCycleNumber - 1) * 5 * 24 * 60 * 60 * 1000));
    const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);

    const newCycle = await Cycle.create({
      cycle_number: newCycleNumber,
      start_date: cycleStartDate,
      end_date: cycleEndDate,
      status: "active",
      total_members: totalMembers,
      next_recipient: recipient._id,
    });

    // Reset all members payment status
    // For each member, check if they have already paid for the new cycle
    const allMembers = await Member.find({});
    for (const member of allMembers) {
      // Count completed payments for the new cycle
      const paymentCount = await Payment.countDocuments({
        member_id: member._id,
        cycle_number: newCycleNumber,
        status: "completed"
      });
      if (paymentCount > 0) {
        await Member.updateOne({ _id: member._id }, { payment_status: "paid", payment_date: new Date() });
      } else {
        await Member.updateOne({ _id: member._id }, { payment_status: "pending", payment_date: null });
      }
    }

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("cycle:new", newCycle);
    }

    const populatedCycle = await newCycle.populate(
      "next_recipient",
      "name phone member_id position"
    );

    res.status(201).json({ success: true, data: populatedCycle });
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
          expected_amount: cycle.total_members * 224,
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

// Delete all cycles (admin only - for system reset)
router.delete("/", protect, adminOnly, async (req, res) => {
  try {
    await Cycle.deleteMany({});
    res.json({ success: true, message: "All cycles deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
