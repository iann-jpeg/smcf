import { Router } from 'express';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Transaction from '../models/Transaction';
import LoanGuarantor from '../models/LoanGuarantor';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private (Staff only)
router.get('/stats', protect, authorize('admin', 'credit_officer', 'treasurer', 'credit_committee', 'auditor'), async (req, res, next) => {
  try {
    // --- Members ---
    const totalMembers = await Member.countDocuments({ status: 'active' });

    const [savingsResult, sharesResult, memberLoanResult] = await Promise.all([
      Member.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$savings' } } }
      ]),
      Member.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$shares' } } }
      ]),
      // Sum loanBalance directly from Member records (most reliable — updated at disbursement)
      Member.aggregate([
        { $match: { status: 'active', loanBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$loanBalance' } } }
      ]),
    ]);

    const totalSavings = savingsResult[0]?.total || 0;
    const totalShares  = sharesResult[0]?.total  || 0;

    // --- Loans ---
    // Active loans = approved (committed) + disbursed + active (repaying)
    const activeLoans = await Loan.countDocuments({
      status: { $in: ['approved', 'disbursed', 'active'] }
    });

    // Total outstanding balance: sum from member records (disbursed principal)
    // Fall back to summing Loan.balance if member records are empty
    const memberTotalLoan = memberLoanResult[0]?.total || 0;
    let totalLoanBalance = memberTotalLoan;
    if (totalLoanBalance === 0) {
      const loanBalRes = await Loan.aggregate([
        { $match: { status: { $in: ['disbursed', 'active'] } } },
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ]);
      totalLoanBalance = loanBalRes[0]?.total || 0;
    }

    // Pending = awaiting approval
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });

    // --- Risk metrics ---
    // PAR 30: loans in 'active' or 'disbursed' status where a repayment is overdue
    // Simplified: defaulted loans / all disbursed loans
    const totalDisbursed = await Loan.countDocuments({
      status: { $in: ['disbursed', 'active', 'completed', 'defaulted'] }
    });
    const defaultedLoans = await Loan.countDocuments({ status: 'defaulted' });
    const defaultRate = totalDisbursed > 0
      ? Math.round((defaultedLoans / totalDisbursed) * 100 * 10) / 10
      : 0;
    const par30 = defaultRate; // proxy until repayment schedule tracking is in place

    // --- Interest income: sum interest portion from completed + active loans ---
    const interestResult = await Loan.aggregate([
      { $match: { status: { $in: ['disbursed', 'active', 'completed'] } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $subtract: ['$totalPayable', '$principal'] } }
        }
      }
    ]);
    const interestIncome = interestResult[0]?.total || 0;

    // --- Guarantees ---
    const activeGuarantees = await LoanGuarantor.countDocuments();

    // --- Recent transactions ---
    const recentTransactions = await Transaction.find()
      .populate('memberId', 'name memberId')
      .sort({ processedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalMembers,
        totalSavings,
        totalShares,
        activeLoans,
        totalLoanBalance,
        pendingLoans,
        defaultRate,
        par30,
        interestIncome,
        activeGuarantees,
        recentTransactions,
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/dashboard/growth
// @desc    Get growth statistics
// @access  Private (Staff only)
router.get('/growth', protect, authorize('admin', 'credit_officer', 'treasurer', 'credit_committee', 'auditor'), async (req, res, next) => {
  try {
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - Number(months));

    // Member growth
    const memberGrowth = await Member.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Loan disbursement growth
    const loanGrowth = await Loan.aggregate([
      { 
        $match: { 
          disbursedDate: { $gte: startDate },
          status: { $in: ['disbursed', 'active', 'completed'] }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$disbursedDate' },
            month: { $month: '$disbursedDate' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$principal' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        memberGrowth,
        loanGrowth
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
