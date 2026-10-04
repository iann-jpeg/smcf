import { Router } from 'express';
import AuditLog from '../models/AuditLog';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import { protect, authorize } from '../middleware/auth';

const router = Router();
const STAFF_ROLES = ['admin', 'treasurer', 'auditor'];

router.get('/', protect, authorize(...STAFF_ROLES), async (req, res, next) => {
  try {
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid finance overview date range' });
    }

    const completedFilter = {
      status: 'completed',
      processedAt: { $gte: startDate, $lte: endDate },
    };

    const trendStart = new Date(startDate);
    trendStart.setMonth(trendStart.getMonth() - 5);
    const [transactions, completedSummary, auditLogs, monthlySummary, loanInterestSummary] = await Promise.all([
      Transaction.find(completedFilter)
        .populate('memberId', 'name memberId')
        .sort({ processedAt: -1 })
        .limit(10)
        .lean(),
      Transaction.aggregate([
        { $match: completedFilter },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
            feeAmount: { $sum: '$feeAmount' },
          },
        },
        { $sort: { amount: -1 } },
      ]),
      AuditLog.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      Transaction.aggregate([
        { $match: { status: 'completed', processedAt: { $gte: trendStart, $lte: endDate } } },
        {
          $group: {
            _id: { year: { $year: '$processedAt' }, month: { $month: '$processedAt' } },
            income: { $sum: '$feeAmount' },
            volume: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Loan.aggregate([
        { $match: { status: { $in: ['disbursed', 'active', 'completed', 'defaulted'] } } },
        { $group: { _id: null, total: { $sum: '$totalInterest' } } },
      ]),
    ]);

    const summary = completedSummary.reduce(
      (result, item) => {
        result.verifiedTransactionCount += Number(item.count || 0);
        result.verifiedTransactionVolume += Number(item.amount || 0);
        result.byType[String(item._id)] = {
          count: Number(item.count || 0),
          amount: Number(item.amount || 0),
        };
        return result;
      },
      {
        verifiedTransactionCount: 0,
        verifiedTransactionVolume: 0,
        byType: {} as Record<string, { count: number; amount: number }>,
      },
    );
    const transactionFees = completedSummary.reduce(
      (total, item) => total + Number(item.feeAmount || 0),
      0,
    );
    const loanInterest = Number(loanInterestSummary[0]?.total || 0);
    const monthly = monthlySummary.map((item) => ({
      label: new Date(Number(item._id.year), Number(item._id.month) - 1, 1).toLocaleDateString('en-KE', { month: 'short' }),
      income: Number(item.income || 0),
      expenses: 0,
      volume: Number(item.volume || 0),
    }));

    return res.json({
      success: true,
      data: {
        period: { startDate, endDate },
        verifiedTransactions: summary,
        memberFunds: {
          deposits: summary.byType.deposit?.amount || 0,
          withdrawals: summary.byType.withdrawal?.amount || 0,
          loanDisbursements: summary.byType.loan_disbursement?.amount || 0,
          loanRepayments: summary.byType.loan_repayment?.amount || 0,
          sharePurchases: summary.byType.share_purchase?.amount || 0,
        },
        organizationalFunds: {
          income: transactionFees + loanInterest,
          expenses: 0,
          transactionFees,
          loanInterest,
          otherIncome: 0,
          netPosition: transactionFees + loanInterest,
          classificationRequired: summary.verifiedTransactionCount,
          message: 'Expenses are not classified in the current ledger and are shown as zero until finance records are entered.',
        },
        monthlyPerformance: monthly,
        incomeSources: {
          transactionFees,
          loanInterest,
          otherIncome: 0,
        },
        expenseBreakdown: {
          hosting: 0,
          domain: 0,
          paymentApi: 0,
          maintenance: 0,
          bankCharges: 0,
          taxes: 0,
        },
        recentTransactions: transactions,
        recentAuditActivity: auditLogs,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;