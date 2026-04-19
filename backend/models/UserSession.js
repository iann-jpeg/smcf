import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema({
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
  role: {
    type: String,
    required: true,
    enum: ['admin', 'super_admin', 'superadmin', 'member', 'committee', 'treasurer', 'secretary', 'auditor', 'viewer', 'credit_officer']
  },
  loginTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  sessionDuration: {
    type: Number, // in seconds
    default: 0
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
  sessionToken: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'user_sessions'
});

// Indexes for performance
userSessionSchema.index({ userId: 1, loginTime: -1 });
userSessionSchema.index({ loginTime: -1 });
userSessionSchema.index({ isActive: 1 });
userSessionSchema.index({ role: 1 });

// Method to end session
userSessionSchema.methods.endSession = function() {
  this.logoutTime = new Date();
  this.isActive = false;
  this.sessionDuration = Math.floor((this.logoutTime - this.loginTime) / 1000);
  return this.save();
};

// Static method to get active sessions count
userSessionSchema.statics.getActiveSessions = function() {
  return this.countDocuments({ isActive: true, archived: false });
};

// Static method to get user's last login
userSessionSchema.statics.getLastLogin = function(userId) {
  return this.findOne({ userId }).sort({ loginTime: -1 });
};

export default mongoose.model('UserSession', userSessionSchema);
