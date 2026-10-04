import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Transaction from '../models/Transaction';
import TenXContribution from '../models/TenXContribution';
import TenXPeriod from '../models/TenXPeriod';
import Saving from '../models/Saving';
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

    const [transactions, completedTransactions, walletRecords] = await Promise.all([
      Transaction.find(transactionFilter).sort({ processedAt: -1 }).limit(50).lean(),
      Transaction.find({ ...transactionFilter, status: 'completed' }).lean(),
      Saving.find({ member_id: member._id }).sort({ created_at: -1 }).limit(50).lean(),
    ]);

    const deposits = completedTransactions
      .filter((transaction) => ['deposit', 'savings_interest'].includes(transaction.type) && !transaction.cycleNumber)
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const withdrawals = completedTransactions
      .filter((transaction) => transaction.type === 'withdrawal')
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
    const completedWallet = walletRecords.filter((record) => record.status === 'completed');
    const walletBalance = completedWallet.reduce((total, record) => {
      if (record.transaction_type === 'deposit' || record.transaction_type === 'interest') return total + Number(record.amount || 0);
      if (record.transaction_type === 'withdrawal') return total - Number(record.amount || 0);
      if (record.transaction_type === 'adjustment') return total + (record.adjustment_direction === 'credit' ? Number(record.amount || 0) : -Number(record.amount || 0));
      return total;
    }, 0);
    const walletPrincipal = completedWallet.filter((record) => record.transaction_type === 'deposit').reduce((total, record) => total + Number(record.amount || 0), 0);
    const walletInterest = completedWallet.filter((record) => record.transaction_type === 'interest').reduce((total, record) => total + Number(record.amount || 0), 0);
    const lockedWallet = completedWallet.filter((record) => record.transaction_type === 'deposit' && record.unlock_date && new Date(record.unlock_date) > new Date()).reduce((total, record) => total + Number(record.amount || 0), 0);

    let cycle: Record<string, unknown> | null = null;
    let cyclePayments: Record<string, unknown>[] = [];
    let tenX: Record<string, unknown> | null = null;
    const database = mongoose.connection.db;

    if (database) {
      const cyclesCollection = database.collection('cycles');
      const paymentsCollection = database.collection('payments');
      const currentCycle = await cyclesCollection.findOne(
        { status: 'active' },
        { sort: { cycle_number: -1 } },
      ) ?? await cyclesCollection.findOne(
        { cycle_number: { $exists: true } },
        { sort: { cycle_number: -1 } },
      );

      if (currentCycle) {
        const cycleMemberIds = Array.isArray(currentCycle.member_ids)
          ? currentCycle.member_ids.map((id: unknown) => String(id))
          : null;
        const isCycleMember = !cycleMemberIds || cycleMemberIds.includes(memberObjectId);
        if (!isCycleMember) {
          cyclePayments = [];
        }
        if (!isCycleMember) {
          // The cycle exists globally, but this member was not selected by the administrator.
          cycle = null;
        } else {
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
    }

    const [tenXPeriod, tenXContributions] = await Promise.all([
      TenXPeriod.findOne({ period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, status: 'OPEN' }).lean(),
      TenXContribution.find({ member_id: member._id }).sort({ period: -1, created_at: -1 }).limit(24).lean(),
    ]);
    if (member.is10XMember) {
      const currentContribution = tenXPeriod
        ? tenXContributions.find((item) => String(item.period_id) === String(tenXPeriod._id))
        : null;
      tenX = {
        enrolled: true,
        period: tenXPeriod?.period ?? null,
        amountDue: tenXPeriod?.due_amount ?? 0,
        status: currentContribution?.status ?? 'PENDING',
        amountPaid: currentContribution?.amount_paid ?? 0,
        contributions: tenXContributions,
      };
    } else {
      tenX = { enrolled: false, period: null, amountDue: 0, status: 'NOT_ENROLLED', amountPaid: 0, contributions: [] };
    }

    return res.json({
      success: true,
      data: {
        member: {
          id: memberObjectId,
          memberId: memberCode,
          name: member.name,
          status: member.status,
          cycleContributionCount: Number(member.cycle_contribution_count || 0),
          totalCycleContribution: Number(member.total_cycle_contribution || 0),
        },
        wallet: {
          balance: walletBalance,
          principal: walletPrincipal,
          totalDeposits: walletPrincipal,
          totalInterestEarned: walletInterest,
          totalWithdrawals: completedWallet.filter((record) => record.transaction_type === 'withdrawal').reduce((total, record) => total + Number(record.amount || 0), 0),
          lockedAmount: lockedWallet,
          availableForWithdrawal: Math.max(0, walletBalance - lockedWallet),
          transactionCount: walletRecords.length,
          transactions: walletRecords,
        },
        cycles: {
          active: cycle,
          eligible: cycle !== null,
          payments: cyclePayments,
        },
        tenX,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;