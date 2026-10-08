import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Saving from '../models/Saving';
import Transaction from '../models/Transaction';
import { AuthRequest, authorize, protect } from '../middleware/auth';

const router = Router();
const adminOnly = [protect, authorize('admin', 'treasurer')];
const currentPeriod = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

function calculateWithdrawalFee(amount: number) {
  if (amount <= 100) return 15;
  if (amount <= 500) return 18;
  if (amount <= 1000) return 30;
  if (amount <= 2500) return 38;
  if (amount <= 5000) return 95;
  if (amount <= 10000) return 145;
  if (amount <= 20000) return 235;
  if (amount <= 50000) return 350;
  return 385;
}

async function memberForRequest(req: AuthRequest) {
  return Member.findOne({ userId: req.userId });
}

async function summary(memberId: mongoose.Types.ObjectId | string) {
  const records = await Saving.find({ member_id: memberId, status: 'completed' }).sort({ created_at: -1 }).lean();
  const deposits = records.filter((r) => r.transaction_type === 'deposit');
  const interest = records.filter((r) => r.transaction_type === 'interest');
  const withdrawals = records.filter((r) => r.transaction_type === 'withdrawal');
  const adjustments = records.filter((r) => r.transaction_type === 'adjustment');
  const now = new Date();
  const locked = deposits.filter((r) => r.unlock_date && new Date(r.unlock_date) > now && r.maturity_status !== 'withdrawn');
  const totalDeposits = deposits.reduce((n, r) => n + Number(r.amount || 0), 0);
  const totalInterest = interest.reduce((n, r) => n + Number(r.amount || 0), 0);
  const totalWithdrawals = withdrawals.reduce((n, r) => n + Number(r.amount || 0), 0);
  const totalWithdrawalFees = withdrawals.reduce((n, r) => n + Number(r.fee_amount || 0), 0);
  const balance = totalDeposits + totalInterest - totalWithdrawals
    + adjustments.filter((r) => r.adjustment_direction === 'credit').reduce((n, r) => n + Number(r.amount || 0), 0)
    - adjustments.filter((r) => r.adjustment_direction === 'debit').reduce((n, r) => n + Number(r.amount || 0), 0);
  const lockedAmount = locked.reduce((n, r) => n + Number(r.amount || 0), 0);
  return {
    currentBalance: balance,
    principal: totalDeposits,
    totalDeposits,
    totalInterestEarned: totalInterest,
    totalWithdrawals,
    totalWithdrawalFees,
    lockedAmount,
    availableForWithdrawal: Math.max(0, balance - lockedAmount),
    nextMaturityDate: locked.length ? locked.map((r) => new Date(r.unlock_date as Date)).sort((a, b) => a.getTime() - b.getTime())[0] : null,
    transactionCount: records.length,
  };
}

router.get('/summary', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await memberForRequest(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    return res.json({ success: true, data: await summary(member._id) });
  } catch (error) { return next(error); }
});

router.get('/transactions', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await memberForRequest(req);
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    return res.json({ success: true, data: await Saving.find({ member_id: member._id }).sort({ created_at: -1 }).limit(limit).lean() });
  } catch (error) { return next(error); }
});

router.post('/withdrawal', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await memberForRequest(req);
    const amount = Math.round(Number(req.body?.amount));
    if (!member) return res.status(404).json({ success: false, message: 'Member profile not found' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'A valid withdrawal amount is required' });
    const wallet = await summary(member._id);
    if (amount > wallet.availableForWithdrawal) return res.status(400).json({ success: false, message: 'Requested amount is not available or has not matured' });
    const pending = await Saving.exists({ member_id: member._id, transaction_type: 'withdrawal', status: 'pending' });
    if (pending) return res.status(409).json({ success: false, message: 'A withdrawal request is already pending' });
    const feeAmount = calculateWithdrawalFee(amount);
    const accountName = String(req.body?.account_name || '').trim();
    const accountNumber = String(req.body?.account_number || '').trim();
    const bankName = String(req.body?.bank_name || '').trim();
    if (!accountName || !accountNumber || !bankName) return res.status(400).json({ success: false, message: 'Payment account details are required' });
    const record = await Saving.create({ member_id: member._id, amount, fee_amount: feeAmount, net_amount: amount - feeAmount, account_name: accountName, account_number: accountNumber, bank_name: bankName, transaction_type: 'withdrawal', balance_before: wallet.currentBalance, balance_after: wallet.currentBalance - amount, payment_method: 'manual', status: 'pending', notes: `Wallet withdrawal request | Fee: KES ${feeAmount}`, created_at: new Date() });
    return res.status(201).json({ success: true, data: record, fee: feeAmount, netAmount: amount - feeAmount });
  } catch (error) { return next(error); }
});

