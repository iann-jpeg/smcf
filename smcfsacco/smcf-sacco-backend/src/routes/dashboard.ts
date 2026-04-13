import { Router } from 'express';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Transaction from '../models/Transaction';
import LoanGuarantor from '../models/LoanGuarantor';
import AuditLog from '../models/AuditLog';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics (ROLE-BASED)
// @access  Private (Staff only) - Returns different data based on user role
router.get('/stats', protect, authorize('admin', 'credit_officer', 'treasurer', 'credit_committee', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isCreditOfficer = userRoles.includes('credit_officer');
    const isCreditCommittee = userRoles.includes('credit_committee');
    const isTreasurer = userRoles.includes('treasurer');
    const isAuditor = userRoles.includes('auditor');

    // ============================================================================
    // ADMIN DASHBOARD - ALL DATA
    // ============================================================================
    if (isAdmin) {
      const totalMembers = await Member.countDocuments({ status: 'active' });
      const [savingsResult, sharesResult, memberLoanResult] = await Promise.all([
        Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$savings' } } }]),
        Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$shares' } } }]),
        Member.aggregate([{ $match: { status: 'active', loanBalance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$loanBalance' } } }]),
      ]);

      const activeLoans = await Loan.countDocuments({ status: { $in: ['approved', 'disbursed', 'active'] } });
      const memberTotalLoan = memberLoanResult[0]?.total || 0;
      const totalDisbursed = await Loan.countDocuments({ status: { $in: ['disbursed', 'active', 'completed', 'defaulted'] } });
      const defaultedLoans = await Loan.countDocuments({ status: 'defaulted' });
      const pendingLoans = await Loan.countDocuments({ status: 'pending' });
      const recentTransactions = await Transaction.find()
        .populate('memberId', 'name memberId')
        .sort({ processedAt: -1 })
        .limit(5);

      return res.json({
        success: true,
        role: 'admin',
        data: {
          totalMembers,
          totalSavings: savingsResult[0]?.total || 0,
          totalShares: sharesResult[0]?.total || 0,
          activeLoans,
          totalLoanBalance: memberTotalLoan,
          pendingLoans,
          defaultRate: totalDisbursed > 0 ? Math.round((defaultedLoans / totalDisbursed) * 100 * 10) / 10 : 0,
          activeGuarantees: await LoanGuarantor.countDocuments(),
          recentTransactions,
        }
      });
    }

    // ============================================================================
    // CREDIT OFFICER DASHBOARD - MEMBERS & APPLICATIONS
    // ============================================================================
    if (isCreditOfficer) {
      const totalMembers = await Member.countDocuments({ status: 'active' });
      const newMembers = await Member.countDocuments({ 
        status: 'active', 
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      });
      
      const pendingLoans = await Loan.countDocuments({ status: 'pending' });
      const recentApplications = await Loan.find({ status: 'pending' })
        .populate('memberId', 'name memberId')
        .sort({ appliedAt: -1 })
        .limit(5);

      return res.json({
        success: true,
        role: 'credit_officer',
        data: {
          totalMembers,
          newMembers,
          pendingLoans,
          recentApplications,
          message: 'Manage member registrations and loan applications'
        }
      });
    }

    // ============================================================================
    // CREDIT COMMITTEE DASHBOARD - LOAN APPROVALS
    // ============================================================================
    if (isCreditCommittee) {
      const pendingApprovals = await Loan.countDocuments({ status: 'pending' });
      const approvedLoans = await Loan.countDocuments({ status: 'approved' });
      const rejectedLoans = await Loan.countDocuments({ status: 'rejected' });
      
      const pendingForReview = await Loan.find({ status: 'pending' })
        .populate('memberId', 'name memberId')
        .sort({ appliedAt: -1 })
        .limit(10);

      return res.json({
        success: true,
        role: 'credit_committee',
        data: {
          pendingApprovals,
          approvedLoans,
          rejectedLoans,
          pendingForReview,
          message: 'Review and approve loan applications'
        }
      });
    }

    // ============================================================================
    // TREASURER DASHBOARD - FINANCIAL DATA
    // ============================================================================
    if (isTreasurer) {
      const [savingsResult, sharesResult, transactionsResult] = await Promise.all([
        Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$savings' } } }]),
        Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$shares' } } }]),
        Transaction.aggregate([
          { $match: { processedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
      ]);

      const totalSavings = savingsResult[0]?.total || 0;
      const totalShares = sharesResult[0]?.total || 0;
      const monthlyTransactions = transactionsResult[0]?.total || 0;

      const recentTransactions = await Transaction.find()
        .populate('memberId', 'name memberId')
        .sort({ processedAt: -1 })
        .limit(10);

      return res.json({
        success: true,
        role: 'treasurer',
        data: {
          totalSavings,
          totalShares,
          monthlyTransactions,
          recentTransactions,
          message: 'Manage accounts, ledger, and financial transactions'
        }
      });
    }

    // ============================================================================
    // AUDITOR DASHBOARD - COMPLIANCE & AUDIT LOGS
    // ============================================================================
    if (isAuditor) {
      const auditLogsCount = await AuditLog.countDocuments();
      const recentAuditLogs = await AuditLog.find()
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(10);

      // Risk metrics
      const defaultedLoans = await Loan.countDocuments({ status: 'defaulted' });
      const totalDisbursed = await Loan.countDocuments({ status: { $in: ['disbursed', 'active', 'completed', 'defaulted'] } });
      const defaultRate = totalDisbursed > 0 ? Math.round((defaultedLoans / totalDisbursed) * 100 * 10) / 10 : 0;

      return res.json({
        success: true,
        role: 'auditor',
        data: {
          auditLogsCount,
          recentAuditLogs,
          defaultRate,
          riskMetrics: {
            defaultedLoans,
            totalDisbursed
          },
          message: 'Audit logs, compliance, and risk assessment'
        }
      });
    }

    // Fallback (shouldn't reach here due to authorize middleware)
    res.status(403).json({ success: false, message: 'Role not recognized' });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/dashboard/growth
// @desc    Get growth statistics (ROLE-BASED)
// @access  Private (Staff only)
router.get('/growth', protect, authorize('admin', 'credit_officer', 'treasurer', 'credit_committee', 'auditor'), async (req: AuthRequest, res, next) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - Number(months));

    // Admin & Treasurer: see member growth + loan growth
    if (userRoles.includes('admin') || userRoles.includes('treasurer')) {
      const memberGrowth = await Member.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      const loanGrowth = await Loan.aggregate([
        { $match: { disbursedDate: { $gte: startDate }, status: { $in: ['disbursed', 'active', 'completed'] } } },
        { $group: { _id: { year: { $year: '$disbursedDate' }, month: { $month: '$disbursedDate' } }, count: { $sum: 1 }, totalAmount: { $sum: '$principal' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return res.json({ success: true, role: userRoles[0], data: { memberGrowth, loanGrowth } });
    }

    // Credit Officer: see member growth only
    if (userRoles.includes('credit_officer')) {
      const memberGrowth = await Member.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return res.json({ success: true, role: 'credit_officer', data: { memberGrowth, message: 'New member registrations over time' } });
    }

    // Credit Committee: see loan approval growth
    if (userRoles.includes('credit_committee')) {
      const approvalGrowth = await Loan.aggregate([
        { $match: { approvedAt: { $gte: startDate } } },
        { $group: { _id: { year: { $year: '$approvedAt' }, month: { $month: '$approvedAt' } }, count: { $sum: 1 }, totalAmount: { $sum: '$principal' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return res.json({ success: true, role: 'credit_committee', data: { approvalGrowth, message: 'Loan approvals over time' } });
    }

    // Auditor: see default rate trends
    if (userRoles.includes('auditor')) {
      const defaultTrends = await Loan.aggregate([
        { $match: { status: 'defaulted' } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return res.json({ success: true, role: 'auditor', data: { defaultTrends, message: 'Default trends over time' } });
    }

    res.status(403).json({ success: false, message: 'Role not recognized' });
  } catch (error) {
    next(error);
  }
});

export default router;
