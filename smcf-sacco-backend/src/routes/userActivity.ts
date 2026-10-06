import { Router } from 'express';
import UserActivity from '../models/UserActivity';
import { authorize, AuthRequest, protect } from '../middleware/auth';
import { recordUserActivity } from '../utils/userActivity';

const router = Router();

router.get('/', protect, authorize('admin', 'auditor'), async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const event = req.query.event ? String(req.query.event) : undefined;
    const filter = event ? { event } : {};
    const activities = await UserActivity.find(filter)
      .populate('userId', 'email fullName roles')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ success: true, count: activities.length, data: activities });
  } catch (error) {
    return next(error);
  }
});

router.post('/exit', protect, async (req: AuthRequest, res, next) => {
  try {
    recordUserActivity(req, {
      userId: req.userId,
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId.slice(0, 120) : null,
      event: req.body?.event === 'logout' ? 'logout' : 'session_exit',
      action: req.body?.event === 'logout' ? 'User logged out' : 'User session exited',
      path: typeof req.body?.path === 'string' ? req.body.path.slice(0, 240) : null,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
