import { Router } from 'express';
import User from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { notifyUser } from '../utils/notify';

const router = Router();

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (admin)
router.get('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/roles
// @desc    Update user roles (admin only)
// @access  Private (admin)
router.put('/:id/roles', protect, authorize('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { roles } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { roles },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Notify the affected user their roles changed
    notifyUser(
      String(user._id),
      'Account Roles Updated',
      `Your account roles have been updated to: ${roles.join(', ')}.`,
      'info',
      '/my-account'
    );

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
