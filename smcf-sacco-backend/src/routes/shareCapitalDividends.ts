import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Transaction from '../models/Transaction';
import AuditLog from '../models/AuditLog';
import ShareContribution from '../models/ShareContribution';
import ShareDividendConfig from '../models/ShareDividendConfig';
import ShareDividendDistribution, {
  DividendCalculationMode,
  DividendEligibilityRule,
  ShareDividendRecordModel,
} from '../models/ShareDividendDistribution';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { notifyMember, notifyStaff } from '../utils/notify';
import { recalculateMemberRiskScore } from '../utils/riskScore';
import { createTransactionRef } from '../utils/transactionRef';

const router = Router();

const SHARE_VALUE_KES = 100;
const MIN_REQUIRED_SHARE_CAPITAL = 10000;
const MAX_REQUIRED_SHARES = 100;

type EligibleMember = {
  _id: string;
  memberId: string;
  name: string;
  status: string;
  shares: number;
};

type DividendPreviewRow = {
  memberObjectId: string;
  memberId: string;
  memberName: string;
  numberOfShares: number;
  shareCapitalValue: number;
  dividendEarned: number;
  newTotalAfterDividendRecord: number;
};

function validateRequest(req: AuthRequest, res: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

async function createShareAuditLog(req: AuthRequest, action: string, changes: Record<string, unknown>) {
  try {
    await AuditLog.create({
      userId: req.userId || null,
      tableName: 'share_capital_dividends',
      recordId: changes.recordId ? String(changes.recordId) : null,
      action,
      changes,
      ipAddress: req.ip || req.connection.remoteAddress || null,
    });
  } catch (error) {
    console.error('[shareCapitalDividends] audit log error:', error);
  }
}

function toSafeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function fetchEligibleMembers(rule: DividendEligibilityRule) {
  const baseMembers = await Member.find({ shares: { $gt: 0 } })
    .select('memberId name status shares')
    .lean();

  let eligible = baseMembers as unknown as EligibleMember[];

  if (rule === 'active_members') {
    eligible = eligible.filter((m) => m.status === 'active');
  }

  if (rule === 'minimum_share_capital') {
    eligible = eligible.filter((m) => Number(m.shares || 0) >= MIN_REQUIRED_SHARE_CAPITAL);
  }

  if (rule === 'no_defaulted_loans') {
    const defaultedLoanMembers = await Loan.distinct('memberId', { status: 'defaulted' });
    const defaultedSet = new Set(defaultedLoanMembers.map((id: any) => String(id)));
    eligible = eligible.filter((m) => !defaultedSet.has(String(m._id)));
  }

  return eligible;
}

function buildDividendPreviewRows(
  members: EligibleMember[],
  calculationMode: DividendCalculationMode,
  dividendRate: number | null,
  totalDividendPool: number | null
) {
  const totalShares = members.reduce((sum, m) => sum + Number(m.shares || 0), 0) / SHARE_VALUE_KES;

  if (members.length === 0) {
    throw new Error('No eligible members found for the selected rule.');
  }

  if (calculationMode === 'pool_based' && (!totalDividendPool || totalDividendPool <= 0)) {
    throw new Error('Total dividend pool is required for pool based calculation.');
  }

  if (calculationMode === 'percentage_based' && (dividendRate === null || dividendRate === undefined || dividendRate < 0)) {
    throw new Error('Dividend rate is required for percentage based calculation.');
  }

  const dividendPerShare =
    calculationMode === 'pool_based' ? Number(totalDividendPool || 0) / Math.max(1, totalShares) : null;

  const rows: DividendPreviewRow[] = members.map((member) => {
    const shareCapitalValue = Number(member.shares || 0);
    const numberOfShares = shareCapitalValue / SHARE_VALUE_KES;

    const dividendEarned =
      calculationMode === 'percentage_based'
        ? Math.round((shareCapitalValue * Number(dividendRate || 0)) / 100)
        : Math.round(numberOfShares * Number(dividendPerShare || 0));

    return {
      memberObjectId: String(member._id),
      memberId: member.memberId,
      memberName: member.name,
      numberOfShares,
      shareCapitalValue,
      dividendEarned: Math.max(0, dividendEarned),
      newTotalAfterDividendRecord: shareCapitalValue + Math.max(0, dividendEarned),
    };
  });

  const totalDividends = rows.reduce((sum, row) => sum + row.dividendEarned, 0);

  return {
    rows,
    totalShares,
    totalDividends,
    totalMembersEligible: rows.length,
  };
}

async function approveContribution(contributionId: string, approverId: string) {
  const contribution = await ShareContribution.findById(contributionId);
  if (!contribution) {
    throw new Error('Contribution record not found.');
  }

  if (contribution.status === 'approved') {
    return contribution;
  }

  if (contribution.status === 'reversed') {
    throw new Error('Cannot approve a reversed contribution.');
  }

  const member = await Member.findById(contribution.memberId).select('shares memberId name');
  if (!member) {
    throw new Error('Member not found for this contribution.');
  }

  const before = Number(member.shares || 0);
  const increment = Number(contribution.amount || 0);
  const after = before + increment;

  await Member.findByIdAndUpdate(contribution.memberId, { $inc: { shares: increment } });
  await recalculateMemberRiskScore(String(contribution.memberId));

  const transactionRef = contribution.transactionRef || createTransactionRef();
  if (!contribution.transactionRef) {
    await Transaction.create({
      transactionRef,
      memberId: contribution.memberId,
      type: 'share_purchase',
      amount: contribution.amount,
      description: `Share contribution approved | Contribution ID: ${String(contribution._id)} | Ref: ${contribution.referenceNumber || 'N/A'}`,
      status: 'completed',
      createdBy: approverId,
    });
  }

  contribution.status = 'approved';
  contribution.approvedBy = approverId as any;
  contribution.approvedAt = new Date();
  contribution.transactionRef = transactionRef;
  await contribution.save();

  notifyMember(
    contribution.memberId,
    'Share Contribution Recorded',
    `Your share contribution of KES ${Number(contribution.amount).toLocaleString()} has been approved and posted.`,
    'approval',
    '/my-account'
  );

  if (before < MIN_REQUIRED_SHARE_CAPITAL && after >= MIN_REQUIRED_SHARE_CAPITAL) {
    notifyMember(
      contribution.memberId,
      'Minimum Share Capital Reached',
      `Congratulations, you have reached the minimum required share capital of KES ${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()}.`,
      'approval',
      '/my-account'
    );
  }

  return contribution;
}

// Dashboard summary
router.get(
  '/dashboard',
  protect,
  authorize('admin', 'treasurer', 'auditor'),
  [query('period').optional().isString()],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const period = String(req.query.period || '').trim();

      const [members, lastDistribution, selectedDistribution] = await Promise.all([
        Member.find().select('shares status').lean(),
        ShareDividendDistribution.findOne({ status: 'completed' }).sort({ approvedAt: -1 }).lean(),
        period
          ? ShareDividendDistribution.findOne({ distributionPeriod: period, status: 'completed' }).lean()
          : Promise.resolve(null),
      ]);

      const totalShareCapital = members.reduce((sum, m: any) => sum + Number(m.shares || 0), 0);
      const totalNumberOfShares = totalShareCapital / SHARE_VALUE_KES;
      const totalMembersWithShares = members.filter((m: any) => Number(m.shares || 0) > 0).length;
      const membersAtMinimum = members.filter((m: any) => Number(m.shares || 0) >= MIN_REQUIRED_SHARE_CAPITAL).length;
      const membersBelowMinimum = members.filter((m: any) => Number(m.shares || 0) < MIN_REQUIRED_SHARE_CAPITAL).length;

      res.json({
        success: true,
        data: {
          shareValuePerShare: SHARE_VALUE_KES,
          minimumRequiredShareCapital: MIN_REQUIRED_SHARE_CAPITAL,
          maximumRequiredShares: MAX_REQUIRED_SHARES,
          totalShareCapital,
          totalNumberOfShares,
          totalMembersWithShares,
          membersAtMinimum,
          membersBelowMinimum,
          totalDividendsAllocatedForSelectedPeriod: Number(selectedDistribution?.totalDividendsDistributed || 0),
          selectedPeriod: period || null,
          lastDividendDistributionDate: lastDistribution?.approvedAt || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Member share profile list
router.get('/members', protect, authorize('admin', 'treasurer', 'auditor'), async (_req, res, next) => {
  try {
    const members = await Member.find().select('memberId name status shares').sort({ name: 1 }).lean();

    const memberIds = members.map((m: any) => m._id);

    const [contributionAgg, dividendAgg] = await Promise.all([
      ShareContribution.aggregate([
        { $match: { memberId: { $in: memberIds }, status: 'approved' } },
        { $group: { _id: '$memberId', count: { $sum: 1 }, total: { $sum: '$amount' }, lastDate: { $max: '$contributionDate' } } },
      ]),
      ShareDividendRecordModel.aggregate([
        { $match: { memberId: { $in: memberIds } } },
        { $group: { _id: '$memberId', totalDividend: { $sum: '$dividendAmount' }, lastDate: { $max: '$approvedAt' } } },
      ]),
    ]);

    const contributionMap = new Map(contributionAgg.map((item: any) => [String(item._id), item]));
    const dividendMap = new Map(dividendAgg.map((item: any) => [String(item._id), item]));

    const rows = members.map((member: any) => {
      const shareCapital = Number(member.shares || 0);
      const numberOfShares = shareCapital / SHARE_VALUE_KES;
      const progress = Math.min(100, (shareCapital / MIN_REQUIRED_SHARE_CAPITAL) * 100);
      const remaining = Math.max(0, MIN_REQUIRED_SHARE_CAPITAL - shareCapital);

      const contribution = contributionMap.get(String(member._id));
      const dividend = dividendMap.get(String(member._id));

      return {
        memberObjectId: member._id,
        memberName: member.name,
        memberId: member.memberId,
        status: member.status,
        numberOfShares,
        shareValuePerShare: SHARE_VALUE_KES,
        totalShareCapitalValue: shareCapital,
        minimumRequiredShareCapital: MIN_REQUIRED_SHARE_CAPITAL,
        shareContributionProgress: progress,
        remainingAmountToReachMinimum: remaining,
        contributionStats: {
          totalApprovedContributions: Number(contribution?.count || 0),
          totalContributedAmount: Number(contribution?.total || 0),
          lastContributionDate: contribution?.lastDate || null,
        },
        dividendStats: {
          totalDividendEarned: Number(dividend?.totalDividend || 0),
          lastDividendDate: dividend?.lastDate || null,
        },
      };
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    next(error);
  }
});

// Single member profile
router.get('/members/:memberObjectId/profile', protect, authorize('admin', 'treasurer', 'auditor'), async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.memberObjectId).select('memberId name status shares').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    const period = String(req.query.period || '').trim();

    const [contributions, dividendHistory, currentPeriodDividend] = await Promise.all([
      ShareContribution.find({ memberId: member._id }).sort({ contributionDate: -1 }).lean(),
      ShareDividendRecordModel.find({ memberId: member._id })
        .sort({ approvedAt: -1 })
        .lean(),
      period
        ? ShareDividendRecordModel.findOne({ memberId: member._id, distributionPeriod: period }).lean()
        : Promise.resolve(null),
    ]);

    const shareCapital = Number((member as any).shares || 0);

    res.json({
      success: true,
      data: {
        memberObjectId: member._id,
        memberName: (member as any).name,
        memberId: (member as any).memberId,
        status: (member as any).status,
        numberOfSharesOwned: shareCapital / SHARE_VALUE_KES,
        shareValuePerShare: SHARE_VALUE_KES,
        totalShareCapitalValue: shareCapital,
        minimumRequiredShareCapital: MIN_REQUIRED_SHARE_CAPITAL,
        shareContributionProgress: Math.min(100, (shareCapital / MIN_REQUIRED_SHARE_CAPITAL) * 100),
        remainingAmountToReachMinimum: Math.max(0, MIN_REQUIRED_SHARE_CAPITAL - shareCapital),
        shareContributionHistory: contributions,
        dividendEarnedCurrentPeriod: Number(currentPeriodDividend?.dividendAmount || 0),
        dividendHistory,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Share contribution records
router.get('/contributions', protect, authorize('admin', 'treasurer', 'auditor'), async (req, res, next) => {
  try {
    const { memberObjectId, status, from, to } = req.query;
    const filter: any = {};

    if (memberObjectId) filter.memberId = memberObjectId;
    if (status) filter.status = status;

    const fromDate = toSafeDate(from);
    const toDate = toSafeDate(to);
    if (fromDate || toDate) {
      filter.contributionDate = {};
      if (fromDate) filter.contributionDate.$gte = fromDate;
      if (toDate) filter.contributionDate.$lte = toDate;
    }

    const contributions = await ShareContribution.find(filter)
      .populate('memberId', 'name memberId')
      .populate('recordedBy approvedBy reversedBy', 'email fullName roles')
      .sort({ contributionDate: -1 });

    res.json({ success: true, count: contributions.length, data: contributions });
  } catch (error) {
    next(error);
  }
});

// Add contribution (manual)
router.post(
  '/contributions',
  protect,
  authorize('admin', 'treasurer'),
  [
    body('memberObjectId').notEmpty().withMessage('Member is required.'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0.'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required.'),
    body('status').optional().isIn(['pending', 'approved']).withMessage('Invalid status.'),
    body('referenceNumber').optional().isString(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const { memberObjectId, amount, paymentMethod, referenceNumber, contributionDate, notes, status } = req.body;
      const numAmount = Math.round(Number(amount));

      const member = await Member.findById(memberObjectId).select('memberId name');
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found.' });
      }

      const contribution = await ShareContribution.create({
        memberId: member._id,
        amount: numAmount,
        numberOfShares: numAmount / SHARE_VALUE_KES,
        shareValuePerShare: SHARE_VALUE_KES,
        paymentMethod,
        referenceNumber: referenceNumber || null,
        contributionDate: toSafeDate(contributionDate) || new Date(),
        recordedBy: req.userId,
        status: status || 'pending',
        notes: notes || null,
        source: 'manual',
      });

      if (contribution.status === 'approved') {
        await approveContribution(String(contribution._id), String(req.userId));
      }

      await createShareAuditLog(req, 'added_share_contribution', {
        recordId: contribution._id,
        memberObjectId,
        memberId: member.memberId,
        amount: numAmount,
        paymentMethod,
        status: contribution.status,
        notes: notes || null,
      });

      res.status(201).json({ success: true, data: contribution });
    } catch (error) {
      next(error);
    }
  }
);

// Approve pending contribution
router.post('/contributions/:id/approve', protect, authorize('admin', 'treasurer'), async (req: AuthRequest, res, next) => {
  try {
    const approved = await approveContribution(req.params.id, String(req.userId));

    await createShareAuditLog(req, 'approved_share_contribution', {
      recordId: approved._id,
      contributionId: approved._id,
      memberObjectId: approved.memberId,
      amount: approved.amount,
      transactionRef: approved.transactionRef,
    });

    res.json({ success: true, data: approved });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Unable to approve contribution.' });
  }
});

// Reverse contribution (higher-level permission: admin only)
router.post(
  '/contributions/:id/reverse',
  protect,
  authorize('admin'),
  [body('reason').notEmpty().withMessage('Reversal reason is required.')],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const contribution = await ShareContribution.findById(req.params.id);
      if (!contribution) {
        return res.status(404).json({ success: false, message: 'Contribution not found.' });
      }

      if (contribution.status === 'reversed') {
        return res.status(400).json({ success: false, message: 'Contribution is already reversed.' });
      }

      const reason = String(req.body.reason || '').trim();
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reversal reason is required.' });
      }

      if (contribution.status === 'approved') {
        const member = await Member.findById(contribution.memberId).select('shares');
        if (!member) {
          return res.status(404).json({ success: false, message: 'Member not found.' });
        }

        const afterReversal = Number(member.shares || 0) - Number(contribution.amount || 0);
        if (afterReversal < 0) {
          return res.status(400).json({ success: false, message: 'Reversal would create a negative share balance.' });
        }

        await Member.findByIdAndUpdate(contribution.memberId, { $inc: { shares: -Number(contribution.amount || 0) } });
        await recalculateMemberRiskScore(String(contribution.memberId));

        if (contribution.transactionRef) {
          await Transaction.findOneAndUpdate(
            { transactionRef: contribution.transactionRef },
            { status: 'reversed', description: `Reversed share contribution | Reason: ${reason}` }
          );
        }
      }

      contribution.status = 'reversed';
      contribution.reversedBy = req.userId as any;
      contribution.reversedAt = new Date();
      contribution.reversalReason = reason;
      await contribution.save();

      await createShareAuditLog(req, 'reversed_share_contribution', {
        recordId: contribution._id,
        contributionId: contribution._id,
        memberObjectId: contribution.memberId,
        amount: contribution.amount,
        reason,
      });

      res.json({ success: true, data: contribution });
    } catch (error) {
      next(error);
    }
  }
);

// Configure dividend parameters (draft)
router.post(
  '/dividends/configure',
  protect,
  authorize('admin', 'treasurer'),
  [
    body('distributionPeriod').notEmpty().withMessage('Distribution period is required.'),
    body('totalProfitAvailable').isFloat({ min: 0 }).withMessage('Total profit must be 0 or greater.'),
    body('calculationMode').isIn(['percentage_based', 'pool_based']).withMessage('Invalid calculation mode.'),
    body('eligibilityRule')
      .isIn(['all_with_shares', 'active_members', 'minimum_share_capital', 'no_defaulted_loans'])
      .withMessage('Invalid eligibility rule.'),
    body('dividendRate').optional({ nullable: true }).isFloat({ min: 0 }),
    body('totalDividendPool').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const {
        distributionPeriod,
        totalProfitAvailable,
        dividendRate,
        totalDividendPool,
        calculationMode,
        eligibilityRule,
        notes,
      } = req.body;

      const config = await ShareDividendConfig.create({
        distributionPeriod,
        totalProfitAvailable: Number(totalProfitAvailable),
        dividendRate: dividendRate === null || dividendRate === undefined ? null : Number(dividendRate),
        totalDividendPool: totalDividendPool === null || totalDividendPool === undefined ? null : Number(totalDividendPool),
        calculationMode,
        eligibilityRule,
        configuredBy: req.userId,
        configuredAt: new Date(),
        notes: notes || null,
        active: true,
      });

      await createShareAuditLog(req, 'configured_dividend', {
        recordId: config._id,
        distributionPeriod,
        calculationMode,
        eligibilityRule,
        totalProfitAvailable: Number(totalProfitAvailable),
        dividendRate: config.dividendRate,
        totalDividendPool: config.totalDividendPool,
      });

      res.status(201).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/dividends/configuration/latest', protect, authorize('admin', 'treasurer', 'auditor'), async (_req, res, next) => {
  try {
    const config = await ShareDividendConfig.findOne({ active: true }).sort({ configuredAt: -1 });
    res.json({ success: true, data: config || null });
  } catch (error) {
    next(error);
  }
});

// Preview dividend distribution
router.post(
  '/dividends/preview',
  protect,
  authorize('admin', 'treasurer', 'auditor'),
  [
    body('distributionPeriod').notEmpty().withMessage('Distribution period is required.'),
    body('totalProfitAvailable').isFloat({ min: 0 }).withMessage('Total profit must be 0 or greater.'),
    body('calculationMode').isIn(['percentage_based', 'pool_based']).withMessage('Invalid calculation mode.'),
    body('eligibilityRule')
      .isIn(['all_with_shares', 'active_members', 'minimum_share_capital', 'no_defaulted_loans'])
      .withMessage('Invalid eligibility rule.'),
    body('dividendRate').optional({ nullable: true }).isFloat({ min: 0 }),
    body('totalDividendPool').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const {
        distributionPeriod,
        totalProfitAvailable,
        calculationMode,
        eligibilityRule,
        dividendRate,
        totalDividendPool,
      } = req.body;

      const duplicate = await ShareDividendDistribution.findOne({ distributionPeriod, status: 'completed' }).lean();
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Dividend distribution for period ${distributionPeriod} already exists.`,
        });
      }

      const eligibleMembers = await fetchEligibleMembers(eligibilityRule);
      const preview = buildDividendPreviewRows(
        eligibleMembers,
        calculationMode,
        dividendRate === null || dividendRate === undefined ? null : Number(dividendRate),
        totalDividendPool === null || totalDividendPool === undefined ? null : Number(totalDividendPool)
      );

      const totalProfitNum = Number(totalProfitAvailable || 0);
      const inputPool =
        calculationMode === 'pool_based'
          ? Number(totalDividendPool || 0)
          : preview.totalDividends;

      if (inputPool > totalProfitNum) {
        return res.status(400).json({
          success: false,
          message: 'Dividend pool exceeds available profit allocation.',
        });
      }

      res.json({
        success: true,
        data: {
          distributionPeriod,
          calculationMode,
          eligibilityRule,
          totalProfitAvailable: totalProfitNum,
          dividendRate: dividendRate === null || dividendRate === undefined ? null : Number(dividendRate),
          totalDividendPool: calculationMode === 'pool_based' ? Number(totalDividendPool || 0) : preview.totalDividends,
          totalMembersEligible: preview.totalMembersEligible,
          totalShares: preview.totalShares,
          totalDividendsToBeDistributed: preview.totalDividends,
          rows: preview.rows,
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Unable to build preview.' });
    }
  }
);

// Approve + execute dividend distribution
router.post(
  '/dividends/approve',
  protect,
  authorize('admin', 'treasurer'),
  [
    body('distributionPeriod').notEmpty().withMessage('Distribution period is required.'),
    body('totalProfitAvailable').isFloat({ min: 0 }).withMessage('Total profit must be 0 or greater.'),
    body('calculationMode').isIn(['percentage_based', 'pool_based']).withMessage('Invalid calculation mode.'),
    body('eligibilityRule')
      .isIn(['all_with_shares', 'active_members', 'minimum_share_capital', 'no_defaulted_loans'])
      .withMessage('Invalid eligibility rule.'),
    body('dividendRate').optional({ nullable: true }).isFloat({ min: 0 }),
    body('totalDividendPool').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      if (!validateRequest(req, res)) return;

      const {
        distributionPeriod,
        totalProfitAvailable,
        calculationMode,
        eligibilityRule,
        dividendRate,
        totalDividendPool,
        notes,
      } = req.body;

      const duplicate = await ShareDividendDistribution.findOne({ distributionPeriod, status: 'completed' }).lean();
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Dividend distribution for period ${distributionPeriod} already exists.`,
        });
      }

      const eligibleMembers = await fetchEligibleMembers(eligibilityRule);
      const preview = buildDividendPreviewRows(
        eligibleMembers,
        calculationMode,
        dividendRate === null || dividendRate === undefined ? null : Number(dividendRate),
        totalDividendPool === null || totalDividendPool === undefined ? null : Number(totalDividendPool)
      );

      const totalProfitNum = Number(totalProfitAvailable || 0);
      const poolToUse =
        calculationMode === 'pool_based'
          ? Number(totalDividendPool || 0)
          : preview.totalDividends;

      if (poolToUse > totalProfitNum) {
        return res.status(400).json({
          success: false,
          message: 'Dividend pool exceeds available profit allocation.',
        });
      }

      const distribution = await ShareDividendDistribution.create({
        distributionPeriod,
        totalProfitAvailable: totalProfitNum,
        dividendRate: dividendRate === null || dividendRate === undefined ? null : Number(dividendRate),
        totalDividendPool: poolToUse,
        calculationMode,
        eligibilityRule,
        totalMembersEligible: preview.totalMembersEligible,
        totalSharesAtDistribution: preview.totalShares,
        totalDividendsDistributed: preview.totalDividends,
        status: 'completed',
        configuredBy: req.userId,
        approvedBy: req.userId,
        configuredAt: new Date(),
        approvedAt: new Date(),
        notes: notes || null,
      });

      for (const row of preview.rows) {
        if (row.dividendEarned <= 0) continue;

        await ShareDividendRecordModel.create({
          distributionId: distribution._id,
          memberId: row.memberObjectId,
          memberName: row.memberName,
          memberCode: row.memberId,
          sharesHeldAtDistribution: row.numberOfShares,
          shareCapitalValueAtDistribution: row.shareCapitalValue,
          dividendAmount: row.dividendEarned,
          calculationType: calculationMode,
          distributionPeriod,
          approvedBy: req.userId,
          approvedAt: new Date(),
        });

        await Transaction.create({
          transactionRef: createTransactionRef(),
          memberId: row.memberObjectId,
          type: 'dividend',
          amount: row.dividendEarned,
          description: `Share Dividend Distribution | Period: ${distributionPeriod} | Calculation: ${calculationMode}`,
          status: 'completed',
          createdBy: req.userId,
        });

        notifyMember(
          row.memberObjectId,
          'Dividend Distributed',
          `A dividend of KES ${row.dividendEarned.toLocaleString()} has been distributed for period ${distributionPeriod}.`,
          'approval',
          '/my-account'
        );
      }

      notifyStaff(
        'Share Dividend Distribution Completed',
        `Distribution for period ${distributionPeriod} completed. Total distributed: KES ${preview.totalDividends.toLocaleString()} to ${preview.totalMembersEligible} members.`,
        'info',
        '/admin'
      );

      await createShareAuditLog(req, 'approved_dividend_distribution', {
        recordId: distribution._id,
        distributionPeriod,
        calculationMode,
        eligibilityRule,
        totalDividendsDistributed: preview.totalDividends,
        totalMembersEligible: preview.totalMembersEligible,
      });

      res.status(201).json({ success: true, data: distribution });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Unable to approve dividend distribution.' });
    }
  }
);

router.get('/dividends/history', protect, authorize('admin', 'treasurer', 'auditor'), async (_req, res, next) => {
  try {
    const history = await ShareDividendDistribution.find()
      .populate('configuredBy approvedBy', 'email fullName')
      .sort({ approvedAt: -1 });

    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/dividends/history/:distributionId', protect, authorize('admin', 'treasurer', 'auditor'), async (req, res, next) => {
  try {
    const records = await ShareDividendRecordModel.find({ distributionId: req.params.distributionId })
      .sort({ dividendAmount: -1 });
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

router.get('/reports', protect, authorize('admin', 'treasurer', 'auditor'), async (_req, res, next) => {
  try {
    const [members, contributions, distributions] = await Promise.all([
      Member.find().select('memberId name shares status').lean(),
      ShareContribution.find().populate('memberId', 'memberId name').sort({ contributionDate: -1 }).lean(),
      ShareDividendDistribution.find().sort({ approvedAt: -1 }).lean(),
    ]);

    const totalShareCapital = members.reduce((sum, m: any) => sum + Number(m.shares || 0), 0);

    const belowMinimum = members
      .filter((m: any) => Number(m.shares || 0) < MIN_REQUIRED_SHARE_CAPITAL)
      .map((m: any) => ({
        memberObjectId: m._id,
        memberId: m.memberId,
        memberName: m.name,
        shareCapital: Number(m.shares || 0),
        remaining: Math.max(0, MIN_REQUIRED_SHARE_CAPITAL - Number(m.shares || 0)),
      }));

    const topShareholders = [...members]
      .sort((a: any, b: any) => Number(b.shares || 0) - Number(a.shares || 0))
      .slice(0, 10)
      .map((m: any) => ({
        memberObjectId: m._id,
        memberId: m.memberId,
        memberName: m.name,
        shareCapital: Number(m.shares || 0),
        numberOfShares: Number(m.shares || 0) / SHARE_VALUE_KES,
      }));

    const monthlyGrowthMap = new Map<string, number>();
    contributions.forEach((c: any) => {
      if (c.status !== 'approved') return;
      const d = new Date(c.contributionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyGrowthMap.set(key, Number(monthlyGrowthMap.get(key) || 0) + Number(c.amount || 0));
    });

    const shareGrowthOverTime = Array.from(monthlyGrowthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, contributedShareCapital: amount }));

    res.json({
      success: true,
      data: {
        totalShareCapitalReport: {
          totalShareCapital,
          totalNumberOfShares: totalShareCapital / SHARE_VALUE_KES,
          totalMembersWithShares: members.filter((m: any) => Number(m.shares || 0) > 0).length,
        },
        shareContributionsByMember: contributions,
        membersBelowMinimumShareCapital: belowMinimum,
        dividendDistributionReport: distributions,
        dividendPayoutHistory: distributions,
        topShareholders,
        shareGrowthOverTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', protect, authorize('admin', 'auditor'), async (_req, res, next) => {
  try {
    const logs = await AuditLog.find({
      tableName: 'share_capital_dividends',
    })
      .populate('userId', 'email fullName roles')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
});

// Member view endpoint
router.get('/member/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.userId }).select('memberId name shares').lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found.' });
    }

    const [contributions, dividends] = await Promise.all([
      ShareContribution.find({ memberId: (member as any)._id, status: 'approved' }).sort({ contributionDate: -1 }).lean(),
      ShareDividendRecordModel.find({ memberId: (member as any)._id }).sort({ approvedAt: -1 }).lean(),
    ]);

    const currentPeriod = dividends[0]?.distributionPeriod || null;
    const currentPeriodDividend = currentPeriod
      ? dividends
          .filter((d: any) => d.distributionPeriod === currentPeriod)
          .reduce((sum: number, d: any) => sum + Number(d.dividendAmount || 0), 0)
      : 0;

    const shareCapital = Number((member as any).shares || 0);

    res.json({
      success: true,
      data: {
        memberObjectId: (member as any)._id,
        memberId: (member as any).memberId,
        memberName: (member as any).name,
        numberOfSharesOwned: shareCapital / SHARE_VALUE_KES,
        totalShareCapital: shareCapital,
        progressTowardMinimumShareCapital: Math.min(100, (shareCapital / MIN_REQUIRED_SHARE_CAPITAL) * 100),
        dividendEarnedCurrentPeriod: currentPeriodDividend,
        dividendHistory: dividends,
        shareContributionHistory: contributions,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
