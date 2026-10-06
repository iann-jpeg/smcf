import { Router } from 'express';
import FinancialCalendarEvent, { FinancialCalendarEventType } from '../models/FinancialCalendarEvent';
import Member from '../models/Member';
import { authorize, AuthRequest, protect } from '../middleware/auth';

const router = Router();
const staff = [protect, authorize('admin', 'treasurer', 'credit_officer', 'auditor')];
const allowedTypes: FinancialCalendarEventType[] = ['cycle_payment', 'loan_repayment', 'card_payment', 'wallet_maturity', 'meeting', 'notice'];

function parseDate(value: unknown): Date | null {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get('/', protect, async (req: AuthRequest, res, next) => {
  try {
    const from = parseDate(req.query.from) || new Date();
    const to = parseDate(req.query.to) || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const isStaff = req.user?.roles?.some((role) => role !== 'member');
    const member = isStaff ? null : await Member.findOne({ userId: req.userId }).select('_id').lean();
    const memberFilter = isStaff
      ? {}
      : { $or: [{ memberIds: { $size: 0 } }, { memberIds: { $in: member?._id ? [member._id] : [] } }] };
    const events = await FinancialCalendarEvent.find({ startsAt: { $gte: from, $lte: to }, ...memberFilter })
      .select('title description type startsAt endsAt amount isPublic memberIds')
      .sort({ startsAt: 1 })
      .lean();
    return res.json({ success: true, data: events });
  } catch (error) {
    return next(error);
  }
});

router.post('/', ...staff, async (req: AuthRequest, res, next) => {
  try {
    const { title, description, type, startsAt, endsAt, amount, memberIds, isPublic } = req.body || {};
    const start = parseDate(startsAt);
    if (!title || !allowedTypes.includes(type) || !start) {
      return res.status(400).json({ success: false, message: 'title, type and a valid startsAt are required' });
    }
    const end = endsAt ? parseDate(endsAt) : null;
    if (endsAt && !end) return res.status(400).json({ success: false, message: 'endsAt must be a valid date' });
    const event = await FinancialCalendarEvent.create({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      type,
      startsAt: start,
      endsAt: end,
      amount: amount === '' || amount == null ? null : Number(amount),
      memberIds: Array.isArray(memberIds) ? memberIds : [],
      isPublic: Boolean(isPublic),
      createdBy: req.userId,
    });
    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', ...staff, async (req: AuthRequest, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.startsAt) {
      const startsAt = parseDate(updates.startsAt);
      if (!startsAt) return res.status(400).json({ success: false, message: 'startsAt must be a valid date' });
      updates.startsAt = startsAt;
    }
    if (updates.type && !allowedTypes.includes(updates.type)) return res.status(400).json({ success: false, message: 'Unsupported event type' });
    const event = await FinancialCalendarEvent.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Calendar event not found' });
    return res.json({ success: true, data: event });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', ...staff, async (req: AuthRequest, res, next) => {
  try {
    const event = await FinancialCalendarEvent.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Calendar event not found' });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    return next(error);
  }
});

export default router;