router.get('/admin/all', ...adminOnly, async (_req, res, next) => {
  try {
    const members = await Member.find({ status: { $ne: 'deleted' } }).select('name memberId phone email status').lean();
    const data = await Promise.all(members.map(async (member) => ({ _id: member._id, name: member.name, memberId: member.memberId, member_id: member.memberId, phone: member.phone, email: member.email, status: member.status, ...(await summary(member._id)) })));
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
});

router.get('/admin/pending-withdrawals', ...adminOnly, async (_req, res, next) => {
  try { return res.json({ success: true, data: await Saving.find({ transaction_type: 'withdrawal', status: 'pending' }).populate('member_id', 'name memberId phone').sort({ created_at: -1 }).lean() }); }
  catch (error) { return next(error); }
});

router.post('/admin/:memberId/adjustment', protect, authorize('admin'), async (req: AuthRequest, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.memberId)) {
      return res.status(400).json({ success: false, message: 'Invalid member ID for wallet adjustment' });
    }
    const member = await Member.findOne({ _id: req.params.memberId, status: { $ne: 'deleted' } }).select('_id name memberId');
    const amount = Math.round(Number(req.body?.amount));
    const direction = req.body?.direction === 'debit' ? 'debit' : req.body?.direction === 'credit' ? 'credit' : null;
    const note = String(req.body?.note || '').trim();
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'A positive adjustment amount is required' });
    if (!direction) return res.status(400).json({ success: false, message: 'Adjustment direction must be credit or debit' });
    if (!note) return res.status(400).json({ success: false, message: 'A reason is required for wallet adjustments' });

    const wallet = await summary(member._id);
    if (direction === 'debit' && amount > wallet.currentBalance) {
      return res.status(400).json({ success: false, message: 'Debit cannot exceed the current wallet balance' });
    }
    const balanceAfter = direction === 'credit' ? wallet.currentBalance + amount : wallet.currentBalance - amount;
    const record = await Saving.create({
      member_id: member._id,
      amount,
      transaction_type: 'adjustment',
      adjustment_direction: direction,
      balance_before: wallet.currentBalance,
      balance_after: balanceAfter,
      payment_method: 'admin_adjustment',
      status: 'completed',
      notes: `ADMIN_ADJUSTMENT | ${direction.toUpperCase()} | ${note}`,
      processed_at: new Date(),
    });
    return res.status(201).json({ success: true, data: record });
  } catch (error) { return next(error); }
});

router.post('/admin/:action-withdrawal/:id', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const action = req.params.action;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid withdrawal action' });
    const record = await Saving.findOne({ _id: req.params.id, transaction_type: 'withdrawal', status: 'pending' });
    if (!record) return res.status(404).json({ success: false, message: 'Pending withdrawal not found' });
    if (action === 'reject') {
      record.status = 'failed'; record.rejection_reason = req.body?.rejection_reason || 'Rejected by administrator'; record.processed_at = new Date(); await record.save();
      return res.json({ success: true, data: record });
    }
    const memberWallet = await summary(record.member_id);
    if (record.amount > memberWallet.availableForWithdrawal) {
      return res.status(409).json({ success: false, message: 'Withdrawal can no longer be approved because the available wallet balance changed' });
    }
    const feeAmount = Number(record.fee_amount || calculateWithdrawalFee(record.amount));
    const netAmount = Math.max(0, Number(record.amount) - feeAmount);
    const processedAt = new Date();
    const updated = await Saving.findOneAndUpdate(
      { _id: record._id, transaction_type: 'withdrawal', status: 'pending' },
      { $set: { status: 'completed', fee_amount: feeAmount, net_amount: netAmount, balance_before: memberWallet.currentBalance, balance_after: memberWallet.currentBalance - Number(record.amount), processed_at: processedAt, notes: `Wallet withdrawal approved by administrator | Fee: KES ${feeAmount} | Net payout: KES ${netAmount}` } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ success: false, message: 'Withdrawal was already processed' });
    try {
      await Transaction.create({
        transactionRef: `WALLET-WD-${String(record._id)}`,
        memberId: record.member_id,
        type: 'withdrawal',
        amount: record.amount,
        grossAmount: record.amount,
        feeAmount,
        netAmount,
        feeType: 'unified_transaction_fee',
        description: `Wallet withdrawal approved; KES ${feeAmount} transaction fee deducted`,
        status: 'completed',
        financialPostingStatus: 'completed',
        processedAt,
        createdBy: req.user?._id || null,
        paymentGateway: 'manual',
      });
    } catch (error) {
      await Saving.findByIdAndUpdate(record._id, { status: 'failed', rejection_reason: 'Transaction ledger posting failed', processed_at: new Date() });
      throw error;
    }
    return res.json({ success: true, data: updated, fee: feeAmount, netAmount });
  } catch (error) { return next(error); }
});

router.post('/admin/apply-interest', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const period = currentPeriod();
    const members = await Member.find({ status: { $ne: 'deleted' } }).select('_id');
    let appliedCount = 0; let totalAmount = 0;
    for (const member of members) {
      const alreadyPosted = await Saving.exists({ member_id: member._id, transaction_type: 'interest', status: 'completed', notes: { $regex: `Period: ${period}` } });
      if (alreadyPosted) continue;
      const wallet = await summary(member._id);
      if (wallet.currentBalance <= 0) continue;
      const amount = Math.round(wallet.currentBalance * 0.03);
      if (amount <= 0) continue;
      await Saving.create({ member_id: member._id, amount, transaction_type: 'interest', interest_rate: 3, interest_amount: amount, balance_before: wallet.currentBalance, balance_after: wallet.currentBalance + amount, payment_method: 'auto_interest', status: 'completed', transaction_ref: `WALLET-INT-${period}-${String(member._id).slice(-6)}`, notes: `MONTHLY_INTEREST | Period: ${period} | Opening principal: ${wallet.currentBalance} | Rate: 3%` });
      appliedCount++; totalAmount += amount;
    }
    return res.json({ success: true, appliedCount, totalAmount, period });
  } catch (error) { return next(error); }
});

export default router;
