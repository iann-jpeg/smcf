/**
 * M-Pesa STK Push via Lipia Online (kreativelabske.com)
 * Payments are directed to SMCF SACCO till number 6938069.
 *
 * Environment variables needed (add to .env):
 *   LIPIA_API_KEY    – Lipia Online API key
 *   LIPIA_API_URL    – Lipia API base URL  (e.g. https://lipia-api.kreativelabske.com/api/v2)
 *   LIPIA_APP_ID     – Lipia application ID
 *   LIPIA_APP_NAME   – Lipia application name  (e.g. smcf)
 *   MPESA_CALLBACK_URL – Public URL Lipia will POST the payment result to
 *
 * If LIPIA_API_KEY is not set the route runs in simulation mode:
 * the STK push is faked and auto-succeeds after ~5 seconds so you can demo the
 * full UI flow without real credentials.
 */

import { Router, Request, Response, NextFunction } from 'express';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import Loan from '../models/Loan';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { processRepayment } from './repayments';
import { notifyStaff } from '../utils/notify';
import { recalculateMemberRiskScore } from '../utils/riskScore';
import { recordSavingsDeposit } from '../utils/depositLedger';
import { createTransactionRef } from '../utils/transactionRef';

const router = Router();

// ─── In-memory: Lipia payment-link payments (not STK) ───────────────────────
// Created when member clicks "Pay via Lipia"; confirmed when member clicks "I've Paid"

interface PendingLipiaPayment {
  type: 'deposit' | 'loan_repay';
  memberId: string;
  loanId?: string;
  amount: number;
  phone: string; // 254xx format
  txnRef: string; // DB transaction ref
  createdAt: number;
}

const pendingLipiaPayments = new Map<string, PendingLipiaPayment>(); // key: txnRef

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min TTL
  for (const [k, v] of pendingLipiaPayments.entries()) {
    if (v.createdAt < cutoff) pendingLipiaPayments.delete(k);
  }
}, 10 * 60 * 1000);

// ─── In-memory pending deposits ────────────────────────────────────────────
// Key: CheckoutRequestID (or simulated ID)
// In production with multiple instances use Redis / DB record instead.

interface PendingDeposit {
  memberId: string;
  amount: number;
  phone: string;
  status: 'pending' | 'success' | 'failed';
  mpesaRef?: string;
  resultDesc?: string;
  createdAt: number;
}

const pendingDeposits = new Map<string, PendingDeposit>();

interface PendingSharePurchase {
  memberId: string;
  amount: number;
  phone: string;
  status: 'pending' | 'success' | 'failed';
  mpesaRef?: string;
  resultDesc?: string;
  createdAt: number;
}

const pendingSharePurchases = new Map<string, PendingSharePurchase>();

interface PendingRegistrationFee {
  memberId: string;
  amount: number;
  phone: string;
  status: 'pending' | 'success' | 'failed';
  mpesaRef?: string;
  resultDesc?: string;
  createdAt: number;
}

const pendingRegistrationFees = new Map<string, PendingRegistrationFee>();

type LooseRecord = Record<string, unknown>;

type LipiaStkResponse = LooseRecord & {
  CheckoutRequestID: string;
  checkoutRequestId: string;
  message?: unknown;
  error?: unknown;
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function getPathValue(input: unknown, path: string[]): unknown {
  let current: unknown = input;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function toErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (typeof err === 'string' && err.trim()) return err;
  const message = asRecord(err)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

function normalizeLipiaBaseUrl(rawUrl?: string): string {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!value) return 'https://lipia-api.kreativelabske.com/api/v2';

  // Guard against env values that accidentally include endpoint paths.
  return value
    .replace(/\/(payments\/stk-push|request\/stk)(\/.*)?$/i, '')
    .replace(/\/+$/, '');
}

// Purge stale entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingDeposits.entries()) {
    if (v.createdAt < cutoff) pendingDeposits.delete(k);
  }
  for (const [k, v] of pendingSharePurchases.entries()) {
    if (v.createdAt < cutoff) pendingSharePurchases.delete(k);
  }
  for (const [k, v] of pendingRegistrationFees.entries()) {
    if (v.createdAt < cutoff) pendingRegistrationFees.delete(k);
  }
}, 10 * 60 * 1000);

/** Query Lipia Online for the current status of an STK push by its CheckoutRequestID / reference */
async function queryLipiaStatus(checkoutRequestId: string): Promise<{
  success: boolean;
  status: string;      // 'pending' | 'success' | 'failed'
  mpesaReceiptNumber?: string;
  resultCode?: string | number;
  resultDesc?: string;
  amount?: number;
}> {
  const apiKey  = process.env.LIPIA_API_KEY!;
  const baseUrl = process.env.LIPIA_API_URL || 'https://lipia-api.kreativelabske.com/api/v2';

  try {
    // Main SMCF flow uses /payments/status; keep /request/status as fallback.
    const urls = [
      `${baseUrl}/payments/status?reference=${encodeURIComponent(checkoutRequestId)}`,
      `${baseUrl}/request/status?reference=${encodeURIComponent(checkoutRequestId)}`,
    ];

    let data: unknown = null;
    let ok = false;
    for (const url of urls) {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
      if (!res.ok) continue;
      ok = true;
      data = await res.json().catch(() => ({}));
      break;
    }

    if (!ok || !data) return { success: false, status: 'pending' };

    const dataRecord = asRecord(data);
    if (!dataRecord) return { success: false, status: 'pending' };

    const payload = asRecord(getPathValue(dataRecord, ['data', 'response']))
      ?? asRecord(dataRecord.data)
      ?? dataRecord;

    const rawResultCode = payload['ResultCode'] ?? payload['resultCode'] ?? dataRecord['ResultCode'] ?? dataRecord['resultCode'];
    const resultCode =
      typeof rawResultCode === 'string' || typeof rawResultCode === 'number'
        ? rawResultCode
        : undefined;
    const receipt = payload['MpesaReceiptNumber'] ?? payload['mpesaReceiptNumber'] ?? payload['TransactionID'] ?? payload['transactionId'];
    const resultDesc = payload['ResultDesc'] ?? payload['resultDesc'] ?? payload['ResultDescription'] ?? dataRecord['message'];
    const rawAmount = payload['Amount'] ?? payload['amount'];
    const payloadStatus = payload['status'];

    const isSuccess = (String(resultCode) === '0' || String(payloadStatus).toLowerCase() === 'success') && !!receipt;
    const isFailed  = !isSuccess && (
      (resultCode !== undefined && String(resultCode) !== '0' && String(resultCode) !== 'pending') ||
      ['failed', 'cancelled'].includes(String(payloadStatus).toLowerCase())
    );

    return {
      success: true,
      status: isSuccess ? 'success' : isFailed ? 'failed' : 'pending',
      mpesaReceiptNumber: typeof receipt === 'string' ? receipt : String(receipt || ''),
      resultCode,
      resultDesc: typeof resultDesc === 'string' ? resultDesc : undefined,
      amount: rawAmount ? Number(rawAmount) : undefined,
    };
  } catch {
    return { success: false, status: 'pending' };
  }
}

