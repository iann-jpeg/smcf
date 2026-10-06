import { Router } from 'express';
import SavingsHistory from '../models/SavingsHistory';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import Member from '../models/Member';

const router = Router();

// @route   GET /api/savings-history
// @desc    Get savings history for a member
// @access  Private
router.get('/', protect, async (req: AuthRequest, res, next) => {
  try {
    const { memberId, limit = 24 } = req.query;
    const filter: any = {};
    const staff = req.user?.roles?.some((role) => ['admin', 'treasurer', 'credit_officer', 'auditor'].includes(role));
    if (staff) {
      if (memberId) filter.memberId = memberId;
    } else {
      const member = await Member.findOne({ userId: req.userId }).select('_id');
      if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
      filter.memberId = member._id;
    }

    const records = await SavingsHistory.find(filter)
      .sort({ month: 1 })
      .limit(Number(limit));

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

export default router;
