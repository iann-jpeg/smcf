import SystemSettings from "../models/SystemSettings.js";

/**
 * Calculate the penalty for early withdrawal
 * @param {Object} saving - The saving/deposit document
 * @param {Number} requestedAmount - Amount user wants to withdraw
 * @returns {Object} - { allowed, penalty_amount, penalty_percentage, net_amount, reason }
 */
export const calculateEarlyWithdrawalPenalty = async (saving, requestedAmount) => {
  try {
    // Get system settings
    let settings = await SystemSettings.findOne();
    
    // If no settings exist, create default
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    // Check if early withdrawal is enabled
    if (!settings.early_withdrawal_enabled) {
      return {
        allowed: false,
        penalty_amount: 0,
        penalty_percentage: 0,
        net_amount: 0,
        reason: "Early withdrawal is currently disabled by admin",
      };
    }

    // If not locked or already matured, no penalty
    if (
      !saving.lock_period_months ||
      saving.lock_period_months === 0 ||
      saving.maturity_status === "matured" ||
      saving.maturity_status === "withdrawn"
    ) {
      return {
        allowed: true,
        penalty_amount: 0,
        penalty_percentage: 0,
        net_amount: requestedAmount,
        reason: "No penalty - deposit is not locked or already matured",
      };
    }

    // Check if still locked
    if (saving.maturity_status === "locked") {
      const now = new Date();
      const unlockDate = new Date(saving.unlock_date);
      const depositDate = new Date(saving.created_at);

      // Calculate total lock period in days
      const totalLockDays = Math.ceil(
        (unlockDate - depositDate) / (1000 * 60 * 60 * 24)
      );

      // Calculate days remaining
      const daysRemaining = Math.ceil(
        (unlockDate - now) / (1000 * 60 * 60 * 24)
      );

      // Calculate percentage of lock period remaining
      const percentRemaining = (daysRemaining / totalLockDays) * 100;

      let penaltyPercentage = settings.early_withdrawal_base_penalty;

      // Apply dynamic penalty based on time remaining
      if (settings.early_withdrawal_penalty_type === "dynamic") {
        if (percentRemaining > 75) {
          penaltyPercentage = settings.early_withdrawal_dynamic_rates.over_75_percent;
        } else if (percentRemaining > 50) {
          penaltyPercentage = settings.early_withdrawal_dynamic_rates.over_50_percent;
        } else if (percentRemaining > 25) {
          penaltyPercentage = settings.early_withdrawal_dynamic_rates.over_25_percent;
        } else {
          penaltyPercentage = settings.early_withdrawal_dynamic_rates.under_25_percent;
        }
      }

      const penaltyAmount = (requestedAmount * penaltyPercentage) / 100;
      const netAmount = requestedAmount - penaltyAmount;

      return {
        allowed: true,
        penalty_amount: penaltyAmount,
        penalty_percentage: penaltyPercentage,
        net_amount: netAmount,
        reason: `Early withdrawal penalty: ${Math.round(percentRemaining)}% of lock period remaining (${daysRemaining} days until ${unlockDate.toLocaleDateString()})`,
        days_remaining: daysRemaining,
        percent_remaining: Math.round(percentRemaining),
        unlock_date: unlockDate,
      };
    }

    // Default: no penalty
    return {
      allowed: true,
      penalty_amount: 0,
      penalty_percentage: 0,
      net_amount: requestedAmount,
      reason: "No penalty applicable",
    };
  } catch (error) {
    console.error("Error calculating early withdrawal penalty:", error);
    throw error;
  }
};

/**
 * Add penalty to group reserve account
 * @param {Number} penaltyAmount - Penalty amount to add to reserve
 * @param {String} adminId - Admin who approved the withdrawal (optional)
 */
export const addToReserveAccount = async (penaltyAmount, adminId = null) => {
  try {
    // Use the centralized reserve account service
    const { addToReserve } = await import("./reserveAccountService.js");
    
    const result = await addToReserve({
      amount: penaltyAmount,
      source_type: "early_withdrawal_penalty",
      description: `Early withdrawal penalty: KES ${penaltyAmount.toLocaleString()}`,
      reference_type: "Saving",
      created_by: adminId,
      is_automated: true,
    });

    return result?.account?.current_balance || 0;
  } catch (error) {
    console.error("Error adding to reserve account:", error);
    throw error;
  }
};

/**
 * Get current system settings for early withdrawals
 */
export const getEarlyWithdrawalSettings = async () => {
  try {
    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    return {
      enabled: settings.early_withdrawal_enabled,
      penalty_type: settings.early_withdrawal_penalty_type,
      base_penalty: settings.early_withdrawal_base_penalty,
      dynamic_rates: settings.early_withdrawal_dynamic_rates,
      credit_penalty: settings.early_withdrawal_credit_penalty,
      reserve_balance: settings.total_reserve_balance,
    };
  } catch (error) {
    console.error("Error getting early withdrawal settings:", error);
    throw error;
  }
};

/**
 * Update early withdrawal settings (admin only)
 */
export const updateEarlyWithdrawalSettings = async (updates, adminId) => {
  try {
    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    // Update allowed fields
    if (updates.early_withdrawal_enabled !== undefined) {
      settings.early_withdrawal_enabled = updates.early_withdrawal_enabled;
    }
    if (updates.early_withdrawal_penalty_type !== undefined) {
      settings.early_withdrawal_penalty_type = updates.early_withdrawal_penalty_type;
    }
    if (updates.early_withdrawal_base_penalty !== undefined) {
      settings.early_withdrawal_base_penalty = updates.early_withdrawal_base_penalty;
    }
    if (updates.dynamic_rates) {
      settings.early_withdrawal_dynamic_rates = {
        ...settings.early_withdrawal_dynamic_rates,
        ...updates.dynamic_rates,
      };
    }
    if (updates.early_withdrawal_credit_penalty !== undefined) {
      settings.early_withdrawal_credit_penalty = updates.early_withdrawal_credit_penalty;
    }

    settings.updated_by = adminId;
    await settings.save();

    return settings;
  } catch (error) {
    console.error("Error updating early withdrawal settings:", error);
    throw error;
  }
};
