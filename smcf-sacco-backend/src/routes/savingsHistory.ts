import { Router } from 'express';
import SavingsHistory from '../models/SavingsHistory';
import { protect } from '../middleware/auth';

const router = Router();

// @route   GET /api/savings-history
// @desc    Get savings history for a member
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { memberId, limit = 24 } = req.query;
    const filter: any = {};
    if (memberId) filter.memberId = memberId;

    const records = await SavingsHistory.find(filter)
      .sort({ month: 1 })
      .limit(Number(limit));

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

export default router;
