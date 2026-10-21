import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import { protect, AuthRequest } from '../middleware/auth';
import { settlePendingDeposit, settleRegistrationFeePayment, settleSharePurchasePayment } from './mpesa';
import { createTransactionRef } from '../utils/transactionRef';

const router = Router();
type QrPurpose = 'savings' | 'wallet' | 'cycle' | 'share_purchase' | 'registration_fee';

function apiBase() {
  return String(process.env.DARAJA_API_URL || 'https://api.safaricom.co.ke').replace(/\/+$/, '');
}

function qrEnabled() {
  return String(process.env.DARAJA_QR_ENABLED || '').toLowerCase() === 'true'
    && Boolean(process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET);
}

async function token() {
  const credentials = Buffer.from(
    `${String(process.env.DARAJA_CONSUMER_KEY || '').trim()}:${String(process.env.DARAJA_CONSUMER_SECRET || '').trim()}`,
  ).toString('base64');
  const response = await fetch(`${apiBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof body.access_token !== 'string') {
    throw new Error(String(body.error_description || body.error || 'Daraja QR authentication failed'));
  }
  return body.access_token;
}

function referenceFor(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

async function settleQrTransaction(transaction: any, receipt: string, amount: number) {
  if (transaction.status === 'completed') return;
  if (!Number.isFinite(amount) || amount !== Number(transaction.amount)) {
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'failed',
      providerStatus: 'failed',
      financialPostingStatus: 'failed',
      reconciliationStatus: 'requires_reconciliation',
    });
    throw new Error('M-Pesa QR amount does not match the pending transaction');
  }

  const member = await Member.findById(transaction.memberId).select('phone');
  const paymentReference = `MPESA-QR-${receipt}`;
  if (transaction.paymentPurpose === 'share_purchase') {
    await settleSharePurchasePayment({
      checkoutRequestId: String(transaction.checkoutRequestId),
      memberId: String(transaction.memberId),
      amount,
      mpesaRef: paymentReference,
      source: 'callback',
    });
  } else if (transaction.paymentPurpose === 'registration_fee') {
    await settleRegistrationFeePayment({
      checkoutRequestId: String(transaction.checkoutRequestId),
      memberId: String(transaction.memberId),
      amount,
      phone: String(member?.phone || ''),
      mpesaRef: paymentReference,
      source: 'callback',
    });
  } else {
    await settlePendingDeposit({
      checkoutRequestId: String(transaction.checkoutRequestId),
      memberId: String(transaction.memberId),
      amount,
      phone: String(member?.phone || ''),
      mpesaRef: paymentReference,
      sourceLabel: 'M-Pesa QR payment',
      cycleNumber: transaction.cycleNumber,
      walletPayment: transaction.paymentPurpose === 'wallet',
      paymentGateway: 'daraja-qr',
    });
  }
}

router.post('/generate', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!qrEnabled()) {
      return res.status(503).json({ success: false, message: 'M-Pesa QR backup is not enabled' });
    }
    const { memberId, amount, purpose = 'savings', cycleNumber } = req.body as {
      memberId?: string;
      amount?: number;
      purpose?: QrPurpose;
      cycleNumber?: number;
    };
    if (!memberId || !mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: 'Valid memberId is required' });
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be positive' });
    }
    const allowed: QrPurpose[] = ['savings', 'wallet', 'cycle', 'share_purchase', 'registration_fee'];
    if (!allowed.includes(purpose)) return res.status(400).json({ success: false, message: 'Unsupported QR payment purpose' });

    const ownMember = await Member.findOne({ userId: req.userId }).select('_id');
    const isStaff = (req.user?.roles || []).some((role) => ['admin', 'treasurer', 'credit_officer'].includes(role));
    if (!isStaff && (!ownMember || String(ownMember._id) !== String(memberId))) {
      return res.status(403).json({ success: false, message: 'You may only initiate payments for your own account' });
    }
    const member = await Member.findById(memberId).select('name');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    const transactionRef = createTransactionRef();
    const checkoutRequestId = `QR-${crypto.randomUUID()}`;
    const billReference = `SMCF-${transactionRef}`;
    const transaction = await Transaction.create({
      transactionRef,
      memberId,
      type: purpose === 'share_purchase' ? 'share_purchase' : purpose === 'registration_fee' ? 'registration_fee' : purpose === 'wallet' ? 'wallet_deposit' : 'deposit',
      amount: Math.round(Number(amount)),
      grossAmount: Math.round(Number(amount)),
      netAmount: Math.round(Number(amount)),
      feeAmount: 0,
      description: `${purpose} payment via M-Pesa QR`,
      status: 'pending',
      providerStatus: 'pending',
      financialPostingStatus: 'pending',
      checkoutRequestId,
      providerMerchantReference: billReference,
      paymentPurpose: purpose,
      paymentGateway: 'daraja-qr',
      cycleNumber: purpose === 'cycle' ? Number(cycleNumber) || undefined : undefined,
    });

    const qrResponse = await fetch(`${apiBase()}/mpesa/qrcode/v1/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        MerchantName: String(member.name || 'SMCF SACCO').slice(0, 20),
        RefNo: billReference,
        Amount: Math.round(Number(amount)),
        TrxCode: String(process.env.DARAJA_QR_TRANSACTION_CODE || 'BG'),
        CPI: String(process.env.DARAJA_SHORTCODE || ''),
        Size: 300,
      }),
    });
    const qr = await qrResponse.json().catch(() => ({})) as Record<string, unknown>;
    const image = String(qr.QRCode || qr.qrCode || '');
    if (!qrResponse.ok || !image) {
      await Transaction.findByIdAndUpdate(transaction._id, { status: 'failed', providerStatus: 'failed', financialPostingStatus: 'failed' });
      throw new Error(String(qr.ResponseDescription || qr.message || 'Daraja QR generation failed'));
    }
    return res.json({
      success: true,
      data: { checkoutRequestId, reference: billReference, qrCode: image, expiresInSeconds: 300 },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:checkoutRequestId/status', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findOne({ checkoutRequestId: req.params.checkoutRequestId }).select('memberId status providerStatus financialPostingStatus mpesaRef amount');
    if (!transaction) return res.status(404).json({ success: false, message: 'QR payment not found' });
    const ownMember = await Member.findOne({ userId: req.userId }).select('_id');
    const isStaff = (req.user?.roles || []).some((role) => ['admin', 'treasurer', 'credit_officer'].includes(role));
    if (!isStaff && (!ownMember || String(ownMember._id) !== String(transaction.memberId))) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this payment' });
    }
    return res.json({ success: true, data: {
      status: transaction.status === 'completed' && transaction.financialPostingStatus === 'completed' ? 'success' : transaction.status,
      mpesaRef: transaction.mpesaRef,
      amount: transaction.amount,
      providerStatus: transaction.providerStatus,
      financialPostingStatus: transaction.financialPostingStatus,
    } });
  } catch (error) {
    next(error);
  }
});

router.post('/callback', async (req: Request, res: Response) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  try {
    const payload = req.body as Record<string, unknown>;
    const result = (payload.Result || payload.result) as Record<string, unknown> | undefined;
    const parameters = ((result?.ResultParameters || payload.ResultParameters) as Record<string, unknown> | undefined)?.ResultParameter;
    const list = Array.isArray(parameters) ? parameters as Array<Record<string, unknown>> : [];
    const values = new Map(list.map((item) => [String(item.Key || '').toLowerCase(), item.Value]));
    const reference = referenceFor(values.get('billrefnumber') || values.get('accountreference') || values.get('invoicenumber') || payload.BillRefNumber || payload.AccountReference);
    const receipt = String(values.get('transid') || payload.TransID || result?.TransactionID || '');
    const amount = Number(values.get('transamount') || payload.TransAmount || values.get('amount'));
    if (!reference || !receipt || !Number.isFinite(amount)) return;
    const transaction = await Transaction.findOne({ providerMerchantReference: reference });
    if (!transaction) return;
    await settleQrTransaction(transaction, receipt, amount);
  } catch (error) {
    console.error('[M-Pesa QR callback] settlement failed', error);
  }
});

export default router;
