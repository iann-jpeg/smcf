import mongoose from 'mongoose';

const usageStatsSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'annual']
  },
  date: {
    type: Date,
    required: true
  },
  // User metrics
  totalUsers: {
    type: Number,
    default: 0
  },
  activeUsers: {
    type: Number,
    default: 0
  },
  newUsers: {
    type: Number,
    default: 0
  },
  // Session metrics
  totalLogins: {
    type: Number,
    default: 0
  },
  uniqueLogins: {
    type: Number,
    default: 0
  },
  totalSessions: {
    type: Number,
    default: 0
  },
  averageSessionDuration: {
    type: Number, // in seconds
    default: 0
  },
  // Activity metrics
  totalSearches: {
    type: Number,
    default: 0
  },
  totalTransactions: {
    type: Number,
    default: 0
  },
  totalDeposits: {
    type: Number,
    default: 0
  },
  totalWithdrawals: {
    type: Number,
    default: 0
  },
  totalLoanApplications: {
    type: Number,
    default: 0
  },
  totalLoanDisbursements: {
    type: Number,
    default: 0
  },
  // Financial metrics
  totalDepositAmount: {
    type: Number,
    default: 0
  },
  totalWithdrawalAmount: {
    type: Number,
    default: 0
  },
  totalLoanAmount: {
    type: Number,
    default: 0
  },
  // Peak usage
  peakUsageHour: {
    type: Number, // 0-23
    default: null
  },
  peakUsageCount: {
    type: Number,
    default: 0
  },
  // Breakdown by role
  adminLogins: {
    type: Number,
    default: 0
  },
  memberLogins: {
    type: Number,
    default: 0
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'usage_stats'
});

// Indexes for performance
usageStatsSchema.index({ period: 1, date: -1 });
usageStatsSchema.index({ date: -1 });

// Unique constraint to prevent duplicate stats for same period/date
usageStatsSchema.index({ period: 1, date: 1 }, { unique: true });

// Static method to get stats for date range
usageStatsSchema.statics.getStatsForRange = function(period, dateFrom, dateTo) {
  return this.find({
    period,
    date: { $gte: dateFrom, $lte: dateTo },
    archived: false
  }).sort({ date: 1 });
};

// Static method to get latest stats
usageStatsSchema.statics.getLatestStats = function(period) {
  return this.findOne({ period, archived: false }).sort({ date: -1 });
};

export default mongoose.model('UsageStats', usageStatsSchema);
