import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import Member from "../models/Member.js";
import Saving from "../models/Saving.js";
import TransactionFee from "../models/TransactionFee.js";
import { 
  calculateTransferFee, 
  calculateTopUpFee, 
  calculateWithdrawalFee,
  getFeeBreakdown 
} from "../services/feeService.js";
import { 
  checkMaturedDeposits, 
  getMaturityStats 
} from "../services/maturityCheckService.js";
import {
  calculateEarlyWithdrawalPenalty,
  getEarlyWithdrawalSettings,
  updateEarlyWithdrawalSettings,
} from "../services/earlyWithdrawalService.js";

const router = express.Router();

// Get member's wallet/savings summary
router.get("/summary", protect, async (req, res) => {
  try {
    const memberId = req.member ? req.member._id : req.admin._id;

    const member = await Member.findById(memberId).select(
      "savings_override total_savings wallet_balance"
    );
    const override = member?.savings_override;
    if (override?.is_enabled) {
      return res.json({
        success: true,
        data: {
          currentBalance: override.current_balance || 0,
          totalDeposits: override.total_deposits || 0,
          totalWithdrawals: override.total_withdrawals || 0,
          totalInterestEarned: override.total_interest_earned || 0,
          totalTransactionFees: override.total_transaction_fees || 0,
          totalLockedSavings: override.total_locked_savings || 0,
          transactionCount: 0,
          overrideApplied: true,
        },
      });
    }

    // Get all completed savings transactions for this member
    const transactions = await Saving.find({ 
      member_id: memberId,
      status: "completed"
    }).sort({
      created_at: -1,
    });

    // Calculate totals only from completed transactions
    const totalDeposits = transactions
      .filter((t) => t.transaction_type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter((t) => t.transaction_type === "withdrawal")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalInterestEarned = transactions
      .filter((t) => t.transaction_type === "interest")
      .reduce((sum, t) => sum + t.amount, 0);

    // Get total transaction fees for this member
    const TransactionFee = (await import("../models/TransactionFee.js")).default;
    const transactionFees = await TransactionFee.find({
      member_id: memberId,
      status: "collected"
    });
    const totalTransactionFees = transactionFees.reduce((sum, fee) => sum + fee.fee_amount, 0);

    // Calculate current balance from transaction history:
    // Current Balance = Total Deposits + Interest Earned - Withdrawals - Transaction Fees
    const currentBalance = totalDeposits + totalInterestEarned - totalWithdrawals - totalTransactionFees;

    console.log("📊 Wallet summary for member:", memberId);
    console.log("   Current Balance:", currentBalance);
    console.log("   Total Deposits:", totalDeposits);
    console.log("   Total Withdrawals:", totalWithdrawals);
    console.log("   Total Interest:", totalInterestEarned);
    console.log("   Total Transaction Fees:", totalTransactionFees);
    console.log("   Transaction Count:", transactions.length);

    res.json({
      success: true,
      data: {
        currentBalance,
        totalDeposits,
        totalWithdrawals,
        totalInterestEarned,
        totalTransactionFees,
        transactionCount: transactions.length,
        totalLockedSavings: 0,
        overrideApplied: false,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet summary:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get member's savings transactions
router.get("/transactions", protect, async (req, res) => {
  try {
    const memberId = req.member ? req.member._id : req.admin._id;
    const { limit = 50, page = 1 } = req.query;

    const transactions = await Saving.find({ member_id: memberId })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("processed_by", "name role");

    const total = await Saving.countDocuments({ member_id: memberId });

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get member's transaction fees
router.get("/fees", protect, async (req, res) => {
  try {
    const memberId = req.member ? req.member._id : req.admin._id;
    const { limit = 50 } = req.query;

    const TransactionFee = (await import("../models/TransactionFee.js")).default;

    // Get fees for this member
    const fees = await TransactionFee.find({ 
      member_id: memberId,
      status: "collected"
    })
      .populate("recipient_id", "name member_id")
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    // Calculate total fees paid by this member
    const totalFees = fees.reduce((sum, fee) => sum + fee.fee_amount, 0);

    res.json({
      success: true,
      data: {
        fees,
        totalFees,
        count: fees.length,
      },
    });
  } catch (error) {
    console.error("Error fetching member fees:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Make a deposit (member)
router.post("/deposit", protect, async (req, res) => {
  try {
    const { amount, payment_method, transaction_ref, notes, lock_period_months } = req.body;
    const memberId = req.member ? req.member._id : req.body.member_id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Calculate top-up fee
    const topUpFee = calculateTopUpFee(payment_method || "mpesa", amount);
    const netDeposit = amount - topUpFee; // Net amount credited to wallet

    if (netDeposit <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount too small after fee deduction",
      });
    }

    // Get current balance
    const lastTransaction = await Saving.findOne({ member_id: memberId }).sort({
      created_at: -1,
    });
    const currentBalance = lastTransaction ? lastTransaction.balance_after : 0;

    // Calculate unlock date if lock period is specified
    let unlockDate = null;
    const lockPeriod = lock_period_months || 0;
    if (lockPeriod > 0) {
      unlockDate = new Date();
      unlockDate.setMonth(unlockDate.getMonth() + lockPeriod);
    }

    // Create deposit transaction (only net amount after fee)
    const saving = await Saving.create({
      member_id: memberId,
      amount: netDeposit,
      transaction_type: "deposit",
      balance_before: currentBalance,
      balance_after: currentBalance + netDeposit,
      payment_method: payment_method || "mpesa",
      transaction_ref: transaction_ref || "",
      notes: notes ? `${notes}${topUpFee > 0 ? ` | Fee: KES ${topUpFee}` : ''}` : (topUpFee > 0 ? `Top-up fee: KES ${topUpFee}` : ''),
      status: "completed",
      lock_period_months: lockPeriod,
      unlock_date: unlockDate,
      maturity_status: lockPeriod > 0 ? "locked" : "none",
    });

    // Update member's total savings AND wallet_balance (net amount only)
    await Member.findByIdAndUpdate(memberId, {
      $inc: { 
        total_savings: netDeposit,
        wallet_balance: netDeposit 
      },
    });

    // Record top-up fee if applicable
    let feeRecord = null;
    if (topUpFee > 0) {
      feeRecord = await TransactionFee.create({
        transaction_type: "top_up",
        member_id: memberId,
        transaction_amount: amount,
        fee_amount: topUpFee,
        payment_method: payment_method || "mpesa",
        fee_description: `Top-up fee for ${payment_method || "mpesa"} deposit of KES ${amount.toLocaleString()}`,
        reference_id: saving._id.toString(),
        status: "collected",
      });
    }

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("savingDeposit", {
        memberId,
        amount: netDeposit,
        fee: topUpFee,
        grossAmount: amount,
        newBalance: currentBalance + netDeposit,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      data: saving,
      fee: topUpFee,
      grossAmount: amount,
      netAmount: netDeposit,
      message: `Deposit of KES ${amount.toLocaleString()} successful`,
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request withdrawal (member)
router.post("/withdraw", protect, async (req, res) => {
  try {
    const { amount, notes, account_name, account_number, bank_name } = req.body;
    const memberId = req.member ? req.member._id : req.body.member_id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Check for locked deposits that would prevent withdrawal
    const lockedDeposits = await Saving.find({
      member_id: memberId,
      transaction_type: "deposit",
      status: "completed",
      unlock_date: { $gt: new Date() }, // Still locked
    }).sort({ unlock_date: 1 });

    // Calculate total locked amount
    let totalLockedAmount = 0;
    let earliestUnlockDate = null;
    
    if (lockedDeposits.length > 0) {
      // Calculate locked amount by finding balance at each locked deposit
      for (const deposit of lockedDeposits) {
        totalLockedAmount += deposit.amount;
      }
      earliestUnlockDate = lockedDeposits[0].unlock_date;
    }

    // Calculate withdrawal fee to check if member can afford it
    const withdrawalFee = calculateWithdrawalFee(amount);
    const totalDeduction = amount + withdrawalFee;

    // Get current balance from most recent completed transaction
    const lastTransaction = await Saving.findOne({ 
      member_id: memberId,
      status: "completed" 
    }).sort({ created_at: -1 });
    const currentBalance = lastTransaction ? lastTransaction.balance_after : 0;

    // Calculate available (unlocked) balance
    const availableBalance = currentBalance - totalLockedAmount;

    // Check if member has enough total balance for withdrawal amount + fee
    if (currentBalance < totalDeduction) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Withdrawal: KES ${amount}, Fee: KES ${withdrawalFee}, Total needed: KES ${totalDeduction}, Your balance: KES ${currentBalance}`,
      });
    }

    // If withdrawal needs locked funds, ensure early withdrawal policy allows it.
    if (availableBalance < totalDeduction) {
      const settings = await getEarlyWithdrawalSettings();

      if (!settings.enabled) {
        let errorMessage = `Insufficient unlocked balance. Withdrawal: KES ${amount}, Fee: KES ${withdrawalFee}, Total needed: KES ${totalDeduction}, Available balance: KES ${availableBalance}`;

        if (totalLockedAmount > 0 && earliestUnlockDate) {
          errorMessage += ` | Locked funds: KES ${totalLockedAmount} (earliest unlock: ${earliestUnlockDate.toLocaleDateString()})`;
        }

        errorMessage += " | Early withdrawal is currently disabled by admin.";

        return res.status(400).json({
          success: false,
          error: errorMessage,
          lockedAmount: totalLockedAmount,
          availableBalance: availableBalance,
          earliestUnlockDate: earliestUnlockDate,
        });
      }
    }

    // Create withdrawal transaction (balance_after will be set when admin approves)
    const saving = await Saving.create({
      member_id: memberId,
      amount,
      transaction_type: "withdrawal",
      balance_before: currentBalance,
      balance_after: currentBalance, // Will be updated on approval to reflect actual deduction
      status: "pending", // Requires admin approval
      notes: notes ? `${notes} | Est. fee: KES ${withdrawalFee}` : `Estimated withdrawal fee: KES ${withdrawalFee}`,
      preferred_account_name: account_name || "",
      preferred_account_number: account_number || "",
      preferred_bank: bank_name || "",
    });

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("withdrawalRequest", {
        memberId,
        amount,
        savingId: saving._id,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      data: saving,
      message: "Withdrawal request submitted. Awaiting admin approval.",
    });
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DEPRECATED: Old withdrawal approval route - replaced by /admin/approve-withdrawal and /admin/reject-withdrawal
// This route is commented out to prevent duplicate TransactionFee creation
// Use the new routes in ApprovalsTab instead
/*
router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body; // 'completed' or 'failed'
    const savingId = req.params.id;

    const saving = await Saving.findById(savingId);
    if (!saving) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    if (saving.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Transaction has already been processed",
      });
    }

    // Handle withdrawal approval/rejection
    if (saving.transaction_type === "withdrawal") {
      if (status === "completed") {
        // Calculate withdrawal fee
        const withdrawalFee = calculateWithdrawalFee(saving.amount);
        const totalDeduction = saving.amount + withdrawalFee;

        // Get member to check balance
        const member = await Member.findById(saving.member_id);
        if (!member) {
          return res.status(404).json({
            success: false,
            error: "Member not found",
          });
        }

        // Get the actual current balance from most recent transaction (not wallet_balance field)
        const latestTransaction = await Saving.findOne({ 
          member_id: saving.member_id,
          status: "completed"
        }).sort({ created_at: -1 });
        const actualCurrentBalance = latestTransaction ? latestTransaction.balance_after : 0;

        // Check if member has enough balance for amount + fee
        if (actualCurrentBalance < totalDeduction) {
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. Current: KES ${actualCurrentBalance}. Withdrawal fee: KES ${withdrawalFee}. Total required: KES ${totalDeduction}`,
          });
        }

        // Deduct from member's total savings AND wallet_balance (amount + fee)
        // Also update total_transaction_fees if there's a fee
        await Member.findByIdAndUpdate(saving.member_id, {
          $inc: { 
            total_savings: -totalDeduction,
            wallet_balance: -totalDeduction,
            total_transaction_fees: withdrawalFee
          },
        });

        // Update saving record with correct balances and fee info
        saving.balance_before = actualCurrentBalance;
        saving.balance_after = actualCurrentBalance - totalDeduction;
        saving.notes = saving.notes 
          ? `${saving.notes}${withdrawalFee > 0 ? ` | Fee: KES ${withdrawalFee}` : ''}`
          : (withdrawalFee > 0 ? `Withdrawal fee: KES ${withdrawalFee}` : '');
        saving.status = "completed";
        saving.processed_by = req.admin._id;
        saving.processed_at = new Date();
        await saving.save();

        // Record withdrawal fee if applicable
        let feeRecord = null;
        if (withdrawalFee > 0) {
          feeRecord = await TransactionFee.create({
            transaction_type: "withdrawal",
            member_id: saving.member_id,
            transaction_amount: saving.amount,
            fee_amount: withdrawalFee,
            fee_description: `Withdrawal fee for KES ${saving.amount.toLocaleString()}`,
            reference_id: saving._id.toString(),
            status: "collected",
          });
        }

        console.log(`✅ Withdrawal approved: KES ${totalDeduction} (Amount: ${saving.amount} + Fee: ${withdrawalFee}) deducted from member ${saving.member_id}`);
      } else if (status === "failed") {
        // Revert the balance back to before withdrawal
        saving.balance_after = saving.balance_before;
        saving.status = "failed";
        saving.processed_by = req.admin._id;
        saving.processed_at = new Date();
        await saving.save();

        console.log(`❌ Withdrawal rejected: Balance restored for member ${saving.member_id}`);
      }
    } else {
      // For other transaction types, just update status
      saving.status = status;
      saving.processed_by = req.admin._id;
      saving.processed_at = new Date();
      await saving.save();
    }

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("withdrawalStatusUpdated", {
        savingId,
        memberId: saving.member_id,
        status,
        amount: saving.amount,
        newBalance: saving.balance_after,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      data: saving,
      message: `Withdrawal ${status}. ${status === 'completed' ? `KES ${saving.amount.toLocaleString()} deducted from wallet.` : 'Balance restored.'}`,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
*/

// Get all members' savings (admin only)
// Get all members savings summary (accessible to all authenticated users for top saver badge)
router.get("/all-members", protect, async (req, res) => {
  try {
    // Get all members with their savings data
    const members = await Member.find().select(
      "name member_id total_savings wallet_balance savings_override"
    );

    // Get savings summary for each member (only completed transactions)
    const membersWithSavings = await Promise.all(
      members.map(async (member) => {
        const override = member.savings_override;
        if (override?.is_enabled) {
          return {
            _id: member._id,
            name: member.name,
            member_id: member.member_id,
            totalDeposits: override.total_deposits || 0,
            overrideApplied: true,
          };
        }

        const transactions = await Saving.find({
          member_id: member._id,
          status: "completed",
        });

        const totalDeposits = transactions
          .filter((t) => t.transaction_type === "deposit")
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          _id: member._id,
          name: member.name,
          member_id: member.member_id,
          totalDeposits,
          overrideApplied: false,
        };
      })
    );

    res.json({
      success: true,
      data: membersWithSavings,
    });
  } catch (error) {
    console.error("Error fetching all members savings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    // Get all members with their savings data
    const members = await Member.find().select(
      "name member_id phone total_savings wallet_balance position savings_override"
    );

    // Get savings summary for each member (only completed transactions)
    const membersWithSavings = await Promise.all(
      members.map(async (member) => {
        const override = member.savings_override;
        if (override?.is_enabled) {
          const currentBalance = override.current_balance || 0;
          return {
            _id: member._id,
            name: member.name,
            member_id: member.member_id,
            phone: member.phone,
            position: member.position,
            currentBalance,
            totalDeposits: override.total_deposits || 0,
            totalWithdrawals: override.total_withdrawals || 0,
            totalInterestEarned: override.total_interest_earned || 0,
            totalTransactionFees: override.total_transaction_fees || 0,
            totalLockedSavings: override.total_locked_savings || 0,
            lockedDepositsCount: 0,
            earliestUnlockDate: null,
            lockPeriodDetails: [],
            lastTransaction: override.last_transaction || null,
            overrideApplied: true,
          };
        }

        const transactions = await Saving.find({
          member_id: member._id,
          status: "completed",
        }).sort({
          created_at: -1,
        });

        const totalDeposits = transactions
          .filter((t) => t.transaction_type === "deposit")
          .reduce((sum, t) => sum + t.amount, 0);

        const totalWithdrawals = transactions
          .filter((t) => t.transaction_type === "withdrawal")
          .reduce((sum, t) => sum + t.amount, 0);

        const totalInterestEarned = transactions
          .filter((t) => t.transaction_type === "interest")
          .reduce((sum, t) => sum + t.amount, 0);

        // Get total transaction fees for this member
        const TransactionFee = (await import("../models/TransactionFee.js")).default;
        const transactionFees = await TransactionFee.find({
          member_id: member._id,
          status: "collected"
        });
        const totalTransactionFees = transactionFees.reduce((sum, fee) => sum + fee.fee_amount, 0);

        // Calculate current balance from transaction history:
        // Current Balance = Total Deposits + Interest Earned - Withdrawals - Transaction Fees
        // Note: Fees are already deducted when withdrawals/transfers happen (balance_after includes fee deduction)
        // But to show accurate balance matching the actual wallet state, we need to account for them
        const currentBalance = totalDeposits + totalInterestEarned - totalWithdrawals - totalTransactionFees;

        // Calculate locked savings (deposits that haven't matured yet)
        const lockedDeposits = await Saving.find({
          member_id: member._id,
          transaction_type: "deposit",
          status: "completed",
          maturity_status: "locked",
          unlock_date: { $gt: new Date() }
        }).sort({ unlock_date: 1 }); // Sort by unlock date ascending
        
        const totalLockedSavings = lockedDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
        const lockedDepositsCount = lockedDeposits.length;
        const earliestUnlockDate = lockedDeposits.length > 0 ? lockedDeposits[0].unlock_date : null;
        
        // Get lock period details for display
        const lockPeriodDetails = lockedDeposits.map(deposit => ({
          amount: deposit.amount,
          lock_period_months: deposit.lock_period_months || 0,
          unlock_date: deposit.unlock_date,
          created_at: deposit.created_at
        }));

        return {
          _id: member._id,
          name: member.name,
          member_id: member.member_id,
          phone: member.phone,
          position: member.position,
          currentBalance,
          totalDeposits,
          totalWithdrawals,
          totalInterestEarned,
          totalTransactionFees,
          totalLockedSavings,
          lockedDepositsCount,
          earliestUnlockDate,
          lockPeriodDetails, // Include lock period information
          lastTransaction:
            transactions.length > 0 ? transactions[0].created_at : null,
          overrideApplied: false,
        };
      })
    );

    // Sort by current balance
    membersWithSavings.sort((a, b) => b.currentBalance - a.currentBalance);

    res.json({
      success: true,
      data: membersWithSavings,
    });
  } catch (error) {
    console.error("Error fetching all savings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending withdrawals (admin only)
router.get("/admin/pending-withdrawals", protect, adminOnly, async (req, res) => {
  try {
    const pendingWithdrawals = await Saving.find({
      transaction_type: "withdrawal",
      status: "pending",
    })
      .sort({ created_at: -1 })
      .populate("member_id", "name member_id phone");

    res.json({
      success: true,
      data: pendingWithdrawals,
    });
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin override for member savings display values
router.put("/admin/override/:memberId", protect, adminOnly, async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    const toNumber = (value) =>
      value === null || value === undefined || value === "" ? 0 : Number(value);

    const payload = {
      is_enabled: true,
      current_balance: Math.max(0, toNumber(req.body.currentBalance)),
      total_deposits: Math.max(0, toNumber(req.body.totalDeposits)),
      total_withdrawals: Math.max(0, toNumber(req.body.totalWithdrawals)),
      total_interest_earned: Math.max(0, toNumber(req.body.totalInterestEarned)),
      total_transaction_fees: Math.max(0, toNumber(req.body.totalTransactionFees)),
      total_locked_savings: Math.max(0, toNumber(req.body.totalLockedSavings)),
      last_transaction: req.body.lastTransaction ? new Date(req.body.lastTransaction) : new Date(),
      updated_at: new Date(),
    };

    member.savings_override = payload;
    member.total_savings = payload.current_balance;
    member.wallet_balance = payload.current_balance;

    await member.save();

    if (req.app.get("io")) {
      req.app.get("io").emit("saving:new", { memberId: member._id });
      req.app.get("io").emit("memberUpdated", member);
    }

    res.json({ success: true, data: member });
  } catch (error) {
    console.error("Error updating savings override:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve withdrawal (admin only)
router.post("/admin/approve-withdrawal/:id", protect, adminOnly, async (req, res) => {
  try {
    const savingId = req.params.id;

    const saving = await Saving.findById(savingId).populate("member_id", "name member_id phone wallet_balance");
    if (!saving) {
      return res.status(404).json({
        success: false,
        error: "Withdrawal request not found",
      });
    }

    if (saving.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Withdrawal has already been processed",
      });
    }

    if (saving.transaction_type !== "withdrawal") {
      return res.status(400).json({
        success: false,
        error: "This is not a withdrawal request",
      });
    }

    // Get member to check balance
    const member = await Member.findById(saving.member_id._id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    // Get the ACTUAL current balance from most recent completed transaction (not wallet_balance field)
    const latestTransaction = await Saving.findOne({ 
      member_id: saving.member_id._id,
      status: "completed"
    }).sort({ created_at: -1 });
    const actualCurrentBalance = latestTransaction ? latestTransaction.balance_after : 0;

    // Check if this is an early withdrawal from locked deposits
    const lockedDeposits = await Saving.find({
      member_id: saving.member_id._id,
      transaction_type: "deposit",
      status: "completed",
      unlock_date: { $gt: new Date() },
    }).sort({ created_at: 1 }); // FIFO

    const totalLockedAmount = lockedDeposits.reduce((sum, dep) => sum + (dep.amount || 0), 0);
    const unlockedBalanceAtApproval = Math.max(0, actualCurrentBalance - totalLockedAmount);
    const amountSubjectToEarlyPenalty = Math.max(0, saving.amount - unlockedBalanceAtApproval);

    let earlyWithdrawalPenalty = 0;
    let penaltyPercentage = 0;
    let penaltyReason = "";
    let isEarlyWithdrawal = false;
    const affectedDeposits = [];

    // Calculate early withdrawal penalty if applicable
    if (lockedDeposits.length > 0 && amountSubjectToEarlyPenalty > 0) {
      const { calculateEarlyWithdrawalPenalty, addToReserveAccount } = await import("../services/earlyWithdrawalService.js");
      
      let remainingAmount = amountSubjectToEarlyPenalty;

      for (const deposit of lockedDeposits) {
        if (remainingAmount <= 0) break;

        const amountFromThisDeposit = Math.min(remainingAmount, deposit.amount);
        const penaltyCalc = await calculateEarlyWithdrawalPenalty(deposit, amountFromThisDeposit);

        if (penaltyCalc.allowed) {
          if (penaltyCalc.penalty_amount > 0) {
            isEarlyWithdrawal = true;
            earlyWithdrawalPenalty += penaltyCalc.penalty_amount;
            penaltyPercentage = Math.max(penaltyPercentage, penaltyCalc.penalty_percentage); // Use highest penalty rate
            penaltyReason = penaltyCalc.reason;

            // Track affected deposits
            affectedDeposits.push({
              deposit_id: deposit._id,
              amount: amountFromThisDeposit,
              penalty: penaltyCalc.penalty_amount,
            });
          }

          remainingAmount -= amountFromThisDeposit;
        }
      }

      // Add penalty to group reserve if there was a penalty
      if (earlyWithdrawalPenalty > 0) {
        await addToReserveAccount(earlyWithdrawalPenalty, req.admin._id);
      }
    }

    // Calculate net amount after early withdrawal penalty
    const netAmountAfterPenalty = saving.amount - earlyWithdrawalPenalty;

    // Calculate withdrawal fee on requested amount (based on tariff chart)
    const withdrawalFee = calculateWithdrawalFee(saving.amount);
    
    // Total deduction from balance = requested amount + withdrawal fee
    const totalDeduction = saving.amount + withdrawalFee;

    // Check if member has enough balance for amount + fee using ACTUAL balance
    if (actualCurrentBalance < totalDeduction) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Withdrawal amount: KES ${saving.amount}, Fee: KES ${withdrawalFee}, Total required: KES ${totalDeduction}, Current balance: KES ${actualCurrentBalance}`,
      });
    }

    // Update member's total_savings, wallet_balance and total_transaction_fees
    await Member.findByIdAndUpdate(saving.member_id._id, {
      $inc: { 
        total_savings: -totalDeduction,
        wallet_balance: -totalDeduction,
        total_transaction_fees: withdrawalFee
      },
    });

    // Update saving record with proper balance tracking and penalty info
    saving.balance_before = actualCurrentBalance;
    saving.balance_after = actualCurrentBalance - totalDeduction;
    saving.is_early_withdrawal = isEarlyWithdrawal;
    saving.penalty_amount = earlyWithdrawalPenalty;
    saving.penalty_percentage = penaltyPercentage;
    saving.penalty_reason = penaltyReason;
    
    // Build comprehensive notes
    let notes = saving.notes || "";
    if (withdrawalFee > 0) {
      notes += ` | Withdrawal fee: KES ${withdrawalFee}`;
    }
    if (earlyWithdrawalPenalty > 0) {
      notes += ` | Early withdrawal penalty: KES ${earlyWithdrawalPenalty} (${penaltyPercentage}%) - ${penaltyReason}`;
    }
    saving.notes = notes;
    
    saving.status = "completed";
    saving.processed_by = req.admin._id;
    saving.processed_at = new Date();
    await saving.save();

    // Record withdrawal fee if applicable
    if (withdrawalFee > 0) {
      await TransactionFee.create({
        transaction_type: "withdrawal",
        member_id: saving.member_id._id,
        transaction_amount: saving.amount,
        fee_amount: withdrawalFee,
        fee_description: `Withdrawal fee for KES ${saving.amount.toLocaleString()}`,
        reference_id: saving._id.toString(),
        status: "collected",
      });

      // Add withdrawal fee to reserve account
      try {
        const { addToReserve } = await import("../services/reserveAccountService.js");
        await addToReserve({
          amount: withdrawalFee,
          source_type: "withdrawal_fee",
          description: `Withdrawal fee from member ${member.name}: KES ${withdrawalFee}`,
          reference_type: "Saving",
          reference_id: saving._id.toString(),
          created_by: req.admin._id,
          metadata: { member_id: saving.member_id._id.toString() },
          is_automated: true,
        });
      } catch (error) {
        console.error("Error adding withdrawal fee to reserve:", error);
      }
    }

    // Apply credit score penalty if early withdrawal
    if (isEarlyWithdrawal) {
      const { getEarlyWithdrawalSettings } = await import("../services/earlyWithdrawalService.js");
      const settings = await getEarlyWithdrawalSettings();
      
      if (settings.credit_penalty > 0) {
        // Import credit score service and apply penalty
        try {
          const { default: Member } = await import("../models/Member.js");
          const creditScorePenalty = settings.credit_penalty;
          
          // Reduce savings_credibility_score (ensure it doesn't go below 0)
          const currentScore = member.savings_credibility_score || 0;
          const newScore = Math.max(0, currentScore - creditScorePenalty);
          
          await Member.findByIdAndUpdate(saving.member_id._id, {
            savings_credibility_score: newScore,
          });

          console.log(`⚠️ Early withdrawal penalty applied: Credit score reduced by ${creditScorePenalty} points (${currentScore} → ${newScore})`);
        } catch (error) {
          console.error("Error applying credit score penalty:", error);
        }
      }
    }

    console.log(`✅ Withdrawal approved: KES ${saving.amount} requested. Penalty: KES ${earlyWithdrawalPenalty}, Fee: KES ${withdrawalFee}, Net to member: KES ${netAmountAfterPenalty - withdrawalFee}, Total deducted from wallet: KES ${totalDeduction}`);

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("withdrawalStatusUpdated", {
        savingId,
        memberId: saving.member_id._id,
        status: "completed",
        amount: saving.amount,
        penalty: earlyWithdrawalPenalty,
        fee: withdrawalFee,
        netAmount: netAmountAfterPenalty - withdrawalFee,
        totalDeducted: totalDeduction,
        newBalance: saving.balance_after,
        isEarlyWithdrawal,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Withdrawal approved. Net amount to member: KES ${(netAmountAfterPenalty - withdrawalFee).toFixed(2)}${earlyWithdrawalPenalty > 0 ? ` (Penalty: KES ${earlyWithdrawalPenalty}, Fee: KES ${withdrawalFee})` : ` (Fee: KES ${withdrawalFee})`}`,
      data: saving,
      penalty: earlyWithdrawalPenalty,
      fee: withdrawalFee,
      netAmount: netAmountAfterPenalty - withdrawalFee,
    });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject withdrawal (admin only)
router.post("/admin/reject-withdrawal/:id", protect, adminOnly, async (req, res) => {
  try {
    const savingId = req.params.id;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        success: false,
        error: "Rejection reason is required",
      });
    }

    const saving = await Saving.findById(savingId).populate("member_id", "name member_id phone");
    if (!saving) {
      return res.status(404).json({
        success: false,
        error: "Withdrawal request not found",
      });
    }

    if (saving.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Withdrawal has already been processed",
      });
    }

    if (saving.transaction_type !== "withdrawal") {
      return res.status(400).json({
        success: false,
        error: "This is not a withdrawal request",
      });
    }

    // Update saving record with rejection
    saving.status = "failed";
    saving.rejection_reason = rejection_reason;
    saving.processed_by = req.admin._id;
    saving.processed_at = new Date();
    saving.balance_after = saving.balance_before; // Restore original balance
    await saving.save();

    console.log(`❌ Withdrawal rejected for ${saving.member_id.name}: ${rejection_reason}`);

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("withdrawalStatusUpdated", {
        savingId,
        memberId: saving.member_id._id,
        status: "failed",
        amount: saving.amount,
        rejectionReason: rejection_reason,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: "Withdrawal rejected",
      data: saving,
    });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply monthly interest to all members (admin only - manual trigger or cron job)
// This applies 3% interest to deposits that are 30+ days old
router.post("/admin/apply-interest", protect, adminOnly, async (req, res) => {
  try {
    // Import and use the shared interest calculation function
    const { applyMonthlyInterest } = await import("../services/interestService.js");
    const result = await applyMonthlyInterest();

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("interestApplied", {
        processedCount: result.appliedCount,
        totalAmount: result.totalAmount,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: result.appliedCount > 0 
        ? `Interest applied to ${result.appliedCount} deposits. Total: KES ${result.totalAmount}`
        : "No interest due at this time",
      processedCount: result.appliedCount,
      totalAmount: result.totalAmount,
    });
  } catch (error) {
    console.error("Error applying interest:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete all savings transactions (admin only - for reset)
router.delete("/", protect, adminOnly, async (req, res) => {
  try {
    const result = await Saving.deleteMany({});
    console.log(
      `🗑️ Cleared all savings: ${result.deletedCount} transactions deleted`
    );

    // Reset all members' total_savings
    await Member.updateMany({}, { $set: { total_savings: 0 } });

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("savingsCleared", {
        deletedCount: result.deletedCount,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `All savings cleared successfully. ${result.deletedCount} transactions deleted.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing savings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// QR-based transfer between members
router.post("/qr-transfer", protect, async (req, res) => {
  try {
    const senderId = req.member ? req.member._id : req.admin._id;
    const { recipientId, recipientMemberId, amount, qrData } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid amount" 
      });
    }

    // Validate QR data
    if (!qrData || qrData.type !== "SMCF_WALLET_DEPOSIT") {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid QR code data" 
      });
    }

    // Calculate transfer fee
    const transferFee = calculateTransferFee(amount);
    const totalDeduction = amount + transferFee;

    // Get sender
    const sender = await Member.findById(senderId);
    if (!sender) {
      return res.status(404).json({ 
        success: false, 
        error: "Sender not found" 
      });
    }

    // Check sender balance (must cover amount + fee)
    if (sender.wallet_balance < totalDeduction) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient balance. Transfer fee: KES ${transferFee}. Total required: KES ${totalDeduction}` 
      });
    }

    // Get recipient
    const recipient = await Member.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ 
        success: false, 
        error: "Recipient not found" 
      });
    }

    // Verify recipient member_id matches QR data
    if (recipient.member_id !== recipientMemberId) {
      return res.status(400).json({ 
        success: false, 
        error: "QR code mismatch" 
      });
    }

    // Deduct from sender (amount + fee)
    sender.wallet_balance -= totalDeduction;
    if (transferFee > 0) {
      sender.total_transaction_fees = (sender.total_transaction_fees || 0) + transferFee;
    }
    await sender.save();

    // Add to recipient (only the transfer amount, not the fee)
    recipient.wallet_balance += amount;
    recipient.total_savings += amount;
    await recipient.save();

    // Get sender's balance before transfer
    const senderLastTxn = await Saving.findOne({ 
      member_id: senderId,
      status: "completed"
    }).sort({ created_at: -1 });
    const senderBalanceBefore = senderLastTxn ? senderLastTxn.balance_after : 0;

    // Create withdrawal transaction for sender
    const withdrawalTxn = await Saving.create({
      member_id: senderId,
      amount: amount,
      transaction_type: "withdrawal",
      status: "completed",
      balance_before: senderBalanceBefore,
      balance_after: sender.wallet_balance,
      notes: `QR Transfer to ${recipient.name} (${recipient.member_id})${transferFee > 0 ? ` | Fee: KES ${transferFee}` : ''}`,
    });

    // Get recipient's balance before transfer
    const recipientLastTxn = await Saving.findOne({ 
      member_id: recipientId,
      status: "completed"
    }).sort({ created_at: -1 });
    const recipientBalanceBefore = recipientLastTxn ? recipientLastTxn.balance_after : 0;

    // Create deposit transaction for recipient
    const depositTxn = await Saving.create({
      member_id: recipientId,
      amount: amount,
      transaction_type: "deposit",
      status: "completed",
      balance_before: recipientBalanceBefore,
      balance_after: recipient.wallet_balance,
      notes: `QR Transfer from ${sender.name} (${sender.member_id})`,
    });

    // Record transfer fee if applicable
    let feeRecord = null;
    if (transferFee > 0) {
      feeRecord = await TransactionFee.create({
        transaction_type: "transfer",
        member_id: senderId,
        recipient_id: recipientId,
        transaction_amount: amount,
        fee_amount: transferFee,
        fee_description: `Transfer fee for KES ${amount.toLocaleString()} to ${recipient.name}`,
        reference_id: withdrawalTxn._id.toString(),
        status: "collected",
      });
    }

    // Emit Socket.IO events
    const io = req.app.get("io");
    if (io) {
      io.emit("qrTransfer", {
        senderId: sender._id,
        senderName: sender.name,
        recipientId: recipient._id,
        recipientName: recipient.name,
        amount,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Successfully transferred KES ${amount} to ${recipient.name}${transferFee > 0 ? ` (Fee: KES ${transferFee})` : ''}`,
      data: {
        sender: {
          id: sender._id,
          name: sender.name,
          newBalance: sender.wallet_balance,
        },
        recipient: {
          id: recipient._id,
          name: recipient.name,
          newBalance: recipient.wallet_balance,
        },
        amount,
        transferFee,
        totalDeducted: totalDeduction,
        withdrawalTxn: withdrawalTxn._id,
        depositTxn: depositTxn._id,
        feeRecord: feeRecord?._id,
      },
    });
  } catch (error) {
    console.error("Error processing QR transfer:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all transaction fees (admin only)
router.get("/admin/fees", protect, adminOnly, async (req, res) => {
  try {
    const { transaction_type, start_date, end_date, limit = 100 } = req.query;

    // Build query
    let query = {};
    
    if (transaction_type) {
      query.transaction_type = transaction_type;
    }
    
    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }

    // Get fees with member details
    const fees = await TransactionFee.find(query)
      .populate("member_id", "name member_id phone")
      .populate("recipient_id", "name member_id")
      .sort({ created_at: -1 })
      .limit(parseInt(limit));

    // Calculate totals
    const totalStats = await TransactionFee.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$transaction_type",
          total_fees: { $sum: "$fee_amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate overall total
    const overallTotal = await TransactionFee.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total_collected: { $sum: "$fee_amount" },
          total_transactions: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        fees,
        stats: totalStats,
        summary: overallTotal[0] || { total_collected: 0, total_transactions: 0 },
      },
    });
  } catch (error) {
    console.error("Error fetching transaction fees:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get fee summary for dashboard (admin only)
router.get("/admin/fees/summary", protect, adminOnly, async (req, res) => {
  try {
    // Get total fees by type
    const feesByType = await TransactionFee.aggregate([
      {
        $group: {
          _id: "$transaction_type",
          total: { $sum: "$fee_amount" },
          count: { $sum: 1 },
          avg: { $avg: "$fee_amount" },
        },
      },
    ]);

    // Get total fees collected
    const totalFees = await TransactionFee.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$fee_amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent fees (last 10)
    const recentFees = await TransactionFee.find()
      .populate("member_id", "name member_id")
      .populate("recipient_id", "name member_id")
      .sort({ created_at: -1 })
      .limit(10);

    // Get fees by date (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const feesByDate = await TransactionFee.aggregate([
      {
        $match: {
          created_at: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          total: { $sum: "$fee_amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    res.json({
      success: true,
      data: {
        feesByType,
        totalCollected: totalFees[0]?.total || 0,
        totalTransactions: totalFees[0]?.count || 0,
        recentFees,
        feesByDate,
      },
    });
  } catch (error) {
    console.error("Error fetching fee summary:", error);
// Admin: Check matured deposits (can be run manually or via cron)
router.post("/check-maturity", protect, adminOnly, async (req, res) => {
  try {
    const result = await checkMaturedDeposits();
    res.json(result);
  } catch (error) {
    console.error("Error checking maturity:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get maturity statistics
router.get("/maturity-stats", protect, adminOnly, async (req, res) => {
  try {
    const stats = await getMaturityStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching maturity stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get all member savings with maturity info
router.get("/admin/all-with-maturity", protect, adminOnly, async (req, res) => {
  try {
    const { maturity_status, member_id } = req.query;

    const filter = { transaction_type: "deposit", status: "completed" };
    if (maturity_status && maturity_status !== "all") {
      filter.maturity_status = maturity_status;
    }
    if (member_id) {
      filter.member_id = member_id;
    }

    const deposits = await Saving.find(filter)
      .populate("member_id", "name member_id phone")
      .sort({ created_at: -1 })
      .limit(500);

    const now = new Date();
    const depositsWithInfo = deposits.map(deposit => ({
      ...deposit.toObject(),
      is_matured: deposit.unlock_date ? deposit.unlock_date <= now : true,
      days_until_maturity: deposit.unlock_date 
        ? Math.ceil((deposit.unlock_date - now) / (1000 * 60 * 60 * 24))
        : 0,
    }));

    res.json({
      success: true,
      data: depositsWithInfo,
      count: depositsWithInfo.length,
    });
  } catch (error) {
    console.error("Error fetching deposits with maturity:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

    res.status(500).json({ success: false, error: error.message });
  }
});

// Check early withdrawal penalty (preview before submission)
router.post("/check-early-withdrawal", protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const memberId = req.member ? req.member._id : req.body.member_id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Get early withdrawal settings first
    const settings = await getEarlyWithdrawalSettings();

    if (!settings.enabled) {
      return res.json({
        success: false,
        early_withdrawal_allowed: false,
        message: "Early withdrawal is currently disabled by admin. Please wait until maturity or contact admin.",
      });
    }

    // Get all locked deposits for this member
    const lockedDeposits = await Saving.find({
      member_id: memberId,
      transaction_type: "deposit",
      status: "completed",
      unlock_date: { $gt: new Date() },
    }).sort({ created_at: 1 }); // Oldest first (FIFO)

    if (lockedDeposits.length === 0) {
      return res.json({
        success: true,
        early_withdrawal_allowed: true,
        penalty_amount: 0,
        penalty_percentage: 0,
        net_amount: amount,
        message: "No locked deposits. Regular withdrawal with no penalty.",
        locked_deposits: [],
      });
    }

    // Estimate unlocked amount first; only the remainder of requested amount can attract early-withdrawal penalties.
    const latestCompletedTxn = await Saving.findOne({ member_id: memberId, status: "completed" }).sort({ created_at: -1 });
    const currentBalance = latestCompletedTxn ? latestCompletedTxn.balance_after : 0;
    const totalLockedAmount = lockedDeposits.reduce((sum, dep) => sum + (dep.amount || 0), 0);
    const unlockedBalance = Math.max(0, currentBalance - totalLockedAmount);
    const amountSubjectToPenalty = Math.max(0, amount - unlockedBalance);

    if (amountSubjectToPenalty <= 0) {
      const withdrawalFee = calculateWithdrawalFee(amount);
      return res.json({
        success: true,
        early_withdrawal_allowed: true,
        requested_amount: amount,
        penalty_amount: 0,
        withdrawal_fee: withdrawalFee,
        net_amount: amount,
        final_amount: amount - withdrawalFee,
        affected_deposits: [],
        credit_score_penalty: 0,
        warning: "Withdrawal can be fulfilled from unlocked funds. No early withdrawal penalty will apply.",
      });
    }

    // Calculate which deposits would be affected
    let remainingAmount = amountSubjectToPenalty;
    const affectedDeposits = [];
    let totalPenalty = 0;

    for (const deposit of lockedDeposits) {
      if (remainingAmount <= 0) break;

      const amountFromThisDeposit = Math.min(remainingAmount, deposit.amount);
      
      // Calculate penalty for this portion
      const penaltyCalc = await calculateEarlyWithdrawalPenalty(deposit, amountFromThisDeposit);

      if (penaltyCalc.allowed) {
        affectedDeposits.push({
          deposit_id: deposit._id,
          deposit_amount: deposit.amount,
          amount_withdrawn: amountFromThisDeposit,
          unlock_date: deposit.unlock_date,
          days_remaining: penaltyCalc.days_remaining,
          percent_remaining: penaltyCalc.percent_remaining,
          penalty_percentage: penaltyCalc.penalty_percentage,
          penalty_amount: penaltyCalc.penalty_amount,
          net_amount: penaltyCalc.net_amount,
        });

        totalPenalty += penaltyCalc.penalty_amount;
        remainingAmount -= amountFromThisDeposit;
      }
    }

    const netAmount = amount - totalPenalty;
    const withdrawalFee = calculateWithdrawalFee(amount); // Fee calculated on requested amount per tariff chart
    const finalAmount = netAmount - withdrawalFee;

    res.json({
      success: true,
      early_withdrawal_allowed: true,
      requested_amount: amount,
      penalty_amount: totalPenalty,
      withdrawal_fee: withdrawalFee,
      net_amount: netAmount,
      final_amount: finalAmount, // Amount member receives after penalty + fee
      affected_deposits: affectedDeposits,
      credit_score_penalty: settings.credit_penalty,
      warning: `Early withdrawal will incur a penalty of KES ${totalPenalty.toFixed(2)} and reduce your credit score by ${settings.credit_penalty} points.`,
    });
  } catch (error) {
    console.error("Error checking early withdrawal penalty:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get early withdrawal settings (admin)
router.get("/admin/early-withdrawal-settings", protect, adminOnly, async (req, res) => {
  try {
    const settings = await getEarlyWithdrawalSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error getting early withdrawal settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update early withdrawal settings (admin)
router.put("/admin/early-withdrawal-settings", protect, adminOnly, async (req, res) => {
  try {
    const adminId = req.admin._id;
    const updates = req.body;

    const settings = await updateEarlyWithdrawalSettings(updates, adminId);

    res.json({
      success: true,
      data: settings,
      message: "Early withdrawal settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating early withdrawal settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
