import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Member', 'Admin']
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'actorModel',
    default: null
  },
  actorModel: {
    type: String,
    enum: ['Member', 'Admin'],
    default: null
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'deposit',
      'withdrawal',
      'loan_application',
      'loan_approval',
      'loan_rejection',
      'loan_disbursement',
      'loan_repayment',
      'profile_update',
      'password_change',
      'admin_action',
      'search',
      'report_generation',
      'export',
      'settings_change',
      'member_registration',
      'member_approval',
      'member_suspension',
      'cycle_creation',
      'announcement_creation',
      'other'
    ]
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  amount: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'success'
  },
  ipAddress: {
    type: String,
    default: null
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSession',
    default: null
  },
  archived: {
    type: Boolean,
    default: false
  },
  // For tamper detection
  hash: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  collection: 'activity_logs'
});

// Indexes for performance
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ activityType: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ actorId: 1 });

import crypto from 'crypto';

  // Generate hash before saving (for tamper detection)
activityLogSchema.pre('save', function(next) {
  if (!this.hash) {
    const data = `${this.userId}${this.activityType}${this.description}${this.createdAt}`;
    this.hash = crypto.createHash('sha256').update(data).digest('hex');
  }
  next();
});

// Make logs immutable after creation
activityLogSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.$set && update.$set.archived !== undefined) {
    // Only allow archiving
    next();
  } else {
    next(new Error('Activity logs are immutable'));
  }
});

// Static method to get member activity timeline
activityLogSchema.statics.getMemberTimeline = function(userId, limit = 50) {
  return this.find({ userId, archived: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'firstName lastName');
};

// Static method to get activity stats
activityLogSchema.statics.getActivityStats = function(dateFrom = null, dateTo = null) {
  const match = { archived: false };
  if (dateFrom) match.createdAt = { $gte: dateFrom };
  if (dateTo) match.createdAt = { ...match.createdAt, $lte: dateTo };
  
  return this.aggregate([
    { $match: match },
    { $group: { _id: '$activityType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

export default mongoose.model('ActivityLog', activityLogSchema);
