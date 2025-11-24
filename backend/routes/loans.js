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

export default router;
