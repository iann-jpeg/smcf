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

    // Update cycle status
    cycle.disbursement_status = "completed";
    cycle.disbursement_date = new Date();
    cycle.recipient_id = recipient_id;
    cycle.status = "completed"; // Mark cycle as completed
    await cycle.save();

    // Update member record
    await Member.findByIdAndUpdate(recipient_id, {
      $inc: { total_received: amount },
      last_payout_date: new Date(),
      last_payout_amount: amount,
    });

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("disbursement:new", disbursement);
      req.app.get("io").emit("cycle:updated", cycle);
    }

    const populatedDisbursement = await Disbursement.findById(disbursement._id)
      .populate("recipient_id", "name phone member_id")
      .populate("cycle_id", "cycle_number")
      .populate("initiated_by", "name");

    // AUTOMATION: Start next cycle immediately after disbursement
    try {
      // Find the next recipient for the new cycle
      const lastRecipient = await Member.findById(recipient_id);
      const lastRecipientPosition = lastRecipient?.position || 0;
      const nextRecipient = await Member.findOne({
        position: { $gt: lastRecipientPosition },
        status: "active",
      }).sort({ position: 1 });
      const recipientForNextCycle = nextRecipient || (await Member.findOne({ status: "active" }).sort({ position: 1 }));
      const totalMembersActive = await Member.countDocuments({ status: "active" });
      const newCycleNumber = (cycle.cycle_number || 0) + 1;
      const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
      const cycleStartDate = new Date(firstCycleStart.getTime() + ((newCycleNumber - 1) * 5 * 24 * 60 * 60 * 1000));
      const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);
      const newCycle = await Cycle.create({
        cycle_number: newCycleNumber,
        start_date: cycleStartDate,
        end_date: cycleEndDate,
        status: "active",
        total_members: totalMembersActive,
        next_recipient: recipientForNextCycle?._id,
      });
      await Member.updateMany({}, { payment_status: "pending", payment_date: null });
      if (req.app.get("io")) {
        req.app.get("io").emit("cycle:new", newCycle);
      }
    } catch (err) {
      console.error("Failed to auto-start next cycle after disbursement:", err);
    }
    res.status(201).json({ success: true, data: populatedDisbursement });
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

    // If disbursement is completed, update cycle and start next cycle
    if (status === "completed") {
      const cycle = await Cycle.findById(disbursement.cycle_id);
      const recipient_id = disbursement.recipient_id._id || disbursement.recipient_id;
      
      if (cycle) {
        // Update cycle status
        cycle.disbursement_status = "completed";
        cycle.disbursement_date = new Date();
        cycle.recipient_id = recipient_id;
        cycle.status = "completed"; // Mark cycle as completed
        await cycle.save();

        // Update member record
        await Member.findByIdAndUpdate(recipient_id, {
          $inc: { total_received: disbursement.amount },
          last_payout_date: new Date(),
          last_payout_amount: disbursement.amount,
        });

        // AUTOMATION: Start next cycle immediately after disbursement
        try {
          // Find the next recipient for the new cycle
          const lastRecipient = await Member.findById(recipient_id);
          const lastRecipientPosition = lastRecipient?.position || 0;
          const nextRecipient = await Member.findOne({
            position: { $gt: lastRecipientPosition },
            status: "active",
          }).sort({ position: 1 });
          const recipientForNextCycle = nextRecipient || (await Member.findOne({ status: "active" }).sort({ position: 1 }));
          const totalMembers = await Member.countDocuments({ status: "active" });
          const newCycleNumber = (cycle.cycle_number || 0) + 1;
          const firstCycleStart = new Date('2026-01-05T00:00:00.000Z');
          const cycleStartDate = new Date(firstCycleStart.getTime() + ((newCycleNumber - 1) * 5 * 24 * 60 * 60 * 1000));
          const cycleEndDate = new Date(cycleStartDate.getTime() + 5 * 24 * 60 * 60 * 1000);
          const newCycle = await Cycle.create({
            cycle_number: newCycleNumber,
            start_date: cycleStartDate,
            end_date: cycleEndDate,
            status: "active",
            total_members: totalMembers,
            next_recipient: recipientForNextCycle?._id,
          });
          await Member.updateMany({}, { payment_status: "pending", payment_date: null });
          if (req.app.get("io")) {
            req.app.get("io").emit("cycle:new", newCycle);
            req.app.get("io").emit("cycle:updated", cycle);
          }
        } catch (err) {
          console.error("Failed to auto-start next cycle after disbursement:", err);
        }
      }
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

// Delete a specific disbursement (admin only)
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const disbursement = await Disbursement.findByIdAndDelete(req.params.id);
    
    if (!disbursement) {
      return res.status(404).json({ 
        success: false, 
        error: "Disbursement not found" 
      });
    }

    // Emit socket event
    if (req.app.get("io")) {
      req.app.get("io").emit("disbursement:deleted", { id: req.params.id });
    }

    res.json({ 
      success: true, 
      message: "Disbursement deleted successfully",
      data: disbursement
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
