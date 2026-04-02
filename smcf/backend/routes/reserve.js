import express from "express";
import { adminOnly, protect } from "../middleware/auth.js";
import {
  getReserveAccount,
  getReserveSummary,
  withdrawFromReserve,
  calculateReserveHealth,
  generateMonthlyReport,
  updateReserveConfig,
  toggleReserveLock,
} from "../services/reserveAccountService.js";
import ReserveTransaction from "../models/ReserveTransaction.js";

const router = express.Router();

// ========== PUBLIC ROUTES (for authenticated members) ==========

// Get reserve account balance and health (read-only for members)
router.get("/balance", protect, async (req, res) => {
  try {
    const account = await getReserveAccount();
    const health = await calculateReserveHealth();

    res.json({
      success: true,
      data: {
        current_balance: account.current_balance,
        health_score: health.health_score,
        loan_coverage_ratio: health.loan_coverage_ratio,
        monthly_growth_rate: health.monthly_growth_rate,
      },
    });
  } catch (error) {
    console.error("Error fetching reserve balance:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get public reserve transactions (last 50, no sensitive data)
router.get("/transactions/public", protect, async (req, res) => {
  try {
    const transactions = await ReserveTransaction.find()
      .select("transaction_type source_type amount balance_after description created_at")
      .sort({ created_at: -1 })
      .limit(50);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching public reserve transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== ADMIN ROUTES ==========

// Get full reserve account summary (admin only)
router.get("/admin/summary", protect, adminOnly, async (req, res) => {
  try {
    const summary = await getReserveSummary();
    const health = await calculateReserveHealth();

    res.json({
      success: true,
      data: {
        ...summary,
        health,
      },
    });
  } catch (error) {
    console.error("Error fetching reserve summary:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all reserve transactions (admin only)
router.get("/admin/transactions", protect, adminOnly, async (req, res) => {
  try {
    const { limit = 100, offset = 0, source_type, transaction_type } = req.query;

    const filter = {};
    if (source_type) filter.source_type = source_type;
    if (transaction_type) filter.transaction_type = transaction_type;

    const transactions = await ReserveTransaction.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate("created_by", "name email")
      .populate("approved_by", "name email")
      .populate("secondary_approval_by", "name email");

    const total = await ReserveTransaction.countDocuments(filter);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error("Error fetching reserve transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Withdraw from reserve (admin only)
router.post("/admin/withdraw", protect, adminOnly, async (req, res) => {
  try {
    const { amount, withdrawal_reason, withdrawal_notes, secondary_approval_by } = req.body;
    const adminId = req.admin._id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid withdrawal amount",
      });
    }

    if (!withdrawal_reason) {
      return res.status(400).json({
        success: false,
        error: "Withdrawal reason is required",
      });
    }

    const result = await withdrawFromReserve({
      amount,
      withdrawal_reason,
      withdrawal_notes,
      approved_by: adminId,
      secondary_approval_by,
    });

    res.json({
      success: true,
      message: `Successfully withdrew KES ${amount.toLocaleString()} from reserve account`,
      data: result,
    });
  } catch (error) {
    console.error("Error withdrawing from reserve:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get monthly report (admin only)
router.get("/admin/report/:year/:month", protect, adminOnly, async (req, res) => {
  try {
    const { year, month } = req.params;
    const report = await generateMonthlyReport(parseInt(month) - 1, parseInt(year));

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating monthly report:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current month report (admin only)
router.get("/admin/report/current", protect, adminOnly, async (req, res) => {
  try {
    const report = await generateMonthlyReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Error generating current month report:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update reserve configuration (admin only)
router.put("/admin/config", protect, adminOnly, async (req, res) => {
  try {
    const adminId = req.admin._id;
    const updates = req.body;

    const account = await updateReserveConfig(updates, adminId);

    res.json({
      success: true,
      message: "Reserve configuration updated successfully",
      data: account,
    });
  } catch (error) {
    console.error("Error updating reserve config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lock/unlock reserve account (admin only)
router.post("/admin/toggle-lock", protect, adminOnly, async (req, res) => {
  try {
    const { is_locked, reason } = req.body;
    const adminId = req.admin._id;

    if (is_locked && !reason) {
      return res.status(400).json({
        success: false,
        error: "Reason is required when locking the reserve account",
      });
    }

    const account = await toggleReserveLock(is_locked, reason || "", adminId);

    res.json({
      success: true,
      message: `Reserve account ${is_locked ? "locked" : "unlocked"} successfully`,
      data: account,
    });
  } catch (error) {
    console.error("Error toggling reserve lock:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reserve health metrics (admin only)
router.get("/admin/health", protect, adminOnly, async (req, res) => {
  try {
    const health = await calculateReserveHealth();

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error("Error calculating reserve health:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reserve statistics (admin only)
router.get("/admin/stats", protect, adminOnly, async (req, res) => {
  try {
    const account = await getReserveAccount();

    // Get transaction counts by source
    const sourceStats = await ReserveTransaction.aggregate([
      {
        $match: {
          transaction_type: "credit",
        },
      },
      {
        $group: {
          _id: "$source_type",
          total_amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total_amount: -1 },
      },
    ]);

    // Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await ReserveTransaction.aggregate([
      {
        $match: {
          created_at: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$created_at" },
            month: { $month: "$created_at" },
            type: "$transaction_type",
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    res.json({
      success: true,
      data: {
        current_balance: account.current_balance,
        total_withdrawn: account.total_withdrawn,
        source_breakdown: {
          early_withdrawal_penalties: account.total_from_early_withdrawal_penalties,
          loan_defaults: account.total_from_loan_defaults,
          loan_interest: account.total_from_loan_interest,
          withdrawal_fees: account.total_from_withdrawal_fees,
          system_fees: account.total_from_system_fees,
          cycle_contributions: account.total_from_cycle_contributions,
        },
        source_stats: sourceStats,
        monthly_trend: monthlyTrend,
      },
    });
  } catch (error) {
    console.error("Error fetching reserve stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
