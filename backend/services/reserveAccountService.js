import GroupReserveAccount from "../models/GroupReserveAccount.js";
import ReserveTransaction from "../models/ReserveTransaction.js";
import Loan from "../models/Loan.js";

/**
 * Get or create the Group Reserve Account (singleton)
 */
export const getReserveAccount = async () => {
  let account = await GroupReserveAccount.findOne();
  
  if (!account) {
    account = await GroupReserveAccount.create({
      current_balance: 0,
    });
  }
  
  return account;
};

/**
 * Add funds to the reserve account
 * @param {Object} params - { amount, source_type, description, reference_type, reference_id, created_by, metadata }
 */
export const addToReserve = async (params) => {
  const {
    amount,
    source_type,
    description,
    reference_type = "Other",
    reference_id = null,
    created_by = null,
    metadata = {},
    is_automated = true,
  } = params;

  if (!amount || amount <= 0) {
    throw new Error("Invalid amount for reserve credit");
  }

  const account = await getReserveAccount();

  // Check if source is enabled
  const sourceEnabledMap = {
    early_withdrawal_penalty: account.config.early_withdrawal_penalties_enabled,
    loan_default_penalty: account.config.loan_default_penalties_enabled,
    withdrawal_fee: account.config.withdrawal_fees_enabled,
    system_fee: account.config.system_fees_enabled,
    cycle_contribution: account.config.cycle_contributions_enabled,
  };

  if (sourceEnabledMap[source_type] === false) {
    console.log(`⚠️ Reserve source ${source_type} is disabled. Skipping credit.`);
    return null;
  }

  // Update account balance
  account.current_balance += amount;

  // Update source-specific totals
  const sourceFieldMap = {
    early_withdrawal_penalty: "total_from_early_withdrawal_penalties",
    loan_default_penalty: "total_from_loan_defaults",
    loan_interest: "total_from_loan_interest",
    withdrawal_fee: "total_from_withdrawal_fees",
    system_fee: "total_from_system_fees",
    cycle_contribution: "total_from_cycle_contributions",
  };

  const sourceField = sourceFieldMap[source_type];
  if (sourceField) {
    account[sourceField] += amount;
  }

  await account.save();

  // Create transaction record
  const transaction = await ReserveTransaction.create({
    transaction_type: "credit",
    source_type,
    amount,
    balance_after: account.current_balance,
    description,
    reference_type,
    reference_id: reference_id ? reference_id.toString() : null,
    created_by,
    metadata,
    is_automated,
    approval_status: "completed",
  });

  console.log(`✅ Reserve credited: KES ${amount} from ${source_type}. New balance: KES ${account.current_balance}`);

  return { account, transaction };
};

/**
 * Withdraw funds from the reserve account (admin only)
 * @param {Object} params - { amount, withdrawal_reason, withdrawal_notes, approved_by, secondary_approval_by }
 */
export const withdrawFromReserve = async (params) => {
  const {
    amount,
    withdrawal_reason,
    withdrawal_notes = "",
    approved_by,
    secondary_approval_by = null,
  } = params;

  if (!amount || amount <= 0) {
    throw new Error("Invalid withdrawal amount");
  }

  if (!approved_by) {
    throw new Error("Withdrawal must be approved by an admin");
  }

  const account = await getReserveAccount();

  // Reset monthly tracking if new month
  account.resetMonthlyTracking();

  // Check if withdrawal is allowed
  const canWithdraw = account.canWithdraw(amount);
  if (!canWithdraw.allowed) {
    throw new Error(canWithdraw.reason);
  }

  // Check dual approval requirement
  if (account.config.require_dual_approval && !secondary_approval_by) {
    throw new Error("Dual approval required for reserve withdrawals");
  }

  // Update account balance
  account.current_balance -= amount;
  account.total_withdrawn += amount;
  account.current_month_withdrawn += amount;
  await account.save();

  // Create transaction record
  const transaction = await ReserveTransaction.create({
    transaction_type: "debit",
    source_type: "admin_withdrawal",
    amount,
    balance_after: account.current_balance,
    description: `Admin withdrawal: ${withdrawal_reason}`,
    withdrawal_reason,
    withdrawal_notes,
    approved_by,
    secondary_approval_by,
    approval_status: "completed",
    is_automated: false,
  });

  console.log(`💸 Reserve withdrawal: KES ${amount} for ${withdrawal_reason}. New balance: KES ${account.current_balance}`);

  return { account, transaction };
};

