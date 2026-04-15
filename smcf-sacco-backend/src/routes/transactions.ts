import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import Loan from '../models/Loan';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { processRepayment } from './repayments';
import { notifyMember } from '../utils/notify';
import { recalculateMemberRiskScore } from '../utils/riskScore';
import { recordSavingsDeposit } from '../utils/depositLedger';

const router = Router();

// @route   GET /api/transactions
// @desc    Get all transactions
// @access  Private
router.get('/', protect, async (req, res, next) => {
  try {
    const { memberId, type, status, limit = 50 } = req.query;
    const filter: any = {};

    if (memberId) filter.memberId = memberId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate('memberId', 'name memberId')
      .populate('createdBy', 'email fullName')
      .sort({ processedAt: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', protect, async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('memberId', 'name memberId email')
      .populate('createdBy', 'email fullName');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/transactions
// @desc    Create new transaction
// @access  Private (Staff only)
router.post(
  '/',
  protect,
  authorize('admin', 'treasurer', 'credit_officer'),
  auditLog('transactions', 'create'),
  [
    body('memberId').notEmpty().withMessage('Member ID is required'),
    body('type').isIn(['deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'share_purchase', 'share_transfer', 'dividend', 'savings_interest'])
      .withMessage('Invalid transaction type'),
    body('amount').isNumeric().withMessage('Amount is required'),
    body('description').optional()
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

      const { memberId, type, amount, description } = req.body;

      // Generate transaction reference
      const count = await Transaction.countDocuments();
      const transactionRef = `TXN${new Date().getFullYear()}${String(count + 1).padStart(8, '0')}`;

      // Create transaction
      const transaction = await Transaction.create({
        transactionRef,
        memberId,
        type,
        amount,
        description,
        status: 'completed',
        depositProcessed: type === 'deposit',
        createdBy: req.userId
      });

      // Update member balance based on transaction type
      if (type === 'deposit') {
        try {
          await recordSavingsDeposit({
            memberId: String(memberId),
            amount: Number(amount),
            reference: transactionRef,
            sourceLabel: 'manual deposit',
            processedAt: new Date(),
            note: description ? String(description).trim() : undefined,
            notificationPath: '/accounts',
          });
        } catch (depositError) {
          await Transaction.findByIdAndUpdate(transaction._id, {
            status: 'failed',
            processedAt: new Date(),
          }).catch(() => {});
          throw depositError;
        }
      } else if (type === 'withdrawal') {
        await Member.findByIdAndUpdate(memberId, { $inc: { savings: -amount } });
      } else if (type === 'share_purchase') {
        await Member.findByIdAndUpdate(memberId, { $inc: { shares: amount } });
      } else if (type === 'savings_interest') {
        await Member.findByIdAndUpdate(memberId, { $inc: { savings: amount } });
      } else if (type === 'loan_repayment') {
        await Member.findByIdAndUpdate(memberId, { $inc: { loanBalance: -amount } });
      }

      if (type === 'share_purchase') {
        await recalculateMemberRiskScore(String(memberId));
      }

      res.status(201).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PUT /api/transactions/:id
// @desc    Update transaction status
// @access  Private (Staff only)
router.put(
  '/:id',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('transactions', 'update'),
  async (req, res, next) => {
    try {
      const transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true, runValidators: true }
      );

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction not found'
        });
      }

      res.json({
        success: true,
        data: transaction
      });
    } catch (error) {
      next(error);
    }
  }
);

// @route   PATCH /api/transactions/:id/confirm
// @desc    Admin confirms a pending Lipia payment — marks complete and updates balances
// @access  Admin / Treasurer
router.patch(
  '/:id/confirm',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('transactions', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const txn = await Transaction.findById(req.params.id);
      if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (txn.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Transaction already confirmed' });
      }

      if (txn.type === 'deposit') {
        await Transaction.findByIdAndUpdate(txn._id, {
          status: 'completed',
          processedAt: new Date(),
          depositProcessed: true,
          description: txn.description?.replace('Pending admin confirmation', `Confirmed by admin — ${new Date().toLocaleDateString('en-KE')}`),
        });

        try {
          await recordSavingsDeposit({
            memberId: String(txn.memberId),
            amount: Number(txn.amount),
            reference: txn.transactionRef,
            sourceLabel: 'admin confirmation',
            processedAt: new Date(),
            note: 'Pending payment confirmed by staff',
            notificationPath: '/accounts',
          });
        } catch (depositError) {
          await Transaction.findByIdAndUpdate(txn._id, {
            status: 'failed',
            processedAt: new Date(),
          }).catch(() => {});
          throw depositError;
        }

        // Notify the member their deposit was confirmed
        notifyMember(
          txn.memberId,
          'Deposit Confirmed ✅',
          `Your deposit of KES ${Number(txn.amount).toLocaleString()} has been confirmed and added to your savings.`,
          'approval',
          '/my-account'
        );

      } else if (txn.type === 'share_purchase') {
        // Update share capital
        await Member.findByIdAndUpdate(txn.memberId, { $inc: { shares: txn.amount } });
        await recalculateMemberRiskScore(String(txn.memberId));
        await Transaction.findByIdAndUpdate(txn._id, {
          status: 'completed',
          processedAt: new Date(),
          description: txn.description?.replace('Pending admin confirmation', `Confirmed by admin — ${new Date().toLocaleDateString('en-KE')}`),
        });
        notifyMember(
          txn.memberId,
          'Share Subscription Confirmed ✅',
          `Your share subscription of KES ${Number(txn.amount).toLocaleString()} has been confirmed and added to your share capital.`,
          'approval',
          '/my-account'
        );

      } else if (txn.type === 'loan_repayment') {
        // Extract loanId embedded in description e.g. "[loanId:6abc123]"
        const match = txn.description?.match(/\[loanId:([a-f0-9]+)\]/i);
        if (!match) {
          return res.status(400).json({ success: false, message: 'Cannot determine loan for this repayment — confirm manually' });
        }
        const loanId = match[1];

        // Delete this placeholder and let processRepayment create the real transaction
        await Transaction.findByIdAndDelete(txn._id);
        await processRepayment(
          loanId,
          txn.amount,
          'mpesa',
          `Lipia Online confirmed by admin on ${new Date().toLocaleDateString('en-KE')}`,
          req.userId!
        );
      }

      return res.json({ success: true, message: 'Payment confirmed and balances updated.' });
    } catch (err) {
      next(err);
    }
  }
);

// @route   PATCH /api/transactions/:id/decline
// @desc    Admin declines a pending payment — marks as declined, no balance change
// @access  Admin / Treasurer
router.patch(
  '/:id/decline',
  protect,
  authorize('admin', 'treasurer'),
  auditLog('transactions', 'update'),
  async (req: AuthRequest, res, next) => {
    try {
      const txn = await Transaction.findById(req.params.id);
      if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
      if (txn.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Only pending payments can be declined' });
      }

      const reason = (req.body as any)?.reason?.trim() || 'Payment could not be verified';

      await Transaction.findByIdAndUpdate(txn._id, {
        status: 'declined',
        processedAt: new Date(),
        description: `${txn.description ?? ''} [DECLINED: ${reason} — ${new Date().toLocaleDateString('en-KE')}]`.trim(),
      });

      notifyMember(
        txn.memberId,
        'Payment Declined ❌',
        `Your payment of KES ${Number(txn.amount).toLocaleString()} was declined. Reason: ${reason}. Contact the office if you believe this is an error.`,
        'rejection',
        '/my-account'
      );

      return res.json({ success: true, message: 'Payment declined.' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
