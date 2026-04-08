import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Member from '../models/Member';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { 
  generateVerificationToken, 
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmailToken,
  getEmailDeliveryHealth,
} from '../services/emailService';

const router = Router();

const allowEmailTokenFallback = process.env.ALLOW_EMAIL_TOKEN_FALLBACK !== 'false';
const resendCooldownSeconds = Math.max(1, Number(process.env.EMAIL_RESEND_COOLDOWN_SECONDS || 60));
const resendCooldownMs = resendCooldownSeconds * 1000;
const resendAttemptByEmail = new Map<string, number>();

const getRetryAfterSeconds = (email: string): number => {
  const lastAttemptAt = resendAttemptByEmail.get(email);
  if (!lastAttemptAt) {
    return 0;
  }

  const remainingMs = resendCooldownMs - (Date.now() - lastAttemptAt);
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

const markResendAttempt = (email: string): void => {
  resendAttemptByEmail.set(email, Date.now());
};

// Generate JWT Token
const generateToken = (id: string): string => {
  return jwt.sign(
    { id },
    (process.env.JWT_SECRET || 'secret') as string,
    { expiresIn: '7d' }
  );
};

// @route   GET /api/auth/email-delivery-health
// @desc    Check verification-email delivery configuration and fallback mode
// @access  Private (Admin only)
router.get('/email-delivery-health', protect, authorize('admin'), async (_req: AuthRequest, res) => {
  const health = getEmailDeliveryHealth();
  res.json({
    success: true,
    data: {
      ...health,
      checkedAt: new Date().toISOString(),
    },
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user and send verification email
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
      const normalizedEmail = String(email).toLowerCase().trim();

      // Check if user already exists
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        if (existingUser.isEmailVerified) {
          return res.status(400).json({
            success: false,
            message: 'User already exists with this email'
          });
        }

        const prevToken = existingUser.emailVerificationToken;
        const prevExpiry = existingUser.emailVerificationExpires;
        const { token: verificationToken, hash: tokenHash, expiresIn } = generateVerificationToken();
        existingUser.emailVerificationToken = tokenHash;
        existingUser.emailVerificationExpires = expiresIn;
        await existingUser.save();

        const emailSent = await sendVerificationEmail(
          existingUser.email,
          existingUser.fullName || existingUser.email,
          verificationToken
        );

        if (!emailSent.success) {
          if (allowEmailTokenFallback) {
            return res.status(200).json({
              success: true,
              message: `Email delivery is unavailable. Use the one-time verification code shown below.`,
              data: {
                user: {
                  id: existingUser._id,
                  email: existingUser.email,
                  fullName: existingUser.fullName,
                  roles: existingUser.roles,
                  isEmailVerified: existingUser.isEmailVerified
                },
                requiresEmailVerification: true,
                verificationToken,
              }
            });
          }

          // Keep the previous token active if send fails, so already delivered links keep working.
          existingUser.emailVerificationToken = prevToken;
          existingUser.emailVerificationExpires = prevExpiry;
          await existingUser.save();

          return res.status(503).json({
            success: false,
            message: `Account exists but we could not resend verification email: ${emailSent.error || 'Email service unavailable'}`
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Account already exists but is not verified. A new verification email has been sent.',
          data: {
            user: {
              id: existingUser._id,
              email: existingUser.email,
              fullName: existingUser.fullName,
              roles: existingUser.roles,
              isEmailVerified: existingUser.isEmailVerified
            },
            requiresEmailVerification: true
          }
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Generate verification token
      const { token: verificationToken, hash: tokenHash, expiresIn } = generateVerificationToken();

      // Create user
      const user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        fullName,
        roles: ['member'],
        isEmailVerified: false,
        emailVerificationToken: tokenHash,
        emailVerificationExpires: expiresIn
      });

      // Send verification email
      const emailSent = await sendVerificationEmail(
        user.email,
        user.fullName || user.email,
        verificationToken
      );

      if (!emailSent.success) {
        if (!allowEmailTokenFallback) {
          return res.status(503).json({
            success: false,
            message: `Account created, but verification email could not be sent: ${emailSent.error || 'Email service unavailable'}`
          });
        }
      }

      res.status(201).json({
        success: true,
        message: emailSent.success
          ? 'Account created! Please check your email to verify your address.'
          : 'Account created! Email delivery is unavailable, use the one-time code shown below to verify.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles,
            isEmailVerified: user.isEmailVerified
          },
          requiresEmailVerification: true,
          verificationToken: !emailSent.success && allowEmailTokenFallback ? verificationToken : undefined
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
    body('email').optional().trim(),
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
      const normalizedEmail = String(email || req.body.username || '').trim().toLowerCase();

      if (!normalizedEmail || !String(password || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'Email and password required'
        });
      }

      // Primary email login with backward-compatible username fallback.
      const user = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { username: normalizedEmail }
        ]
      }).select('+password');

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

      // Admin accounts can sign in without verification; other roles must verify after signup.
      const normalizedRoles = (Array.isArray(user.roles) ? user.roles : [user.roles])
        .filter(Boolean)
        .map((role: any) => String(role).toLowerCase());
      const isAdminUser = normalizedRoles.includes('admin');
      if (!user.isEmailVerified && !isAdminUser) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          requiresEmailVerification: true,
          email: user.email
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
            roles: user.roles,
            isEmailVerified: user.isEmailVerified
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/auth/verify-email
// @desc    Verify email address with token
// @access  Public
router.post(
  '/verify-email',
  [body('token').exists().withMessage('Verification token is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const rawToken = String(req.body.token || '');
      const token = rawToken.trim().replace(/\s+/g, '');
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      // Hash the token to compare with stored hash
      const tokenHash = verifyEmailToken(token);

      // Find user with this verification token
      const user = await User.findOne({
        emailVerificationToken: tokenHash,
        emailVerificationExpires: { $gt: new Date() }
      }).select('+emailVerificationToken +emailVerificationExpires');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully! You can now log in.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            isEmailVerified: user.isEmailVerified
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/auth/resend-verification-email
// @desc    Resend verification email
// @access  Public
router.post(
  '/resend-verification-email',
  [body('email').isEmail().withMessage('Please provide a valid email')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const normalizedEmail = String(req.body.email).toLowerCase().trim();

      // Find user
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found with this email'
        });
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      const retryAfterSeconds = getRetryAfterSeconds(normalizedEmail);
      if (retryAfterSeconds > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds} second(s) before requesting another code.`,
          retryAfterSeconds,
        });
      }

      // Generate new verification token
      const prevToken = user.emailVerificationToken;
      const prevExpiry = user.emailVerificationExpires;
      const { token: verificationToken, hash: tokenHash, expiresIn } = generateVerificationToken();

      // Update user with new token
      user.emailVerificationToken = tokenHash;
      user.emailVerificationExpires = expiresIn;
      await user.save();

      // Send verification email
      const emailSent = await sendVerificationEmail(
        user.email,
        user.fullName || user.email,
        verificationToken
      );

      if (!emailSent.success) {
        if (allowEmailTokenFallback) {
          markResendAttempt(normalizedEmail);
          return res.json({
            success: true,
            message: 'Email delivery is unavailable. Use the one-time verification code shown below.',
            data: {
              verificationToken,
            },
          });
        }

        // Keep old token valid when email provider is down / misconfigured.
        user.emailVerificationToken = prevToken;
        user.emailVerificationExpires = prevExpiry;
        await user.save();

        return res.status(503).json({
          success: false,
          message: `Failed to send verification email: ${emailSent.error || 'Email service unavailable'}`
        });
      }

      markResendAttempt(normalizedEmail);
      res.json({
        success: true,
        message: 'Verification email sent! Please check your inbox.'
      });
    } catch (error) {
      next(error);
    }
  }
);

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

// @route   PUT /api/auth/email/update-and-verify
// @desc    Update authenticated user's email and trigger verification flow
// @access  Private
router.put(
  '/email/update-and-verify',
  protect,
  [body('email').isEmail().withMessage('Please provide a valid email')],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const normalizedEmail = String(req.body.email).toLowerCase().trim();
      const retryAfterSeconds = getRetryAfterSeconds(normalizedEmail);
      if (retryAfterSeconds > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds} second(s) before requesting another code.`,
          retryAfterSeconds,
        });
      }

      const user = await User.findById(req.userId).select('+emailVerificationToken +emailVerificationExpires');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const currentEmail = String(user.email || '').toLowerCase().trim();
      const emailChanged = normalizedEmail !== currentEmail;

      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Another account already uses this email address',
        });
      }

      const previousState = {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        emailVerificationToken: user.emailVerificationToken,
        emailVerificationExpires: user.emailVerificationExpires,
      };

      const { token: verificationToken, hash: tokenHash, expiresIn } = generateVerificationToken();

      user.email = normalizedEmail;
      user.isEmailVerified = false;
      user.emailVerificationToken = tokenHash;
      user.emailVerificationExpires = expiresIn;
      await user.save();

      await Member.findOneAndUpdate(
        { userId: user._id },
        { email: normalizedEmail },
        { new: false }
      );

      const emailSent = await sendVerificationEmail(
        user.email,
        user.fullName || user.email,
        verificationToken
      );

      if (!emailSent.success) {
        if (allowEmailTokenFallback) {
          markResendAttempt(normalizedEmail);
          return res.json({
            success: true,
            message: 'Email delivery is unavailable. Use the one-time verification code shown below.',
            data: {
              user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                roles: user.roles,
                isEmailVerified: user.isEmailVerified,
              },
              requiresEmailVerification: true,
              verificationToken,
              emailChanged,
            },
          });
        }

        user.email = previousState.email;
        user.isEmailVerified = previousState.isEmailVerified;
        user.emailVerificationToken = previousState.emailVerificationToken;
        user.emailVerificationExpires = previousState.emailVerificationExpires;
        await user.save();

        await Member.findOneAndUpdate(
          { userId: user._id },
          { email: previousState.email || null },
          { new: false }
        );

        return res.status(503).json({
          success: false,
          message: `Failed to send verification email: ${emailSent.error || 'Email service unavailable'}`,
        });
      }

      markResendAttempt(normalizedEmail);
      return res.json({
        success: true,
        message: emailChanged
          ? 'Email updated. Please verify your new email address.'
          : 'Verification email sent! Please check your inbox.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            roles: user.roles,
            isEmailVerified: user.isEmailVerified,
          },
          requiresEmailVerification: true,
          emailChanged,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

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

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Please provide a valid email')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const normalizedEmail = String(req.body.email).toLowerCase().trim();
      const retryAfterSeconds = getRetryAfterSeconds(normalizedEmail);
      
      // Rate limiting
      if (retryAfterSeconds > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfterSeconds} second(s) before requesting another reset link.`,
          retryAfterSeconds,
        });
      }

      // Find user by email
      const user = await User.findOne({ email: normalizedEmail });
      
      // For security: return success even if user doesn't exist (prevents email enumeration)
      if (!user) {
        markResendAttempt(normalizedEmail);
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        });
      }

      // Generate password reset token
      const { token: resetToken, hash: tokenHash, expiresIn } = generateVerificationToken();
      
      user.passwordResetToken = tokenHash;
      user.passwordResetExpires = expiresIn;
      await user.save();

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(
        user.email,
        user.fullName || user.email,
        resetToken
      );

      if (!emailSent.success) {
        if (allowEmailTokenFallback) {
          markResendAttempt(normalizedEmail);
          return res.json({
            success: true,
            message: 'Email delivery is unavailable. Use the one-time reset code shown below.',
            data: {
              resetToken,
              requiresEmailVerification: true,
              message: 'Share this code with the user securely'
            },
          });
        }

        // Clear the reset token if email fails
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return res.status(503).json({
          success: false,
          message: `Failed to send password reset email: ${emailSent.error || 'Email service unavailable'}`,
        });
      }

      markResendAttempt(normalizedEmail);
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

      const { token, newPassword } = req.body;
      const tokenHash = verifyEmailToken(token);

      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: tokenHash,
        passwordResetExpires: { $gt: new Date() }
      }).select('+passwordResetToken +passwordResetExpires +password');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Password reset token is invalid or has expired. Please request a new reset link.'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password and clear reset token
      user.password = hashedPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successful. You can now log in with your new password.',
        data: {
          email: user.email,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
