import { Router } from 'express';
import { authorize, AuthRequest, protect } from '../middleware/auth';
import Member from '../models/Member';
import Loan from '../models/Loan';
import Saving from '../models/Saving';
import Transaction from '../models/Transaction';
import FinancialCalendarEvent from '../models/FinancialCalendarEvent';
import StrategicTarget, { StrategicMetric } from '../models/StrategicTarget';
import StrategicGoal from '../models/StrategicGoal';
import { calculateScenario, calculateScorecard, strategicMetrics } from '../services/strategicIntelligenceService';

const router = Router();
const staff = [protect, authorize('admin', 'treasurer', 'credit_officer', 'credit_committee', 'auditor')];
const managers = [protect, authorize('admin', 'treasurer')];
const metrics: StrategicMetric[] = strategicMetrics;
const validDate = (value: unknown) => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
};
const monthsBetween = (start: Date, end: Date) => Math.max(1, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1);

async function actuals(asOf: Date) {
  const [membership, savings, loans, revenue, expenses] = await Promise.all([
    Member.countDocuments({ status: 'active', createdAt: { $lte: asOf } }),
    Member.aggregate([{ $match: { status: 'active', createdAt: { $lte: asOf } } }, { $group: { _id: null, value: { $sum: '$savings' } } }]),
    Member.aggregate([{ $match: { status: 'active', createdAt: { $lte: asOf } } }, { $group: { _id: null, value: { $sum: '$loanBalance' } } }]),
    Transaction.aggregate([{ $match: { status: 'completed', processedAt: { $lte: asOf }, type: { $in: ['loan_repayment', 'registration_fee', 'savings_interest'] } } }, { $group: { _id: null, value: { $sum: '$amount' } } }]),
    // Expense postings are not represented by a verified source model; do not infer them.
    Promise.resolve([]),
  ]);
  return { membership, savings: savings[0]?.value || 0, loans: loans[0]?.value || 0, revenue: revenue[0]?.value || 0, expenses: null as number | null };
}

