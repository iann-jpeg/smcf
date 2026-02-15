import express from 'express';
import UserSession from '../models/UserSession.js';
import SearchLog from '../models/SearchLog.js';
import ActivityLog from '../models/ActivityLog.js';
import LoginAttempt from '../models/LoginAttempt.js';
import UsageStats from '../models/UsageStats.js';
import Member from '../models/Member.js';
import { logActivity } from '../middleware/activityTracker.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all analytics routes - require authentication
router.use(protect);

/**
 * Helper function to parse date range from query
 */
const parseDateRange = (req) => {
  const { period, startDate, endDate } = req.query;
  let dateFrom, dateTo;
  
  dateTo = endDate ? new Date(endDate) : new Date();
  
  switch (period) {
    case 'today':
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 1);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date(dateFrom);
      dateTo.setHours(23, 59, 59, 999);
      break;
    case 'week':
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 7);
      break;
    case 'month':
      dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - 1);
      break;
    case 'year':
      dateFrom = new Date();
      dateFrom.setFullYear(dateFrom.getFullYear() - 1);
      break;
    default:
      dateFrom = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { dateFrom, dateTo };
};

/**
 * GET /api/analytics/dashboard
 * Get main dashboard overview
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { dateFrom, dateTo } = parseDateRange(req);
    
    // Get active sessions
    const activeSessions = await UserSession.countDocuments({ isActive: true });
    
    // Get daily/weekly/monthly active users
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [dailyActiveUsers, weeklyActiveUsers, monthlyActiveUsers] = await Promise.all([
      UserSession.distinct('userId', { loginTime: { $gte: today } }),
      UserSession.distinct('userId', { loginTime: { $gte: weekAgo } }),
      UserSession.distinct('userId', { loginTime: { $gte: monthAgo } })
    ]);
    
    // Get total users
    const totalUsers = await Member.countDocuments({ status: 'active' });
    
    // Get login statistics
    const totalLogins = await UserSession.countDocuments({
      loginTime: { $gte: dateFrom, $lte: dateTo }
    });
    
    // Get search statistics
    const totalSearches = await SearchLog.countDocuments({
      createdAt: { $gte: dateFrom, $lte: dateTo }
    });
    
    // Get activity statistics
    const totalTransactions = await ActivityLog.countDocuments({
      activityType: { $in: ['deposit', 'withdrawal', 'loan_repayment'] },
      createdAt: { $gte: dateFrom, $lte: dateTo }
    });
    
    // Get peak usage times
    const peakUsage = await UserSession.aggregate([
      {
        $match: {
          loginTime: { $gte: dateFrom, $lte: dateTo }
        }
      },
      {
        $group: {
          _id: { $hour: '$loginTime' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 1
      }
    ]);
    
    // Get recent failed login attempts
    const failedLogins = await LoginAttempt.countDocuments({
      success: false,
      createdAt: { $gte: dateFrom, $lte: dateTo }
    });
    
    res.json({
      overview: {
        totalUsers,
        activeSessions,
        dailyActiveUsers: dailyActiveUsers.length,
        weeklyActiveUsers: weeklyActiveUsers.length,
        monthlyActiveUsers: monthlyActiveUsers.length
      },
      metrics: {
        totalLogins,
        totalSearches,
        totalTransactions,
        failedLogins
      },
      peakUsage: peakUsage.length > 0 ? {
        hour: peakUsage[0]._id,
        count: peakUsage[0].count
      } : null,
      dateRange: { dateFrom, dateTo }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Error fetching dashboard data', error: error.message });
  }
});

/**
 * GET /api/analytics/searches
 * Get search analytics
 */
