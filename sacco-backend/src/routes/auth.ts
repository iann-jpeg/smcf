import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// Generate JWT Token
const generateToken = (id: string): string => {
  return jwt.sign(
    { id },
    (process.env.JWT_SECRET || 'secret') as string,
    { expiresIn: '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password, fullName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = await User.create({
        email,
        password: hashedPassword,
        fullName,
        roles: ['member'] // Default role
      });

      // Generate token
      const token = generateToken(user._id.toString());

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').exists().withMessage('Password is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password } = req.body;

      // Find user with password field
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Generate token
      const token = generateToken(user._id.toString());

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/update
// @desc    Update user profile
// @access  Private
router.put(
  '/update',
  protect,
  [
    body('fullName').optional().trim(),
    body('avatarUrl').optional().trim()
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const { fullName, avatarUrl } = req.body;

      const user = await User.findByIdAndUpdate(
        req.userId,
        { fullName, avatarUrl },
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').exists().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/auth/setup
// @desc    First-run admin setup – promotes the given email to admin.
//          Only works if NO admin users exist in the database yet.
// @access  Public (intentionally – one-time bootstrap only)
router.post(
  '/setup',
  [body('email').isEmail().withMessage('Valid email required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      // Block if an admin already exists
      const existingAdmin = await User.findOne({ roles: 'admin' });
      if (existingAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Setup already complete – an admin account already exists.'
        });
      }

      const user = await User.findOneAndUpdate(
        { email: (req.body.email as string).toLowerCase() },
        { $addToSet: { roles: 'admin' } },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No account found with that email. Please register first.'
        });
      }

      res.json({
        success: true,
        message: `${user.email} has been promoted to admin. Please log out and log back in.`,
        data: { email: user.email, roles: user.roles }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
