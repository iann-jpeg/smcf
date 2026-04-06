import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Member from '../models/Member';
import Transaction from '../models/Transaction';
import SavingsInterestDistribution, { SavingsInterestStatementModel } from '../models/SavingsInterestDistribution';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { notifyMember, notifyStaff } from '../utils/notify';

const router = Router();

type PreviewRow = {
  memberId: string;
  memberName: string;
  savings: number;
  interest: number;
  newSavings: number;
};

async function buildPreview(totalProfit: number, interestRate: number) {
  const members = await Member.find({ status: 'active', savings: { $gt: 0 } }).select('name savings');
  if (members.length === 0) {
    throw new Error('No active members with savings found for distribution.');
  }
  const rows: PreviewRow[] = members.map((m: any) => {
    const savings = Number(m.savings || 0);
    const interest = Math.round((savings * interestRate) / 100);
    return {
      memberId: String(m._id),
      memberName: m.name,
      savings,
      interest,
      newSavings: savings + interest,
    };
  });

  const totalSavings = rows.reduce((s, r) => s + r.savings, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const membersCount = rows.length;

  if (totalInterest > totalProfit) {
    throw new Error('Calculated interest exceeds available profit. Adjust rate or profit.');
  }

  return { rows, totalSavings, totalInterest, membersCount };
}

// --- POST /api/savings-interest/preview ------------------------------------
router.post(
  '/preview',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('savings', 'interest-preview'),
  [
    body('totalProfit').isFloat({ min: 1 }).withMessage('Total profit must be greater than 0'),
    body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate is required'),
    body('period').notEmpty().withMessage('Period is required'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { totalProfit, interestRate, period } = req.body;
      const profitNum = Math.round(Number(totalProfit));
      const rateNum = Number(interestRate);

      const existing = await SavingsInterestDistribution.findOne({ period }).lean();
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Savings interest for period "${period}" has already been distributed.`,
        });
      }

      let preview;
      try {
        preview = await buildPreview(profitNum, rateNum);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: (err as Error)?.message || 'Preview validation failed',
        });
      }

      res.json({
        success: true,
        data: {
          period,
          totalProfit: profitNum,
          interestRate: rateNum,
          totalSavings: preview.totalSavings,
          totalInterest: preview.totalInterest,
          membersCount: preview.membersCount,
          preview: preview.rows,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// --- POST /api/savings-interest/approve ------------------------------------
router.post(
  '/approve',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('savings', 'interest-approve'),
  [
    body('totalProfit').isFloat({ min: 1 }).withMessage('Total profit must be greater than 0'),
    body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate is required'),
    body('period').notEmpty().withMessage('Period is required'),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { totalProfit, interestRate, period } = req.body;
      const profitNum = Math.round(Number(totalProfit));
      const rateNum = Number(interestRate);

      const existing = await SavingsInterestDistribution.findOne({ period }).lean();
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Savings interest for period "${period}" has already been distributed.`,
        });
      }
      let preview;
      try {
        preview = await buildPreview(profitNum, rateNum);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: (err as Error)?.message || 'Distribution validation failed',
        });
      }
      const year = new Date().getFullYear();
      const distCount = await SavingsInterestDistribution.countDocuments();
      const distributionId = `SI-${year}-${String(distCount + 1).padStart(5, '0')}`;

      const distribution = await SavingsInterestDistribution.create({
        period,
        totalProfit: profitNum,
        interestRate: rateNum,
        totalSavingsEligible: preview.totalSavings,
        totalInterest: preview.totalInterest,
        membersCount: preview.membersCount,
        approvedBy: req.userId,
        approvedAt: new Date(),
        distributionId,
      });

      const txnCount = await Transaction.countDocuments();
      let seqOffset = 0;

      for (const row of preview.rows) {
        if (row.interest <= 0) continue;
        const ref = `TXN${year}${String(txnCount + seqOffset + 1).padStart(8, '0')}`;
        seqOffset++;

        await Transaction.create({
          transactionRef: ref,
          memberId: row.memberId,
          type: 'savings_interest',
          amount: row.interest,
          description: `Savings Interest - Period: ${period} | Rate: ${rateNum}% | Previous: ${row.savings} | New: ${row.newSavings}`,
          status: 'completed',
          createdBy: req.userId,
        });

        await Member.findByIdAndUpdate(row.memberId, { $inc: { savings: row.interest } });

        await SavingsInterestStatementModel.create({
          distributionId: distribution._id,
          memberId: row.memberId,
          memberName: row.memberName,
          savingsBefore: row.savings,
          interestAmount: row.interest,
          savingsAfter: row.newSavings,
        });

        notifyMember(
          row.memberId,
          'Savings Interest Credited',
          `Your savings interest of KES ${row.interest.toLocaleString()} for period ${period} has been credited. New savings balance: KES ${row.newSavings.toLocaleString()}.`,
          'approval',
          '/my-account?tab=savings'
        );
      }

      notifyStaff(
        'Savings Interest Distribution Complete',
        `KES ${preview.totalInterest.toLocaleString()} distributed to ${preview.membersCount} members for period ${period}.`,
        'info',
        '/accounts'
      );

      res.json({
        success: true,
        data: {
          distributionId: distribution.distributionId,
          period,
          totalProfit: profitNum,
          interestRate: rateNum,
          totalSavings: preview.totalSavings,
          totalInterest: preview.totalInterest,
          membersCount: preview.membersCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// --- GET /api/savings-interest/history -------------------------------------
router.get('/history', protect, authorize('admin', 'treasurer'), async (req, res, next) => {
  try {
    const history = await SavingsInterestDistribution.find()
      .populate('approvedBy', 'email fullName')
      .sort({ approvedAt: -1 });

    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
});

// --- GET /api/savings-interest/my ------------------------------------------
router.get('/my', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.userId }).select('_id name').lean();
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    const records = await SavingsInterestStatementModel.find({ memberId: (member as any)._id })
      .populate('distributionId', 'period interestRate approvedAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

export default router;