router.get('/searches', async (req, res) => {
  try {
    const { dateFrom, dateTo } = parseDateRange(req);
    const { userId, category, limit = 100 } = req.query;
    
    const query = {
      createdAt: { $gte: dateFrom, $lte: dateTo },
      archived: false
    };
    
    if (userId) query.userId = userId;
    if (category) query.searchCategory = category;
    
    // Get total searches
    const totalSearches = await SearchLog.countDocuments(query);
    
    // Get top searches
    const topSearches = await SearchLog.getTopSearches(20, dateFrom);
    
    // Get searches by category
    const searchesByCategory = await SearchLog.getSearchesByCategory(dateFrom);
    
    // Get recent searches (optimized with lean)
    const recentSearches = await SearchLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 50))
      .populate('userId', 'name phone member_id')
      .select('-__v')
      .lean();
    
    // Get searches per user
    const searchesPerUser = await SearchLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get suspicious searches
    const suspiciousSearches = await SearchLog.countDocuments({
      ...query,
      suspicious: true
    });
    
    res.json({
      totalSearches,
      topSearches,
      searchesByCategory,
      recentSearches,
      searchesPerUser,
      suspiciousSearches,
      dateRange: { dateFrom, dateTo }
    });
  } catch (error) {
    console.error('Error fetching search analytics:', error);
    res.status(500).json({ message: 'Error fetching search analytics', error: error.message });
  }
});

/**
 * GET /api/analytics/logins
 * Get login and session analytics
 */
router.get('/logins', async (req, res) => {
  try {
    const { dateFrom, dateTo } = parseDateRange(req);
    const { userId } = req.query;
    
    const query = {
      loginTime: { $gte: dateFrom, $lte: dateTo }
    };
    
    if (userId) query.userId = userId;
    
    // Get total logins
    const totalLogins = await UserSession.countDocuments(query);
    
    // Get unique users
    const uniqueUsers = await UserSession.distinct('userId', query);
    
    // Get average session duration
    const avgSessionDuration = await UserSession.aggregate([
      { $match: { ...query, sessionDuration: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$sessionDuration' }
        }
      }
    ]);
    
    // Get logins by role
    const loginsByRole = await UserSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get logins by device type
    const loginsByDevice = await UserSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get active sessions (optimized with lean)
    const activeSessions = await UserSession.find({ isActive: true })
      .populate('userId', 'name phone member_id')
      .sort({ loginTime: -1 })
      .limit(20)
      .lean();
    
    // Get failed login attempts
    const failedAttempts = await LoginAttempt.aggregate([
      {
        $match: {
          success: false,
          createdAt: { $gte: dateFrom, $lte: dateTo }
        }
      },
      {
        $group: {
          _id: '$failureReason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get suspicious IPs
    const suspiciousIPs = await LoginAttempt.getSuspiciousIPs(10);
    
    res.json({
      totalLogins,
      uniqueUsers: uniqueUsers.length,
      averageSessionDuration: avgSessionDuration.length > 0 ? avgSessionDuration[0].avgDuration : 0,
      loginsByRole,
      loginsByDevice,
      activeSessions,
      failedAttempts,
      suspiciousIPs,
      dateRange: { dateFrom, dateTo }
    });
  } catch (error) {
    console.error('Error fetching login analytics:', error);
    res.status(500).json({ message: 'Error fetching login analytics', error: error.message });
  }
});

/**
 * GET /api/analytics/activities
 * Get activity analytics
 */
router.get('/activities', async (req, res) => {
  try {
    const { dateFrom, dateTo } = parseDateRange(req);
    const { userId, activityType, limit = 100 } = req.query;
    
    const query = {
      createdAt: { $gte: dateFrom, $lte: dateTo },
      archived: false
    };
    
    if (userId) query.userId = userId;
    if (activityType) query.activityType = activityType;
    
    // Get total activities
    const totalActivities = await ActivityLog.countDocuments(query);
    
    // Get activities by type
    const activitiesByType = await ActivityLog.getActivityStats(dateFrom, dateTo);
    
    // Get recent activities (optimized with lean)
    const recentActivities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 50))
      .populate('userId', 'name phone member_id')
      .populate('actorId', 'name phone member_id')
      .select('-__v')
      .lean();
    
    // Get most active users with their details
    const mostActiveUsersRaw = await ActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          userModel: { $first: '$userModel' },
          activityCount: { $sum: 1 }
        }
      },
      { $sort: { activityCount: -1 } },
      { $limit: 10 }
    ]);
    
    // Populate user details for most active users
    const Member = (await import('../models/Member.js')).default;
    const Admin = (await import('../models/Admin.js')).default;
    
    const mostActiveUsers = await Promise.all(
      mostActiveUsersRaw.map(async (item) => {
        if (!item._id) return item;
        
        const Model = item.userModel === 'Member' ? Member : Admin;
        const user = await Model.findById(item._id).select('name phone member_id');
        
        return {
          _id: item._id,
          activityCount: item.activityCount,
          name: user?.name || 'Unknown User',
          phone: user?.phone,
          member_id: user?.member_id,
          userModel: item.userModel
        };
      })
    );
    
    // Get activity trends (daily counts)
    const activityTrends = await ActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      totalActivities,
      activitiesByType,
      recentActivities,
      mostActiveUsers,
      activityTrends,
      dateRange: { dateFrom, dateTo }
    });
  } catch (error) {
    console.error('Error fetching activity analytics:', error);
    res.status(500).json({ message: 'Error fetching activity analytics', error: error.message });
  }
});

