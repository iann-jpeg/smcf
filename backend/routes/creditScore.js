import express from 'express';
import { protect } from '../middleware/auth.js';
import { calculateCreditScore } from '../services/creditScoreService.js';

const router = express.Router();

/**
 * GET /api/credit-score/member/current
 * Get credit score for currently logged-in member
 * MUST BE DEFINED BEFORE /:memberId route to avoid conflicts
 */
router.get('/member/current', protect, async (req, res) => {
  try {
    const memberId = req.user._id;
    const creditScore = await calculateCreditScore(memberId);

    res.json({
      success: true,
      data: creditScore,
    });
  } catch (error) {
    console.error('Credit score API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate credit score',
    });
  }
});

/**
 * GET /api/credit-score/:memberId
 * Calculate and return credit score for a member (admin only)
 */
router.get('/:memberId', protect, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Verify user can access this credit score
    // Members can only see their own, admins can see all
    if (req.user.role !== 'admin' && req.user._id.toString() !== memberId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view this credit score',
      });
    }

    const creditScore = await calculateCreditScore(memberId);

    res.json({
      success: true,
      data: creditScore,
    });
  } catch (error) {
    console.error('Credit score API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate credit score',
    });
  }
});

export default router;