async function monthlyHistory(metric: StrategicMetric, since: Date, asOf: Date) {
  if (metric === 'membership') {
    return Member.aggregate([{ $match: { status: 'active', createdAt: { $gte: since, $lte: asOf } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, value: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  }
  if (metric === 'savings') {
    return Saving.aggregate([{ $match: { status: 'completed', created_at: { $gte: since, $lte: asOf }, transaction_type: { $in: ['deposit', 'interest', 'adjustment'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$created_at' } }, value: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]);
  }
  if (metric === 'loans') {
    return Loan.aggregate([{ $match: { createdAt: { $gte: since, $lte: asOf }, status: { $in: ['approved', 'disbursed', 'active', 'completed', 'defaulted'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, value: { $sum: '$principal' } } }, { $sort: { _id: 1 } }]);
  }
  if (metric === 'revenue') {
    return Transaction.aggregate([{ $match: { status: 'completed', processedAt: { $gte: since, $lte: asOf }, type: { $in: ['loan_repayment', 'registration_fee', 'savings_interest'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$processedAt' } }, value: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]);
  }
  return [];
}

function forecast(value: number | null, history: Array<{ _id: string; value: number }>, months: number) {
  if (value === null || history.length < 2) return { value: null, assumption: 'Insufficient verified history (at least two monthly observations required).' };
  const first = history[0].value;
  const last = history[history.length - 1].value;
  const monthlyChange = (last - first) / Math.max(1, history.length - 1);
  return { value: Math.max(0, value + monthlyChange * months), assumption: 'Linear trend from verified monthly observations; no external data or seasonality assumed.' };
}

router.get('/overview', ...staff, async (req: AuthRequest, res, next) => {
  try {
    const asOf = new Date();
    const horizon = Math.min(24, Math.max(1, Number(req.query.horizonMonths) || 3));
    const from = new Date(asOf);
    from.setUTCMonth(from.getUTCMonth() - 12);
    const [current, targets, goals, events] = await Promise.all([
      actuals(asOf),
      StrategicTarget.find({ active: true, periodStart: { $lte: asOf }, periodEnd: { $gte: asOf } }).select('-createdBy').sort({ periodEnd: 1 }).lean(),
      StrategicGoal.find({ dueDate: { $gte: asOf } }).select('-createdBy').sort({ dueDate: 1 }).limit(20).lean(),
      FinancialCalendarEvent.find({ startsAt: { $gte: asOf, $lte: new Date(asOf.getTime() + 180 * 86400000) } }).select('title description type startsAt endsAt amount isPublic').sort({ startsAt: 1 }).limit(50).lean(),
    ]);
    const cards = await Promise.all(metrics.map(async (metric) => {
      const history = await monthlyHistory(metric, from, asOf);
      const target = targets.find((item) => item.metric === metric);
      const value = current[metric];
      const monthsRemaining = target ? monthsBetween(asOf, new Date(target.periodEnd)) : horizon;
      const expectedToday = target ? target.targetValue * Math.min(1, Math.max(0, (asOf.getTime() - new Date(target.periodStart).getTime()) / (new Date(target.periodEnd).getTime() - new Date(target.periodStart).getTime()))) : null;
      const gap = target && value !== null ? target.targetValue - value : null;
      const requiredMonthlyGrowth = target && value !== null && monthsRemaining > 0 ? gap / monthsRemaining : null;
      const progress = target && target.targetValue > 0 && value !== null ? Math.round(value / target.targetValue * 1000) / 10 : null;
      const fc = forecast(value, history, horizon);
      return { metric, actual: value, target: target?.targetValue ?? null, variance: target && value !== null ? value - target.targetValue : null, expectedToday, gap, requiredMonthlyGrowth, progress, forecast: fc.value, forecastAssumption: fc.assumption, history: history.map((item) => ({ month: item._id, value: item.value })), status: target && value !== null ? (value >= target.targetValue ? 'on_track' : progress !== null && progress >= 75 ? 'at_risk' : 'behind') : 'not_configured', trend: history.length >= 2 ? (history[history.length - 1].value >= history[0].value ? 'up' : 'down') : 'insufficient_history', explanation: target ? `Current ${metric} is ${value === null ? 'unavailable' : `${Math.abs((value || 0) - target.targetValue).toLocaleString()} ${value >= target.targetValue ? 'above' : 'below'} target`}.` : 'No active management target is configured for this metric.' };
    }));
    const scorecard = calculateScorecard(cards);
    const warnings = cards.filter((card) => card.status === 'behind' || card.status === 'at_risk').map((card) => ({ metric: card.metric, severity: card.status === 'behind' ? 'high' : 'medium', message: `${card.metric} needs attention: ${card.explanation}` }));
    return res.json({ success: true, data: { asOf, horizonMonths: horizon, cards, goals, calendarEvents: events, warnings, recommendations: warnings.map((item) => `Review ${item.metric} trajectory and update the explicit target or action plan.`), scorecard, assumptions: ['All actuals come from existing verified SACCO models.', 'Revenue includes completed loan repayments, registration fees and savings interest only.', 'Expenses are unavailable because no verified expense posting source was found.', 'Forecasts are linear and shown only when two or more monthly observations exist.'] } });
  } catch (error) { return next(error); }
});

router.post('/scenarios', ...staff, async (req: AuthRequest, res, next) => {
  try {
    const { base, monthlyGrowth, months = 12 } = req.body || {};
    const horizon = Math.min(36, Math.max(1, Number(months)));
    if (!base || typeof base !== 'object' || !monthlyGrowth || typeof monthlyGrowth !== 'object') return res.status(400).json({ success: false, message: 'base and monthlyGrowth objects are required' });
    const result = calculateScenario(base, monthlyGrowth, horizon);
    return res.json({ success: true, data: { horizonMonths: horizon, scenarios: result, assumptions: 'Admin-provided starting values and monthly growth rates are compounded; this is a planning simulation, not a projection of member-level outcomes.' } });
  } catch (error) { return next(error); }
});

function bodyDates(body: Record<string, unknown>, fields: string[]) {
  return fields.map((field) => validDate(body[field]));
}
router.get('/targets', ...staff, async (_req, res, next) => { try { return res.json({ success: true, data: await StrategicTarget.find().select('-createdBy').sort({ periodEnd: 1 }).lean() }); } catch (e) { return next(e); } });
router.post('/targets', ...managers, async (req: AuthRequest, res, next) => { try { const body = req.body || {}; const [start, end] = bodyDates(body, ['periodStart', 'periodEnd']); if (!metrics.includes(body.metric) || !body.name || !Number.isFinite(Number(body.targetValue)) || Number(body.targetValue) < 0 || !start || !end || end <= start) return res.status(400).json({ success: false, message: 'metric, name, non-negative targetValue, valid periodStart and periodEnd are required' }); const item = await StrategicTarget.create({ ...body, targetValue: Number(body.targetValue), unit: body.unit || (body.metric === 'membership' ? 'count' : 'currency'), periodStart: start, periodEnd: end, createdBy: req.userId }); return res.status(201).json({ success: true, data: item }); } catch (e) { return next(e); } });
router.put('/targets/:id', ...managers, async (req, res, next) => { try { const updates = { ...req.body }; if (updates.periodStart) updates.periodStart = validDate(updates.periodStart); if (updates.periodEnd) updates.periodEnd = validDate(updates.periodEnd); if (updates.targetValue !== undefined && (!Number.isFinite(Number(updates.targetValue)) || Number(updates.targetValue) < 0)) return res.status(400).json({ success: false, message: 'targetValue must be a non-negative number' }); const item = await StrategicTarget.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-createdBy'); if (!item) return res.status(404).json({ success: false, message: 'Strategic target not found' }); return res.json({ success: true, data: item }); } catch (e) { return next(e); } });
router.delete('/targets/:id', ...managers, async (req, res, next) => { try { const item = await StrategicTarget.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Strategic target not found' }); return res.json({ success: true, data: { id: req.params.id } }); } catch (e) { return next(e); } });
router.get('/goals', ...staff, async (_req, res, next) => { try { return res.json({ success: true, data: await StrategicGoal.find().select('-createdBy').sort({ dueDate: 1 }).lean() }); } catch (e) { return next(e); } });
router.post('/goals', ...managers, async (req: AuthRequest, res, next) => { try { const body = req.body || {}; const [start, end] = bodyDates(body, ['startsAt', 'dueDate']); if (!body.title || !start || !end || end <= start || (body.milestones && !Array.isArray(body.milestones))) return res.status(400).json({ success: false, message: 'title, valid startsAt and dueDate are required' }); const item = await StrategicGoal.create({ ...body, startsAt: start, dueDate: end, createdBy: req.userId }); return res.status(201).json({ success: true, data: item }); } catch (e) { return next(e); } });
router.put('/goals/:id', ...managers, async (req, res, next) => { try { const item = await StrategicGoal.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-createdBy'); if (!item) return res.status(404).json({ success: false, message: 'Strategic goal not found' }); return res.json({ success: true, data: item }); } catch (e) { return next(e); } });
router.delete('/goals/:id', ...managers, async (req, res, next) => { try { const item = await StrategicGoal.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ success: false, message: 'Strategic goal not found' }); return res.json({ success: true, data: { id: req.params.id } }); } catch (e) { return next(e); } });

export default router;
