import { Router } from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
const adminOnly = [protect, authorize('admin', 'treasurer')];

router.get('/overview', ...adminOnly, async (_req: AuthRequest, res, next) => {
  try {
    const database = mongoose.connection.db;
    if (!database) return res.status(503).json({ success: false, message: 'Database unavailable' });

    const [members, currentCycle, cycles, payments, disbursements] = await Promise.all([
      Member.find({ status: { $ne: 'deleted' } }).sort({ position: 1, memberId: 1 }).lean(),
      database.collection('cycles').findOne({ status: 'active' }, { sort: { cycle_number: -1 } }),
      database.collection('cycles').find({}).sort({ cycle_number: -1 }).limit(24).toArray(),
      database.collection('payments').find({}).sort({ date: -1, created_at: -1 }).limit(250).toArray(),
      database.collection('disbursements').find({}).sort({ disbursement_date: -1, created_at: -1 }).limit(100).toArray(),
    ]);

    const cycleNumber = Number(currentCycle?.cycle_number || 0);
    const currentPayments = payments.filter((payment) => Number(payment.cycle_number) === cycleNumber);
    const completedPayments = currentPayments.filter((payment) => payment.status === 'completed');
    const paidIds = new Set(completedPayments.map((payment) => String(payment.member_id)));
    const advancePayments = members.map((member: any) => {
      const total = Number(member.total_cycle_contribution || 0);
      const contribution = Number(member.monthly_contribution || currentCycle?.contribution_amount || 200) || 200;
      const cyclesPaid = Math.floor(total / contribution);
      return {
        memberId: member.member_id || String(member._id),
        name: member.name,
        cyclesPaid,
        cyclesAhead: Math.max(0, cyclesPaid - cycleNumber),
      };
    }).filter((member) => member.cyclesAhead > 0);

    return res.json({
      success: true,
      data: {
        currentCycle,
        cycles,
        members,
        payments: currentPayments.slice(0, 100),
        recentPayments: payments.slice(0, 100),
        disbursements,
        paidMemberIds: [...paidIds],
        advancePayments,
        stats: {
          cycleNumber,
          paidMembers: paidIds.size,
          totalMembers: members.length,
          collected: completedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          target: members.length * Number(currentCycle?.contribution_amount || currentCycle?.expected_amount || 200),
          pendingMembers: Math.max(0, members.length - paidIds.size),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/payments/manual', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const { memberId, amount, phone, cycleNumber, noPayment } = req.body;
    const parsedAmount = Math.round(Number(amount));
    const parsedCycle = Number(cycleNumber);
    if (!memberId || !parsedAmount || parsedAmount <= 0 || !parsedCycle) {
      return res.status(400).json({ success: false, message: 'memberId, amount and cycleNumber are required' });
    }
    const member = await Member.findById(memberId).select('phone memberId name');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    const database = mongoose.connection.db;
    if (!database) return res.status(503).json({ success: false, message: 'Database unavailable' });

    const reference = `ADMIN-${Date.now()}-${String(member.memberId || memberId).slice(-8)}`;
    const payment = await database.collection('payments').insertOne({
      member_id: member._id,
      paid_by: member._id,
      amount: parsedAmount,
      phone: phone || member.phone || '',
      mpesa_transaction_id: reference,
      transaction_reference: reference,
      payment_method: 'admin_manual',
      status: 'completed',
      type: 'cycle_payment',
      cycle_number: parsedCycle,
      notes: noPayment ? 'Marked paid by administrator without payment' : 'Manual cycle payment recorded by administrator',
      date: new Date(),
      created_at: new Date(),
      deposit_processed: true,
    });
    return res.status(201).json({ success: true, data: { id: payment.insertedId, reference, member: member.name } });
  } catch (error) {
    return next(error);
  }
});

router.put('/cycles/:id', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const amount = Math.round(Number(req.body?.contributionAmount));
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'A valid contribution amount is required' });
    const database = mongoose.connection.db;
    if (!database) return res.status(503).json({ success: false, message: 'Database unavailable' });
    const cycleId: any = mongoose.Types.ObjectId.isValid(req.params.id) ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;
    const result = await database.collection('cycles').findOneAndUpdate(
      { _id: cycleId },
      { $set: { contribution_amount: amount, monthly_contribution: amount, expected_amount: amount * Number(req.body?.memberCount || 0), updated_at: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) return res.status(404).json({ success: false, message: 'Cycle not found' });
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/cycles/start', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const database = mongoose.connection.db;
    if (!database) return res.status(503).json({ success: false, message: 'Database unavailable' });
    const cycles = database.collection('cycles');
    const members = database.collection('members');
    const currentCycle = await cycles.findOne({ status: 'active' }, { sort: { cycle_number: -1 } });
    const lastCycle = await cycles.findOne({}, { sort: { cycle_number: -1 } });
    const cycleNumber = Number(lastCycle?.cycle_number || currentCycle?.cycle_number || 0) + 1;
    const activeMembers = await members.find({ status: 'active' }).sort({ position: 1, memberId: 1 }).toArray();
    if (activeMembers.length === 0) return res.status(400).json({ success: false, message: 'Add at least one active member before setting up a cycle' });

    const startDate = req.body?.startDate ? new Date(req.body.startDate) : new Date();
    const endDate = req.body?.endDate ? new Date(req.body.endDate) : new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      return res.status(400).json({ success: false, message: 'Cycle dates are invalid' });
    }
    const contributionAmount = Math.round(Number(req.body?.contributionAmount || currentCycle?.contribution_amount || 224));
    const requestedRecipient = req.body?.recipientId && mongoose.Types.ObjectId.isValid(req.body.recipientId)
      ? new mongoose.Types.ObjectId(req.body.recipientId)
      : null;
    const recipient = requestedRecipient
      ? activeMembers.find((member) => String(member._id) === String(requestedRecipient))
      : activeMembers[0];
    if (currentCycle) {
      await cycles.updateOne({ _id: currentCycle._id }, { $set: { status: 'completed', next_recipient: null, recipient_paid: true, updated_at: new Date() } });
    }
    const cycle = {
      cycle_number: cycleNumber,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      contribution_amount: contributionAmount,
      expected_amount: activeMembers.length * contributionAmount,
      total_members: activeMembers.length,
      paid_members_count: 0,
      total_amount_collected: 0,
      next_recipient: recipient?._id || null,
      recipient_paid: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = await cycles.insertOne(cycle);
    await members.updateMany({ status: 'active' }, { $set: { payment_status: 'pending', payment_date: null } });
    return res.status(201).json({ success: true, data: { ...cycle, _id: result.insertedId } });
  } catch (error) {
    return next(error);
  }
});

router.put('/members/:id', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const allowed = ['name', 'phone', 'monthly_contribution', 'position', 'payment_status'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    const member = await Member.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    return res.json({ success: true, data: member });
  } catch (error) {
    return next(error);
  }
});

export default router;