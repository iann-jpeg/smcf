// Delete a single loan by ID (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const loan = await Loan.findByIdAndDelete(req.params.id);
    if (!loan) {
      return res.status(404).json({ success: false, error: 'Loan not found' });
    }
    // Emit Socket.IO event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('loanDeleted', {
        loanId: req.params.id,
        memberId: loan.member_id,
        status: loan.status,
        timestamp: new Date(),
      });
    }
    res.json({ success: true, message: 'Loan deleted successfully', loanId: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Loan from "../models/Loan.js";
import Payment from "../models/Payment.js";
import { initiateLipiaPayment } from "../services/lipiaService.js";
import { calculateLateFeeForLoan, applyLateFees } from "../services/lateFeesService.js";

const router = express.Router();

// Get all loans with calculated late fees
router.get("/", protect, async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("member_id", "name phone member_id")
      .populate("approved_by", "name role")
      .sort({ created_at: -1 });
    
    // Add calculated late fee info to each loan
    const loansWithLateFees = loans.map(loan => {
      const loanObj = loan.toObject();
      const lateFeeInfo = calculateLateFeeForLoan(loan);
      return {
        ...loanObj,
        pending_late_fee: lateFeeInfo.lateFee,
        total_late_fees: lateFeeInfo.totalLateFees,
        days_overdue: lateFeeInfo.daysOverdue,
        is_overdue: lateFeeInfo.isOverdue,
        late_fee_daily_rate: lateFeeInfo.dailyRate,
        // Current total including pending late fees
        current_total_due: (loanObj.total_repayable || 0) + (lateFeeInfo.lateFee || 0),
        current_remaining: (loanObj.amount_remaining || 0) + (lateFeeInfo.lateFee || 0),
      };
    });
    
    res.json(loansWithLateFees);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single loan with detailed payment info
router.get("/:id", protect, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate("member_id", "name phone member_id")
      .populate("approved_by", "name role");
    
    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan not found" });
    }
    
    const loanObj = loan.toObject();
    const lateFeeInfo = calculateLateFeeForLoan(loan);
    
    res.json({
      success: true,
      data: {
        ...loanObj,
        pending_late_fee: lateFeeInfo.lateFee,
        total_late_fees: lateFeeInfo.totalLateFees,
        days_overdue: lateFeeInfo.daysOverdue,
        is_overdue: lateFeeInfo.isOverdue,
        late_fee_daily_rate: lateFeeInfo.dailyRate,
        current_total_due: (loanObj.total_repayable || 0) + (lateFeeInfo.lateFee || 0),
        current_remaining: (loanObj.amount_remaining || 0) + (lateFeeInfo.lateFee || 0),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Manually apply late fees to all overdue loans
router.post("/admin/apply-late-fees", protect, adminOnly, async (req, res) => {
  try {
    const result = await applyLateFees();
    
    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("lateFeesApplied", {
        processedCount: result.processedCount,
        totalFees: result.totalFees,
        timestamp: new Date(),
      });
    }
    
    res.json({
      success: true,
      message: result.processedCount > 0 
        ? `Late fees applied to ${result.processedCount} loans. Total: KES ${result.totalFees}`
        : "No overdue loans requiring late fee application",
      ...result
    });
  } catch (error) {
    console.error("Error applying late fees:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request loan (member)
router.post("/request", protect, async (req, res) => {
  try {
    const { amount, purpose, interest_rate } = req.body;

    if (!req.member || !req.member._id) {
      return res.status(401).json({
        success: false,
        error: "Not authorized: valid member token required. Please log in again.",
      });
    }

    const loan = await Loan.create({
      member_id: req.member._id,
      amount,
      purpose,
      interest_rate: interest_rate || 0,
      status: "pending",
    });

    // Emit Socket.IO event for new loan request
    const io = req.app.get("io");
    if (io) {
      io.emit("loanRequest", {
        loanId: loan._id,
        member: {
          _id: req.member._id,
          name: req.member.name,
        },
        memberName: req.member.name,
        amount: loan.amount,
        purpose: loan.purpose,
        timestamp: new Date(),
      });
    }

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

// Approve/Reject loan (admin only) - supports both PUT and PATCH
router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, rejection_reason, notes } = req.body; // 'approved', 'rejected', 'disbursed', 'repaid'

    const updateData = { status };

    if (status === "approved") {
      updateData.approved_by = req.admin._id;
      updateData.approval_date = new Date();
    } else if (status === "rejected") {
      if (rejection_reason) {
        updateData.rejection_reason = rejection_reason;
      }
    } else if (status === "disbursed") {
      updateData.disbursement_date = new Date();
      // Generate PDF receipt for disbursement
      try {
        const loan = await Loan.findById(req.params.id).populate("member_id");
        if (loan) {
          // Prepare receipt data
          const receiptData = {
            transactionId: loan._id.toString(),
            date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
            fromName: req.admin?.name || "Admin",
            fromAccount: req.admin?._id?.toString() || "-",
            toName: loan.member_id?.name || "-",
            toPhone: loan.member_id?.phone || "-",
            amount: loan.amount,
            category: "Loan Disbursement",
            subCategory: loan.purpose || "-",
          };
          const { generateLoanReceiptPDF } = await import("../services/receiptService.js");
          const pdfPath = await generateLoanReceiptPDF(receiptData);
          updateData.notes = (updateData.notes ? updateData.notes + "\n" : "") + `Receipt: ${pdfPath}`;
        }
      } catch (err) {
        console.error("Failed to generate loan receipt PDF:", err);
      }
    } else if (status === "repaid") {
      updateData.repayment_date = new Date();
    }
    
    // Save notes if provided
    if (notes) {
      updateData.notes = notes;
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

    // Try to extract receipt path from notes if present
    let receiptPath = null;
    if (loan && loan.notes && loan.notes.includes('Receipt:')) {
      const match = loan.notes.match(/Receipt: (.*\.pdf)/);
      if (match) receiptPath = match[1];
    }
    res.json({ success: true, data: loan, receipt: receiptPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH method alias for loan status updates (for ApprovalsTab compatibility)
router.patch("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, rejection_reason, notes } = req.body;

    const updateData = { status };

    if (status === "approved") {
      updateData.approved_by = req.admin._id;
      updateData.approval_date = new Date();
    } else if (status === "rejected") {
      if (rejection_reason) {
        updateData.rejection_reason = rejection_reason;
      }
    } else if (status === "disbursed") {
      updateData.disbursement_date = new Date();
    } else if (status === "repaid") {
      updateData.repayment_date = new Date();
    }
    
    if (notes) {
      updateData.notes = notes;
    }

    const loan = await Loan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      populate: { path: "member_id", select: "name phone member_id" },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan not found" });
    }

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

// Make partial loan repayment with STK Push (member or admin)
router.post("/:id/repay", protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const loanId = req.params.id;
    const payerId = req.member ? req.member._id : req.admin._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount",
      });
    }

    const loan = await Loan.findById(loanId).populate("member_id", "name phone phoneNumber member_id");
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


    // Calculate up-to-date late fees (pending + accrued)
    const { lateFee: pendingLateFee, totalLateFees } = require("../services/lateFeesService.js").calculateLateFeeForLoan(loan);
    // Total due is principal + interest + all late fees
    const baseRepayable = loan.interest_rate > 0
      ? loan.amount + (loan.amount * loan.interest_rate) / 100
      : loan.amount;
    const totalDue = baseRepayable + totalLateFees;
    // Remaining = total due - paid so far
    const currentRemaining = totalDue - (loan.amount_paid || 0);
    if (amount > currentRemaining) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (KES ${amount}) exceeds remaining balance (KES ${currentRemaining})`,
      });
    }

    // Generate unique reference
    const reference = `LOAN-${Date.now()}-${payerId}`;

    // Get payer's phone number
    const payerPhone = loan.member_id.phone || loan.member_id.phoneNumber;
    if (!payerPhone) {
      return res.status(400).json({
        success: false,
        error: "Member phone number not found",
      });
    }

    // Initiate STK Push payment via Lipia
    const lipiaResult = await initiateLipiaPayment(
      payerPhone,
      amount,
      reference,
      `SMCF Loan Repayment - ${loan.member_id.name}`
    );

    if (!lipiaResult.success) {
      return res.status(400).json({
        success: false,
        error: lipiaResult.error,
        responseDescription: lipiaResult.responseDescription,
      });
    }

    // Calculate how much of this payment goes to late fees vs principal/interest
    let lateFeePortion = 0;
    let principalPortion = 0;
    let lateFeesOutstanding = totalLateFees - (loan.late_fees_paid || 0);
    if (lateFeesOutstanding > 0) {
      if (amount >= lateFeesOutstanding) {
        lateFeePortion = lateFeesOutstanding;
        principalPortion = amount - lateFeesOutstanding;
      } else {
        lateFeePortion = amount;
        principalPortion = 0;
      }
    } else {
      lateFeePortion = 0;
      principalPortion = amount;
    }

    // Create pending payment record (track late fee portion)
    const payment = await Payment.create({
      member_id: loan.member_id._id,
      paid_by: payerId,
      amount: amount,
      phone: payerPhone,
      payment_method: "lipia",
      type: "loan_repayment",
      status: "pending",
      mpesa_transaction_id: reference,
      checkout_request_id: lipiaResult.checkoutRequestID,
      merchant_request_id: lipiaResult.merchantRequestID,
      notes: `Loan repayment for loan ID: ${loanId}`,
      date: new Date(),
      late_fee_portion: lateFeePortion,
    });

    // Return STK push details for polling
    res.json({
      success: true,
      message: lipiaResult.customerMessage || `STK Push sent to ${payerPhone}. Please enter your M-Pesa PIN.`,
      ResponseCode: lipiaResult.responseCode,
      ResponseDescription: lipiaResult.responseDescription,
      CheckoutRequestID: lipiaResult.checkoutRequestID,
      TransactionReference: lipiaResult.checkoutRequestID,
      MerchantRequestID: lipiaResult.merchantRequestID,
      CustomerMessage: lipiaResult.customerMessage,
      paymentId: payment._id,
      loanId: loanId,
      amount: amount,
      remaining: currentRemaining - amount,
      lateFeePortion,
      principalPortion,
      totalLateFees,
      totalDue,
    });
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
