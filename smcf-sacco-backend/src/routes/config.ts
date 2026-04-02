import { Router } from 'express';
import SystemConfig from '../models/SystemConfig';
import { protect, authorize } from '../middleware/auth';
import { notifyStaff } from '../utils/notify';

const router = Router();

const CONFIG_FIELDS = [
  'interestRate',
  'interestModel',
  'processingFee',
  'penaltyRate',
  'autoApproveLimit',
  'committeeThreshold',
  'maxGuaranteeMultiplier',
  'minGuarantors',
  'minLiquidityRatio',
] as const;

// @route   GET /api/config
// @desc    Get system configuration
// @access  Private
router.get('/', protect, async (_req, res, next) => {
  try {
    const config = await SystemConfig.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/config
// @desc    Update system configuration (admin only)
// @access  Private (admin)
router.put('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const config = await SystemConfig.getConfig();

    CONFIG_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        (config as any)[field] = req.body[field];
      }
    });

    await config.save();

    // Notify all staff that system settings changed
    notifyStaff(
      'System Configuration Updated',
      'An admin has updated system configuration (interest rates, thresholds, and policies).',
      'info',
      '/settings'
    );

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

export default router;