/**
 * GET /api/analytics/timeline/all
 * Get complete activity timeline for all members
 */
router.get('/timeline/all', async (req, res) => {
  try {
    const { limit = 100, search } = req.query;
    
    // Build query
    let query = { archived: false };
    
    // If search term provided, find matching members first
    if (search) {
      const Member = (await import('../models/Member.js')).default;
      const Admin = (await import('../models/Admin.js')).default;
      
      const searchRegex = new RegExp(search, 'i');
      const [members, admins] = await Promise.all([
        Member.find({
          $or: [
            { name: searchRegex },
            { member_id: searchRegex },
            { phone: searchRegex }
          ]
        }).select('_id'),
        Admin.find({
          $or: [
            { name: searchRegex },
            { phone: searchRegex }
          ]
        }).select('_id')
      ]);
      
      const userIds = [...members.map(m => m._id), ...admins.map(a => a._id)];
      if (userIds.length > 0) {
        query.userId = { $in: userIds };
      } else {
        // No matching users found
        return res.json({
          activities: [],
          totalCount: 0
        });
      }
    }
    
    // Get all activities with user information (optimized with lean)
    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .populate('userId', 'name phone member_id')
      .populate('actorId', 'name phone member_id')
      .select('-hash -__v')
      .lean();
    
    // Get total count
    const totalCount = await ActivityLog.countDocuments(query);
    
    res.json({
      activities,
      totalCount
    });
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({ message: 'Error fetching activity timeline', error: error.message });
  }
});

/**
 * GET /api/analytics/members/:memberId/timeline
 * Get individual member activity timeline
 */
router.get('/members/:memberId/timeline', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 50 } = req.query;
    
    // Get member's activity timeline
    const timeline = await ActivityLog.getMemberTimeline(memberId, parseInt(limit));
    
    // Get member's login history
    const loginHistory = await UserSession.find({ userId: memberId })
      .sort({ loginTime: -1 })
      .limit(20)
      .select('-sessionToken -__v');
    
    // Get member's search history
    const searchHistory = await SearchLog.find({ userId: memberId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-__v');
    
    // Get member's last login
    const lastLogin = await UserSession.getLastLogin(memberId);
    
    res.json({
      timeline,
      loginHistory,
      searchHistory,
      lastLogin
    });
  } catch (error) {
    console.error('Error fetching member timeline:', error);
    res.status(500).json({ message: 'Error fetching member timeline', error: error.message });
  }
});

/**
 * GET /api/analytics/members/inactive
 * Get list of inactive members
 */
