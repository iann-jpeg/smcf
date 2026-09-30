import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import Saving from '../models/Saving';
import { AuthRequest, authorize, protect } from '../middleware/auth';

const router = Router();
const adminOnly = [protect, authorize('admin', 'treasurer')];
const currentPeriod = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

async function memberForRequest(req: AuthRequest) {
  return Member.findOne({ userId: req.userId });
}

async function summary(memberId: mongoose.Types.ObjectId | string) {
  const records = await Saving.find({ member_id: memberId, status: 'completed' }).sort({ created_at: -1 }).lean();
  const deposits = records.filter((r) => r.transaction_type === 'deposit');
  const interest = records.filter((r) => r.transaction_type === 'interest');
  const withdrawals = records.filter((r) => r.transaction_type === 'withdrawal');
  const now = new Date();
  const locked = deposits.filter((r) => r.unlock_date && new Date(r.unlock_date) > now && r.maturity_status !== 'withdrawn');
  const totalDeposits = deposits.reduce((n, r) => n + Number(r.amount || 0), 0);
  const totalInterest = interest.reduce((n, r) => n + Number(r.amount || 0), 0);
  const totalWithdrawals = withdrawals.reduce((n, r) => n + Number(r.amount || 0), 0);
  const balance = totalDeposits + totalInterest - totalWithdrawals;
  const lockedAmount = locked.reduce((n, r) => n + Number(r.amount || 0), 0);
  return {
    currentBalance: balance,
    principal: totalDeposits,
    totalDeposits,
    totalInterestEarned: totalInterest,
    totalWithdrawals,
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
    const record = await Saving.create({ member_id: member._id, amount, transaction_type: 'withdrawal', balance_before: wallet.currentBalance, balance_after: wallet.currentBalance - amount, payment_method: 'manual', status: 'pending', notes: 'Wallet withdrawal request', created_at: new Date() });
    return res.status(201).json({ success: true, data: record });
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
    record.status = 'completed'; record.processed_at = new Date(); record.notes = 'Wallet withdrawal completed by administrator'; await record.save();
    return res.json({ success: true, data: record });
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
