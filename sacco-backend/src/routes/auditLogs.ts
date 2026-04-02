import { Router } from 'express';
import AuditLog from '../models/AuditLog';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// @route   GET /api/audit-logs
// @desc    Get audit logs (admin/auditor only)
// @access  Private
router.get('/', protect, authorize('admin', 'auditor'), async (req, res, next) => {
  try {
    const { limit = 50, tableName } = req.query;
    const filter: any = {};
    if (tableName) filter.tableName = tableName;

    const logs = await AuditLog.find(filter)
      .populate('userId', 'email fullName')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    next(error);
  }
});

export default router;