router.get('/members/inactive', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get all active members
    const allMembers = await Member.find({ status: 'active' }).select('_id firstName lastName phoneNumber');
    
    // Get members who logged in after threshold
    const activeUserIds = await UserSession.distinct('userId', {
      loginTime: { $gte: thresholdDate }
    });
    
    // Filter out active members
    const inactiveMembers = allMembers.filter(
      member => !activeUserIds.some(id => id.toString() === member._id.toString())
    );
    
    // Get last login for each inactive member
    const inactiveMembersWithLastLogin = await Promise.all(
      inactiveMembers.map(async (member) => {
        const lastLogin = await UserSession.getLastLogin(member._id);
        return {
          ...member.toObject(),
          lastLogin: lastLogin?.loginTime || null,
          daysSinceLogin: lastLogin 
            ? Math.floor((Date.now() - lastLogin.loginTime.getTime()) / (24 * 60 * 60 * 1000))
            : null
        };
      })
    );
    
    res.json({
      count: inactiveMembersWithLastLogin.length,
      members: inactiveMembersWithLastLogin,
      threshold: { days, date: thresholdDate }
    });
  } catch (error) {
    console.error('Error fetching inactive members:', error);
    res.status(500).json({ message: 'Error fetching inactive members', error: error.message });
  }
});

/**
 * GET /api/analytics/usage-stats
 * Get aggregated usage statistics
 */
router.get('/usage-stats', async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;
    
    const dateFrom = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = endDate ? new Date(endDate) : new Date();
    
    // Get usage stats for the period
    const stats = await UsageStats.getStatsForRange(period, dateFrom, dateTo);
    
    // Get latest stats
    const latestStats = await UsageStats.getLatestStats(period);
    
    res.json({
      stats,
      latestStats,
      period,
      dateRange: { dateFrom, dateTo }
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ message: 'Error fetching usage stats', error: error.message });
  }
});

/**
 * POST /api/analytics/generate-stats
 * Generate usage statistics for a specific period (Admin only)
 */