async function pollSACCOPayment(
  type: 'deposit' | 'loan_repay' | 'share_purchase' | 'registration_fee',
  checkoutRequestId: string,
  pendingTxnId: string,   // DB Transaction._id (string) of the pending record
  memberId: string,
  amount: number,
  phone: string,
  loanId?: string,
): Promise<void> {
  const MAX_MS   = 90_000;
  const INTERVAL = 3_000;
  const start    = Date.now();

  const tick = async (): Promise<void> => {
    if (Date.now() - start > MAX_MS) {
      // Timeout — mark failed in DB and update Maps
      await Transaction.findByIdAndUpdate(pendingTxnId, { status: 'failed', processedAt: new Date() });
      if (type === 'deposit') {
        const d = pendingDeposits.get(checkoutRequestId);
        if (d) { d.status = 'failed'; d.resultDesc = 'Payment timed out'; pendingDeposits.set(checkoutRequestId, d); }
      } else if (type === 'share_purchase') {
        const s = pendingSharePurchases.get(checkoutRequestId);
        if (s) { s.status = 'failed'; s.resultDesc = 'Payment timed out'; pendingSharePurchases.set(checkoutRequestId, s); }
      } else if (type === 'registration_fee') {
        const f = pendingRegistrationFees.get(checkoutRequestId);
        if (f) { f.status = 'failed'; f.resultDesc = 'Payment timed out'; pendingRegistrationFees.set(checkoutRequestId, f); }
      } else {
        const r = pendingRepayments.get(checkoutRequestId);
        if (r) { r.status = 'failed'; r.resultDesc = 'Payment timed out'; pendingRepayments.set(checkoutRequestId, r); }
      }
      return;
    }

    const { status, mpesaReceiptNumber, amount: paidAmt, resultDesc } = await queryLipiaStatus(checkoutRequestId);

    if (status === 'success' && mpesaReceiptNumber) {
      const confirmedAmount = paidAmt || amount;
      try {
        if (type === 'deposit') {
          await settlePendingDeposit({
            checkoutRequestId,
            memberId,
            amount: confirmedAmount,
            phone,
            mpesaRef: mpesaReceiptNumber,
            sourceLabel: 'M-Pesa STK',
            processedAt: new Date(),
          });
          const d = pendingDeposits.get(checkoutRequestId);
          if (d) { d.status = 'success'; d.mpesaRef = mpesaReceiptNumber; d.amount = confirmedAmount; pendingDeposits.set(checkoutRequestId, d); }

        } else if (type === 'share_purchase') {
          await Transaction.findByIdAndUpdate(pendingTxnId, {
            status: 'completed',
            mpesaRef: mpesaReceiptNumber,
            amount: confirmedAmount,
            description: `M-Pesa Share Purchase — Ref: ${mpesaReceiptNumber} — ${phone}`,
            processedAt: new Date(),
            depositProcessed: true,
          });
          await Member.findByIdAndUpdate(memberId, { $inc: { shares: confirmedAmount } });
          await recalculateMemberRiskScore(memberId);
          const s = pendingSharePurchases.get(checkoutRequestId);
          if (s) { s.status = 'success'; s.mpesaRef = mpesaReceiptNumber; s.amount = confirmedAmount; pendingSharePurchases.set(checkoutRequestId, s); }

          const member = await Member.findById(memberId).select('name memberId');
          const displayName = member?.name || member?.memberId || 'Member';
          void notifyStaff(
            'Share Purchase Received',
            `${displayName} purchased shares worth KES ${Number(confirmedAmount).toLocaleString()} via M-Pesa. Ref: ${mpesaReceiptNumber}.`,
            'info',
            '/accounts'
          );

        } else if (type === 'registration_fee') {
          await settleRegistrationFeePayment({
            checkoutRequestId,
            memberId,
            amount: confirmedAmount,
            phone,
            mpesaRef: mpesaReceiptNumber,
            source: 'polling',
          });
          const f = pendingRegistrationFees.get(checkoutRequestId);
          if (f) { f.status = 'success'; f.mpesaRef = mpesaReceiptNumber; f.amount = confirmedAmount; pendingRegistrationFees.set(checkoutRequestId, f); }

        } else if (type === 'loan_repay' && loanId) {
          // Delete placeholder, processRepayment creates the real transaction
          await Transaction.findByIdAndDelete(pendingTxnId);
          const result = await processRepayment(
            loanId, confirmedAmount, 'mpesa',
            `Phone: ${phone} Ref: ${mpesaReceiptNumber}`, null
          );
          const r = pendingRepayments.get(checkoutRequestId);
          if (r) { r.status = 'success'; r.mpesaRef = mpesaReceiptNumber; r.amount = confirmedAmount; r.loanCompleted = result.loanCompleted; pendingRepayments.set(checkoutRequestId, r); }
        }
      } catch (err) {
        console.error('[pollSACCOPayment] post-confirm error', err);
        await Transaction.findByIdAndUpdate(pendingTxnId, { status: 'failed', processedAt: new Date() }).catch(() => {});
        if (type === 'deposit') {
          const d = pendingDeposits.get(checkoutRequestId);
          if (d) { d.status = 'failed'; d.resultDesc = 'Processing error after payment confirmed'; pendingDeposits.set(checkoutRequestId, d); }
        } else if (type === 'share_purchase') {
          const s = pendingSharePurchases.get(checkoutRequestId);
          if (s) { s.status = 'failed'; s.resultDesc = 'Processing error after payment confirmed'; pendingSharePurchases.set(checkoutRequestId, s); }
        } else if (type === 'registration_fee') {
          const f = pendingRegistrationFees.get(checkoutRequestId);
          if (f) { f.status = 'failed'; f.resultDesc = 'Processing error after payment confirmed'; pendingRegistrationFees.set(checkoutRequestId, f); }
        } else {
          const r = pendingRepayments.get(checkoutRequestId);
          if (r) { r.status = 'failed'; r.resultDesc = 'Processing error after payment confirmed'; pendingRepayments.set(checkoutRequestId, r); }
        }
      }
      return;
    }

    if (status === 'failed') {
      await Transaction.findByIdAndUpdate(pendingTxnId, { status: 'failed', processedAt: new Date() });
      if (type === 'deposit') {
        const d = pendingDeposits.get(checkoutRequestId);
        if (d) { d.status = 'failed'; d.resultDesc = resultDesc || 'Payment cancelled or failed'; pendingDeposits.set(checkoutRequestId, d); }
      } else if (type === 'share_purchase') {
        const s = pendingSharePurchases.get(checkoutRequestId);
        if (s) { s.status = 'failed'; s.resultDesc = resultDesc || 'Payment cancelled or failed'; pendingSharePurchases.set(checkoutRequestId, s); }
      } else if (type === 'registration_fee') {
        const f = pendingRegistrationFees.get(checkoutRequestId);
        if (f) { f.status = 'failed'; f.resultDesc = resultDesc || 'Payment cancelled or failed'; pendingRegistrationFees.set(checkoutRequestId, f); }
      } else {
        const r = pendingRepayments.get(checkoutRequestId);
        if (r) { r.status = 'failed'; r.resultDesc = resultDesc || 'Payment cancelled or failed'; pendingRepayments.set(checkoutRequestId, r); }
      }
      return;
    }

    // Still pending — schedule next check
    setTimeout(tick, INTERVAL);
  };

  // First check after initial delay
  setTimeout(tick, INTERVAL);
}

