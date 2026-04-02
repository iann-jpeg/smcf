
import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Loan from "../models/Loan.js";
import LoanTermsAcceptance from "../models/LoanTermsAcceptance.js";
import LoanGuarantor from "../models/LoanGuarantor.js";
import Payment from "../models/Payment.js";
import { initiateLipiaPayment } from "../services/lipiaService.js";
import { calculateLateFeeForLoan, applyLateFees } from "../services/lateFeesService.js";

const router = express.Router();

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

// Get all loans with calculated late fees
router.get("/", protect, async (req, res) => {
  try {
    const loans = await Loan.find()
      .populate("member_id", "name phone member_id")
      .populate("approved_by", "name role")
      .sort({ created_at: -1 });
    
    // Add calculated late fee info and guarantor status to each loan
    const loansWithLateFees = await Promise.all(loans.map(async (loan) => {
      const loanObj = loan.toObject();
      const lateFeeInfo = calculateLateFeeForLoan(loan);
      
      // Get guarantor information for this loan
      const guarantors = await LoanGuarantor.find({ loan_id: loan._id })
        .populate("guarantor_id", "name phone member_id");
      
      const guarantorSummary = {
        total: guarantors.length,
        accepted: guarantors.filter(g => g.status === "accepted").length,
        pending: guarantors.filter(g => g.status === "pending").length,
        declined: guarantors.filter(g => g.status === "declined").length,
        details: guarantors.map(g => ({
          id: g._id,
          guarantor_id: g.guarantor_id?._id,
          guarantor_name: g.guarantor_id?.name,
          guarantor_phone: g.guarantor_id?.phone,
          guarantor_member_id: g.guarantor_id?.member_id,
          status: g.status,
          accepted_at: g.accepted_at,
          declined_at: g.declined_at,
          decline_reason: g.decline_reason,
        })),
      };
      
      console.log(`Loan ${loan._id} guarantor info:`, guarantorSummary);
      
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
        guarantors: guarantorSummary,
      };
    }));
    
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
    
    // Get guarantor information
    const guarantors = await LoanGuarantor.find({ loan_id: req.params.id })
      .populate("guarantor_id", "name phone member_id total_savings");
    
    const guarantorSummary = {
      total: guarantors.length,
      accepted: guarantors.filter(g => g.status === "accepted").length,
      pending: guarantors.filter(g => g.status === "pending").length,
      declined: guarantors.filter(g => g.status === "declined").length,
      details: guarantors.map(g => ({
        id: g._id,
        guarantor_id: g.guarantor_id?._id,
        guarantor_name: g.guarantor_id?.name,
        guarantor_phone: g.guarantor_id?.phone,
        guarantor_member_id: g.guarantor_id?.member_id,
        guarantor_savings: g.guarantor_id?.total_savings,
        status: g.status,
        accepted_at: g.accepted_at,
        declined_at: g.declined_at,
        decline_reason: g.decline_reason,
        liability_amount: g.liability_amount,
      })),
    };
    
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
        guarantors: guarantorSummary,
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

// Accept loan terms and conditions (member)
router.post("/accept-terms", protect, async (req, res) => {
  try {
    const { policyVersion, userAgent } = req.body;

    if (!req.member || !req.member._id) {
      return res.status(401).json({
        success: false,
        error: "Not authorized: valid member token required.",
      });
    }

    // Get IP address from request
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
    const cleanIp = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress.split(',')[0].trim();

    // Create acceptance record
    const acceptance = await LoanTermsAcceptance.createAcceptance({
      memberId: req.member._id,
      policyVersion: policyVersion || "SMCF-LOAN-POLICY-2026-01",
      ipAddress: cleanIp,
      userAgent: userAgent || req.headers['user-agent'] || 'unknown',
      memberName: req.member.name,
      memberPhone: req.member.phone,
    });

    res.status(201).json({ 
      success: true, 
      message: "Terms accepted successfully",
      data: {
        acceptanceId: acceptance._id,
        acceptedAt: acceptance.accepted_at,
      }
    });
  } catch (error) {
    console.error("Error accepting terms:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request loan (member) - now requires terms acceptance
router.post("/request", protect, async (req, res) => {
  try {
    const { amount, purpose, interest_rate, termsAcceptanceId, guarantor_ids } = req.body;

    if (!req.member || !req.member._id) {
      return res.status(401).json({
        success: false,
        error: "Not authorized: valid member token required. Please log in again.",
      });
    }

    // Verify terms have been accepted
    if (!termsAcceptanceId) {
      return res.status(400).json({
        success: false,
        error: "Terms and conditions must be accepted before submitting loan application.",
      });
    }

    // Verify the acceptance record exists and belongs to this member
    const acceptance = await LoanTermsAcceptance.findOne({
      _id: termsAcceptanceId,
      member_id: req.member._id,
      is_valid: true,
    });

    if (!acceptance) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired terms acceptance. Please accept terms again.",
      });
    }

    const loan = await Loan.create({
      member_id: req.member._id,
      amount,
      purpose,
      interest_rate: interest_rate || 0,
      status: "pending",
    });

    // Link the acceptance to this loan
    acceptance.loan_id = loan._id;
    await acceptance.save();

    console.log(`📋 Loan created: ${loan._id}, Amount: ${amount}, Guarantors provided: ${guarantor_ids ? guarantor_ids.length : 0}`);

    // Handle guarantors if provided
    if (guarantor_ids && Array.isArray(guarantor_ids) && guarantor_ids.length > 0) {
      console.log(`✍️ Adding ${guarantor_ids.length} guarantors to loan ${loan._id}`);
      
      // Check for self-selection
      if (guarantor_ids.includes(req.member._id.toString())) {
        await Loan.findByIdAndDelete(loan._id);
        return res.status(400).json({
          success: false,
          error: "Cannot select yourself as guarantor",
        });
      }

      // Validate guarantor savings requirements (minimum KES 500)
      const MIN_GUARANTOR_SAVINGS = 500;
      const Member = (await import("../models/Member.js")).default;
      
      for (const guarantor_id of guarantor_ids) {
        const guarantorMember = await Member.findById(guarantor_id);
        if (!guarantorMember) {
          await Loan.findByIdAndDelete(loan._id);
          return res.status(400).json({
            success: false,
            error: `Guarantor not found: ${guarantor_id}`,
          });
        }
        
        const guarantorSavings = guarantorMember.total_savings || 0;
        if (guarantorSavings < MIN_GUARANTOR_SAVINGS) {
          await Loan.findByIdAndDelete(loan._id);
          return res.status(400).json({
            success: false,
            error: `Guarantor ${guarantorMember.name} has insufficient savings. Minimum required: KES ${MIN_GUARANTOR_SAVINGS}, Current: KES ${guarantorSavings}`,
          });
        }
      }

      // Calculate liability amount per guarantor (equal split)
      const liabilityPerGuarantor = loan.amount / guarantor_ids.length;
      const LEGAL_DECLARATION = `I understand and accept that I am jointly and severally liable for the repayment of this loan under the Laws of Kenya. In the event of borrower default, I may be subject to recovery action including deduction from my savings account. This agreement is governed by the Law of Contract Act (Cap 23) and constitutes a legally binding electronic signature.`;

      let createdGuarantorsCount = 0;
      
      for (const guarantor_id of guarantor_ids) {
        try {
          // Create guarantor record
          const guarantor = await LoanGuarantor.create({
            loan_id: loan._id,
            borrower_id: req.member._id,
            guarantor_id,
            liability_amount: liabilityPerGuarantor,
            policy_version: "1.0",
            legal_acceptance_text: LEGAL_DECLARATION,
          });

          console.log(`✅ Created guarantor record for ${guarantor_id} on loan ${loan._id}`);
          createdGuarantorsCount++;

          // Update exposure pending count
          const GuarantorExposure = (await import("../models/GuarantorExposure.js")).default;
          await GuarantorExposure.updateExposure(guarantor_id);
        } catch (error) {
          console.error(`❌ Error creating guarantor record for ${guarantor_id}:`, error);
        }
      }

      if (createdGuarantorsCount > 0) {
        // Update loan to require guarantor approval
        loan.requires_guarantor_approval = true;
        loan.guarantor_approval_pending = true;
        await loan.save();
        console.log(`🔒 Loan ${loan._id} now requires guarantor approval (${createdGuarantorsCount} guarantors added)`);
      }
    }

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
    console.error("Loan request error:", error);
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
      // First, check if this loan requires guarantor approval
      const loan = await Loan.findById(req.params.id);
      if (!loan) {
        return res.status(404).json({ success: false, error: "Loan not found" });
      }

      // Check if loan requires guarantor approval
      if (loan.requires_guarantor_approval) {
        // Get all guarantors for this loan
        const guarantors = await LoanGuarantor.find({ loan_id: req.params.id });
        
        if (guarantors.length === 0) {
          return res.status(400).json({
            success: false,
            error: "This loan requires guarantors but none have been added yet.",
          });
        }

        // Check if all guarantors have accepted
        const allAccepted = guarantors.every((g) => g.status === "accepted");
        const pendingCount = guarantors.filter((g) => g.status === "pending").length;
        const declinedCount = guarantors.filter((g) => g.status === "declined").length;

        if (!allAccepted) {
          return res.status(400).json({
            success: false,
            error: `Cannot approve loan: ${pendingCount} guarantor(s) pending, ${declinedCount} guarantor(s) declined. All guarantors must accept before approval.`,
            guarantor_summary: {
              total: guarantors.length,
              accepted: guarantors.filter((g) => g.status === "accepted").length,
              pending: pendingCount,
              declined: declinedCount,
            },
          });
        }
      }

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
      // First, check if this loan requires guarantor approval
      const loan = await Loan.findById(req.params.id);
      if (!loan) {
        return res.status(404).json({ success: false, error: "Loan not found" });
      }

      // Check if loan requires guarantor approval
      if (loan.requires_guarantor_approval) {
        // Get all guarantors for this loan
        const guarantors = await LoanGuarantor.find({ loan_id: req.params.id });
        
        if (guarantors.length === 0) {
          return res.status(400).json({
            success: false,
            error: "This loan requires guarantors but none have been added yet.",
          });
        }

        // Check if all guarantors have accepted
        const allAccepted = guarantors.every((g) => g.status === "accepted");
        const pendingCount = guarantors.filter((g) => g.status === "pending").length;
        const declinedCount = guarantors.filter((g) => g.status === "declined").length;

        if (!allAccepted) {
          return res.status(400).json({
            success: false,
            error: `Cannot approve loan: ${pendingCount} guarantor(s) pending, ${declinedCount} guarantor(s) declined. All guarantors must accept before approval.`,
            guarantor_summary: {
              total: guarantors.length,
              accepted: guarantors.filter((g) => g.status === "accepted").length,
              pending: pendingCount,
              declined: declinedCount,
            },
          });
        }
      }

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
    const { amount, phone } = req.body;
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
    const { lateFee: pendingLateFee, totalLateFees } = calculateLateFeeForLoan(loan);
    // Total due is principal + interest + all late fees
    const baseRepayable = loan.interest_rate > 0
      ? loan.amount + (loan.amount * loan.interest_rate) / 100
      : loan.amount;
    // Track late fees paid (if not present, default to 0)
    const lateFeesPaid = loan.late_fees_paid || 0;
    // Track principal/interest paid (if not present, default to 0)
    const principalPaid = loan.amount_paid || 0;
    // Calculate remaining principal/interest and late fees separately
    const principalRemaining = baseRepayable - principalPaid;
    const lateFeesRemaining = totalLateFees - lateFeesPaid;
    // Members can pay any remaining principal/interest or late fees
    const currentRemaining = principalRemaining + lateFeesRemaining;
    if (amount > currentRemaining) {
      return res.status(400).json({
        success: false,
        error: `Payment amount (KES ${amount}) exceeds remaining balance (KES ${currentRemaining})`,
      });
    }

    // Generate unique reference
    const reference = `LOAN-${Date.now()}-${payerId}`;

    // Get payer's phone number - use provided phone or fallback to loan member's phone
    const payerPhone = phone || loan.member_id.phone || loan.member_id.phoneNumber;
    if (!payerPhone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required for payment",
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

    // Calculate totalDue for response (principal + interest + all late fees)
    const totalDue = baseRepayable + totalLateFees;
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
