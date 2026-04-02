import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import RepaymentRecord from '../models/RepaymentRecord';
import Transaction from '../models/Transaction';
import Loan from '../models/Loan';
import Member from '../models/Member';
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

  const paid = Math.min(amount, loan.balance); // can't overpay

  // 1. Create transaction record
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

  // 2. Update the oldest pending/overdue repayment installment
  const installment = await RepaymentRecord.findOne({
    loanId: loan._id,
    status: { $in: ['pending', 'overdue', 'partial'] },
  }).sort({ dueDate: 1 });

  let repaymentRecord = null;
  if (installment) {
    const newPaid  = (installment.amountPaid || 0) + paid;
    const newStatus: IRepaymentStatus =
      newPaid >= installment.amountDue ? 'paid' : 'partial';

    repaymentRecord = await RepaymentRecord.findByIdAndUpdate(
      installment._id,
      {
        amountPaid: newPaid,
        paidDate: newStatus === 'paid' ? new Date() : null,
        status: newStatus,
      },
      { new: true }
    );
  }

  // 3. Update loan balance
  const newBalance = Math.max(0, loan.balance - paid);
  const loanCompleted = newBalance === 0;
  await Loan.findByIdAndUpdate(loanId, {
    balance: newBalance,
    ...(loanCompleted ? { status: 'completed' } : {}),
  });

  // 4. Update member's loanBalance
  await Member.findByIdAndUpdate(loan.memberId, { $inc: { loanBalance: -paid } });

  // 5. Notify the member their repayment was recorded
  notifyMember(
    loan.memberId,
    loanCompleted ? 'Loan Fully Repaid 🎉' : 'Repayment Confirmed ✅',
    loanCompleted
      ? `Congratulations! Your loan ${loan.loanNumber} has been fully repaid.`
      : `Your repayment of KES ${paid.toLocaleString()} for loan ${loan.loanNumber} has been confirmed. Remaining balance: KES ${Math.max(0, loan.balance - paid).toLocaleString()}.`,
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

