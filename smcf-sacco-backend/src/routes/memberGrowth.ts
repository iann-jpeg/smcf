import { Router } from 'express';
import Member from '../models/Member';
import MemberSavingsGoal from '../models/MemberSavingsGoal';
import Transaction from '../models/Transaction';
import { AuthRequest, protect } from '../middleware/auth';

const router = Router();
const completedContributionTypes = ['deposit', 'savings_interest'];

async function getMember(req: AuthRequest) {
  return Member.findOne({ userId: req.userId }).select('_id savings').lean();
}

router.get('/overview', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await getMember(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    const [goals, monthly] = await Promise.all([
      MemberSavingsGoal.find({ memberId: member._id }).sort({ createdAt: -1 }).lean(),
      Transaction.aggregate([
        {
          $match: {
            memberId: member._id,
            type: { $in: completedContributionTypes },
            status: 'completed',
            processedAt: { $gte: new Date(Date.now() - 12 * 31 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { year: { $year: '$processedAt' }, month: { $month: '$processedAt' } },
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    const currentSavings = Number(member.savings || 0);
    const history = monthly.map((entry) => ({
      month: `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}`,
      amount: Number(entry.amount || 0),
      count: Number(entry.count || 0),
    }));
    const recent = history.slice(-6);
    const averageMonthlyContribution = recent.length
      ? recent.reduce((sum, entry) => sum + entry.amount, 0) / recent.length
      : 0;
    const previous = history.slice(-12, -6);
    const previousAverage = previous.length
      ? previous.reduce((sum, entry) => sum + entry.amount, 0) / previous.length
      : 0;
    const projectionAvailable = history.length >= 2 && averageMonthlyContribution > 0;
    const nextMilestone = [5000, 10000, 25000, 50000, 100000, 250000, 500000]
      .find((threshold) => currentSavings < threshold) ?? null;

    return res.json({
      success: true,
      data: {
        currentSavings,
        history,
        averageMonthlyContribution: Math.round(averageMonthlyContribution * 100) / 100,
        contributionTrend: previousAverage > 0
          ? Math.round(((averageMonthlyContribution - previousAverage) / previousAverage) * 1000) / 10
          : null,
        projection: projectionAvailable
          ? {
            available: true,
            basis: 'recent_completed_savings_contributions',
            months: [3, 6, 12].map((months) => ({
              months,
              amount: Math.round(currentSavings + averageMonthlyContribution * months),
            })),
          }
          : { available: false, reason: 'At least two completed contribution months are required.' },
        nextMilestone: nextMilestone ? {
          amount: nextMilestone,
          remaining: Math.max(0, nextMilestone - currentSavings),
        } : null,
        goals: goals.map((goal) => ({
          ...goal,
          currentAmount: currentSavings,
          progress: Math.min(100, Math.round((currentSavings / goal.targetAmount) * 100)),
          remaining: Math.max(0, goal.targetAmount - currentSavings),
          progressBasis: 'current_sacco_savings_balance',
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/goals', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await getMember(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    const title = String(req.body?.title || '').trim();
    const targetAmount = Number(req.body?.targetAmount);
    if (!title || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ success: false, message: 'A title and positive targetAmount are required' });
    }
    const targetDate = req.body?.targetDate ? new Date(String(req.body.targetDate)) : null;
    if (targetDate && Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: 'targetDate must be a valid date' });
    }
    const goal = await MemberSavingsGoal.create({
      memberId: member._id,
      title,
      description: req.body?.description ? String(req.body.description).trim() : null,
      targetAmount,
      targetDate,
    });
    return res.status(201).json({ success: true, data: goal });
  } catch (error) {
    return next(error);
  }
});

router.put('/goals/:id', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await getMember(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    const updates: Record<string, unknown> = {};
    if (req.body?.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body?.description !== undefined) updates.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body?.targetAmount !== undefined) {
      const amount = Number(req.body.targetAmount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'targetAmount must be positive' });
      updates.targetAmount = amount;
    }
    if (req.body?.targetDate !== undefined) {
      const date = req.body.targetDate ? new Date(String(req.body.targetDate)) : null;
      if (date && Number.isNaN(date.getTime())) return res.status(400).json({ success: false, message: 'targetDate must be valid' });
      updates.targetDate = date;
    }
    const goal = await MemberSavingsGoal.findOneAndUpdate(
      { _id: req.params.id, memberId: member._id },
      updates,
      { new: true, runValidators: true },
    ).lean();
    if (!goal) return res.status(404).json({ success: false, message: 'Savings goal not found' });
    return res.json({ success: true, data: goal });
  } catch (error) {
    return next(error);
  }
});

router.delete('/goals/:id', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await getMember(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    const goal = await MemberSavingsGoal.findOneAndDelete({ _id: req.params.id, memberId: member._id });
    if (!goal) return res.status(404).json({ success: false, message: 'Savings goal not found' });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
});

export default router;
