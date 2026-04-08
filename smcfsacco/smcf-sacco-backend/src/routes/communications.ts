import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Member from '../models/Member';
import EmailBroadcast from '../models/EmailBroadcast';
import MemberMessage from '../models/MemberMessage';
import { protect, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { getEmailDeliveryHealth, sendBulkEmail } from '../services/emailService';

const router = Router();
const STAFF_ROLES = ['admin', 'credit_officer', 'credit_committee', 'treasurer', 'auditor'];

function normalizeEmail(input: unknown): string | null {
  const email = String(input || '').trim().toLowerCase();
  if (!email || email.length < 5 || email.length > 254) return null;

  // Comprehensive email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return null;
  
  // Reject obviously invalid patterns
  if (email.startsWith('.') || email.startsWith('@') || email.endsWith('@')) return null;
  if (email.includes('..') || email.includes(' ')) return null;
  if (email.includes('<') || email.includes('>')) return null;
  
  // Common typo catch (double domains)
  const domainPart = email.split('@')[1];
  if (!domainPart || !domainPart.includes('.')) return null;

  return email;
}

// @route   POST /api/communications/email-broadcast
// @route   POST /api/email/broadcast (legacy alias)
// @desc    Broadcast email to all stored user/member emails (admin only)
// @access  Private (Admin only)
router.post(
  ['/email-broadcast', '/broadcast'],
  protect,
  authorize('admin'),
  auditLog('communications', 'email_broadcast'),
  [
    body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 180 }).withMessage('Subject must be at most 180 characters'),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 10000 }).withMessage('Message must be at most 10000 characters'),
    body('isHtml').optional().isBoolean().withMessage('isHtml must be a boolean'),
    body('dryRun').optional().isBoolean().withMessage('dryRun must be a boolean'),
    body('templateMode').optional().isIn(['plain', 'branded']).withMessage('templateMode must be plain or branded'),
    body('recipientMode').optional().isIn(['filters', 'manual']).withMessage('recipientMode must be filters or manual'),
    body('filters').optional().isObject().withMessage('filters must be an object'),
    body('filters.staffOnly').optional().isBoolean().withMessage('filters.staffOnly must be a boolean'),
    body('filters.activeMembersOnly').optional().isBoolean().withMessage('filters.activeMembersOnly must be a boolean'),
    body('filters.verifiedUsersOnly').optional().isBoolean().withMessage('filters.verifiedUsersOnly must be a boolean'),
    body('manualEmails').optional().isArray().withMessage('manualEmails must be an array'),
    body('manualEmails.*').optional().isString().withMessage('manualEmails values must be strings'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map((e) => e.msg).join(', '),
        });
      }

      const {
        subject,
        message,
        isHtml = false,
        dryRun = false,
        templateMode = 'plain',
        recipientMode = 'filters',
        manualEmails = [],
      } = req.body as {
        subject: string;
        message: string;
        isHtml?: boolean;
        dryRun?: boolean;
        templateMode?: 'plain' | 'branded';
        recipientMode?: 'filters' | 'manual';
        manualEmails?: string[];
      };

      const filters = {
        staffOnly: Boolean(req.body?.filters?.staffOnly),
        activeMembersOnly: Boolean(req.body?.filters?.activeMembersOnly),
        verifiedUsersOnly: Boolean(req.body?.filters?.verifiedUsersOnly),
      };

      const userQuery: any = { 
        email: { $exists: true, $ne: null, $regex: '^.+@.+\\..+$' }  // Must have valid email format
      };
      if (filters.staffOnly) {
        userQuery.roles = { $in: STAFF_ROLES };
      }
      if (filters.verifiedUsersOnly) {
        userQuery.isEmailVerified = true;
      }

      const memberQuery: any = { 
        email: { $exists: true, $ne: null, $regex: '^.+@.+\\..+$' }  // Must have valid email format
      };
      if (filters.activeMembersOnly) {
        memberQuery.status = 'active';
      }

      let fromUsers: string[] = [];
      let fromMembers: string[] = [];
      let dedupedRecipients: string[] = [];

      if (recipientMode === 'manual') {
        dedupedRecipients = Array.from(
          new Set(
            (Array.isArray(manualEmails) ? manualEmails : [])
              .map((email) => normalizeEmail(email))
              .filter((email): email is string => Boolean(email))
          )
        );
        fromUsers = dedupedRecipients;
      } else {
        const [users, members] = await Promise.all([
          User.find(userQuery).select('email').lean(),
          filters.staffOnly ? Promise.resolve([] as any[]) : Member.find(memberQuery).select('email').lean(),
        ]);

        fromUsers = users
          .map((u: any) => normalizeEmail(u.email))
          .filter((email): email is string => Boolean(email));

        fromMembers = members
          .map((m: any) => normalizeEmail(m.email))
          .filter((email): email is string => Boolean(email));

        dedupedRecipients = Array.from(new Set([...fromUsers, ...fromMembers]));
      }

      if (dedupedRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid recipient emails found in the system',
          data: {
            recipients: {
              fromUsers: fromUsers.length,
              fromMembers: fromMembers.length,
              dedupedTotal: 0,
            },
            filters,
          },
        });
      }

      const maxRecipients = Math.max(1, Number(process.env.ADMIN_EMAIL_MAX_RECIPIENTS || 5000));
      const limitedRecipients = dedupedRecipients.slice(0, maxRecipients);
      const skippedByCap = Math.max(0, dedupedRecipients.length - limitedRecipients.length);

      if (dryRun) {
        return res.json({
          success: true,
          message: 'Dry run complete',
          data: {
            dryRun: true,
            recipients: {
              fromUsers: fromUsers.length,
              fromMembers: fromMembers.length,
              dedupedTotal: dedupedRecipients.length,
              maxRecipients,
              skippedByCap,
              sendable: limitedRecipients.length,
            },
            templateMode,
            recipientMode,
            filters,
          },
        });
      }

      const health = getEmailDeliveryHealth();
      if (!health.details.resendApiKeyConfigured) {
        return res.status(503).json({
          success: false,
          message: 'Email delivery is not configured. Set RESEND_API_KEY before sending broadcasts.',
          data: {
            health,
          },
        });
      }

      const sendResult = await sendBulkEmail({
        recipients: limitedRecipients,
        subject,
        message,
        isHtml,
        templateMode,
      });

      const messagePreview = message.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);

      await EmailBroadcast.create({
        createdBy: req.userId || null,
        subject,
        messagePreview,
        isHtml,
        templateMode,
        filters,
        recipients: {
          fromUsers: fromUsers.length,
          fromMembers: fromMembers.length,
          dedupedTotal: dedupedRecipients.length,
          maxRecipients,
          skippedByCap,
          attempted: sendResult.attempted,
        },
        delivery: {
          sent: sendResult.sent,
          failed: sendResult.failed,
          sampleFailures: sendResult.failures.slice(0, 20),
        },
      });

      res.json({
        success: true,
        message: `Broadcast completed: ${sendResult.sent} sent, ${sendResult.failed} failed`,
        data: {
          dryRun: false,
          recipients: {
            fromUsers: fromUsers.length,
            fromMembers: fromMembers.length,
            dedupedTotal: dedupedRecipients.length,
            maxRecipients,
            skippedByCap,
            attempted: sendResult.attempted,
          },
          templateMode,
          recipientMode,
          filters,
          delivery: {
            sent: sendResult.sent,
            failed: sendResult.failed,
            sampleFailures: sendResult.failures.slice(0, 20),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/communications/history
// @route   GET /api/communications/email-broadcast-history (legacy alias)
// @desc    Get sent broadcast history (admin only)
// @access  Private (Admin only)
router.get(['/history', '/email-broadcast-history'], protect, authorize('admin'), async (_req, res, next) => {
  try {
    const history = await EmailBroadcast.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('createdBy', 'email fullName');

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/communications/member-messages
// @desc    Submit a member message for admin review
// @access  Private
router.post(
  '/member-messages',
  protect,
  [
    body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 180 }).withMessage('Subject must be at most 180 characters'),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }).withMessage('Message must be at most 5000 characters'),
    body('source').optional().isIn(['member-dashboard', 'members-section', 'landing-page']).withMessage('Invalid source'),
  ],
  async (req: any, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map((e) => e.msg).join(', '),
        });
      }

      const subject = String(req.body?.subject || '').trim();
      const message = String(req.body?.message || '').trim();
      const source = (req.body?.source || 'member-dashboard') as 'member-dashboard' | 'members-section' | 'landing-page';

      const senderName = req.user?.fullName || req.user?.email || 'Member';
      const senderContact = req.user?.email || '';

      const created = await MemberMessage.create({
        source,
        senderUserId: req.userId || null,
        senderName,
        senderContact,
        subject,
        message,
        status: 'new',
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/communications/member-messages
// @desc    Admin inbox for member messages
// @access  Private (Admin only)
router.get('/member-messages', protect, authorize('admin'), async (_req, res, next) => {
  try {
    const messages = await MemberMessage.find().sort({ createdAt: -1 }).limit(100).populate('senderUserId', 'email fullName roles');
    res.json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/communications/member-messages/:id/read
// @desc    Mark member message as read
// @access  Private (Admin only)
router.patch('/member-messages/:id/read', protect, authorize('admin'), async (req: any, res, next) => {
  try {
    const updated = await MemberMessage.findByIdAndUpdate(
      req.params.id,
      {
        status: 'read',
        readBy: req.userId || null,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