router.post('/generate-stats', async (req, res) => {
  try {
    const { period = 'daily', date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    
    // Set date range based on period
    let startDate, endDate;
    
    switch (period) {
      case 'daily':
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(targetDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'annual':
        startDate = new Date(targetDate.getFullYear(), 0, 1);
        endDate = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        return res.status(400).json({ message: 'Invalid period' });
    }
    
    // Calculate metrics
    const [
      totalUsers,
      activeUserIds,
      newUsers,
      sessions,
      searches,
      activities
    ] = await Promise.all([
      Member.countDocuments({ status: 'active', createdAt: { $lte: endDate } }),
      UserSession.distinct('userId', { loginTime: { $gte: startDate, $lte: endDate } }),
      Member.countDocuments({ status: 'active', createdAt: { $gte: startDate, $lte: endDate } }),
      UserSession.find({ loginTime: { $gte: startDate, $lte: endDate } }),
      SearchLog.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      ActivityLog.find({ createdAt: { $gte: startDate, $lte: endDate } })
    ]);
    
    // Calculate session metrics
    const totalSessions = sessions.length;
    const uniqueLogins = activeUserIds.length;
    const totalLogins = sessions.length;
    const validSessions = sessions.filter(s => s.sessionDuration > 0);
    const averageSessionDuration = validSessions.length > 0
      ? validSessions.reduce((sum, s) => sum + s.sessionDuration, 0) / validSessions.length
      : 0;
    
    // Calculate activity metrics
    const deposits = activities.filter(a => a.activityType === 'deposit');
    const withdrawals = activities.filter(a => a.activityType === 'withdrawal');
    const loanApplications = activities.filter(a => a.activityType === 'loan_application');
    const loanDisbursements = activities.filter(a => a.activityType === 'loan_disbursement');
    
    const totalDepositAmount = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalWithdrawalAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const totalLoanAmount = loanDisbursements.reduce((sum, l) => sum + (l.amount || 0), 0);
    
    // Calculate peak usage
    const loginsByHour = {};
    sessions.forEach(s => {
      const hour = s.loginTime.getHours();
      loginsByHour[hour] = (loginsByHour[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(loginsByHour)
      .sort((a, b) => b[1] - a[1])[0];
    
    const peakUsageHour = peakHour ? parseInt(peakHour[0]) : null;
    const peakUsageCount = peakHour ? peakHour[1] : 0;
    
    // Count logins by role
    const adminLogins = sessions.filter(s => 
      s.role === 'admin' || s.role === 'super_admin'
    ).length;
    const memberLogins = sessions.filter(s => s.role === 'member').length;
    
    // Create or update usage stats
    const stats = await UsageStats.findOneAndUpdate(
      { period, date: startDate },
      {
        period,
        date: startDate,
        totalUsers,
        activeUsers: uniqueLogins,
        newUsers,
        totalLogins,
        uniqueLogins,
        totalSessions,
        averageSessionDuration: Math.round(averageSessionDuration),
        totalSearches: searches,
        totalTransactions: deposits.length + withdrawals.length + loanDisbursements.length,
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        totalLoanApplications: loanApplications.length,
        totalLoanDisbursements: loanDisbursements.length,
        totalDepositAmount,
        totalWithdrawalAmount,
        totalLoanAmount,
        peakUsageHour,
        peakUsageCount,
        adminLogins,
        memberLogins,
        metadata: {
          generatedAt: new Date(),
          generatedBy: req.user._id
        }
      },
      { upsert: true, new: true }
    );
    
    // Log this activity
    await logActivity({
      userId: req.user._id,
      userModel: 'Admin',
      activityType: 'report_generation',
      description: `Generated ${period} usage statistics for ${startDate.toISOString().split('T')[0]}`,
      metadata: { period, date: startDate }
    });
    
    res.json({
      message: 'Usage statistics generated successfully',
      stats
    });
  } catch (error) {
    console.error('Error generating usage stats:', error);
    res.status(500).json({ message: 'Error generating usage stats', error: error.message });
  }
});

/**
 * GET /api/analytics/financial-trends
 * Get financial trends data for charts (last 7 months of savings, loans, repayments)
 */
router.get('/financial-trends', async (req, res) => {
  try {
    const { months = 7 } = req.query;
    const numMonths = parseInt(months);
    
    // Import models
    const Saving = (await import('../models/Saving.js')).default;
    const Loan = (await import('../models/Loan.js')).default;
    
    const now = new Date();
    const monthlyData = [];
    
    // Generate data for each of the last N months
    for (let i = numMonths - 1; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Get month name (short format)
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      // Calculate savings deposits for the month (completed deposits only)
      const savingsDeposits = await Saving.find({
        transaction_type: 'deposit',
        status: 'completed',
        created_at: { $gte: monthStart, $lte: monthEnd }
      });
      const monthlySavings = savingsDeposits.reduce((sum, s) => sum + (s.amount || 0), 0);
      
      // Calculate loans disbursed for the month
      const loansDisbursed = await Loan.find({
        status: { $in: ['disbursed', 'repaid'] },
        disbursement_date: { $gte: monthStart, $lte: monthEnd }
      });
      const monthlyLoans = loansDisbursed.reduce((sum, l) => sum + (l.amount || 0), 0);
      
      // Calculate repayments for the month
      // Get loans that had repayments made during this month
      const loansWithRepayments = await Loan.find({
        $or: [
          { status: 'repaid', updated_at: { $gte: monthStart, $lte: monthEnd } },
          { 
            status: 'disbursed', 
            amount_paid: { $gt: 0 },
            updated_at: { $gte: monthStart, $lte: monthEnd }
          }
        ]
      });
      
      // For accurate repayment tracking, we should use payment records
      const Payment = (await import('../models/Payment.js')).default;
      const monthlyPayments = await Payment.find({
        payment_type: 'loan_repayment',
        status: 'confirmed',
        created_at: { $gte: monthStart, $lte: monthEnd }
      });
      
      const monthlyRepayments = monthlyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      monthlyData.push({
        month: monthName,
        year: monthDate.getFullYear(),
        monthNumber: monthDate.getMonth() + 1,
        Savings: monthlySavings / 1000000, // Convert to millions for display
        'Loans Disbursed': monthlyLoans / 1000000,
        Repayments: monthlyRepayments / 1000000,
        // Also include raw values for reference
        rawSavings: monthlySavings,
        rawLoans: monthlyLoans,
        rawRepayments: monthlyRepayments
      });
    }
    
    res.json({
      success: true,
      data: monthlyData,
      metadata: {
        months: numMonths,
        generatedAt: new Date(),
        currency: 'KES'
      }
    });
  } catch (error) {
    console.error('Error fetching financial trends:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Error fetching financial trends data'
    });
  }
});

export default router;
