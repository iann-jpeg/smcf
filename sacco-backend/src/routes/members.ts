import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Member from '../models/Member';
import User from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

// @route   PUT /api/members/me/profile
// @desc    Member self-update extended profile fields
// @access  Private (own account only)
router.put('/me/profile', protect, async (req: AuthRequest, res, next) => {
  try {
    const { name, nationalId, dateOfBirth, gender, county, occupation, employer, phone, email } = req.body;
    const update: Record<string, unknown> = {};
    if (name !== undefined && String(name).trim()) update.name = String(name).trim();
    if (nationalId !== undefined && String(nationalId).trim()) update.nationalId = String(nationalId).trim();
    if (dateOfBirth !== undefined && String(dateOfBirth).trim()) {
      const parsed = new Date(String(dateOfBirth));
      if (!Number.isNaN(parsed.getTime())) update.dateOfBirth = parsed;
    }
    if (gender !== undefined && ['male', 'female', 'other'].includes(String(gender))) {
      update.gender = gender;
    }
    if (county !== undefined && String(county).trim()) update.county = String(county).trim();
    if (occupation !== undefined && String(occupation).trim()) update.occupation = String(occupation).trim();
    if (employer !== undefined && String(employer).trim()) update.employer = String(employer).trim();
    if (phone !== undefined && String(phone).trim()) update.phone = String(phone).trim();
    if (email !== undefined && String(email).trim()) update.email = String(email).toLowerCase().trim();

    const existingMember = await Member.findOne({ userId: req.userId }).select('_id userId email');
    if (!existingMember) return res.status(404).json({ success: false, message: 'Member profile not found' });

    if (typeof update.email === 'string' && existingMember.userId) {
      const duplicateUser = await User.findOne({
        email: update.email,
        _id: { $ne: existingMember.userId }
      }).select('_id');
      if (duplicateUser) {
        return res.status(400).json({ success: false, message: 'Email is already used by another user account' });
      }
    }

    const member = await Member.findOneAndUpdate(
      { userId: req.userId },
      update,
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    if (typeof update.email === 'string' && existingMember.userId) {
      await User.findByIdAndUpdate(existingMember.userId, { email: update.email });
    }

    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

const ALLOWED_DOC_FIELDS = ['docIdCopy', 'docPassportPhoto', 'docMembershipForm', 'docKraPinCertificate'];

// @route   PUT /api/members/me/document
// @desc    Member self-upload KYC document (base64 data URL)
// @access  Private (own account only)
router.put('/me/document', protect, async (req: AuthRequest, res, next) => {
  try {
    const { field, data } = req.body;
    if (!ALLOWED_DOC_FIELDS.includes(field)) {
      return res.status(400).json({ success: false, message: 'Invalid document field' });
    }
    if (!data || typeof data !== 'string' || !data.startsWith('data:')) {
      return res.status(400).json({ success: false, message: 'Invalid document data' });
    }
    // Enforce ~500KB limit (base64 of 500KB binary ≈ 680K chars)
    if (data.length > 700000) {
      return res.status(400).json({ success: false, message: 'Document too large. Maximum file size is 500KB.' });
    }
    const member = await Member.findOneAndUpdate(
      { userId: req.userId },
      { [field]: data },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    res.json({ success: true, data: { field, uploaded: true } });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/members/me/photo
// @desc    Member self-update profile photo (base64 data URL)
// @access  Private (own account only)
router.put('/me/photo', protect, async (req: AuthRequest, res, next) => {
  try {
    const { photo } = req.body;
    if (!photo || typeof photo !== 'string') {
      return res.status(400).json({ success: false, message: 'Photo data is required' });
    }
    // Only allow JPEG, PNG, or WebP data URLs
    if (!photo.startsWith('data:image/jpeg;base64,') && !photo.startsWith('data:image/png;base64,') && !photo.startsWith('data:image/webp;base64,')) {
      return res.status(400).json({ success: false, message: 'Invalid image format. Use JPEG, PNG, or WebP.' });
    }
    // Enforce ~200KB limit (base64 is ~4/3 of original binary size)
    if (photo.length > 270000) {
      return res.status(400).json({ success: false, message: 'Image too large. Please use an image under 200KB.' });
    }
    const member = await Member.findOneAndUpdate(
      { userId: req.userId },
      { profilePhoto: photo },
      { new: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    res.json({ success: true, data: { profilePhoto: member.profilePhoto } });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/members/me
// @desc    Member self-update (phone, email)
// @access  Private (own account only)
router.put('/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const { phone, email } = req.body;
    const update: Record<string, unknown> = {};
    if (phone !== undefined && String(phone).trim()) {
      update.phone = String(phone).trim();
    }
    if (email !== undefined && String(email).trim()) {
      update.email = String(email).toLowerCase().trim();
    }

    const existingMember = await Member.findOne({ userId: req.userId }).select('_id userId email');
    if (!existingMember) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    if (typeof update.email === 'string' && existingMember.userId) {
      const duplicateUser = await User.findOne({
        email: update.email,
        _id: { $ne: existingMember.userId }
      }).select('_id');
      if (duplicateUser) {
        return res.status(400).json({ success: false, message: 'Email is already used by another user account' });
      }
    }

    if (Object.keys(update).length === 0) {
      return res.json({ success: true, data: existingMember });
    }

    const member = await Member.findOneAndUpdate(
      { userId: req.userId },
      update,
      { new: true, runValidators: true }
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });

    if (typeof update.email === 'string' && existingMember.userId) {
      await User.findByIdAndUpdate(existingMember.userId, { email: update.email });
    }

    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/members/me
// @desc    Get the member profile linked to the current authenticated user
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await Member.findOne({ userId: req.userId }).populate('userId', 'email fullName');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found for this account' });
    }

    const memberObj = member.toObject() as any;
    const fallbackEmail =
      typeof memberObj?.email === 'string' && memberObj.email.trim()
        ? memberObj.email
        : (memberObj?.userId && typeof memberObj.userId === 'object' ? memberObj.userId.email : null);

    if (!memberObj.email && fallbackEmail) {
      await Member.findByIdAndUpdate(member._id, { email: String(fallbackEmail).toLowerCase().trim() });
      memberObj.email = String(fallbackEmail).toLowerCase().trim();
    }

    res.json({ success: true, data: memberObj });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/members
// @desc    Get all members
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const members = await Member.find()
      .populate('userId', 'email fullName')
      .sort({ createdAt: -1 });

    const withFallbackEmail = members.map((m: any) => {
      const obj = m.toObject ? m.toObject() : m;
      if (!obj.email && obj.userId && typeof obj.userId === 'object' && obj.userId.email) {
        obj.email = String(obj.userId.email).toLowerCase().trim();
      }
      return obj;
    });

    res.json({
      success: true,
      count: withFallbackEmail.length,
      data: withFallbackEmail
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/members/:id
// @desc    Get single member
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate('userId', 'email fullName');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const obj: any = member.toObject ? member.toObject() : member;
    if (!obj.email && obj.userId && typeof obj.userId === 'object' && obj.userId.email) {
      obj.email = String(obj.userId.email).toLowerCase().trim();
    }

    res.json({
      success: true,
      data: obj
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/members
// @desc    Create new member
// @access  Private (Staff only)
router.post(
  '/',
  protect,
  authorize('admin', 'credit_officer', 'treasurer'),
  auditLog('members', 'create'),
  [
    body('memberId').notEmpty().withMessage('Member ID is required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional()
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

      const member = await Member.create(req.body);

      res.status(201).json({
        success: true,
        data: member
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/members/:id
// @desc    Update member
// @access  Private (Staff only)
router.put(
  '/:id',
  protect,
  authorize('admin', 'credit_officer', 'treasurer'),
  auditLog('members', 'update'),
  async (req, res, next) => {
    try {
      const member = await Member.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/members/:id/link-account
// @desc    Link (or unlink) a member record to a registered user account
// @access  Private (Admin only)
router.put(
  '/:id/link-account',
  protect,
  authorize('admin'),
  auditLog('members', 'link_account'),
  async (req, res, next) => {
    try {
      const { userId } = req.body; // null to unlink

      // If linking, verify the user exists
      if (userId) {
        const user = await User.findById(userId).select('_id email roles');
        if (!user) {
          return res.status(404).json({ success: false, message: 'User account not found' });
        }
        // Ensure the target user isn't already linked to another member
        const alreadyLinked = await Member.findOne({ userId, _id: { $ne: req.params.id } });
        if (alreadyLinked) {
          return res.status(400).json({
            success: false,
            message: `This user account is already linked to member ${alreadyLinked.memberId}`
          });
        }
        // Add 'member' role to user if not already present
        if (!user.roles.includes('member' as any)) {
          await User.findByIdAndUpdate(userId, { $addToSet: { roles: 'member' } });
        }
      }

      const updateData: Record<string, unknown> = { userId: userId || null };
      if (userId) {
        const linkedUser = await User.findById(userId).select('email').lean();
        if (linkedUser?.email) {
          updateData.email = String(linkedUser.email).toLowerCase().trim();
        }
      }

      const member = await Member.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).populate('userId', 'email fullName roles');

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }

      res.json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  }
);

// @route   DELETE /api/members/:id
// @desc    Delete member
// @access  Private (Admin only)
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  auditLog('members', 'delete'),
  async (req, res, next) => {
    try {
      const member = await Member.findByIdAndDelete(req.params.id);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      res.json({
        success: true,
        data: {}
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/members/:id/verify-kyc
// @desc    Verify member KYC
// @access  Private (Staff only)
router.put(
  '/:id/verify-kyc',
  protect,
  authorize('admin', 'credit_officer'),
  auditLog('members', 'verify_kyc'),
  async (req: AuthRequest, res, next) => {
    try {
      const member = await Member.findByIdAndUpdate(
        req.params.id,
        {
          kycVerified: true,
          kycVerifiedAt: new Date(),
          kycVerifiedBy: req.userId
        },
        { new: true }
      );

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
