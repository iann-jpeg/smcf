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

const router = express.Router();

// Get member's wallet/savings summary
router.get("/summary", protect, async (req, res) => {
  try {
    const memberId = req.member ? req.member._id : req.admin._id;

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

    // Calculate current balance from transaction history:
    // Current Balance = Total Deposits + Interest Earned - Withdrawals
    const currentBalance = totalDeposits + totalInterestEarned - totalWithdrawals;

    console.log("📊 Wallet summary for member:", memberId);
    console.log("   Current Balance:", currentBalance);
    console.log("   Total Deposits:", totalDeposits);
    console.log("   Total Withdrawals:", totalWithdrawals);
    console.log("   Total Interest:", totalInterestEarned);
    console.log("   Transaction Count:", transactions.length);

    res.json({
      success: true,
      data: {
        currentBalance,
        totalDeposits,
        totalWithdrawals,
        totalInterestEarned,
        transactionCount: transactions.length,
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

// Make a deposit (member)
router.post("/deposit", protect, async (req, res) => {
  try {
    const { amount, payment_method, transaction_ref, notes } = req.body;
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
    const { amount, notes } = req.body;
    const memberId = req.member ? req.member._id : req.body.member_id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
      });
    }

    // Get current balance
    const lastTransaction = await Saving.findOne({ member_id: memberId }).sort({
      created_at: -1,
    });
    const currentBalance = lastTransaction ? lastTransaction.balance_after : 0;

    if (amount > currentBalance) {
      return res.status(400).json({
        success: false,
        error: "Insufficient balance",
      });
    }

    // Create withdrawal transaction
    const saving = await Saving.create({
      member_id: memberId,
      amount,
      transaction_type: "withdrawal",
      balance_before: currentBalance,
      balance_after: currentBalance - amount,
      status: "pending", // Requires admin approval
      notes: notes || "",
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

// Approve/Reject withdrawal (admin only)
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

        // Check if member has enough balance for amount + fee
        if (member.wallet_balance < totalDeduction) {
          return res.status(400).json({
            success: false,
            error: `Insufficient balance. Withdrawal fee: KES ${withdrawalFee}. Total required: KES ${totalDeduction}`,
          });
        }

        // Deduct from member's total savings AND wallet_balance (amount + fee)
        await Member.findByIdAndUpdate(saving.member_id, {
          $inc: { 
            total_savings: -totalDeduction,
            wallet_balance: -totalDeduction 
          },
        });

        // Update saving notes to include fee
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

// Get all members' savings (admin only)
// Get all members savings summary (accessible to all authenticated users for top saver badge)
router.get("/all-members", protect, async (req, res) => {
  try {
    // Get all members with their savings data
    const members = await Member.find().select(
      "name member_id total_savings wallet_balance"
    );

    // Get savings summary for each member (only completed transactions)
    const membersWithSavings = await Promise.all(
      members.map(async (member) => {
        const transactions = await Saving.find({ 
          member_id: member._id,
          status: "completed"
        });

        const totalDeposits = transactions
          .filter((t) => t.transaction_type === "deposit")
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          _id: member._id,
          name: member.name,
          member_id: member.member_id,
          totalDeposits,
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
      "name member_id phone total_savings wallet_balance position"
    );

    // Get savings summary for each member (only completed transactions)
    const membersWithSavings = await Promise.all(
      members.map(async (member) => {
        const transactions = await Saving.find({ 
          member_id: member._id,
          status: "completed"
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

        // Calculate current balance from transaction history:
        // Current Balance = Total Deposits + Interest Earned - Withdrawals
        const currentBalance = totalDeposits + totalInterestEarned - totalWithdrawals;

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
          lastTransaction:
            transactions.length > 0 ? transactions[0].created_at : null,
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

    // Calculate withdrawal fee
    const withdrawalFee = calculateWithdrawalFee(saving.amount);
    const totalDeduction = saving.amount + withdrawalFee;

    // Get member to check balance
    const member = await Member.findById(saving.member_id._id);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: "Member not found",
      });
    }

    // Check if member has enough balance for amount + fee
    if (member.wallet_balance < totalDeduction) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Withdrawal amount: KES ${saving.amount}, Fee: KES ${withdrawalFee}, Total required: KES ${totalDeduction}, Current balance: KES ${member.wallet_balance}`,
      });
    }

    // Deduct from member's wallet_balance and total_savings (amount + fee)
    await Member.findByIdAndUpdate(saving.member_id._id, {
      $inc: { 
        total_savings: -totalDeduction,
        wallet_balance: -totalDeduction 
      },
    });

    // Update saving record
    saving.notes = saving.notes 
      ? `${saving.notes}${withdrawalFee > 0 ? ` | Fee: KES ${withdrawalFee}` : ''}`
      : (withdrawalFee > 0 ? `Withdrawal fee: KES ${withdrawalFee}` : '');
    saving.status = "completed";
    saving.processed_by = req.admin._id;
    saving.processed_at = new Date();
    saving.balance_after = member.wallet_balance - totalDeduction;
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
    }

    console.log(`✅ Withdrawal approved: KES ${totalDeduction} (Amount: ${saving.amount} + Fee: ${withdrawalFee}) deducted from ${member.name}'s wallet`);

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("withdrawalStatusUpdated", {
        savingId,
        memberId: saving.member_id._id,
        status: "completed",
        amount: saving.amount,
        fee: withdrawalFee,
        totalDeducted: totalDeduction,
        newBalance: saving.balance_after,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Withdrawal approved. KES ${saving.amount} will be sent to member. Fee: KES ${withdrawalFee}`,
      data: saving,
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
router.post("/admin/apply-interest", protect, adminOnly, async (req, res) => {
  try {
    const members = await Member.find();
    const interestRate = 0.03; // 3% monthly
    let processedCount = 0;

    for (const member of members) {
      // Get current balance
      const lastTransaction = await Saving.findOne({
        member_id: member._id,
      }).sort({ created_at: -1 });

      if (lastTransaction && lastTransaction.balance_after > 0) {
        const currentBalance = lastTransaction.balance_after;
        const interestAmount = currentBalance * interestRate;
        const newBalance = currentBalance + interestAmount;

        // Create interest transaction
        await Saving.create({
          member_id: member._id,
          amount: interestAmount,
          transaction_type: "interest",
          balance_before: currentBalance,
          balance_after: newBalance,
          interest_rate: interestRate * 100,
          interest_amount: interestAmount,
          payment_method: "auto_interest",
          status: "completed",
          processed_by: req.admin._id,
          notes: "Monthly interest applied",
        });

        processedCount++;
      }
    }

    // Emit Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.emit("interestApplied", {
        processedCount,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Interest applied to ${processedCount} members`,
      processedCount,
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
    await sender.save();

    // Add to recipient (only the transfer amount, not the fee)
    recipient.wallet_balance += amount;
    recipient.total_savings += amount;
    await recipient.save();

    // Create withdrawal transaction for sender
    const withdrawalTxn = await Saving.create({
      member_id: senderId,
      amount: amount,
      transaction_type: "withdrawal",
      status: "completed",
      notes: `QR Transfer to ${recipient.name} (${recipient.member_id})${transferFee > 0 ? ` | Fee: KES ${transferFee}` : ''}`,
      balance_after: sender.wallet_balance,
    });

    // Create deposit transaction for recipient
    const depositTxn = await Saving.create({
      member_id: recipientId,
      amount: amount,
      transaction_type: "deposit",
      status: "completed",
      notes: `QR Transfer from ${sender.name} (${sender.member_id})`,
      balance_after: recipient.wallet_balance,
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
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
