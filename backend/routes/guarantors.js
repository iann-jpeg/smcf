import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import LoanGuarantor from "../models/LoanGuarantor.js";
import GuarantorExposure from "../models/GuarantorExposure.js";
import Loan from "../models/Loan.js";
import Member from "../models/Member.js";
import Saving from "../models/Saving.js";

const router = express.Router();

// CONFIGURATION CONSTANTS
const MIN_GUARANTORS_REQUIRED = 2;
const MAX_LOANS_TO_GUARANTEE = 5;
const GUARANTEE_CAPACITY_MULTIPLIER = 3; // 3x savings balance
const MIN_SAVINGS_BALANCE = 500; // Minimum savings to be a guarantor (KES 500)

// Legal declaration text (Kenyan Law compliant)
const LEGAL_DECLARATION = `I understand and accept that I am jointly and severally liable for the repayment of this loan under the Laws of Kenya. In the event of borrower default, I may be subject to recovery action including deduction from my savings account. This agreement is governed by the Law of Contract Act (Cap 23) and constitutes a legally binding electronic signature.`;

// ===== ELIGIBILITY VALIDATION =====

// Check if member is eligible to be a guarantor
router.post("/validate-guarantor", protect, async (req, res) => {
  try {
    const { guarantor_id, loan_amount } = req.body;

    if (!guarantor_id || !loan_amount) {
      return res.status(400).json({
        success: false,
        error: "Guarantor ID and loan amount are required",
      });
    }

    const member = await Member.findById(guarantor_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    // Check 1: Member must be active
    if (member.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "Member is not active",
        code: "INACTIVE_MEMBER",
      });
    }

    // Check 2: Get member savings balance
    const savingsBalance = member.total_savings || 0;

    if (savingsBalance < MIN_SAVINGS_BALANCE) {
      return res.status(400).json({
        success: false,
        error: `Guarantor must have minimum savings of KES ${MIN_SAVINGS_BALANCE}`,
        code: "INSUFFICIENT_SAVINGS",
      });
    }

    // Check 3: Get or create guarantor exposure
    let exposure = await GuarantorExposure.findOne({ guarantor_id });
    if (!exposure) {
      exposure = await GuarantorExposure.create({
        guarantor_id,
        max_guarantee_capacity: GuarantorExposure.calculateMaxCapacity(savingsBalance),
      });
    } else {
      // Update max capacity based on current savings
      exposure.max_guarantee_capacity = GuarantorExposure.calculateMaxCapacity(savingsBalance);
      await exposure.save();
    }

    // Check 4: Blacklist check
    if (exposure.is_blacklisted) {
      return res.status(400).json({
        success: false,
        error: `Guarantor is blacklisted: ${exposure.blacklist_reason}`,
        code: "BLACKLISTED",
      });
    }

    // Check 5: Check active guarantee count
    if (exposure.active_guarantee_count >= MAX_LOANS_TO_GUARANTEE) {
      return res.status(400).json({
        success: false,
        error: `Guarantor has reached maximum of ${MAX_LOANS_TO_GUARANTEE} active guarantees`,
        code: "MAX_GUARANTEES_REACHED",
      });
    }

    // Check 6: Check if guarantor has capacity for this amount
    const requiredCapacity = loan_amount / MIN_GUARANTORS_REQUIRED; // Assume equal split
    const availableCapacity = exposure.max_guarantee_capacity - exposure.total_guaranteed_amount;

    if (availableCapacity < requiredCapacity) {
      return res.status(400).json({
        success: false,
        error: `Guarantor has insufficient capacity. Available: KES ${availableCapacity.toFixed(2)}, Required: KES ${requiredCapacity.toFixed(2)}`,
        code: "INSUFFICIENT_CAPACITY",
      });
    }

    // Check 7: Check for pending defaults
    const pendingDefaults = await Loan.countDocuments({
      guarantors: guarantor_id,
      status: "defaulted",
      "guarantor_recovery.status": { $ne: "fully_recovered" },
    });

    if (pendingDefaults > 0) {
      return res.status(400).json({
        success: false,
        error: "Guarantor has unresolved loan defaults",
        code: "PENDING_DEFAULT",
      });
    }

    // All checks passed
    res.json({
      success: true,
      eligible: true,
      guarantor: {
        id: member._id,
        name: member.name,
        member_id: member.member_id,
        phone: member.phone,
        savings_balance: savingsBalance,
        current_exposure: exposure.total_guaranteed_amount,
        available_capacity: availableCapacity,
        active_guarantees: exposure.active_guarantee_count,
        risk_score: exposure.risk_score,
      },
    });
  } catch (error) {
    console.error("Guarantor validation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of eligible guarantors for borrower
router.get("/eligible-guarantors", protect, async (req, res) => {
  try {
    const { loan_amount } = req.query;
    const borrowerId = req.user._id;

    if (!loan_amount) {
      return res.status(400).json({
        success: false,
        error: "Loan amount is required",
      });
    }

    // Get all active members except the borrower
    const members = await Member.find({
      _id: { $ne: borrowerId },
      status: "active",
    });

    const eligibleGuarantors = [];

    for (const member of members) {
      // Get savings balance
      const savingsBalance = member.total_savings || 0;

      // Get exposure
      let exposure = await GuarantorExposure.findOne({
        guarantor_id: member._id,
      });
      if (!exposure) {
        exposure = await GuarantorExposure.create({
          guarantor_id: member._id,
          max_guarantee_capacity: GuarantorExposure.calculateMaxCapacity(savingsBalance),
        });
      }

      // Calculate capacities
      const availableCapacity = exposure.max_guarantee_capacity - exposure.total_guaranteed_amount;
      const requiredCapacity = parseFloat(loan_amount) / MIN_GUARANTORS_REQUIRED;

      // Check eligibility and reasons for ineligibility
      let is_eligible = true;
      const ineligibility_reasons = [];

      if (savingsBalance < MIN_SAVINGS_BALANCE) {
        is_eligible = false;
        ineligibility_reasons.push(`Insufficient savings (Min: KES ${MIN_SAVINGS_BALANCE})`);
      }

      if (exposure.is_blacklisted) {
        is_eligible = false;
        ineligibility_reasons.push(`Blacklisted: ${exposure.blacklist_reason || 'Default record'}`);
      }

      if (exposure.active_guarantee_count >= MAX_LOANS_TO_GUARANTEE) {
        is_eligible = false;
        ineligibility_reasons.push(`Max guarantees reached (${MAX_LOANS_TO_GUARANTEE})`);
      }

      if (availableCapacity < requiredCapacity) {
        is_eligible = false;
        ineligibility_reasons.push(`Insufficient capacity (Available: KES ${availableCapacity.toFixed(0)})`);
      }

      eligibleGuarantors.push({
        id: member._id,
        name: member.name,
        member_id: member.member_id,
        phone: member.phone,
        savings_balance: savingsBalance,
        current_exposure: exposure.total_guaranteed_amount,
        available_capacity: availableCapacity,
        active_guarantees: exposure.active_guarantee_count,
        is_eligible,
        ineligibility_reasons,
        risk_score: exposure.risk_score,
      });
    }

    // Sort by available capacity (descending)
    eligibleGuarantors.sort((a, b) => b.available_capacity - a.available_capacity);

    res.json({
      success: true,
      guarantors: eligibleGuarantors,
      config: {
        min_required: MIN_GUARANTORS_REQUIRED,
        max_loans_to_guarantee: MAX_LOANS_TO_GUARANTEE,
        min_savings_balance: MIN_SAVINGS_BALANCE,
      },
    });
  } catch (error) {
    console.error("Get eligible guarantors error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== LOAN APPLICATION WITH GUARANTORS =====

// Add guarantors to loan application
router.post("/add-to-loan", protect, async (req, res) => {
  try {
    const { loan_id, guarantor_ids } = req.body;

    if (!loan_id || !guarantor_ids || !Array.isArray(guarantor_ids)) {
      return res.status(400).json({
        success: false,
        error: "Loan ID and guarantor IDs array are required",
      });
    }

    if (guarantor_ids.length < MIN_GUARANTORS_REQUIRED) {
      return res.status(400).json({
        success: false,
        error: `Minimum ${MIN_GUARANTORS_REQUIRED} guarantors required`,
      });
    }

    // Get loan
    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: "Loan not found",
      });
    }

    // Verify loan belongs to requester
    if (loan.member_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Loan must be in pending state
    if (loan.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Can only add guarantors to pending loans",
      });
    }

    // Check for self-selection
    if (guarantor_ids.includes(req.user._id.toString())) {
      return res.status(400).json({
        success: false,
        error: "Cannot select yourself as guarantor",
      });
    }

    // Calculate liability amount per guarantor (equal split)
    const liabilityPerGuarantor = loan.amount / guarantor_ids.length;

    const createdGuarantors = [];
    const errors = [];

    for (const guarantor_id of guarantor_ids) {
      try {
        // Validate guarantor
        const validation = await fetch(
          `${req.protocol}://${req.get("host")}/api/guarantors/validate-guarantor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.authorization,
            },
            body: JSON.stringify({
              guarantor_id,
              loan_amount: loan.amount,
            }),
          }
        );

        if (!validation.ok) {
          const result = await validation.json();
          errors.push({
            guarantor_id,
            error: result.error,
          });
          continue;
        }

        // Create guarantor record
        const guarantor = await LoanGuarantor.create({
          loan_id,
          borrower_id: req.user._id,
          guarantor_id,
          liability_amount: liabilityPerGuarantor,
          policy_version: "1.0",
          legal_acceptance_text: LEGAL_DECLARATION,
        });

        createdGuarantors.push(guarantor);

        // Update exposure pending count
        await GuarantorExposure.updateExposure(guarantor_id);
      } catch (error) {
        errors.push({
          guarantor_id,
          error: error.message,
        });
      }
    }

    if (createdGuarantors.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No guarantors could be added",
        errors,
      });
    }

    // Update loan status
    loan.requires_guarantor_approval = true;
    loan.guarantor_approval_pending = true;
    await loan.save();

    res.json({
      success: true,
      message: `${createdGuarantors.length} guarantor(s) added successfully`,
      guarantors: createdGuarantors,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Add guarantors error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GUARANTOR ACTIONS =====

// Get guarantor notifications (loans they need to approve)
router.get("/my-guarantor-requests", protect, async (req, res) => {
  try {
    const guarantorId = req.user._id;
    console.log(`Fetching guarantor requests for user: ${guarantorId}`);

    const requests = await LoanGuarantor.find({
      guarantor_id: guarantorId,
      status: "pending",
    })
      .populate("borrower_id", "name member_id phone")
      .populate("loan_id")
      .sort({ created_at: -1 });

    console.log(`Found ${requests.length} pending guarantor requests for user ${guarantorId}`);

    res.json({
      success: true,
      requests,
      count: requests.length,
    });
  } catch (error) {
    console.error("Get guarantor requests error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Accept guarantor responsibility
router.post("/accept/:guarantor_record_id", protect, async (req, res) => {
  try {
    const { guarantor_record_id } = req.params;
    const ip_address = req.ip || req.connection.remoteAddress;

    const guarantor = await LoanGuarantor.findById(guarantor_record_id);
    if (!guarantor) {
      return res.status(404).json({
        success: false,
        error: "Guarantor record not found",
      });
    }

    // Verify guarantor is the requester
    if (guarantor.guarantor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (guarantor.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Guarantor request already processed",
      });
    }

    // Update status
    guarantor.status = "accepted";
    guarantor.accepted_at = new Date();
    guarantor.ip_address = ip_address;
    await guarantor.save();

    // Update exposure
    await GuarantorExposure.updateExposure(guarantor.guarantor_id);

    // Check if all guarantors have accepted
    const allGuarantors = await LoanGuarantor.find({
      loan_id: guarantor.loan_id,
    });
    const allAccepted = allGuarantors.every((g) => g.status === "accepted");

    if (allAccepted) {
      // Update loan status
      const loan = await Loan.findById(guarantor.loan_id);
      if (loan) {
        loan.guarantor_approval_pending = false;
        loan.all_guarantors_accepted = true;
        await loan.save();
      }
    }

    res.json({
      success: true,
      message: "Guarantor responsibility accepted",
      guarantor,
      all_accepted: allAccepted,
    });
  } catch (error) {
    console.error("Accept guarantor error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Decline guarantor responsibility
router.post("/decline/:guarantor_record_id", protect, async (req, res) => {
  try {
    const { guarantor_record_id } = req.params;
    const { reason } = req.body;

    const guarantor = await LoanGuarantor.findById(guarantor_record_id);
    if (!guarantor) {
      return res.status(404).json({
        success: false,
        error: "Guarantor record not found",
      });
    }

    // Verify guarantor is the requester
    if (guarantor.guarantor_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (guarantor.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Guarantor request already processed",
      });
    }

    // Update status
    guarantor.status = "declined";
    guarantor.declined_at = new Date();
    guarantor.decline_reason = reason || "No reason provided";
    await guarantor.save();

    // Update exposure
    await GuarantorExposure.updateExposure(guarantor.guarantor_id);

    res.json({
      success: true,
      message: "Guarantor responsibility declined",
      guarantor,
    });
  } catch (error) {
    console.error("Decline guarantor error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guarantor's profile (loans guaranteed, exposure, etc.)
router.get("/my-profile", protect, async (req, res) => {
  try {
    const guarantorId = req.user._id;
    console.log(`Fetching guarantor profile for user: ${guarantorId}`);

    // Get exposure
    let exposure = await GuarantorExposure.findOne({ guarantor_id: guarantorId });
    if (!exposure) {
      exposure = await GuarantorExposure.create({
        guarantor_id: guarantorId,
        max_guarantee_capacity: 0,
      });
    }

    // Get all guarantees
    const guarantees = await LoanGuarantor.find({ guarantor_id: guarantorId })
      .populate("loan_id")
      .populate("borrower_id", "name member_id phone")
      .sort({ created_at: -1 });

    console.log(`Found ${guarantees.length} total guarantees for user ${guarantorId}`);

    // Get savings balance
    const guarantor = await Member.findById(guarantorId);
    const savingsBalance = guarantor?.total_savings || 0;

    res.json({
      success: true,
      profile: {
        exposure,
        guarantees,
        savings_balance: savingsBalance,
        max_capacity: GuarantorExposure.calculateMaxCapacity(savingsBalance),
      },
    });
  } catch (error) {
    console.error("Get guarantor profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all guarantors for a loan (admin)
router.get("/loan/:loan_id", protect, adminOnly, async (req, res) => {
  try {
    const { loan_id } = req.params;

    const guarantors = await LoanGuarantor.find({ loan_id })
      .populate("guarantor_id")
      .populate("borrower_id", "name member_id phone");

    // Enrich with savings balance
    const enrichedGuarantors = await Promise.all(
      guarantors.map(async (g) => {
        const exposure = await GuarantorExposure.findOne({
          guarantor_id: g.guarantor_id._id,
        });

        return {
          ...g.toObject(),
          savings_balance: g.guarantor_id.total_savings || 0,
          exposure: exposure || null,
        };
      })
    );

    res.json({
      success: true,
      guarantors: enrichedGuarantors,
    });
  } catch (error) {
    console.error("Get loan guarantors error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guarantor profile (admin)
router.get("/profile/:guarantor_id", protect, adminOnly, async (req, res) => {
  try {
    const { guarantor_id } = req.params;

    const member = await Member.findById(guarantor_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    const exposure = await GuarantorExposure.findOne({ guarantor_id });
    const guarantees = await LoanGuarantor.find({ guarantor_id })
      .populate("loan_id")
      .populate("borrower_id", "name member_id phone")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      profile: {
        member,
        exposure,
        guarantees,
        savings_balance: member.total_savings || 0,
      },
    });
  } catch (error) {
    console.error("Get guarantor profile error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process default recovery from guarantors (admin)
router.post("/process-recovery", protect, adminOnly, async (req, res) => {
  try {
    const { loan_id, recovery_type, custom_amounts } = req.body;
    // recovery_type: "equal" | "proportional" | "custom"

    if (!loan_id || !recovery_type) {
      return res.status(400).json({
        success: false,
        error: "Loan ID and recovery type are required",
      });
    }

    const loan = await Loan.findById(loan_id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: "Loan not found",
      });
    }

    if (loan.status !== "defaulted") {
      return res.status(400).json({
        success: false,
        error: "Loan must be in defaulted status",
      });
    }

    // Get all accepted guarantors
    const guarantors = await LoanGuarantor.find({
      loan_id,
      status: "accepted",
    });

    if (guarantors.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No accepted guarantors found",
      });
    }

    const outstandingAmount = loan.outstanding_balance || loan.amount;
    const recoveries = [];

    // Calculate recovery amounts
    for (const guarantor of guarantors) {
      let recoveryAmount = 0;

      switch (recovery_type) {
        case "equal":
          recoveryAmount = outstandingAmount / guarantors.length;
          break;
        case "proportional":
          recoveryAmount = guarantor.liability_amount;
          break;
        case "custom":
          if (custom_amounts && custom_amounts[guarantor.guarantor_id.toString()]) {
            recoveryAmount = custom_amounts[guarantor.guarantor_id.toString()];
          }
          break;
      }

      // Get guarantor member
      const guarantorMember = await Member.findById(guarantor.guarantor_id);

      if (!guarantorMember || guarantorMember.total_savings < recoveryAmount) {
        recoveries.push({
          guarantor_id: guarantor.guarantor_id,
          attempted_amount: recoveryAmount,
          recovered_amount: 0,
          status: "insufficient_funds",
        });
        continue;
      }

      // Deduct from savings
      const oldBalance = guarantorMember.total_savings;
      guarantorMember.total_savings -= recoveryAmount;
      await guarantorMember.save();

      // Create savings transaction record
      await Saving.create({
        member_id: guarantor.guarantor_id,
        amount: recoveryAmount,
        transaction_type: "withdrawal",
        balance_before: oldBalance,
        balance_after: guarantorMember.total_savings,
        status: "completed",
        payment_method: "auto_interest",
        notes: `Guarantor recovery for loan #${loan._id} (Borrower: ${loan.member_id})`,
      });

      // Update guarantor record
      guarantor.recovered_amount += recoveryAmount;
      guarantor.recovery_deductions.push({
        amount: recoveryAmount,
        date: new Date(),
        admin_id: req.user._id,
        notes: `${recovery_type} recovery`,
        remaining_balance: guarantor.liability_amount - guarantor.recovered_amount,
      });
      await guarantor.save();

      // Update exposure
      const exposure = await GuarantorExposure.findOne({
        guarantor_id: guarantor.guarantor_id,
      });
      if (exposure) {
        exposure.total_recovered_amount += recoveryAmount;

        // Add to default history
        const existingDefault = exposure.default_history.find(
          (d) => d.loan_id.toString() === loan_id.toString()
        );

        if (existingDefault) {
          existingDefault.recovered_amount += recoveryAmount;
          if (existingDefault.recovered_amount >= existingDefault.defaulted_amount) {
            existingDefault.status = "fully_recovered";
          } else {
            existingDefault.status = "partially_recovered";
          }
        } else {
          exposure.default_history.push({
            loan_id,
            borrower_id: loan.member_id,
            defaulted_amount: recoveryAmount,
            recovered_amount: recoveryAmount,
            defaulted_at: new Date(),
            status: "fully_recovered",
          });
        }

        await exposure.save();
        await GuarantorExposure.updateExposure(guarantor.guarantor_id);
      }

      recoveries.push({
        guarantor_id: guarantor.guarantor_id,
        attempted_amount: recoveryAmount,
        recovered_amount: recoveryAmount,
        status: "success",
      });
    }

    // Update loan
    const totalRecovered = recoveries.reduce((sum, r) => sum + r.recovered_amount, 0);
    loan.outstanding_balance = Math.max(0, outstandingAmount - totalRecovered);
    loan.guarantor_recovery_completed = true;
    loan.guarantor_recovery_amount = totalRecovered;
    await loan.save();

    res.json({
      success: true,
      message: "Recovery processed successfully",
      recoveries,
      total_recovered: totalRecovered,
      remaining_balance: loan.outstanding_balance,
    });
  } catch (error) {
    console.error("Process recovery error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Blacklist/unblacklist guarantor (admin)
router.put("/blacklist/:guarantor_id", protect, adminOnly, async (req, res) => {
  try {
    const { guarantor_id } = req.params;
    const { is_blacklisted, reason } = req.body;

    let exposure = await GuarantorExposure.findOne({ guarantor_id });
    if (!exposure) {
      exposure = await GuarantorExposure.create({
        guarantor_id,
        max_guarantee_capacity: 0,
      });
    }

    exposure.is_blacklisted = is_blacklisted;
    exposure.blacklist_reason = reason || "";
    exposure.blacklisted_at = is_blacklisted ? new Date() : null;
    await exposure.save();

    res.json({
      success: true,
      message: is_blacklisted ? "Guarantor blacklisted" : "Guarantor removed from blacklist",
      exposure,
    });
  } catch (error) {
    console.error("Blacklist guarantor error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get guarantor statistics (admin dashboard)
router.get("/stats", protect, adminOnly, async (req, res) => {
  try {
    const totalGuarantors = await Member.countDocuments({ status: "active" });
    const activeGuarantors = await GuarantorExposure.countDocuments({
      active_guarantee_count: { $gt: 0 },
    });
    const blacklistedGuarantors = await GuarantorExposure.countDocuments({
      is_blacklisted: true,
    });

    const totalExposure = await GuarantorExposure.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$total_guaranteed_amount" },
        },
      },
    ]);

    const pendingRequests = await LoanGuarantor.countDocuments({
      status: "pending",
    });

    res.json({
      success: true,
      stats: {
        total_guarantors: totalGuarantors,
        active_guarantors: activeGuarantors,
        blacklisted_guarantors: blacklistedGuarantors,
        total_exposure: totalExposure[0]?.total || 0,
        pending_requests: pendingRequests,
      },
    });
  } catch (error) {
    console.error("Get guarantor stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
