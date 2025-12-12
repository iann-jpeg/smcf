import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Loan from "../models/Loan.js";

const router = express.Router();

// Get all loans
router.get("/", protect, async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("member_id", "name phone member_id")
      .populate("approved_by", "name role")
      .sort({ created_at: -1 });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request loan (member)
router.post("/request", protect, async (req, res) => {
  try {
    const { amount, purpose, interest_rate } = req.body;

    const memberId = req.member ? req.member._id : req.body.member_id;

    const loan = await Loan.create({
      member_id: memberId,
      amount,
      purpose,
      interest_rate: interest_rate || 0,
      status: "pending",
    });

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all loans (admin only)
router.delete("/", protect, adminOnly, async (req, res) => {
  try {
    const result = await Loan.deleteMany({});
    console.log(`🗑️ Cleared all loans: ${result.deletedCount} loans deleted`);

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.emit("loansCleared", {
        deletedCount: result.deletedCount,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `All loans cleared successfully. ${result.deletedCount} loans deleted.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing loans:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve/Reject loan (admin only)
router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body; // 'approved', 'rejected', 'disbursed', 'repaid'

    const updateData = { status };

    if (status === "approved") {
      updateData.approved_by = req.admin._id;
      updateData.approval_date = new Date();
    } else if (status === "disbursed") {
      updateData.disbursement_date = new Date();
    } else if (status === "repaid") {
      updateData.repayment_date = new Date();
    }

    const loan = await Loan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      populate: { path: "member_id", select: "name phone member_id" },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan not found" });
    }

    // Emit Socket.IO event for real-time updates
    const io = req.app.get("io");
    if (io && loan.member_id) {
      io.emit("loanStatusUpdated", {
        loanId: loan._id,
        memberId: loan.member_id._id,
        memberName: loan.member_id.name,
        status: loan.status,
        amount: loan.amount,
        rejectionReason: loan.rejection_reason || null,
        notes: loan.notes || null,
        timestamp: new Date(),
      });

      console.log(
        `📢 Loan status updated: ${loan.status} for member ${
          loan.member_id.name
        }${loan.rejection_reason ? ` - Reason: ${loan.rejection_reason}` : ""}`
      );
    }

    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Make partial loan repayment (member or admin)
router.post("/:id/repay", protect, async (req, res) => {
  try {
    const { amount, payment_method, transaction_ref, notes } = req.body;
    const loanId = req.params.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount",
      });
    }

    const loan = await Loan.findById(loanId).populate("member_id", "name phone member_id");
    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan not found" });
    }

    // Only allow repayment for disbursed loans
    if (loan.status !== "disbursed" && loan.status !== "repaid") {
      return res.status(400).json({
        success: false,
        error: "Loan must be disbursed before making repayments",
      });
    }

    // Check if payment amount exceeds remaining balance
    const currentRemaining = loan.amount_remaining || loan.total_repayable;
    if (amount > currentRemaining) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (KES ${amount}) exceeds remaining balance (KES ${currentRemaining})`,
      });
    }

    // Add payment to history
    loan.payment_history.push({
      amount,
      payment_date: new Date(),
      payment_method: payment_method || "cash",
      transaction_ref: transaction_ref || "",
      notes: notes || "",
    });

    // Update paid amount
    loan.amount_paid = (loan.amount_paid || 0) + amount;

    // Save will trigger pre-save hook to calculate remaining and update status
    await loan.save();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io && loan.member_id) {
      io.emit("loanPayment", {
        loanId: loan._id,
        memberId: loan.member_id._id,
        memberName: loan.member_id.name,
        paymentAmount: amount,
        totalPaid: loan.amount_paid,
        remaining: loan.amount_remaining,
        isFullyPaid: loan.status === "repaid",
        timestamp: new Date(),
      });

      console.log(
        `💰 Loan payment: KES ${amount} received from ${loan.member_id.name}. Total paid: KES ${loan.amount_paid}, Remaining: KES ${loan.amount_remaining}`
      );
    }

    res.json({
      success: true,
      message: loan.status === "repaid" 
        ? `Loan fully repaid! Total paid: KES ${loan.amount_paid}`
        : `Payment of KES ${amount} recorded. Remaining: KES ${loan.amount_remaining}`,
      data: {
        loan,
        paymentAmount: amount,
        totalPaid: loan.amount_paid,
        remaining: loan.amount_remaining,
        isFullyPaid: loan.status === "repaid",
        paymentsCount: loan.payment_history.length,
      },
    });
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
