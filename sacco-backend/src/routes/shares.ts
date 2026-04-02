/**
 * Shares routes
 *  POST /api/shares/transfer              — Member transfers share capital to another member
 *  POST /api/shares/distribute-dividends  — Admin proportionally distributes a dividend pool
 */

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { notifyMember, notifyStaff } from '../utils/notify';

const router = Router();

// ─── POST /api/shares/transfer ───────────────────────────────────────────────
// Authenticated member transfers their own share capital to another member.

router.post(
  '/transfer',
  protect,
  auditLog('shares', 'transfer'),
  [
    body('recipientMemberId').notEmpty().withMessage('Recipient member ID is required'),
    body('amount').isFloat({ min: 100 }).withMessage('Minimum transfer amount is KES 100'),
  ],
  async (req: AuthRequest, res: any, next: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { recipientMemberId, amount, description } = req.body;
      const numAmount = Math.round(Number(amount));

      // Resolve sender from the authenticated user
      const sender = await Member.findOne({ userId: req.userId });
      if (!sender) {
        return res.status(404).json({ success: false, message: 'Your member profile was not found' });
      }
      if (sender.shares < numAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient share capital. You have KES ${sender.shares.toLocaleString()} available.`,
        });
      }

      // Find recipient by human-readable memberId (e.g. "MCF001")
      const recipient = await Member.findOne({ memberId: recipientMemberId });
      if (!recipient) {
        return res.status(404).json({ success: false, message: 'Recipient member not found' });
      }
      if (String(sender._id) === String(recipient._id)) {
        return res.status(400).json({ success: false, message: 'Cannot transfer shares to yourself' });
      }

      // Generate two sequential transaction refs
      const count = await Transaction.countDocuments();
      const year  = new Date().getFullYear();
      const senderRef    = `TXN${year}${String(count + 1).padStart(8, '0')}`;
      const recipientRef = `TXN${year}${String(count + 2).padStart(8, '0')}`;

      // Debit — sender
      await Transaction.create({
        transactionRef: senderRef,
        memberId: sender._id,
        type: 'share_transfer',
        amount: numAmount,
        description: description || `Share transfer sent to ${recipient.name} (${recipient.memberId})`,
        status: 'completed',
        createdBy: req.userId,
      });

      // Credit — recipient
      await Transaction.create({
        transactionRef: recipientRef,
        memberId: recipient._id,
        type: 'share_transfer',
        amount: numAmount,
        description: description || `Share transfer received from ${sender.name} (${sender.memberId})`,
        status: 'completed',
        createdBy: req.userId,
      });

      // Update balances atomically
      await Member.findByIdAndUpdate(sender._id,    { $inc: { shares: -numAmount } });
      await Member.findByIdAndUpdate(recipient._id, { $inc: { shares:  numAmount } });

      // Notify both parties (fire-and-forget)
      notifyMember(
        sender._id,
        'Share Transfer Sent',
        `You transferred KES ${numAmount.toLocaleString()} in share capital to ${recipient.name} (${recipient.memberId}).`,
        'info',
        '/my-account'
      );
      notifyMember(
        recipient._id,
        'Share Transfer Received 📈',
        `${sender.name} (${sender.memberId}) transferred KES ${numAmount.toLocaleString()} in share capital to your account.`,
        'approval',
        '/my-account'
      );

      return res.json({
        success: true,
        data: {
          senderRef,
          recipientRef,
          amount: numAmount,
          from: { name: sender.name,    memberId: sender.memberId,    newShares: sender.shares - numAmount },
          to:   { name: recipient.name, memberId: recipient.memberId, newShares: recipient.shares + numAmount },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/shares/distribute-dividends ───────────────────────────────────
// Admin distributes a total dividend pool proportionally to all active members
// who hold share capital. Dividends are credited to each member's savings.

router.post(
  '/distribute-dividends',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('shares', 'distribute-dividends'),
  [
    body('totalDividend').isFloat({ min: 1 }).withMessage('Total dividend must be greater than 0'),
    body('period').notEmpty().withMessage('Period is required (e.g. 2025 or Q1-2025)'),
  ],
  async (req: AuthRequest, res: any, next: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { totalDividend, period } = req.body;
      const numTotal = Math.round(Number(totalDividend));

      // Check that this period hasn't already been distributed
      const existing = await Transaction.findOne({
        type: 'dividend',
        description: new RegExp(`Period: ${period}`, 'i'),
        status: 'completed',
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Dividends for period "${period}" have already been distributed.`,
        });
      }

      // Fetch all active members with share capital > 0
      const members = await Member.find({ status: 'active', shares: { $gt: 0 } });
      if (members.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active members with share capital found.',
        });
      }

      const totalShares = members.reduce((sum, m) => sum + m.shares, 0);
      const count = await Transaction.countDocuments();
      const year  = new Date().getFullYear();

      const distributions: {
        memberId: string; name: string; shares: number; proportion: number; dividend: number; ref: string;
      }[] = [];

      let seqOffset = 0;
      for (const member of members) {
        const proportion = member.shares / totalShares;
        const dividend   = Math.round(proportion * numTotal);
        if (dividend <= 0) continue;

        const ref = `TXN${year}${String(count + seqOffset + 1).padStart(8, '0')}`;
        seqOffset++;

        await Transaction.create({
          transactionRef: ref,
          memberId: member._id,
          type: 'dividend',
          amount: dividend,
          description: `Dividend — Period: ${period} | Share proportion: ${(proportion * 100).toFixed(2)}%`,
          status: 'completed',
          createdBy: req.userId,
        });

        // Credit dividend to member savings
        await Member.findByIdAndUpdate(member._id, { $inc: { savings: dividend } });

        // Notify member
        notifyMember(
          member._id,
          'Dividend Credited 💰',
          `Your dividend of KES ${dividend.toLocaleString()} for period ${period} has been credited to your savings.`,
          'approval',
          '/my-account'
        );

        distributions.push({
          memberId: String(member._id),
          name:       member.name,
          shares:     member.shares,
          proportion: parseFloat((proportion * 100).toFixed(2)),
          dividend,
          ref,
        });
      }

      // Notify staff that distribution is complete
      notifyStaff(
        'Dividend Distribution Complete',
        `KES ${numTotal.toLocaleString()} distributed to ${distributions.length} members for period ${period}.`,
        'info',
        '/accounts'
      );

      return res.json({
        success: true,
        data: {
          period,
          totalDividend: numTotal,
          totalShares,
          membersProcessed: distributions.length,
          distributions,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
