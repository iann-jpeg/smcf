import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import CardSubscription from '../models/CardSubscription';
import { protect, AuthRequest } from '../middleware/auth';
import { settlePendingDeposit, settleRegistrationFeePayment, settleSharePurchasePayment } from './mpesa';
import { createTransactionRef } from '../utils/transactionRef';

const router = Router();
const SIMULATION_DELAY_MS = 2000;
type Purpose = 'savings' | 'wallet' | 'cycle' | 'share_purchase' | 'registration_fee';

function configured() {
  return Boolean(process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET);
}

function baseUrl() {
  return String(process.env.PESAPAL_BASE_URL || 'https://cybqa.pesapal.com/pesapalapi').replace(/\/+$/, '');
}

function callbackUrl() {
  return process.env.PESAPAL_CALLBACK_URL || 'http://localhost:5001/api/pesapal/callback';
}

function notificationId() {
  return process.env.PESAPAL_IPN_ID || '';
}

function purposeType(purpose: Purpose) {
  if (purpose === 'wallet') return 'wallet_deposit';
  if (purpose === 'share_purchase') return 'share_purchase';
  if (purpose === 'registration_fee') return 'registration_fee';
  return 'deposit';
}

async function pesapalToken(): Promise<string> {
  const response = await fetch(`${baseUrl()}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  const token = data.token;
  if (!response.ok || typeof token !== 'string' || !token) {
    throw new Error(String(data.message || 'Pesapal authentication failed'));
  }
  return token;
}

async function fetchPesapalStatus(orderTrackingId: string) {
  const token = await pesapalToken();
  const response = await fetch(
    `${baseUrl()}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.message || 'Pesapal status lookup failed'));
  return data;
}

async function settleOrder(transaction: any, providerStatus: Record<string, unknown>) {
  const status = String(providerStatus.payment_status_description || providerStatus.status || providerStatus.payment_status_code || '').toLowerCase();
  const successful = ['completed', 'complete', 'paid', 'success', 'successful', '1'].includes(status);
  const failed = ['failed', 'invalid', 'reversed', 'cancelled', 'cancel'].includes(status);
  if (!successful && !failed) return 'pending';
  if (failed) {
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'failed',
      providerStatus: 'failed',
      financialPostingStatus: 'failed',
      processedAt: new Date(),
    });
    return 'failed';
  }

  const providerAmount = Number(providerStatus.amount);
  if (Number.isFinite(providerAmount) && providerAmount !== Number(transaction.amount)) {
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'failed',
      providerStatus: 'failed',
      financialPostingStatus: 'failed',
      reconciliationStatus: 'requires_reconciliation',
    });
    throw new Error('Pesapal amount does not match the SMCF transaction');
  }

  const reference = String(providerStatus.confirmation_code || providerStatus.transaction_reference || transaction.providerOrderTrackingId);
  const paymentReference = `PESAPAL-${reference}`;
  const member = await Member.findById(transaction.memberId).select('phone');
  const result = transaction.paymentPurpose === 'share_purchase'
    ? await settleSharePurchasePayment({
        checkoutRequestId: String(transaction.checkoutRequestId),
        memberId: String(transaction.memberId),
        amount: Number(transaction.amount),
        mpesaRef: paymentReference,
        source: 'pesapal',
      })
    : transaction.paymentPurpose === 'registration_fee'
      ? await settleRegistrationFeePayment({
          checkoutRequestId: String(transaction.checkoutRequestId),
          memberId: String(transaction.memberId),
          amount: Number(transaction.amount),
          phone: String(member?.phone || ''),
          mpesaRef: paymentReference,
          source: 'pesapal',
        })
      : await settlePendingDeposit({
          checkoutRequestId: String(transaction.checkoutRequestId),
          memberId: String(transaction.memberId),
          amount: Number(transaction.amount),
          mpesaRef: paymentReference,
          sourceLabel: 'Pesapal card payment',
          cycleNumber: transaction.cycleNumber,
          processedAt: new Date(),
          walletPayment: transaction.paymentPurpose === 'wallet',
          paymentGateway: 'pesapal',
        });
  await Transaction.findByIdAndUpdate(transaction._id, {
    providerStatus: 'success',
    financialPostingStatus: 'completed',
    reconciliationStatus: 'reconciled',
    status: 'completed',
    mpesaRef: paymentReference,
    depositProcessed: true,
  });
  if (transaction.subscriptionId) {
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    await CardSubscription.findByIdAndUpdate(transaction.subscriptionId, {
      status: 'active',
      nextPaymentDate,
    });
  }
  return result.duplicate ? 'completed' : 'success';
}