/**
 * Get reserve account summary
 */
export const getReserveSummary = async () => {
  const account = await getReserveAccount();
  
  // Get recent transactions
  const recentTransactions = await ReserveTransaction.find()
    .sort({ created_at: -1 })
    .limit(20)
    .populate("created_by", "name email")
    .populate("approved_by", "name email")
    .populate("secondary_approval_by", "name email");

  // Calculate monthly stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const monthlyCredits = await ReserveTransaction.aggregate([
    {
      $match: {
        transaction_type: "credit",
        created_at: { $gte: monthStart },
      },
    },
    {
      $group: {
        _id: "$source_type",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const monthlyDebits = await ReserveTransaction.aggregate([
    {
      $match: {
        transaction_type: "debit",
        created_at: { $gte: monthStart },
      },
    },
    {
      $group: {
        _id: "$withdrawal_reason",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    account,
    recentTransactions,
    monthlyCredits,
    monthlyDebits,
  };
};

/**
 * Calculate reserve health score (0-100)
 */
export const calculateReserveHealth = async () => {
  const account = await getReserveAccount();
  
  // Get total outstanding loans
  const outstandingLoans = await Loan.aggregate([
    {
      $match: {
        status: { $in: ["disbursed", "defaulted"] },
      },
    },
    {
      $group: {
        _id: null,
        totalOutstanding: { $sum: "$remaining_amount" },
        totalDefaulted: {
          $sum: {
            $cond: [{ $eq: ["$status", "defaulted"] }, "$remaining_amount", 0],
          },
        },
      },
    },
  ]);

  const totalOutstanding = outstandingLoans[0]?.totalOutstanding || 0;
  const totalDefaulted = outstandingLoans[0]?.totalDefaulted || 0;

  // Calculate loan coverage ratio (Reserve / Outstanding Loans)
  const loanCoverageRatio = totalOutstanding > 0 
    ? (account.current_balance / totalOutstanding) * 100 
    : 100;

  // Calculate growth rate (compare to last month)
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  
  const lastMonthBalance = await ReserveTransaction.findOne({
    created_at: { $lte: lastMonth },
  }).sort({ created_at: -1 });

  const previousBalance = lastMonthBalance?.balance_after || account.current_balance;
  const monthlyGrowthRate = previousBalance > 0
    ? ((account.current_balance - previousBalance) / previousBalance) * 100
    : 0;

  // Calculate health score (weighted average)
  // - 40%: Balance sufficiency (KES 50,000+ = 100%, 0 = 0%)
  // - 30%: Loan coverage ratio (100%+ = 100%, 0% = 0%)
  // - 20%: Monthly growth rate (10%+ = 100%, negative = 0%)
  // - 10%: Default absorption capacity (Reserve can cover defaults)

  const balanceScore = Math.min((account.current_balance / 50000) * 100, 100);
  const coverageScore = Math.min(loanCoverageRatio, 100);
  const growthScore = Math.max(0, Math.min((monthlyGrowthRate / 10) * 100, 100));
  const defaultAbsorptionScore = totalDefaulted > 0
    ? Math.min((account.current_balance / totalDefaulted) * 100, 100)
    : 100;

  const healthScore = Math.round(
    balanceScore * 0.4 +
    coverageScore * 0.3 +
    growthScore * 0.2 +
    defaultAbsorptionScore * 0.1
  );

  // Update account with calculated metrics
  account.reserve_health_score = healthScore;
  account.loan_coverage_ratio = loanCoverageRatio;
  account.monthly_growth_rate = monthlyGrowthRate;
  await account.save();

  return {
    health_score: healthScore,
    loan_coverage_ratio: loanCoverageRatio,
    monthly_growth_rate: monthlyGrowthRate,
    current_balance: account.current_balance,
    total_outstanding_loans: totalOutstanding,
    total_defaulted_loans: totalDefaulted,
    breakdown: {
      balance_score: balanceScore,
      coverage_score: coverageScore,
      growth_score: growthScore,
      default_absorption_score: defaultAbsorptionScore,
    },
  };
};

/**
 * Generate monthly reserve report
 */
export const generateMonthlyReport = async (month = null, year = null) => {
  const now = new Date();
  const reportMonth = month || now.getMonth();
  const reportYear = year || now.getFullYear();
  
  const monthStart = new Date(reportYear, reportMonth, 1);
  const monthEnd = new Date(reportYear, reportMonth + 1, 0);

  // Get all transactions for the month
  const transactions = await ReserveTransaction.find({
    created_at: { $gte: monthStart, $lte: monthEnd },
  }).sort({ created_at: 1 });

  // Aggregate by source type
  const creditsBySource = await ReserveTransaction.aggregate([
    {
      $match: {
        transaction_type: "credit",
        created_at: { $gte: monthStart, $lte: monthEnd },
      },
    },
    {
      $group: {
        _id: "$source_type",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const debitsByReason = await ReserveTransaction.aggregate([
    {
      $match: {
        transaction_type: "debit",
        created_at: { $gte: monthStart, $lte: monthEnd },
      },
    },
    {
      $group: {
        _id: "$withdrawal_reason",
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCredits = creditsBySource.reduce((sum, item) => sum + item.total, 0);
  const totalDebits = debitsByReason.reduce((sum, item) => sum + item.total, 0);

  // Get opening and closing balance
  const openingBalance = transactions[0]?.balance_after - transactions[0]?.amount || 0;
  const closingBalance = transactions[transactions.length - 1]?.balance_after || 0;

  // Calculate health metrics
  const healthMetrics = await calculateReserveHealth();

  return {
    period: {
      month: reportMonth + 1,
      year: reportYear,
      start: monthStart,
      end: monthEnd,
    },
    balance: {
      opening: openingBalance,
      closing: closingBalance,
      net_change: closingBalance - openingBalance,
    },
    credits: {
      total: totalCredits,
      by_source: creditsBySource,
    },
    debits: {
      total: totalDebits,
      by_reason: debitsByReason,
    },
    health: healthMetrics,
    transaction_count: transactions.length,
    generated_at: new Date(),
  };
};

/**
 * Update reserve configuration
 */
export const updateReserveConfig = async (updates, adminId) => {
  const account = await getReserveAccount();
  
  // Update config fields
  if (updates.early_withdrawal_penalties_enabled !== undefined) {
    account.config.early_withdrawal_penalties_enabled = updates.early_withdrawal_penalties_enabled;
  }
  if (updates.loan_default_penalties_enabled !== undefined) {
    account.config.loan_default_penalties_enabled = updates.loan_default_penalties_enabled;
  }
  if (updates.loan_interest_percentage !== undefined) {
    account.config.loan_interest_percentage = updates.loan_interest_percentage;
  }
  if (updates.withdrawal_fees_enabled !== undefined) {
    account.config.withdrawal_fees_enabled = updates.withdrawal_fees_enabled;
  }
  if (updates.system_fees_enabled !== undefined) {
    account.config.system_fees_enabled = updates.system_fees_enabled;
  }
  if (updates.cycle_contributions_enabled !== undefined) {
    account.config.cycle_contributions_enabled = updates.cycle_contributions_enabled;
  }
  if (updates.max_withdrawal_per_month !== undefined) {
    account.config.max_withdrawal_per_month = updates.max_withdrawal_per_month;
  }
  if (updates.max_withdrawal_percentage !== undefined) {
    account.config.max_withdrawal_percentage = updates.max_withdrawal_percentage;
  }
  if (updates.require_dual_approval !== undefined) {
    account.config.require_dual_approval = updates.require_dual_approval;
  }
  if (updates.authorized_signatories !== undefined) {
    account.config.authorized_signatories = updates.authorized_signatories;
  }

  await account.save();

  // Log configuration change
  await ReserveTransaction.create({
    transaction_type: "credit",
    source_type: "other",
    amount: 0,
    balance_after: account.current_balance,
    description: "Reserve configuration updated",
    created_by: adminId,
    metadata: new Map(Object.entries(updates)),
    is_automated: false,
    approval_status: "completed",
  });

  return account;
};

/**
 * Lock/unlock reserve account (for audits)
 */
export const toggleReserveLock = async (isLocked, reason, adminId) => {
  const account = await getReserveAccount();
  
  account.config.is_locked = isLocked;
  account.config.locked_reason = isLocked ? reason : "";
  account.config.locked_by = isLocked ? adminId : null;
  account.config.locked_at = isLocked ? new Date() : null;
  
  await account.save();

  console.log(`🔒 Reserve account ${isLocked ? 'locked' : 'unlocked'}: ${reason}`);

  return account;
};