/** Send STK push via Lipia Online to till 6938069 */
async function sendLipiaSTK(phone: string, amount: number, reference: string, description: string): Promise<LipiaStkResponse> {
  const apiKey  = process.env.LIPIA_API_KEY!;
  const baseUrl = normalizeLipiaBaseUrl(process.env.LIPIA_API_URL);
  const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://smcf-sacco-backend.onrender.com/api/mpesa/callback';
  const appId = process.env.LIPIA_APP_ID;
  const appName = process.env.LIPIA_APP_NAME;

  const phone07 = normalizePhoneForLipia(phone);
  const phone254 = normalizePhone(phone);
  const phonePlus254 = `+${phone254}`;
  const phoneCandidates = Array.from(new Set([phone07, phone254, phonePlus254]));

  const attempts = phoneCandidates.flatMap((phoneValue) => [
    {
      url: `${baseUrl}/payments/stk-push`,
      body: {
        phone_number: phoneValue,
        amount,
        external_reference: reference,
        ...(appId ? { app_id: appId } : {}),
        ...(appName ? { app_name: appName } : {}),
        callback_url: callbackUrl,
        description,
      },
    },
    {
      url: `${baseUrl}/payments/stk-push`,
      body: {
        phone: phoneValue,
        amount,
        reference,
        ...(appId ? { app_id: appId } : {}),
        ...(appName ? { app_name: appName } : {}),
        description,
        callback_url: callbackUrl,
      },
    },
  ]);

  let lastStatus = 500;
  let lastReason = 'Unknown error';

  for (const attempt of attempts) {
    const res = await fetch(attempt.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attempt.body),
    });

    const responseText = await res.text().catch(() => '');
    let data: unknown = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText || 'Unexpected response from payment service' };
    }

    const dataRecord = asRecord(data);
    const errorRecord = asRecord(dataRecord?.error);
    const mpesaErrorRecord = asRecord(errorRecord?.mpesaError);

    if (!res.ok) {
      lastStatus = res.status;
      const rawReason =
        typeof data === 'string'
          ? data
          : (errorRecord?.message ?? dataRecord?.message ?? dataRecord?.error);
      lastReason = typeof rawReason === 'string' ? rawReason : 'Unknown error';

      // Some provider responses indicate suspension in body text even when status is not 403.
      if (looksLikeSuspended(lastReason)) {
        lastStatus = 403;
      }
      continue;
    }

    if (dataRecord?.success === false) {
      lastStatus = 400;
      const rawReason =
        mpesaErrorRecord?.errorMessage
        ?? errorRecord?.message
        ?? dataRecord?.message;
      lastReason = typeof rawReason === 'string' ? rawReason : 'Payment initiation failed';

      // Treat policy suspension as service-unavailable for clearer API semantics.
      if (looksLikeSuspended(lastReason)) {
        lastStatus = 403;
      }
      continue;
    }

    const checkoutRequestId = extractCheckoutRequestId(data);

    // Some Lipia variants return a successful envelope but move the request id
    // into different keys. Keep trying other endpoint variants before failing.
    if (!checkoutRequestId) {
      lastStatus = 502;
      lastReason = 'Payment service response missing checkout request id';
      continue;
    }

    return {
      ...(dataRecord || {}),
      CheckoutRequestID: checkoutRequestId,
      checkoutRequestId,
    };
  }

  if (lastStatus === 403) {
    const err = new Error(`Payment service suspended — please contact SMCF admin. (${lastReason})`) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  if (lastStatus >= 400 && lastStatus < 500) {
    const err = new Error(`Payment request rejected: ${lastReason}`) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const err = new Error(`Lipia STK push failed (HTTP ${lastStatus}): ${lastReason}`) as Error & { statusCode?: number };
  err.statusCode = 502;
  throw err;
}

function looksLikeSuspended(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('suspended') || m.includes('policy violation');
}

function extractCheckoutRequestId(payload: unknown): string | undefined {
  const candidates = [
    getPathValue(payload, ['data', 'TransactionReference']),
    getPathValue(payload, ['data', 'CheckoutRequestID']),
    getPathValue(payload, ['data', 'checkoutRequestId']),
    getPathValue(payload, ['data', 'checkout_request_id']),
    getPathValue(payload, ['data', 'checkoutRequestID']),
    getPathValue(payload, ['data', 'requestId']),
    getPathValue(payload, ['data', 'reference']),
    getPathValue(payload, ['CheckoutRequestID']),
    getPathValue(payload, ['checkoutRequestId']),
    getPathValue(payload, ['checkout_request_id']),
    getPathValue(payload, ['transactionReference']),
    getPathValue(payload, ['reference']),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return undefined;
}

function normalizePhone(raw: string): string {
  let p = String(raw).trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p;
}

// Lipia Online requires 07XXXXXXXXX / 01XXXXXXXXX format (not 254-prefix)
function normalizePhoneForLipia(raw: string): string {
  let p = String(raw).trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (p.startsWith('254')) p = '0' + p.slice(3);
  if (!p.startsWith('0')) p = '0' + p;
  return p;
}

function maskSecret(value?: string): string | null {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-1)}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function envFingerprint(value?: string): string | null {
  if (!value) return null;
  return `${value.length}:${value.charCodeAt(0)}:${value.charCodeAt(value.length - 1)}`;
}

const REGISTRATION_FEE_AMOUNT = 100;

function isSamePhone(left: string, right: string): boolean {
  const l = normalizePhone(left || '');
  const r = normalizePhone(right || '');
  return l === r;
}

async function findMemberByPhoneForRegistration(phone: string) {
  const normalized = normalizePhone(phone);
  const allCandidates = await Member.find({ registrationFeePaid: { $ne: true }, phone: { $ne: null } })
    .select('_id phone registrationFeePaid')
    .limit(2000);

  return allCandidates.find((m) => isSamePhone(String((m as { phone?: unknown }).phone || ''), normalized)) || null;
}

async function settleRegistrationFeePayment(params: {
  memberId: string;
  amount: number;
  phone: string;
  mpesaRef: string;
  checkoutRequestId?: string;
  source: 'callback' | 'polling' | 'reconcile';
}) {
  const { memberId, amount, phone, mpesaRef, checkoutRequestId, source } = params;

  if (Number(amount) !== REGISTRATION_FEE_AMOUNT) {
    throw new Error(`Registration fee must be exactly KES ${REGISTRATION_FEE_AMOUNT}`);
  }

  const duplicate = await Transaction.findOne({
    type: 'registration_fee',
    mpesaRef,
    status: 'completed',
  }).select('_id');

  if (duplicate) {
    const already = await Member.findOne({ registrationFeeMpesaCode: mpesaRef }).select('_id');
    return { updated: false, alreadyPaid: Boolean(already), duplicate: true };
  }

  const updateResult = await Member.findOneAndUpdate(
    { _id: memberId, registrationFeePaid: { $ne: true } },
    {
      $set: {
        registrationFeePaid: true,
        registrationFeeAmount: REGISTRATION_FEE_AMOUNT,
        registrationFeeMpesaCode: mpesaRef,
        registrationFeeDate: new Date(),
        registrationFeePhone: normalizePhone(phone),
        registrationFeeTransactionId: checkoutRequestId || mpesaRef,
        registrationFeePendingCheckoutId: null,
      },
    },
    { new: true }
  );

  await Transaction.findOneAndUpdate(
    {
      checkoutRequestId,
      type: 'registration_fee',
      status: 'pending',
    },
    {
      status: 'completed',
      mpesaRef,
      amount: REGISTRATION_FEE_AMOUNT,
      description: `M-Pesa Registration Fee - Ref: ${mpesaRef} - ${normalizePhone(phone)}`,
      processedAt: new Date(),
      depositProcessed: true,
    }
  );

  if (!updateResult) {
    return { updated: false, alreadyPaid: true, duplicate: false };
  }

  const existingTxn = await Transaction.findOne({
    memberId,
    type: 'registration_fee',
    mpesaRef,
    status: 'completed',
  }).select('_id');

  if (!existingTxn) {
    const transactionRef = createTransactionRef();
    await Transaction.create({
      transactionRef,
      memberId,
      type: 'registration_fee',
      amount: REGISTRATION_FEE_AMOUNT,
      description: `M-Pesa Registration Fee (${source}) - Ref: ${mpesaRef} - ${normalizePhone(phone)}`,
      status: 'completed',
      mpesaRef,
      checkoutRequestId: checkoutRequestId || null,
      createdBy: null,
    });
  }

  return { updated: true, alreadyPaid: false, duplicate: false };
}

async function settlePendingDeposit(params: {
  checkoutRequestId: string;
  memberId: string;
  amount: number;
  phone?: string;
  mpesaRef: string;
  sourceLabel: string;
  processedAt?: Date;
}) {
  const amount = Math.round(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Deposit amount must be a positive number');
  }

  const processedAt = params.processedAt ?? new Date();
  const existingCompletedTxn = await Transaction.findOne({
    type: 'deposit',
    mpesaRef: params.mpesaRef,
    status: 'completed',
  }).select('_id');

  if (existingCompletedTxn) {
    return { applied: false, duplicate: true };
  }

  const claimedTxn = await Transaction.findOneAndUpdate(
    {
      checkoutRequestId: params.checkoutRequestId,
      type: 'deposit',
      depositProcessed: { $ne: true },
    },
    {
      $set: {
        status: 'completed',
        mpesaRef: params.mpesaRef,
        amount,
        description: `M-Pesa Savings Deposit — Ref: ${params.mpesaRef} — ${params.phone || 'unknown'}`,
        processedAt,
        depositProcessed: true,
      },
    },
    { new: true }
  ).select('_id status depositProcessed');

  if (!claimedTxn) {
    const pendingTxn = await Transaction.findOne({
      checkoutRequestId: params.checkoutRequestId,
      type: 'deposit',
    }).select('_id status depositProcessed');

    if (pendingTxn) {
      return { applied: false, duplicate: true };
    }

    throw new Error('Pending deposit transaction not found');
  }

  await recordSavingsDeposit({
    memberId: params.memberId,
    amount,
    reference: params.mpesaRef,
    sourceLabel: params.sourceLabel,
    processedAt,
    note: params.phone ? `Phone: ${params.phone}` : undefined,
    notificationPath: '/accounts',
  });

  return { applied: true, duplicate: false };
}

function isDuplicateKeyError(err: unknown): err is { code?: number; keyValue?: Record<string, unknown>; keyPattern?: Record<string, unknown> } {
  if (!err || typeof err !== 'object') return false;
  return (err as { code?: number }).code === 11000;
}

function getDuplicateFields(err: { keyValue?: Record<string, unknown>; keyPattern?: Record<string, unknown>; message?: string }): string[] {
  const fromKeyValue = Object.keys(err.keyValue || {});
  if (fromKeyValue.length > 0) return fromKeyValue;

  const fromKeyPattern = Object.keys(err.keyPattern || {});
  if (fromKeyPattern.length > 0) return fromKeyPattern;

  const message = String(err.message || '');
  const indexMatch = message.match(/index:\s*([^\s]+)\s*dup key/i);
  if (!indexMatch?.[1]) return [];

  const indexName = indexMatch[1];
  const normalized = indexName.replace(/_1/g, '');
  return normalized.split('_').filter(Boolean);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findReusablePendingDepositTransaction(params: {
  memberId: string;
  amount: number;
  phone: string;
}) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  return Transaction.findOne({
    memberId: params.memberId,
    type: 'deposit',
    status: 'pending',
    depositProcessed: { $ne: true },
    amount: params.amount,
    checkoutRequestId: { $exists: true, $nin: [null, ''] },
    createdAt: { $gte: fifteenMinutesAgo },
    description: { $regex: new RegExp(escapeRegex(params.phone)) },
  })
    .sort({ createdAt: -1 })
    .select('_id checkoutRequestId memberId amount status depositProcessed');
}

async function createOrGetPendingDepositTransaction(params: {
  memberId: string;
  amount: number;
  phone: string;
  checkoutRequestId: string;
}) {
  const description = `M-Pesa Savings Deposit — STK Pending — ${params.phone}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const txnRef = createTransactionRef();

    try {
      const txnDoc = await Transaction.findOneAndUpdate(
        {
          checkoutRequestId: params.checkoutRequestId,
          type: 'deposit',
        },
        {
          $setOnInsert: {
            transactionRef: txnRef,
            memberId: params.memberId,
            type: 'deposit',
            amount: params.amount,
            description,
            status: 'pending',
            checkoutRequestId: params.checkoutRequestId,
            createdBy: null,
          },
        },
        { upsert: true, new: true }
      ).select('_id checkoutRequestId memberId amount status mpesaRef depositProcessed');

      if (txnDoc) {
        return txnDoc;
      }
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }

      const duplicateFields = getDuplicateFields(err as { keyValue?: Record<string, unknown>; keyPattern?: Record<string, unknown>; message?: string });

      const existingByCheckout = await Transaction.findOne({
        checkoutRequestId: params.checkoutRequestId,
        type: 'deposit',
      }).select('_id checkoutRequestId memberId amount status mpesaRef depositProcessed');

      if (existingByCheckout) {
        return existingByCheckout;
      }

      const existingSimilarPending = await findReusablePendingDepositTransaction({
        memberId: params.memberId,
        amount: params.amount,
        phone: params.phone,
      });

      if (existingSimilarPending?.checkoutRequestId) {
        const hydratedSimilarTxn = await Transaction.findById(existingSimilarPending._id)
          .select('_id checkoutRequestId memberId amount status mpesaRef depositProcessed');

        if (hydratedSimilarTxn) {
          return hydratedSimilarTxn;
        }
      }

      // If duplicate metadata is unclear, retry as a transient race condition.
      if (duplicateFields.length === 0) {
        continue;
      }

      // Retry transactionRef collisions; any other field collision should bubble.
      if (!duplicateFields.includes('transactionRef') && !duplicateFields.includes('checkoutRequestId')) {
        throw err;
      }
    }
  }

  throw new Error('Failed to create pending deposit transaction after retries');
}

// ─── GET /api/mpesa/provider-diagnostics ─────────────────────────────────────
// Admin diagnostics endpoint: returns masked provider config to compare environments

router.get('/provider-diagnostics', protect, authorize('admin', 'treasurer'), async (_req: AuthRequest, res: Response) => {
  const apiKey = process.env.LIPIA_API_KEY;
  const appId = process.env.LIPIA_APP_ID;
  const appName = process.env.LIPIA_APP_NAME;
  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  const apiUrl = process.env.LIPIA_API_URL || 'https://lipia-api.kreativelabske.com/api/v2';

  return res.json({
    success: true,
    data: {
      configured: {
        apiKey: !!apiKey,
        appId: !!appId,
        appName: !!appName,
        callbackUrl: !!callbackUrl,
      },
      values: {
        apiUrl,
        callbackUrl,
        appName,
        apiKeyMasked: maskSecret(apiKey),
        appIdMasked: maskSecret(appId),
      },
      fingerprints: {
        apiKey: envFingerprint(apiKey),
        appId: envFingerprint(appId),
      },
      notes: 'Use fingerprints to confirm both services are using the same Lipia credentials without exposing secrets.',
    },
  });
});

// ─── POST /api/mpesa/deposit ─────────────────────────────────────────────────
// Initiates an STK Push to the member's phone.
// Body: { memberId: string, amount: number, phone: string }

router.post('/deposit', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, phone } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });
    if (!phone)    return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!amount || Number(amount) < 10)
      return res.status(400).json({ success: false, message: 'Minimum deposit is KES 10' });

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.round(Number(amount));

    const reusablePendingTxn = await findReusablePendingDepositTransaction({
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
    });

    if (reusablePendingTxn?.checkoutRequestId) {
      const existingCheckoutRequestId = String(reusablePendingTxn.checkoutRequestId);

      pendingDeposits.set(existingCheckoutRequestId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      pollSACCOPayment('deposit', existingCheckoutRequestId, String(reusablePendingTxn._id), memberId, numAmount, mpesaPhone).catch(
        (err) => console.error('[pollSACCOPayment deposit reuse]', err)
      );

      return res.json({
        success: true,
        data: {
          checkoutRequestId: existingCheckoutRequestId,
          reused: true,
        },
      });
    }

    // ── Simulation mode (no credentials set) ──────────────────────────────
    const hasCredentials = !!(process.env.LIPIA_API_KEY);

    if (!hasCredentials) {
      const simId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      pendingDeposits.set(simId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      // Auto-complete after 5 s (simulate customer entering PIN)
      setTimeout(async () => {
        const d = pendingDeposits.get(simId);
        if (!d || d.status !== 'pending') return;
        try {
          const ref = `SIM${Date.now()}`;
          await recordDeposit(d.memberId, d.amount, d.phone, ref);
          d.status = 'success';
          d.mpesaRef = ref;
        } catch {
          d.status = 'failed';
          d.resultDesc = 'Simulation internal error';
        }
        pendingDeposits.set(simId, d!);
      }, 5000);

      return res.json({
        success: true,
        simulated: true,
        data: { checkoutRequestId: simId },
      });
    }

    // ── Real STK Push via Lipia Online ────────────────────────────────────
    const stkData = await sendLipiaSTK(mpesaPhone, numAmount, 'SMCF-SAVINGS', 'SMCF SACCO Savings Deposit');

    // Lipia proxies the Safaricom response — CheckoutRequestID may be top-level
    // or nested under data depending on the Lipia version.
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || stkData.error || 'STK Push failed. Payment service did not return a checkout request ID.',
      });
    }

    // Create (or reuse) DB record immediately so retries remain idempotent.
    const txnDoc = await createOrGetPendingDepositTransaction({
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      checkoutRequestId,
    });

    const mapStatus: PendingDeposit['status'] =
      txnDoc.status === 'completed' ? 'success' : txnDoc.status === 'failed' ? 'failed' : 'pending';

    pendingDeposits.set(checkoutRequestId, {
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: mapStatus,
      mpesaRef: txnDoc.mpesaRef || undefined,
      createdAt: Date.now(),
    });

    // Start server-side Lipia polling — no callback dependency
    if (txnDoc.status === 'pending' && txnDoc.depositProcessed !== true) {
      pollSACCOPayment('deposit', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone).catch(
        (err) => console.error('[pollSACCOPayment deposit]', err)
      );
    }

    return res.json({ success: true, data: { checkoutRequestId } });
  } catch (err) {
    next(err);
  }
});

async function recordDeposit(memberId: string, amount: number, phone: string, mpesaRef: string) {
  const transactionRef = createTransactionRef();
  await Transaction.create({
    transactionRef,
    memberId,
    type: 'deposit',
    amount,
    description: `M-Pesa Savings Deposit — Ref: ${mpesaRef} — ${phone}`,
    status: 'completed',
    createdBy: null,
  });

  await recordSavingsDeposit({
    memberId,
    amount,
    reference: mpesaRef,
    sourceLabel: 'M-Pesa',
    processedAt: new Date(),
    note: phone ? `Phone: ${phone}` : undefined,
    notificationPath: '/accounts',
  });
}

// ─── POST /api/mpesa/share-purchase ─────────────────────────────────────────
// Initiates STK Push for share purchase and records a pending transaction.

router.post('/share-purchase', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, phone } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });
    if (!phone)    return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!amount || Number(amount) < 100)
      return res.status(400).json({ success: false, message: 'Minimum share purchase is KES 100' });

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.round(Number(amount));
    const hasCredentials = !!(process.env.LIPIA_API_KEY);

    if (!hasCredentials) {
      const simId = `SHRSIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      pendingSharePurchases.set(simId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      setTimeout(async () => {
        const s = pendingSharePurchases.get(simId);
        if (!s || s.status !== 'pending') return;
        try {
          const ref = `SHRSIM${Date.now()}`;
          const txnRef = createTransactionRef();
          await Transaction.create({
            transactionRef: txnRef,
            memberId,
            type: 'share_purchase',
            amount: numAmount,
            description: `M-Pesa Share Purchase — Ref: ${ref} — ${mpesaPhone}`,
            status: 'completed',
            mpesaRef: ref,
            createdBy: null,
          });
          await Member.findByIdAndUpdate(memberId, { $inc: { shares: numAmount } });
          await recalculateMemberRiskScore(memberId);
          s.status = 'success';
          s.mpesaRef = ref;
        } catch {
          s.status = 'failed';
          s.resultDesc = 'Simulation internal error';
        }
        pendingSharePurchases.set(simId, s);
      }, 5000);

      return res.json({
        success: true,
        simulated: true,
        data: { checkoutRequestId: simId },
      });
    }

    const stkData = await sendLipiaSTK(mpesaPhone, numAmount, 'SMCF-SHARES', 'SMCF SACCO Share Purchase');
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || stkData.error || 'STK Push failed. Payment service did not return a checkout request ID.',
      });
    }

    const txnRef = createTransactionRef();
    const txnDoc   = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'share_purchase',
      amount: numAmount,
      description: `M-Pesa Share Purchase — STK Pending — ${mpesaPhone}`,
      status: 'pending',
      checkoutRequestId,
      createdBy: null,
    });

    pendingSharePurchases.set(checkoutRequestId, {
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: 'pending',
      createdAt: Date.now(),
    });

    pollSACCOPayment('share_purchase', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone).catch(
      (err) => console.error('[pollSACCOPayment share-purchase]', err)
    );

    return res.json({ success: true, data: { checkoutRequestId } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/registration-fee/initiate ───────────────────────────────
// Initiates one-time registration fee payment (KES 100).

router.post('/registration-fee/initiate', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, phone } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });

    const member = await Member.findById(memberId).select('phone registrationFeePaid registrationFeePendingCheckoutId');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (member.registrationFeePaid) {
      return res.status(409).json({ success: false, message: 'Registration fee already paid' });
    }

    const mpesaPhone = normalizePhone(phone || member.phone || '');
    if (!mpesaPhone || mpesaPhone.length < 12) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }

    const numAmount = REGISTRATION_FEE_AMOUNT;
    const hasCredentials = !!process.env.LIPIA_API_KEY;

    if (!hasCredentials) {
      const simId = `REGSIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      pendingRegistrationFees.set(simId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      await Member.findByIdAndUpdate(memberId, {
        $set: {
          registrationFeeAmount: REGISTRATION_FEE_AMOUNT,
          registrationFeePendingCheckoutId: simId,
        },
      });

      const txnRef = createTransactionRef();
      await Transaction.create({
        transactionRef: txnRef,
        memberId,
        type: 'registration_fee',
        amount: numAmount,
        description: `M-Pesa Registration Fee - STK Pending - ${mpesaPhone}`,
        status: 'pending',
        checkoutRequestId: simId,
        createdBy: null,
      });

      setTimeout(async () => {
        const f = pendingRegistrationFees.get(simId);
        if (!f || f.status !== 'pending') return;
        try {
          const ref = `REGSIM${Date.now()}`;
          await settleRegistrationFeePayment({
            memberId: f.memberId,
            amount: REGISTRATION_FEE_AMOUNT,
            phone: f.phone,
            mpesaRef: ref,
            checkoutRequestId: simId,
            source: 'polling',
          });
          f.status = 'success';
          f.mpesaRef = ref;
          pendingRegistrationFees.set(simId, f);
        } catch {
          f.status = 'failed';
          f.resultDesc = 'Simulation internal error';
          pendingRegistrationFees.set(simId, f);
        }
      }, 4000);

      return res.json({ success: true, simulated: true, data: { checkoutRequestId: simId } });
    }

    const stkData = await sendLipiaSTK(mpesaPhone, numAmount, 'SMCF-REGFEE', 'SMCF SACCO Registration Fee');
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || stkData.error || 'STK Push failed. Payment service did not return a checkout request ID.',
      });
    }

    const txnRef = createTransactionRef();
    const txnDoc = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'registration_fee',
      amount: numAmount,
      description: `M-Pesa Registration Fee - STK Pending - ${mpesaPhone}`,
      status: 'pending',
      checkoutRequestId,
      createdBy: null,
    });

    pendingRegistrationFees.set(checkoutRequestId, {
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: 'pending',
      createdAt: Date.now(),
    });

    await Member.findByIdAndUpdate(memberId, {
      $set: {
        registrationFeeAmount: REGISTRATION_FEE_AMOUNT,
        registrationFeePendingCheckoutId: checkoutRequestId,
      },
    });

    pollSACCOPayment('registration_fee', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone).catch(
      (err) => console.error('[pollSACCOPayment registration-fee]', err)
    );

    return res.json({ success: true, data: { checkoutRequestId } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/registration-fee/reconcile-manual ─────────────────────
// Allows admin/staff to mark manually paid registration fee after validating details.

router.post('/registration-fee/reconcile-manual', protect, authorize('admin', 'treasurer', 'credit_officer'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { phone, mpesaRef, amount } = req.body;
    const normalizedRef = String(mpesaRef || '').trim().toUpperCase();
    if (!normalizedRef) return res.status(400).json({ success: false, message: 'mpesaRef is required' });
    if (Number(amount) !== REGISTRATION_FEE_AMOUNT) {
      return res.status(400).json({ success: false, message: 'Amount must be KES 100 for registration fee' });
    }

    const member = await findMemberByPhoneForRegistration(String(phone || ''));
    if (!member) return res.status(404).json({ success: false, message: 'No unpaid member found for the provided phone' });

    const memberDoc = member as { _id: unknown; phone?: unknown };

    await settleRegistrationFeePayment({
      memberId: String(memberDoc._id),
      amount: REGISTRATION_FEE_AMOUNT,
      phone: String(memberDoc.phone || phone),
      mpesaRef: normalizedRef,
      checkoutRequestId: normalizedRef,
      source: 'reconcile',
    });

    return res.json({ success: true, data: { memberId: String(memberDoc._id), mpesaRef: normalizedRef } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/callback ────────────────────────────────────────────────
// Safaricom posts the result here. Handles both savings deposits and loan repayments.

router.post('/callback', async (req: Request, res: Response) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const cb = req.body?.Body?.stkCallback;
    if (!cb) return;

    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = cb;
    type CallbackItem = { Name?: string; Value?: unknown };
    const items: CallbackItem[] = Array.isArray(CallbackMetadata?.Item) ? CallbackMetadata.Item : [];
    const get = (n: string): unknown => items.find((i) => i.Name === n)?.Value;

    const mpesaRef = get('MpesaReceiptNumber') as string || `MPESA${Date.now()}`;
    const paidAmt  = Number(get('Amount'));
    const depositTxn = await Transaction.findOne({ checkoutRequestId: CheckoutRequestID, type: 'deposit' })
      .select('memberId amount description');

    // ── Savings deposit ──────────────────────────────────────────────────
    const deposit = pendingDeposits.get(CheckoutRequestID);
    if (deposit || depositTxn) {
      if (ResultCode !== 0) {
        if (deposit) {
          deposit.status = 'failed';
          deposit.resultDesc = ResultDesc || 'Payment cancelled or failed';
          pendingDeposits.set(CheckoutRequestID, deposit);
        }
        await Transaction.findOneAndUpdate(
          { checkoutRequestId: CheckoutRequestID, type: 'deposit' },
          { status: 'failed', processedAt: new Date() }
        ).catch(() => {});
      } else {
        const amt = paidAmt || deposit?.amount || Number(depositTxn?.amount) || 0;
        const memberId = deposit?.memberId || String(depositTxn?.memberId || '');
        const phone = deposit?.phone || '';
        if (!memberId) {
          throw new Error('Unable to resolve member for deposit callback');
        }

        await settlePendingDeposit({
          checkoutRequestId: CheckoutRequestID,
          memberId,
          amount: amt,
          phone,
          mpesaRef,
          sourceLabel: 'M-Pesa STK',
          processedAt: new Date(),
        });

        if (deposit) {
          deposit.status = 'success';
          deposit.mpesaRef = mpesaRef;
          deposit.amount = amt;
          pendingDeposits.set(CheckoutRequestID, deposit);
        }
      }
      return;
    }

    // ── Share purchase ───────────────────────────────────────────────────
    const sharePurchase = pendingSharePurchases.get(CheckoutRequestID);
    if (sharePurchase) {
      if (ResultCode !== 0) {
        sharePurchase.status = 'failed';
        sharePurchase.resultDesc = ResultDesc || 'Payment cancelled or failed';
      } else {
        const amt = paidAmt || sharePurchase.amount;
        const txn = await Transaction.findOneAndUpdate(
          { checkoutRequestId: CheckoutRequestID, type: 'share_purchase', status: 'pending' },
          {
            status: 'completed',
            mpesaRef,
            amount: amt,
            description: `M-Pesa Share Purchase — Ref: ${mpesaRef} — ${sharePurchase.phone}`,
            processedAt: new Date(),
            depositProcessed: true,
          },
          { new: true }
        );

        // Only increment once if pending transaction existed.
        if (txn) {
          await Member.findByIdAndUpdate(sharePurchase.memberId, { $inc: { shares: amt } });
          await recalculateMemberRiskScore(sharePurchase.memberId);
          const member = await Member.findById(sharePurchase.memberId).select('name memberId');
          const displayName = member?.name || member?.memberId || 'Member';
          void notifyStaff(
            'Share Purchase Received',
            `${displayName} purchased shares worth KES ${Number(amt).toLocaleString()} via M-Pesa. Ref: ${mpesaRef}.`,
            'info',
            '/accounts'
          );
        }

        sharePurchase.status = 'success';
        sharePurchase.mpesaRef = mpesaRef;
        sharePurchase.amount = amt;
      }
      pendingSharePurchases.set(CheckoutRequestID, sharePurchase);
      return;
    }

    // ── Loan repayment ───────────────────────────────────────────────────
    const regFee = pendingRegistrationFees.get(CheckoutRequestID);
    if (regFee) {
      if (ResultCode !== 0) {
        regFee.status = 'failed';
        regFee.resultDesc = ResultDesc || 'Payment cancelled or failed';
      } else {
        const amt = paidAmt || regFee.amount;
        if (amt === REGISTRATION_FEE_AMOUNT) {
          await settleRegistrationFeePayment({
            memberId: regFee.memberId,
            amount: amt,
            phone: regFee.phone,
            mpesaRef,
            checkoutRequestId: CheckoutRequestID,
            source: 'callback',
          });
          regFee.status = 'success';
          regFee.mpesaRef = mpesaRef;
          regFee.amount = amt;
        } else {
          regFee.status = 'failed';
          regFee.resultDesc = 'Invalid amount for registration fee';
          await Transaction.findOneAndUpdate({ checkoutRequestId: CheckoutRequestID, type: 'registration_fee' }, { status: 'failed', processedAt: new Date() });
        }
      }
      pendingRegistrationFees.set(CheckoutRequestID, regFee);
      return;
    }

    const repayment = pendingRepayments.get(CheckoutRequestID);
    if (repayment) {
      if (ResultCode !== 0) {
        repayment.status     = 'failed';
        repayment.resultDesc = ResultDesc || 'Payment cancelled or failed';
      } else {
        const amt = paidAmt || repayment.amount;
        const result = await processRepayment(
          repayment.loanId, amt, 'mpesa',
          `Phone: ${repayment.phone} Ref: ${mpesaRef}`, null
        );
        repayment.status       = 'success';
        repayment.mpesaRef     = mpesaRef;
        repayment.amount       = amt;
        repayment.loanCompleted = result.loanCompleted;
      }
      pendingRepayments.set(CheckoutRequestID, repayment);
    }
  } catch (err) {
    console.error('[mpesa callback error]', err);
  }
});

// ─── GET /api/mpesa/status/:checkoutRequestId ────────────────────────────────
// Frontend polls this to check whether the push succeeded / failed / is pending.

router.get('/status/:checkoutRequestId', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { checkoutRequestId } = req.params;

    // Fast path: in-memory Map
    const deposit = pendingDeposits.get(checkoutRequestId);
    if (deposit) {
      return res.json({
        success: true,
        data: {
          type: 'deposit',
          status:     deposit.status,
          mpesaRef:   deposit.mpesaRef,
          amount:     deposit.amount,
          resultDesc: deposit.resultDesc,
        },
      });
    }

    const share = pendingSharePurchases.get(checkoutRequestId);
    if (share) {
      return res.json({
        success: true,
        data: {
          type: 'share_purchase',
          status:     share.status,
          mpesaRef:   share.mpesaRef,
          amount:     share.amount,
          resultDesc: share.resultDesc,
        },
      });
    }

    const regFee = pendingRegistrationFees.get(checkoutRequestId);
    if (regFee) {
      return res.json({
        success: true,
        data: {
          type: 'registration_fee',
          status: regFee.status,
          mpesaRef: regFee.mpesaRef,
          amount: regFee.amount,
          resultDesc: regFee.resultDesc,
        },
      });
    }

    // Fallback: DB lookup (handles server restart where Map was cleared)
    const txn = await Transaction.findOne({
      checkoutRequestId,
      type: { $in: ['deposit', 'share_purchase', 'registration_fee'] },
    }).select('status mpesaRef amount type');
    if (txn) {
      return res.json({
        success: true,
        data: {
          type: txn.type,
          status:   txn.status === 'completed' ? 'success' : txn.status === 'failed' ? 'failed' : 'pending',
          mpesaRef: txn.mpesaRef,
          amount:   txn.amount,
        },
      });
    }

    return res.status(404).json({ success: false, message: 'Request not found or expired' });
  } catch (err) {
    next(err);
  }
});

// ─── In-memory pending loan repayments ─────────────────────────────────────

interface PendingRepayment {
  loanId: string;
  memberId: string;
  amount: number;
  phone: string;
  status: 'pending' | 'success' | 'failed';
  mpesaRef?: string;
  resultDesc?: string;
  loanCompleted?: boolean;
  createdAt: number;
}

const pendingRepayments = new Map<string, PendingRepayment>();

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingRepayments.entries()) {
    if (v.createdAt < cutoff) pendingRepayments.delete(k);
  }
}, 10 * 60 * 1000);

// ─── POST /api/mpesa/loan-repay ──────────────────────────────────────────────
// Body: { loanId, amount, phone }

router.post('/loan-repay', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { loanId, amount, phone } = req.body;

    if (!loanId)  return res.status(400).json({ success: false, message: 'loanId is required' });
    if (!phone)   return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!amount || Number(amount) < 10)
      return res.status(400).json({ success: false, message: 'Minimum repayment is KES 10' });

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (!['disbursed', 'active'].includes(loan.status))
      return res.status(400).json({ success: false, message: 'Loan is not active' });

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.min(Math.round(Number(amount)), Math.round(loan.balance));

    const hasCredentials = !!(process.env.LIPIA_API_KEY);

    if (!hasCredentials) {
      const simId = `REPSIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      pendingRepayments.set(simId, {
        loanId,
        memberId: String(loan.memberId),
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      setTimeout(async () => {
        const r = pendingRepayments.get(simId);
        if (!r || r.status !== 'pending') return;
        try {
          const ref = `REPSIM${Date.now()}`;
          const result = await processRepayment(r.loanId, r.amount, 'mpesa', `Phone: ${r.phone} Ref: ${ref}`, null);
          r.status = 'success';
          r.mpesaRef = ref;
          r.loanCompleted = result.loanCompleted;
        } catch (e: unknown) {
          r.status = 'failed';
          r.resultDesc = toErrorMessage(e, 'Simulation error');
        }
        pendingRepayments.set(simId, r);
      }, 5000);

      return res.json({ success: true, simulated: true, data: { checkoutRequestId: simId } });
    }

    // ── Real STK Push via Lipia Online ────────────────────────────────────
    const stkData = await sendLipiaSTK(
      mpesaPhone,
      numAmount,
      loan.loanNumber,
      `SMCF Loan Repayment ${loan.loanNumber}`,
    );

    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: stkData.message || stkData.error || 'STK Push failed' });
    }

    const memberId = String(loan.memberId);

    // Create a DB placeholder so we survive restarts
    const txnRef = createTransactionRef();
    const txnDoc   = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'loan_repayment',
      amount: numAmount,
      description: `M-Pesa Loan Repayment — STK Pending — Loan ${loan.loanNumber}`,
      status: 'pending',
      checkoutRequestId,
      loanId,
      createdBy: null,
    });

    pendingRepayments.set(checkoutRequestId, {
      loanId,
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: 'pending',
      createdAt: Date.now(),
    });

    // Start server-side Lipia polling
    pollSACCOPayment('loan_repay', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone, loanId).catch(
      (err) => console.error('[pollSACCOPayment loan-repay]', err)
    );

    return res.json({ success: true, data: { checkoutRequestId } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/mpesa/repay-status/:checkoutRequestId ─────────────────────────

router.get('/repay-status/:checkoutRequestId', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { checkoutRequestId } = req.params;

    // Fast path: in-memory Map
    const r = pendingRepayments.get(checkoutRequestId);
    if (r) {
      return res.json({
        success: true,
        data: { status: r.status, mpesaRef: r.mpesaRef, amount: r.amount, loanCompleted: r.loanCompleted, resultDesc: r.resultDesc },
      });
    }

    // Fallback: DB lookup
    const txn = await Transaction.findOne({ checkoutRequestId, type: 'loan_repayment' }).select('status mpesaRef amount loanId');
    if (txn) {
      return res.json({
        success: true,
        data: {
          status:   txn.status === 'completed' ? 'success' : txn.status === 'failed' ? 'failed' : 'pending',
          mpesaRef: txn.mpesaRef,
          amount:   txn.amount,
        },
      });
    }

    return res.status(404).json({ success: false, message: 'Request not found or expired' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/payment-initiated ──────────────────────────────────────
// Called BEFORE opening Lipia payment link.
// Creates a pending transaction in DB immediately (shows in member history).
// Body: { memberId, amount, phone, type: 'deposit'|'loan_repay', loanId? }

router.post('/payment-initiated', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, phone, type, loanId } = req.body;
    let { memberId } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ success: false, message: 'amount and type are required' });
    }

    // For loan repayments, resolve memberId from the loan if not supplied
    if (type === 'loan_repay' && loanId && !memberId) {
      const loan = await Loan.findById(loanId).select('memberId');
      if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
      memberId = String(loan.memberId);
    }

    if (!memberId) {
      return res.status(400).json({ success: false, message: 'memberId is required' });
    }
    const numAmount = Math.round(Number(amount));
    if (numAmount < 10) return res.status(400).json({ success: false, message: 'Minimum amount is KES 10' });

    const normPhone = phone ? normalizePhone(String(phone)) : 'unknown';
    const txnType   = type === 'loan_repay' ? 'loan_repayment' : type === 'share_subscribe' ? 'share_purchase' : 'deposit';
    const loanTag   = (type === 'loan_repay' && loanId) ? ` [loanId:${loanId}]` : '';

    const txnRef = createTransactionRef();

    await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: txnType,
      amount: numAmount,
      description: `M-Pesa via Lipia Online — Pending admin confirmation${loanTag}`,
      status: 'pending',
      createdBy: null,
    });

    pendingLipiaPayments.set(txnRef, {
      type,
      memberId,
      loanId,
      amount: numAmount,
      phone: normPhone,
      txnRef,
      createdAt: Date.now(),
    });

    return res.json({ success: true, data: { transactionRef: txnRef } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/payment-confirm ────────────────────────────────────────
// Called when member clicks "I've Paid — Return to App".
// Marks the pending transaction completed and updates savings / loan balance.
// Body: { transactionRef }

router.post('/payment-confirm', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { transactionRef } = req.body;
    if (!transactionRef) {
      return res.status(400).json({ success: false, message: 'transactionRef is required' });
    }

    const pending = pendingLipiaPayments.get(transactionRef);
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Payment record not found or expired' });
    }

    const mpesaRef = `LIPIA-CONFIRM-${Date.now()}`;

    if (pending.type === 'deposit') {
      // Mark transaction completed + add to savings
      await Transaction.findOneAndUpdate(
        { transactionRef },
        {
          status: 'completed',
          description: `M-Pesa Savings Deposit via Lipia Online — Member confirmed`,
          processedAt: new Date(),
          depositProcessed: true,
        }
      );
      try {
        await recordSavingsDeposit({
          memberId: pending.memberId,
          amount: pending.amount,
          reference: mpesaRef,
          sourceLabel: 'Lipia payment link',
          processedAt: new Date(),
          note: `Transaction ${transactionRef}`,
          notificationPath: '/accounts',
        });
      } catch (depositError) {
        await Transaction.findOneAndUpdate(
          { transactionRef },
          { status: 'failed', processedAt: new Date() }
        ).catch(() => {});
        throw depositError;
      }

    } else if (pending.type === 'loan_repay' && pending.loanId) {
      // Delete the pending placeholder transaction — processRepayment creates the real one
      await Transaction.findOneAndDelete({ transactionRef, status: 'pending' });

      await processRepayment(
        pending.loanId,
        pending.amount,
        'mpesa',
        `Lipia Online payment — Member confirmed — ${mpesaRef}`,
        null
      );
    }

    pendingLipiaPayments.delete(transactionRef);
    return res.json({ success: true, data: { message: 'Payment confirmed and recorded.' } });
  } catch (err) {
    next(err);
  }
});

export default router;