router.post('/orders', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, purpose = 'savings', cycleNumber, subscription = false, consentAccepted = false } = req.body;
    if (!memberId || !mongoose.isValidObjectId(memberId)) return res.status(400).json({ success: false, message: 'Valid memberId is required' });
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });
    if (!['savings', 'wallet', 'cycle', 'share_purchase', 'registration_fee'].includes(purpose)) return res.status(400).json({ success: false, message: 'Unsupported Pesapal payment purpose' });
    if (purpose === 'share_purchase' && Number(amount) < 100) return res.status(400).json({ success: false, message: 'Minimum share purchase is KES 100' });
    if (purpose === 'registration_fee' && Number(amount) !== 110) return res.status(400).json({ success: false, message: 'Registration payment must be exactly KES 110' });
    if (subscription && !consentAccepted) return res.status(400).json({ success: false, message: 'Recurring card payment consent is required' });
    const member = await Member.findById(memberId).select('name email phone registrationFeePaid');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (purpose === 'registration_fee' && member.registrationFeePaid) return res.status(409).json({ success: false, message: 'Registration fee already paid' });

    const amountNumber = Math.round(Number(amount));
    const transactionRef = createTransactionRef();
    const checkoutRequestId = `PESAPAL-${crypto.randomUUID()}`;
    const merchantReference = `SMCF-${transactionRef}`;
    let subscriptionId: mongoose.Types.ObjectId | undefined;
    if (subscription) {
      const cardSubscription = await CardSubscription.create({
        memberId,
        amount: amountNumber,
        purpose: ['savings', 'wallet', 'cycle'].includes(purpose) ? purpose : 'savings',
        status: 'pending',
        providerCustomerReference: merchantReference,
        consentAcceptedAt: new Date(),
      });
      subscriptionId = cardSubscription._id;
    }
    const transaction = await Transaction.create({
      transactionRef,
      memberId,
      type: purposeType(purpose),
      amount: amountNumber,
      grossAmount: amountNumber,
      netAmount: amountNumber,
      feeAmount: 0,
      description: `${purpose} payment via Pesapal card`,
      status: 'pending',
      providerStatus: 'pending',
      financialPostingStatus: 'pending',
      checkoutRequestId,
      providerMerchantReference: merchantReference,
      paymentPurpose: purpose,
      subscriptionId,
      paymentGateway: 'pesapal',
      cycleNumber: purpose === 'cycle' ? Number(cycleNumber) || undefined : undefined,
    });

    if (!configured()) {
      return res.json({
        success: true,
        data: {
          orderTrackingId: checkoutRequestId,
          merchantReference,
          redirectUrl: null,
          simulation: true,
          subscriptionRequested: Boolean(subscription),
        },
      });
    }

    const token = await pesapalToken();
    const response = await fetch(`${baseUrl()}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: merchantReference,
        currency: 'KES',
        amount: amountNumber,
        description: `SMCF ${purpose} payment`,
        callback_url: callbackUrl(),
        notification_id: notificationId(),
        account_number: String(memberId),
        billing_address: {
          email_address: member.email || undefined,
          phone_number: member.phone || undefined,
          first_name: member.name?.split(' ')[0] || 'SMCF',
          last_name: member.name?.split(' ').slice(1).join(' ') || 'Member',
        },
      }),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const orderTrackingId = String(data.order_tracking_id || '');
    if (!response.ok || !orderTrackingId) throw new Error(String(data.message || 'Pesapal order creation failed'));
    await Transaction.findByIdAndUpdate(transaction._id, { providerOrderTrackingId: orderTrackingId });
    res.json({ success: true, data: { orderTrackingId, merchantReference, redirectUrl: data.redirect_url, simulation: false } });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:orderTrackingId/status', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOne({
      $or: [{ providerOrderTrackingId: req.params.orderTrackingId }, { checkoutRequestId: req.params.orderTrackingId }],
    });
    if (!transaction) return res.status(404).json({ success: false, message: 'Pesapal order not found' });
    const member = await Member.findOne({ userId: req.userId }).select('_id');
    const isStaff = (req.user?.roles || []).some((role) => ['admin', 'treasurer', 'credit_officer'].includes(role));
    if (!member || (String(transaction.memberId) !== String(member._id) && !isStaff)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this payment' });
    }
    let providerStatus: Record<string, unknown>;
    if (!configured()) {
      providerStatus = Date.now() - new Date(transaction.createdAt).getTime() >= SIMULATION_DELAY_MS
        ? { status: 'completed', amount: transaction.amount, confirmation_code: `SIM-${transaction.transactionRef}` }
        : { status: 'pending' };
    } else {
      providerStatus = await fetchPesapalStatus(String(transaction.providerOrderTrackingId || req.params.orderTrackingId));
    }
    const status = await settleOrder(transaction, providerStatus);
    const latest = await Transaction.findById(transaction._id).select('status providerStatus financialPostingStatus mpesaRef');
    res.json({ success: true, data: { status, providerStatus: latest?.providerStatus, financialPostingStatus: latest?.financialPostingStatus, paymentReference: latest?.mpesaRef } });
  } catch (error) {
    next(error);
  }
});

async function processProviderNotification(orderTrackingId: string, merchantReference?: string) {
  const transaction = await Transaction.findOne({
    $or: [{ providerOrderTrackingId: orderTrackingId }, { providerMerchantReference: merchantReference }],
  });
  if (!transaction) return false;
  const status = configured() ? await fetchPesapalStatus(orderTrackingId) : { status: 'pending' };
  await settleOrder(transaction, status);
  return true;
}

router.get('/callback', async (req: Request, res: Response) => {
  const orderTrackingId = String(req.query.OrderTrackingId || req.query.orderTrackingId || '');
  const merchantReference = String(req.query.OrderMerchantReference || req.query.orderMerchantReference || '');
  if (orderTrackingId) await processProviderNotification(orderTrackingId, merchantReference);
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/sacco/my-account?pesapal=${encodeURIComponent(orderTrackingId)}`);
});

router.post('/ipn', async (req: Request, res: Response) => {
  const orderTrackingId = String(req.body.OrderTrackingId || req.body.orderTrackingId || '');
  const merchantReference = String(req.body.OrderMerchantReference || req.body.orderMerchantReference || '');
  if (!orderTrackingId) return res.status(400).json({ success: false, message: 'OrderTrackingId is required' });
  await processProviderNotification(orderTrackingId, merchantReference);
  res.json({ success: true });
});

router.post('/subscriptions/:id/cancel', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await Member.findOne({ userId: req.userId }).select('_id');
    if (!member) return res.status(404).json({ success: false, message: 'Member account not found' });
    const subscription = await CardSubscription.findOneAndUpdate(
      { _id: req.params.id, memberId: member._id, status: { $in: ['pending', 'active'] } },
      { status: 'cancelled' },
      { new: true },
    );
    if (!subscription) return res.status(404).json({ success: false, message: 'Active card subscription not found' });
    res.json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
});

router.get('/subscriptions', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const member = await Member.findOne({ userId: req.userId }).select('_id');
    if (!member) return res.json({ success: true, data: [] });
    const subscriptions = await CardSubscription.find({ memberId: member._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: subscriptions });
  } catch (error) {
    next(error);
  }
});

export default router;
