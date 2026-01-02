import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Loan from "../models/Loan.js";
import Payment from "../models/Payment.js";
import { initiateLipiaPayment } from "../services/lipiaService.js";

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

    // Check if payment amount exceeds remaining balance
    const currentRemaining = loan.amount_remaining || loan.total_repayable;
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

    // Create pending payment record
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
    });
  } catch (error) {
    console.error("Error processing loan repayment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
