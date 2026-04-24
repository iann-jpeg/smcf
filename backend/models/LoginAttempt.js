import mongoose from 'mongoose';

const loginAttemptSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true // email or phone
  },
  success: {
    type: Boolean,
    required: true,
    default: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userModel',
    default: null
  },
  userModel: {
    type: String,
    enum: ['Member', 'Admin'],
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  },
  deviceType: {
    type: String,
    default: null
  },
  browser: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  failureReason: {
    type: String,
    enum: ['invalid_credentials', 'account_locked', 'account_not_found', 'account_inactive', 'other'],
    default: null
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'login_attempts'
});

// Indexes for performance
loginAttemptSchema.index({ identifier: 1, createdAt: -1 });
loginAttemptSchema.index({ userId: 1, createdAt: -1 });
loginAttemptSchema.index({ success: 1, createdAt: -1 });
loginAttemptSchema.index({ ipAddress: 1, createdAt: -1 });
loginAttemptSchema.index({ createdAt: -1 });

// Static method to get failed attempts count
loginAttemptSchema.statics.getRecentFailedAttempts = function(identifier, minutes = 15) {
  const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);
  return this.countDocuments({
    identifier,
    success: false,
    createdAt: { $gte: timeThreshold }
  });
};

// Static method to detect suspicious activity
loginAttemptSchema.statics.getSuspiciousIPs = function(limit = 10) {
  const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
  
  return this.aggregate([
    {
      $match: {
        success: false,
        createdAt: { $gte: timeThreshold },
        archived: false
      }
    },
    {
      $group: {
        _id: '$ipAddress',
        failedAttempts: { $sum: 1 }
      }
    },
    {
      $match: {
        failedAttempts: { $gte: 5 }
      }
    },
    {
      $sort: { failedAttempts: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

export default mongoose.model('LoginAttempt', loginAttemptSchema);
