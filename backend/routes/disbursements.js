import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Cycle from "../models/Cycle.js";
import Disbursement from "../models/Disbursement.js";
import Member from "../models/Member.js";

const router = express.Router();

// Get all disbursements
router.get("/", protect, async (req, res) => {
  try {
    const disbursements = await Disbursement.find()
      .populate("recipient_id", "name phone member_id")
      .populate("cycle_id", "cycle_number")
      .populate("initiated_by", "name")
      .sort({ disbursement_date: -1 })
      .limit(100);
    res.json(disbursements);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get disbursements for specific cycle
router.get("/cycle/:cycleNumber", protect, async (req, res) => {
  try {
    const cycle = await Cycle.findOne({ cycle_number: req.params.cycleNumber });
    if (!cycle) {
      return res.status(404).json({ success: false, error: "Cycle not found" });
    }

    const disbursements = await Disbursement.find({ cycle_id: cycle._id })
      .populate("recipient_id", "name phone member_id")
      .populate("initiated_by", "name")
      .sort({ disbursement_date: -1 });

    res.json(disbursements);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process disbursement (admin only)
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { recipient_id, amount, phone, notes, cycle_number } = req.body;

    // Validate inputs
    if (!recipient_id || !amount || !phone) {
      return res.status(400).json({
        success: false,
        error: "Recipient, amount, and phone are required",
      });
    }

    // Get current cycle
    let cycle;
    if (cycle_number) {
      cycle = await Cycle.findOne({ cycle_number });
    } else {
      cycle = await Cycle.findOne({ status: "active" });
    }

    if (!cycle) {
      return res.status(404).json({
        success: false,
        error: "No active cycle found",
      });
    }

    // Check if all members have paid - calculate from actual completed payments
    const Payment = (await import("../models/Payment.js")).default;
    
    // Get all members (not just active, since we count all in frontend)
    const allMembers = await Member.find();
    const totalMembers = allMembers.length;
    
    console.log("🔍 Disbursement validation for cycle #" + cycle.cycle_number);
    console.log("   Total members:", totalMembers);
    
    // Get ALL completed payments (regardless of cycle_number for now)
    const allCompletedPayments = await Payment.find({
      status: "completed",
    });
    
    console.log("   All completed payments:", allCompletedPayments.length);
    
    // Count unique members who have made completed payments
    const uniquePaidMembers = new Set(
      allCompletedPayments.map((p) => {
        const memberId = p.member_id?._id || p.member_id;
        return memberId ? memberId.toString() : null;
      }).filter(id => id !== null)
    ).size;
    
    console.log("   Unique paid members (all payments):", uniquePaidMembers);
    console.log("   Cycle stored count:", cycle.paid_members_count);
    console.log("   Validation result:", uniquePaidMembers >= totalMembers ? "✅ PASS" : "❌ FAIL");
    
    // Validate that enough members have paid
    if (uniquePaidMembers < totalMembers) {
      console.error(`❌ Not enough members paid: ${uniquePaidMembers}/${totalMembers}`);
      return res.status(400).json({
        success: false,
        error: `Cannot disburse - only ${uniquePaidMembers}/${totalMembers} members have paid`,
        details: {
          paid: uniquePaidMembers,
          total: totalMembers,
          cycleNumber: cycle.cycle_number,
          paymentsFound: allCompletedPayments.length,
        }
      });
    }
    
    console.log("✅ All members have paid, proceeding with disbursement");

    // Create disbursement record
    const disbursement = await Disbursement.create({
      cycle_id: cycle._id,
      recipient_id,
      amount,
      phone,
      status: "processing",
      initiated_by: req.user._id,
      notes,
    });

    // In production, integrate with M-Pesa B2C API here
    // For now, mark as completed
    disbursement.status = "completed";
    disbursement.mpesa_transaction_id = `DISB${Date.now()}`;
    await disbursement.save();

    // Update cycle to completed
    cycle.status = "completed";
    cycle.disbursement_date = new Date();
    await cycle.save();

    // Update recipient member record
    await Member.findByIdAndUpdate(recipient_id, {
      $inc: { total_received: amount },
      last_payout_date: new Date(),
      last_payout_amount: amount,
      disbursement_status: "received",
    });

    console.log("🔄 Current cycle completed, starting new cycle...");

    // ===== AUTO-START NEW CYCLE =====
    // Find next recipient in the queue
    const currentRecipient = await Member.findById(recipient_id);
    const currentPosition = currentRecipient?.position || 0;

    // Get next member by position
    let nextRecipient = await Member.findOne({
      position: { $gt: currentPosition },
      status: "active",
    }).sort({ position: 1 });

    // If no next recipient, cycle back to first member
    if (!nextRecipient) {
      nextRecipient = await Member.findOne({ status: "active" }).sort({ position: 1 });
    }

    if (!nextRecipient) {
      console.error("❌ No next recipient found for new cycle");
      return res.status(500).json({
        success: false,
        error: "Disbursement recorded but failed to start new cycle - no recipients available"
      });
    }

    // Create new cycle
    const newCycleNumber = cycle.cycle_number + 1;
    const newCycle = await Cycle.create({
      cycle_number: newCycleNumber,
      start_date: new Date(),
      end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      status: "active",
      total_members: totalMembers,
      next_recipient: nextRecipient._id,
      paid_members_count: 0,
      total_amount_collected: 0,
    });

    // Reset all members' payment status for new cycle
    await Member.updateMany(
      {},
      { 
        payment_status: "pending", 
        payment_date: null,
        amount: 0
      }
    );

    console.log(`✅ New cycle #${newCycleNumber} started with recipient: ${nextRecipient.name}`);

    // Emit socket events for real-time updates
    if (req.app.get("io")) {
      req.app.get("io").emit("disbursement:new", disbursement);
      req.app.get("io").emit("cycle:completed", cycle);
      req.app.get("io").emit("cycle:new", newCycle);
      req.app.get("io").emit("cycle:updated", newCycle);
    }

    const populatedDisbursement = await Disbursement.findById(disbursement._id)
      .populate("recipient_id", "name phone member_id")
      .populate("cycle_id", "cycle_number")
      .populate("initiated_by", "name");

    const populatedNewCycle = await Cycle.findById(newCycle._id)
      .populate("next_recipient", "name phone member_id position");

    res.status(201).json({ 
      success: true, 
      data: populatedDisbursement,
      newCycle: populatedNewCycle,
      message: `Disbursement completed and Cycle #${newCycleNumber} started with ${nextRecipient.name} as recipient`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update disbursement status (admin only)
router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, mpesa_transaction_id } = req.body;

    const disbursement = await Disbursement.findByIdAndUpdate(
      req.params.id,
      { status, mpesa_transaction_id },
      { new: true }
    )
      .populate("recipient_id", "name phone member_id")
      .populate("cycle_id", "cycle_number");

    if (!disbursement) {
      return res
        .status(404)
        .json({ success: false, error: "Disbursement not found" });
    }

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("disbursement:updated", disbursement);
    }

    res.json({ success: true, data: disbursement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all disbursements (admin only - for system reset)
router.delete("/", protect, adminOnly, async (req, res) => {
  try {
    await Disbursement.deleteMany({});
    res.json({ success: true, message: "All disbursements deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
