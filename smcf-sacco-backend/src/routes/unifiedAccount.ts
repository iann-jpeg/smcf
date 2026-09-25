import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Transaction from '../models/Transaction';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

function objectIdOrString(value: string) {
  return mongoose.Types.ObjectId.isValid(value)
    ? [{ _id: new mongoose.Types.ObjectId(value) }, { _id: value }]
    : [{ _id: value }];
}

function memberIdFilters(memberObjectId: string, memberCode: string) {
  const filters: Record<string, unknown>[] = [
    { member_id: memberCode },
    { memberId: memberCode },
    { member_id: memberObjectId },
    { memberId: memberObjectId },
  ];

  if (mongoose.Types.ObjectId.isValid(memberObjectId)) {
    const objectId = new mongoose.Types.ObjectId(memberObjectId);
    filters.push({ member_id: objectId }, { memberId: objectId });
  }

  return filters;
}

// @route   GET /api/unified-account
// @desc    Read-only SACCO account summary for wallet and cycles modules
// @access  Private
router.get('/', protect, async (req: AuthRequest, res, next) => {
  try {
    const requestedMemberId = String(req.query.memberId || '').trim();
    const staffRoles = ['admin', 'credit_officer', 'treasurer', 'auditor'];
    const canViewRequestedMember = Boolean(
      requestedMemberId && req.user?.roles?.some((role) => staffRoles.includes(role)),
    );

    if (requestedMemberId && !canViewRequestedMember) {
      return res.status(403).json({ success: false, message: 'Staff access is required to view another member account' });
    }

    const member = canViewRequestedMember
      ? await Member.findById(requestedMemberId).lean()
      : await Member.findOne({ userId: req.userId }).lean();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found' });
    }

    const memberObjectId = String(member._id);
    const memberCode = String(member.memberId);
    const transactionFilter = { memberId: member._id };

    const [transactions, completedTransactions] = await Promise.all([
      Transaction.find(transactionFilter).sort({ processedAt: -1 }).limit(50).lean(),
      Transaction.find({ ...transactionFilter, status: 'completed' }).lean(),
    ]);

    const deposits = completedTransactions
      .filter((transaction) => ['deposit', 'savings_interest'].includes(transaction.type))
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const withdrawals = completedTransactions
      .filter((transaction) => transaction.type === 'withdrawal')
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

    let cycle: Record<string, unknown> | null = null;
    let cyclePayments: Record<string, unknown>[] = [];
    const database = mongoose.connection.db;

    if (database) {
      const cyclesCollection = database.collection('cycles');
      const paymentsCollection = database.collection('payments');
      const currentCycle = await cyclesCollection.findOne(
        { status: 'active' },
        { sort: { cycle_number: -1 } },
      );

      if (currentCycle) {
        const paymentFilter = {
          cycle_number: currentCycle.cycle_number,
          status: 'completed',
          $or: memberIdFilters(memberObjectId, memberCode),
        };
        cyclePayments = await paymentsCollection.find(paymentFilter).sort({ created_at: -1 }).limit(50).toArray();

        const cyclePaymentTotal = cyclePayments.reduce(
          (total, payment) => total + Number(payment.amount || 0),
          0,
        );

        cycle = {
          cycleNumber: currentCycle.cycle_number,
          status: currentCycle.status,
          startDate: currentCycle.start_date ?? null,
          endDate: currentCycle.end_date ?? null,
          daysLeft: currentCycle.days_left ?? null,
          contributionAmount: currentCycle.contribution_amount ?? currentCycle.expected_amount ?? null,
          memberContribution: cyclePaymentTotal,
          paymentCount: cyclePayments.length,
          nextRecipient: currentCycle.next_recipient ?? null,
        };
      }
    }

    return res.json({
      success: true,
      data: {
        member: {
          id: memberObjectId,
          memberId: memberCode,
          name: member.name,
          status: member.status,
        },
        wallet: {
          balance: Number(member.savings || 0),
          totalDeposits: deposits,
          totalWithdrawals: withdrawals,
          transactionCount: transactions.length,
          transactions,
        },
        cycles: {
          active: cycle,
          payments: cyclePayments,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;