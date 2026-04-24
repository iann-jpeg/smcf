import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema({
  searchTerm: {
    type: String,
    required: true,
    trim: true
  },
  searchCategory: {
    type: String,
    required: true,
    enum: ['members', 'loans', 'transactions', 'reports', 'savings', 'cycles', 'general', 'other']
  },
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
  userRole: {
    type: String,
    required: true,
    enum: ['admin', 'super_admin', 'member', 'committee']
  },
  resultsCount: {
    type: Number,
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
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSession',
    default: null
  },
  suspicious: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'search_logs'
});

// Indexes for performance
searchLogSchema.index({ userId: 1, createdAt: -1 });
searchLogSchema.index({ searchTerm: 'text' });
searchLogSchema.index({ searchCategory: 1, createdAt: -1 });
searchLogSchema.index({ createdAt: -1 });
searchLogSchema.index({ suspicious: 1 });

// Static method to get top searches
searchLogSchema.statics.getTopSearches = function(limit = 10, dateFrom = null) {
  const match = { archived: false };
  if (dateFrom) {
    match.createdAt = { $gte: dateFrom };
  }
  
  return this.aggregate([
    { $match: match },
    { $group: { _id: '$searchTerm', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// Static method to get search count by category
searchLogSchema.statics.getSearchesByCategory = function(dateFrom = null) {
  const match = { archived: false };
  if (dateFrom) {
    match.createdAt = { $gte: dateFrom };
  }
  
  return this.aggregate([
    { $match: match },
    { $group: { _id: '$searchCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

export default mongoose.model('SearchLog', searchLogSchema);
