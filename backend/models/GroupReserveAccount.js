import mongoose from "mongoose";

const groupReserveAccountSchema = new mongoose.Schema({
  // Current balance
  current_balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Cumulative totals by source
  total_from_early_withdrawal_penalties: {
    type: Number,
    default: 0,
  },
  total_from_loan_defaults: {
    type: Number,
    default: 0,
  },
  total_from_loan_interest: {
    type: Number,
    default: 0,
  },
  total_from_withdrawal_fees: {
    type: Number,
    default: 0,
  },
  total_from_system_fees: {
    type: Number,
    default: 0,
  },
  total_from_cycle_contributions: {
    type: Number,
    default: 0,
  },
  
  // Total withdrawals
  total_withdrawn: {
    type: Number,
    default: 0,
  },
  
  // Configuration
  config: {
    // Enable/disable automatic funding sources
    early_withdrawal_penalties_enabled: {
      type: Boolean,
      default: true,
    },
    loan_default_penalties_enabled: {
      type: Boolean,
      default: true,
    },
    loan_interest_percentage: {
      type: Number,
      default: 97, // Take 97% of interest (i.e., interest - 3%)
      min: 0,
      max: 100,
    },
    withdrawal_fees_enabled: {
      type: Boolean,
      default: true,
    },
    system_fees_enabled: {
      type: Boolean,
      default: true,
    },
    cycle_contributions_enabled: {
      type: Boolean,
      default: false, // Opt-in
    },
    
    // Withdrawal limits
    max_withdrawal_per_month: {
      type: Number,
      default: 100000, // KES 100,000
    },
    max_withdrawal_percentage: {
      type: Number,
      default: 20, // Max 20% of balance per month
    },
    
    // Approval requirements
    require_dual_approval: {
      type: Boolean,
      default: false,
    },
    authorized_signatories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    }],
    
    // Lock during audit
    is_locked: {
      type: Boolean,
      default: false,
    },
    locked_reason: {
      type: String,
      default: "",
    },
    locked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    locked_at: {
      type: Date,
    },
  },
  
  // Monthly tracking
  current_month_withdrawn: {
    type: Number,
    default: 0,
  },
  current_month_start: {
    type: Date,
    default: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  },
  
  // Health metrics (calculated)
  reserve_health_score: {
    type: Number,
    default: 0, // 0-100 score
    min: 0,
    max: 100,
  },
  loan_coverage_ratio: {
    type: Number,
    default: 0, // Reserve / Total Outstanding Loans
  },
  monthly_growth_rate: {
    type: Number,
    default: 0, // % growth month-over-month
  },
  
  // Metadata
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  last_monthly_report_date: {
    type: Date,
  },
});

// Update timestamp on save
groupReserveAccountSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Method to reset monthly tracking
groupReserveAccountSchema.methods.resetMonthlyTracking = function() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  if (this.current_month_start < currentMonthStart) {
    this.current_month_withdrawn = 0;
    this.current_month_start = currentMonthStart;
  }
};

// Method to check if withdrawal is allowed
groupReserveAccountSchema.methods.canWithdraw = function(amount) {
  if (this.config.is_locked) {
    return { allowed: false, reason: "Reserve account is locked: " + this.config.locked_reason };
  }
  
  if (amount > this.current_balance) {
    return { allowed: false, reason: "Insufficient reserve balance" };
  }
  
  // Reset monthly tracking if new month
  this.resetMonthlyTracking();
  
  // Check monthly limit
  if (this.current_month_withdrawn + amount > this.config.max_withdrawal_per_month) {
    return { 
      allowed: false, 
      reason: `Monthly withdrawal limit exceeded (KES ${this.config.max_withdrawal_per_month.toLocaleString()})` 
    };
  }
  
  // Check percentage limit
  const maxPercentageAmount = (this.current_balance * this.config.max_withdrawal_percentage) / 100;
  if (amount > maxPercentageAmount) {
    return { 
      allowed: false, 
      reason: `Cannot withdraw more than ${this.config.max_withdrawal_percentage}% of reserve balance` 
    };
  }
  
  return { allowed: true };
};

export default mongoose.model("GroupReserveAccount", groupReserveAccountSchema);
