import { Router } from 'express';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Transaction from '../models/Transaction';
import LoanGuarantor from '../models/LoanGuarantor';
import AuditLog from '../models/AuditLog';
import { protect, authorize, AuthRequest } from '../middleware/auth';

async function loadFinancialDashboardSummary() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalMembers,
    savingsResult,
    sharesResult,
    loanBalanceResult,
    activeLoans,
    pendingLoans,
    totalDisbursed,
    defaultedLoans,
    activeGuarantees,
    monthlyTransactionsResult,
    recentTransactions,
  ] = await Promise.all([
    Member.countDocuments({ status: 'active' }),
    Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$savings' } } }]),
    Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$shares' } } }]),
    Member.aggregate([{ $match: { status: 'active', loanBalance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$loanBalance' } } }]),
    Loan.countDocuments({ status: { $in: ['approved', 'disbursed', 'active'] } }),
    Loan.countDocuments({ status: 'pending' }),
    Loan.countDocuments({ status: { $in: ['disbursed', 'active', 'completed', 'defaulted'] } }),
    Loan.countDocuments({ status: 'defaulted' }),
    LoanGuarantor.countDocuments(),
    Transaction.aggregate([
      { $match: { processedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Transaction.find()
      .populate('memberId', 'name memberId')
      .sort({ processedAt: -1 })
      .limit(10),
  ]);

  const totalSavings = savingsResult[0]?.total || 0;
  const totalShares = sharesResult[0]?.total || 0;
  const totalLoanBalance = loanBalanceResult[0]?.total || 0;
  const monthlyTransactions = monthlyTransactionsResult[0]?.total || 0;
  const defaultRate = totalDisbursed > 0 ? Math.round((defaultedLoans / totalDisbursed) * 100 * 10) / 10 : 0;

  return {
    totalMembers,
    totalSavings,
    totalShares,
    totalLoanBalance,
    activeLoans,
    pendingLoans,
    defaultRate,
    activeGuarantees,
    monthlyTransactions,
    recentTransactions,
  };
}

const router = Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics (ROLE-BASED)
// @access  Private (Staff only) - Returns different data based on user role
router.get('/stats', protect, async (req: AuthRequest, res, next) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    const isAdmin = userRoles.includes('admin');
    const isCreditOfficer = userRoles.includes('credit_officer');
    const isCreditCommittee = userRoles.includes('credit_committee');
    const isTreasurer = userRoles.includes('treasurer');
    const isAuditor = userRoles.includes('auditor');
    const isStaff = isAdmin || isCreditOfficer || isCreditCommittee || isTreasurer || isAuditor;

    if (!isStaff) {
      return res.json({
        success: true,
        role: 'member',
        data: {
          totalMembers: 0,
          totalSavings: 0,
          totalShares: 0,
          totalLoanBalance: 0,
          activeLoans: 0,
          availableLiquidity: 0,
          liquidityRatio: 0,
          pendingApprovals: 0,
          defaultRate: 0,
          par30: 0,
          capitalAdequacy: 0,
          interestIncome: 0,
          activeGuarantees: 0,
          recentTransactions: [],
        },
      });
    }

    // ============================================================================
    // ADMIN DASHBOARD - ALL DATA
    // ============================================================================
    if (isAdmin) {
      const financialSummary = await loadFinancialDashboardSummary();

      return res.json({
        success: true,
        role: 'admin',
        data: {
          ...financialSummary,
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
      const financialSummary = await loadFinancialDashboardSummary();

      return res.json({
        success: true,
        role: 'treasurer',
        data: {
          ...financialSummary,
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
