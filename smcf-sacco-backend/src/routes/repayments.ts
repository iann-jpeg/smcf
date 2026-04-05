import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import RepaymentRecord from '../models/RepaymentRecord';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import Member from '../models/Member';
import SystemConfig from '../models/SystemConfig';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { notifyMember } from '../utils/notify';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function generateTxnRef(): Promise<string> {
  const count = await Transaction.countDocuments();
  return `TXN${new Date().getFullYear()}${String(count + 1).padStart(8, '0')}`;
}

/**
 * Core atomic repayment logic.
 * Handles: transaction creation, repayment record update, loan balance update,
 * member loanBalance update, and loan completion.
 */
async function processRepayment(
  loanId: string,
  amount: number,
  method: string,
  note: string | null,
  actorId: string | null
): Promise<{ transaction: any; repaymentRecord: any; loanCompleted: boolean }> {
  const loan = await Loan.findById(loanId);
  if (!loan) throw new Error('Loan not found');
  if (!['disbursed', 'active'].includes(loan.status)) {
    throw new Error('Loan is not active or disbursed — repayment not allowed');
  }

  // 1. Apply penalties to any overdue installments and collect pending schedule
  const installments = await RepaymentRecord.find({
    loanId: loan._id,
    status: { $in: ['pending', 'overdue', 'partial'] },
  }).sort({ dueDate: 1 });

  let penaltyApplied = 0;
  const now = new Date();
  const config = await SystemConfig.getConfig();
  const penaltyRate = Math.max(0, Number(config.penaltyRate || 0));

  for (const installment of installments) {
    if (installment.dueDate < now && installment.status !== 'paid') {
      if (!installment.penaltyAmount) {
        const penaltyForInstallment = penaltyRate > 0
          ? Math.round((installment.amountDue * penaltyRate) / 100)
          : 0;
        if (penaltyForInstallment > 0) {
          await RepaymentRecord.findByIdAndUpdate(
            installment._id,
            {
              penaltyAmount: penaltyForInstallment,
              amountDue: installment.amountDue + penaltyForInstallment,
              status: 'overdue',
            },
            { new: true }
          );
          installment.amountDue += penaltyForInstallment;
          installment.penaltyAmount = penaltyForInstallment;
          installment.status = 'overdue';
          penaltyApplied += penaltyForInstallment;
        } else if (installment.status === 'pending') {
          await RepaymentRecord.findByIdAndUpdate(installment._id, { status: 'overdue' });
          installment.status = 'overdue';
        }
      } else if (installment.status === 'pending') {
        await RepaymentRecord.findByIdAndUpdate(installment._id, { status: 'overdue' });
        installment.status = 'overdue';
      }
    }
  }

  const effectiveBalance = Math.max(0, loan.balance + penaltyApplied);
  const paid = Math.min(amount, effectiveBalance); // can't overpay

  // 2. Create transaction record
  const txnRef = await generateTxnRef();
  const transaction = await Transaction.create({
    transactionRef: txnRef,
    memberId: loan.memberId,
    type: 'loan_repayment',
    amount: paid,
    description: `Loan Repayment — ${loan.loanNumber} — via ${method}${note ? ` — ${note}` : ''}`,
    status: 'completed',
    createdBy: actorId,
  });

  let repaymentRecord = null;
  let remaining = paid;

  for (const installment of installments) {
    if (remaining <= 0) break;
    const dueLeft = Math.max(0, installment.amountDue - (installment.amountPaid || 0));
    if (dueLeft <= 0) continue;

    const applied = Math.min(remaining, dueLeft);
    const newPaid = (installment.amountPaid || 0) + applied;
    const newStatus: IRepaymentStatus = newPaid >= installment.amountDue ? 'paid' : 'partial';

    repaymentRecord = await RepaymentRecord.findByIdAndUpdate(
      installment._id,
      {
        amountPaid: newPaid,
        paidDate: newStatus === 'paid' ? new Date() : null,
        status: newStatus,
      },
      { new: true }
    );

    remaining -= applied;
  }

  // 3. Update loan balance
  const newBalance = Math.max(0, effectiveBalance - paid);
  const loanCompleted = newBalance === 0;
  await Loan.findByIdAndUpdate(loanId, {
    balance: newBalance,
    ...(loanCompleted ? { status: 'completed' } : {}),
  });

  // 4. Update member's loanBalance
  await Member.findByIdAndUpdate(loan.memberId, { $inc: { loanBalance: penaltyApplied - paid } });

  // 5. Notify the member their repayment was recorded
  notifyMember(
    loan.memberId,
    loanCompleted ? 'Loan Fully Repaid 🎉' : 'Repayment Confirmed ✅',
    loanCompleted
      ? `Congratulations! Your loan ${loan.loanNumber} has been fully repaid.`
      : `Your repayment of KES ${paid.toLocaleString()} for loan ${loan.loanNumber} has been confirmed. Remaining balance: KES ${Math.max(0, newBalance).toLocaleString()}.`,
    'approval',
    '/my-account'
  );

  return { transaction, repaymentRecord, loanCompleted };
}

type IRepaymentStatus = 'pending' | 'paid' | 'overdue' | 'partial';

// ─── GET /api/repayments ─────────────────────────────────────────────────────
router.get('/', protect, async (req: AuthRequest, res, next) => {
  try {
    const { memberId, loanId, limit = 50 } = req.query;
    const filter: any = {};
    if (memberId) filter.memberId = memberId;
    if (loanId)   filter.loanId   = loanId;

    const records = await RepaymentRecord.find(filter)
      .populate('loanId', 'loanNumber')
      .sort({ dueDate: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/repayments/loan/:loanId/history ────────────────────────────────
// Full repayment transaction history for a given loan
router.get('/loan/:loanId/history', protect, async (req: AuthRequest, res, next) => {
  try {
    const loan = await Loan.findById(req.params.loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    const [records, transactions] = await Promise.all([
      RepaymentRecord.find({ loanId: req.params.loanId }).sort({ dueDate: 1 }),
      Transaction.find({ memberId: loan.memberId, type: 'loan_repayment' })
        .sort({ processedAt: -1 }),
    ]);

    res.json({ success: true, data: { schedule: records, payments: transactions } });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/repayments/loan/:loanId/pay ───────────────────────────────────
// Admin / staff record a manual (cash) repayment
router.post(
  '/loan/:loanId/pay',
  protect,
  authorize('admin', 'treasurer', 'credit_officer'),
  auditLog('repayments', 'create'),
  [
    body('amount').isNumeric().withMessage('Amount is required'),
    body('method').optional().isIn(['cash', 'bank_transfer', 'mpesa', 'cheque']),
    body('note').optional().isString(),
  ],
  async (req: AuthRequest, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { amount, method = 'cash', note = null } = req.body;
      const num = Math.round(Number(amount));
      if (num <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });

      const result = await processRepayment(
        req.params.loanId,
        num,
        method,
        note,
        req.userId!
      );

      res.status(201).json({
        success: true,
        message: result.loanCompleted ? 'Loan fully repaid and marked as completed!' : 'Repayment recorded successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/repayments/loan/:loanId/mpesa ────────────────────────────────
// Member self-service M-Pesa loan repayment (STK push)
// Imported by the mpesa route handler — also accessible directly for polling.
export { processRepayment };

export default router;

