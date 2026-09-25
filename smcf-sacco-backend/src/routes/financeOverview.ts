import { Router } from 'express';
import AuditLog from '../models/AuditLog';
import Transaction from '../models/Transaction';
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

    const [transactions, completedSummary, auditLogs] = await Promise.all([
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
          },
        },
        { $sort: { amount: -1 } },
      ]),
      AuditLog.find({ createdAt: { $gte: startDate, $lte: endDate } })
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
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
          income: 0,
          expenses: 0,
          classificationRequired: summary.verifiedTransactionCount,
          message: 'Organizational income and expenses require explicit finance classification.',
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