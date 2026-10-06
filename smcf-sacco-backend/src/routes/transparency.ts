import { Router } from 'express';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Transaction from '../models/Transaction';

const router = Router();

// Deliberately public and aggregated: never expose member, transaction, loan, or receipt identifiers.
router.get('/', async (_req, res, next) => {
  try {
    const [members, savings, shares, activeLoans, completedTransactions] = await Promise.all([
      Member.countDocuments({ status: 'active' }),
      Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$savings' } } }]),
      Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$shares' } } }]),
      Loan.countDocuments({ status: { $in: ['approved', 'disbursed', 'active'] } }),
      Transaction.countDocuments({ status: 'completed' }),
    ]);
    return res.json({
      success: true,
      data: {
        memberCount: members,
        totalSavings: Number(savings[0]?.total || 0),
        totalShares: Number(shares[0]?.total || 0),
        activeLoanCount: activeLoans,
        completedTransactionCount: completedTransactions,
        disclaimer: 'Figures are aggregated for transparency and do not contain personal or transaction-level information.',
        asOf: new Date().toISOString(),
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
