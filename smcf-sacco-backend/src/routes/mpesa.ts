/**
 * M-Pesa STK Push via PayHero.
 *
 * Environment variables needed (add to .env):
 *   PAYHERO_API_URL       – PayHero API base URL
 *   PAYHERO_API_USERNAME  – PayHero Basic Auth username
 *   PAYHERO_API_PASSWORD  – PayHero Basic Auth password
 *   PAYHERO_CHANNEL_ID    – PayHero payment channel ID
 *   PAYHERO_ACCOUNT_ID    – PayHero account ID
 *   PAYHERO_CALLBACK_URL  – Public URL PayHero will POST the payment result to
 *
 * If PayHero credentials are not set the route runs in simulation mode:
 * the STK push is faked and auto-succeeds after ~5 seconds so you can demo the
 * full UI flow without real credentials.
 */

import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import Member from '../models/Member';
import TenXContribution from '../models/TenXContribution';
import TenXPeriod from '../models/TenXPeriod';
import Saving from '../models/Saving';
import Loan from '../models/Loan';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { processRepayment } from './repayments';
import { notifyStaff } from '../utils/notify';
import { recalculateMemberRiskScore } from '../utils/riskScore';
import { recordSavingsDeposit } from '../utils/depositLedger';
import { createTransactionRef } from '../utils/transactionRef';

const router = Router();

// ─── In-memory: PayHero payment-link payments (not STK) ───────────────────────
// Created when member clicks "Pay via PayHero"; confirmed when member clicks "I've Paid"

interface PendingManualPayment {
  type: 'deposit' | 'loan_repay';
  memberId: string;
  loanId?: string;
  amount: number;
  phone: string; // 254xx format
  txnRef: string; // DB transaction ref
  createdAt: number;
}

const pendingManualPayments = new Map<string, PendingManualPayment>(); // key: txnRef

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min TTL
  for (const [k, v] of pendingManualPayments.entries()) {
    if (v.createdAt < cutoff) pendingManualPayments.delete(k);
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
  cyclePayment?: boolean;
  cycleNumber?: number;
  tenXContributionId?: string;
    walletPayment?: boolean;
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

type PayHeroPaymentResponse = LooseRecord & {
  success: boolean;
  provider: 'payhero';
  checkoutRequestId?: string;
  providerReference?: string;
  externalReference?: string;
  status?: string;
  message?: unknown;
};

type PayHeroCustomerContext = {
  name?: string | null;
  email?: string | null;
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

function extractProviderErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  if (!record) return fallback;

  const candidates = [
    record.message,
    record.error,
    record.error_message,
    record.errorMessage,
    record.detail,
    getPathValue(record, ['data', 'message']),
    getPathValue(record, ['data', 'error']),
    getPathValue(record, ['data', 'error_message']),
    getPathValue(record, ['data', 'errorMessage']),
    getPathValue(record, ['data', 'detail']),
  ];

  const message = candidates.find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  if (message) return message.trim();

  const errors = record.errors ?? getPathValue(record, ['data', 'errors']);
  if (Array.isArray(errors)) {
    const messages = errors
      .map((item) => {
        if (typeof item === 'string') return item;
        const itemRecord = asRecord(item);
        return itemRecord ? toErrorMessage(itemRecord, '') : '';
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }

  if (errors && typeof errors === 'object') {
    const messages = Object.entries(errors as Record<string, unknown>)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) return value.map((item) => `${field}: ${String(item)}`);
        return [`${field}: ${String(value)}`];
      })
      .filter((value) => value.trim());
    if (messages.length > 0) return messages.join('; ');
  }

  return fallback;
}

function normalizePayHeroBaseUrl(rawUrl?: string): string {
  const value = String(rawUrl || '').trim().replace(/\/+$/, '');
  return value || 'https://backend.payhero.co.ke';
}

function hasPayHeroCredentials(): boolean {
  return Boolean(
    process.env.PAYHERO_API_USERNAME &&
    process.env.PAYHERO_API_PASSWORD &&
    process.env.PAYHERO_CALLBACK_URL
  );
}

function parsePositiveId(value: string | undefined, name: string): number {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
    const err = new Error(`PayHero ${name} must be a positive numeric ID`) as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }
  return Number(normalized);
}

function splitCustomerName(name?: string | null): { first_name: string; last_name: string } {
  const normalized = String(name || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return { first_name: 'SMCF', last_name: 'Member' };
  const parts = normalized.split(' ');
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: 'Member' };
  }
  return {
    first_name: parts.shift() || 'SMCF',
    last_name: parts.join(' ') || 'Member',
  };
}

async function discoverPayHeroNetwork(baseUrl: string, authHeader: string, countryCode = 'KE') {
  const endpoints = [
    `${baseUrl}/api/global/discovery/payment-world/country/${encodeURIComponent(countryCode)}`,
    `${baseUrl}/api/global/discovery/payment-world/country?country=${encodeURIComponent(countryCode)}`,
  ];

  let lastMessage = '';
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });

      const text = await res.text().catch(() => '');
      let data: unknown = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || 'Unexpected discovery response' };
      }

      if (!res.ok) {
        lastMessage = extractProviderErrorMessage(data, `PayHero discovery failed with HTTP ${res.status}`);
        continue;
      }

      const record = asRecord(data);
      const payload = asRecord(record?.data) ?? record ?? {};
      const providerNetworks = asRecord(getPathValue(payload, ['provider_networks']))
        ?? asRecord(getPathValue(payload, ['data', 'provider_networks']))
        ?? asRecord(getPathValue(data, ['provider_networks']));

      const candidates = providerNetworks?.['m-pesa'] ?? providerNetworks?.m_pesa ?? providerNetworks?.mpesa;
      if (Array.isArray(candidates) && candidates.length > 0) {
        return candidates[0] as LooseRecord;
      }

      lastMessage = 'PayHero discovery completed but no m-pesa provider network was returned';
    } catch (err) {
      lastMessage = toErrorMessage(err, 'PayHero discovery failed');
    }
  }

  const error = new Error(lastMessage || 'Unable to discover PayHero provider network') as Error & { statusCode?: number };
  error.statusCode = 502;
  throw error;
}

async function sendPayHeroGlobalPayment(
  phone: string,
  amount: number,
  reference: string,
  description: string,
  customerContext?: PayHeroCustomerContext,
): Promise<PayHeroPaymentResponse> {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;
  const callbackUrl = process.env.PAYHERO_CALLBACK_URL;
  const vendorId = process.env.PAYHERO_VENDOR_ID || process.env.PAYHERO_ACCOUNT_ID;

  if (!username || !password || !callbackUrl || !vendorId) {
    const err = new Error('PayHero payment configuration is incomplete') as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const baseUrl = normalizePayHeroBaseUrl(process.env.PAYHERO_API_URL);
  const network = await discoverPayHeroNetwork(baseUrl, `Basic ${auth}`, 'KE');
  const { first_name, last_name } = splitCustomerName(customerContext?.name);
  const customerEmail = String(customerContext?.email || '').trim() || 'payments@smcf.app';
  const customerPhone = `+${normalizePhone(phone)}`;

  const requestBody = {
    request_type: 'payment',
    transaction_channel: 'momo',
    provider: 'yellowcard',
    amount,
    currency: 'KES',
    country: 'KE',
    customer: {
      first_name,
      last_name,
      email: customerEmail,
      phone: customerPhone,
      country: 'KE',
    },
    vendor_config: {
      vendor_id: parsePositiveId(vendorId, 'vendor ID'),
    },
    provider_config: network,
    payment_config: {
      account_number: customerPhone,
      callback_url: callbackUrl,
    },
    external_reference: reference,
    description,
  };

  const requestUrl = `${baseUrl}/api/global/payments`;
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error('[PayHero] global payment request failed', {
      endpoint: requestUrl,
      reference,
      amount,
      phoneSuffix: normalizePhoneForPayHero(phone).slice(-4),
      error: toErrorMessage(err, 'Network error'),
    });
    const networkError = new Error('PayHero could not be reached. Please try again.') as Error & { statusCode?: number };
    networkError.statusCode = 502;
    throw networkError;
  }

  const responseText = await res.text().catch(() => '');
  let data: unknown = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: 'Unexpected response from PayHero' };
  }
  const dataRecord = asRecord(data);
  const checkoutRequestId = extractCheckoutRequestId(data);

  if (!res.ok || !checkoutRequestId) {
    const providerCode = dataRecord?.code ?? dataRecord?.error_code ?? dataRecord?.errorCode ?? dataRecord?.status_code ?? null;
    const providerMessage = extractProviderErrorMessage(data, 'Payment request could not be initiated. Please try again.');
    const message = providerCode === 'resource_not_found'
      ? 'PayHero could not resolve the requested resource for this tenant. Check that the API username/password belong to the same PayHero workspace as the discovered network and vendor ID.'
      : providerMessage;

    console.error('[PayHero] global payment rejected', {
      endpoint: requestUrl,
      httpStatus: res.status,
      reference,
      amount,
      phoneSuffix: normalizePhone(phone).slice(-4),
      providerCode,
      message,
    });

    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = res.ok ? 502 : res.status >= 400 && res.status < 500 ? 400 : 502;
    throw err;
  }

  const providerReference = [
    getPathValue(data, ['merchant_reference']),
    getPathValue(data, ['merchantReference']),
    getPathValue(data, ['transaction_reference']),
    getPathValue(data, ['transactionReference']),
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));

  return {
    success: true,
    provider: 'payhero',
    checkoutRequestId,
    providerReference,
    externalReference: reference,
    status: typeof dataRecord?.status === 'string' ? dataRecord.status : 'accepted',
    message: dataRecord?.message,
  };
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

/** Query PayHero for the current status of an STK push by its request ID. */
async function queryPayHeroStatus(checkoutRequestId: string): Promise<{
  success: boolean;
  status: string;
  mpesaReceiptNumber?: string;
  resultCode?: string | number;
  resultDesc?: string;
  amount?: number;
}> {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;
  const baseUrl = normalizePayHeroBaseUrl(process.env.PAYHERO_API_URL);
  try {
    if (!username || !password) return { success: false, status: 'pending' };
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const res = await fetch(`${baseUrl}/api/global/transaction-status`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: checkoutRequestId }),
    });
    if (!res.ok) return { success: false, status: 'pending' };
    const data: unknown = await res.json().catch(() => ({}));
    const dataRecord = asRecord(data);
    if (!dataRecord) return { success: false, status: 'pending' };
    const payload = asRecord(getPathValue(dataRecord, ['data', 'response'])) ?? asRecord(dataRecord.data) ?? dataRecord;
    const rawResultCode = payload.ResultCode ?? payload.resultCode ?? dataRecord.ResultCode ?? dataRecord.resultCode;
    const resultCode = typeof rawResultCode === 'string' || typeof rawResultCode === 'number' ? rawResultCode : undefined;
    const receipt = payload.MpesaReceiptNumber ?? payload.mpesaReceiptNumber ?? payload.receipt_number ?? payload.receiptNumber ?? payload.TransactionID ?? payload.transactionId;
    const resultDesc = payload.ResultDesc ?? payload.resultDesc ?? payload.ResultDescription ?? payload.message ?? dataRecord.message;
    const rawAmount = payload.Amount ?? payload.amount;
    const status = String(payload.status ?? payload.Status ?? '').toLowerCase();
    const isSuccess = (String(resultCode) === '0' || ['success', 'successful', 'completed', 'complete'].includes(status)) && Boolean(receipt);
    const isFailed = !isSuccess && ((resultCode !== undefined && String(resultCode) !== '0' && String(resultCode) !== 'pending') || ['failed', 'cancelled', 'canceled', 'rejected'].includes(status));
    return {
      success: true,
      status: isSuccess ? 'success' : isFailed ? 'failed' : 'pending',
      mpesaReceiptNumber: typeof receipt === 'string' ? receipt : String(receipt || ''),
      resultCode,
      resultDesc: typeof resultDesc === 'string' ? resultDesc : undefined,
      amount: rawAmount === undefined ? undefined : Number(rawAmount),
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

    const { status, mpesaReceiptNumber, amount: paidAmt, resultDesc } = await queryPayHeroStatus(checkoutRequestId);

    if (status === 'success' && mpesaReceiptNumber) {
      const confirmedAmount = paidAmt || amount;
      try {
        if (type === 'deposit') {
          const pending = pendingDeposits.get(checkoutRequestId);
          await settlePendingDeposit({
            checkoutRequestId,
            memberId,
            amount: confirmedAmount,
            phone,
            mpesaRef: mpesaReceiptNumber,
            sourceLabel: 'M-Pesa STK',
            cycleNumber: pending?.cyclePayment ? pending.cycleNumber : undefined,
            tenXContributionId: pending?.tenXContributionId,
            walletPayment: pending?.walletPayment,
            processedAt: new Date(),
          });
          const d = pendingDeposits.get(checkoutRequestId);
          if (d) { d.status = 'success'; d.mpesaRef = mpesaReceiptNumber; d.amount = confirmedAmount; pendingDeposits.set(checkoutRequestId, d); }

        } else if (type === 'share_purchase') {
          const shareAmounts = calculateTransactionAmounts(confirmedAmount, 'share_purchase');
          await Transaction.findByIdAndUpdate(pendingTxnId, {
            status: 'completed',
            mpesaRef: mpesaReceiptNumber,
            amount: confirmedAmount,
            ...shareAmounts,
            description: `M-Pesa Share Purchase — Ref: ${mpesaReceiptNumber} — ${phone}`,
            processedAt: new Date(),
            depositProcessed: true,
          });
          await Member.findByIdAndUpdate(memberId, { $inc: { shares: shareAmounts.netAmount } });
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
          const repaymentAmounts = calculateTransactionAmounts(confirmedAmount, 'loan_repayment');
          // Delete placeholder, processRepayment creates the real transaction
          await Transaction.findByIdAndDelete(pendingTxnId);
          const result = await processRepayment(
            loanId, repaymentAmounts.netAmount, 'mpesa',
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

/** Initiate a PayHero M-Pesa collection and return the normalized provider response. */
async function sendPayHeroChannelPayment(
  phone: string,
  amount: number,
  reference: string,
  description: string,
): Promise<PayHeroPaymentResponse> {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;
  const channelId = process.env.PAYHERO_CHANNEL_ID;
  const accountId = process.env.PAYHERO_ACCOUNT_ID;
  const callbackUrl = process.env.PAYHERO_CALLBACK_URL;
  if (!username || !password || !channelId || !accountId || !callbackUrl) {
    const err = new Error('PayHero channel payment configuration is incomplete') as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const requestUrl = `${normalizePayHeroBaseUrl(process.env.PAYHERO_API_URL)}/api/v2/payments`;
  const requestBody = {
    amount,
    currency: 'KES',
    phone_number: normalizePhoneForPayHero(phone),
    provider: 'm-pesa',
    channel_id: Number(channelId) || channelId,
    account_id: Number(accountId) || accountId,
    external_reference: reference,
    callback_url: callbackUrl,
    description,
  };

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(requestUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error('[PayHero] channel request failed', { endpoint: requestUrl, channelId, reference, amount, phoneSuffix: normalizePhoneForPayHero(phone).slice(-4), error: toErrorMessage(err, 'Network error') });
    const networkError = new Error('PayHero could not be reached. Please try again.') as Error & { statusCode?: number };
    networkError.statusCode = 502;
    throw networkError;
  }

  const responseText = await res.text().catch(() => '');
  let data: unknown = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = { message: 'Unexpected response from PayHero' }; }
  const dataRecord = asRecord(data);
  const checkoutRequestId = extractCheckoutRequestId(data);
  if (!res.ok || !checkoutRequestId) {
    const message = extractProviderErrorMessage(data, 'Payment request could not be initiated. Please try again.');
    console.error('[PayHero] channel payment rejected', {
      endpoint: requestUrl,
      httpStatus: res.status,
      channelId,
      reference,
      amount,
      phoneSuffix: normalizePhoneForPayHero(phone).slice(-4),
      providerCode: dataRecord?.code ?? dataRecord?.error_code ?? dataRecord?.errorCode ?? null,
      message,
    });
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = res.ok ? 502 : res.status >= 400 && res.status < 500 ? 400 : 502;
    throw err;
  }

  const providerReference = [
    getPathValue(data, ['merchant_reference']),
    getPathValue(data, ['merchantReference']),
    getPathValue(data, ['transaction_reference']),
    getPathValue(data, ['transactionReference']),
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return {
    success: true,
    provider: 'payhero',
    checkoutRequestId,
    providerReference,
    externalReference: reference,
    status: typeof dataRecord?.status === 'string' ? dataRecord.status : 'accepted',
    message: dataRecord?.message,
  };
}

async function sendPayHeroSTK(
  phone: string,
  amount: number,
  reference: string,
  description: string,
  customerContext?: PayHeroCustomerContext,
): Promise<PayHeroPaymentResponse> {
  if (!hasPayHeroCredentials()) {
    const err = new Error('PayHero payment configuration is incomplete') as Error & { statusCode?: number };
    err.statusCode = 503;
    throw err;
  }

  const paymentMode = String(process.env.PAYHERO_PAYMENT_MODE || '').trim().toLowerCase();
  if (paymentMode === 'channel' || (!paymentMode && process.env.PAYHERO_CHANNEL_ID && process.env.PAYHERO_ACCOUNT_ID)) {
    return sendPayHeroChannelPayment(phone, amount, reference, description);
  }
  return sendPayHeroGlobalPayment(phone, amount, reference, description, customerContext);
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
    getPathValue(payload, ['data', 'request_id']),
    getPathValue(payload, ['data', 'CheckoutRequestID']),
    getPathValue(payload, ['data', 'checkout_request_id']),
    getPathValue(payload, ['data', 'reference']),
    getPathValue(payload, ['CheckoutRequestID']),
    getPathValue(payload, ['checkoutRequestId']),
    getPathValue(payload, ['checkout_request_id']),
    getPathValue(payload, ['transactionReference']),
    getPathValue(payload, ['request_id']),
    getPathValue(payload, ['requestId']),
    getPathValue(payload, ['reference']),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
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

// PayHero requires 07XXXXXXXXX / 01XXXXXXXXX format (not 254-prefix)
function normalizePhoneForPayHero(raw: string): string {
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

const UNIFIED_TRANSACTION_FEE = 10;
const REGISTRATION_FEE_AMOUNT = 100;
const REGISTRATION_GROSS_AMOUNT = REGISTRATION_FEE_AMOUNT + UNIFIED_TRANSACTION_FEE;

type FeeableTransactionType = 'deposit' | 'wallet_deposit' | 'share_purchase' | 'registration_fee' | 'loan_repayment';

function calculateTransactionAmounts(grossAmount: number, type: FeeableTransactionType, cyclePayment = false) {
  const gross = Math.round(Number(grossAmount));
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error('Payment amount must be a positive number');
  }
  const fee = type === 'deposit' && cyclePayment ? 0 : UNIFIED_TRANSACTION_FEE;
  const net = gross - fee;
  if (fee > 0 && net <= 0) {
    throw new Error(`Amount must be greater than KES ${fee} after the transaction fee`);
  }
  return {
    grossAmount: gross,
    feeAmount: fee,
    netAmount: net,
    feeType: fee > 0 ? 'unified_transaction_fee' as const : 'none' as const,
  };
}

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
  const feeAmounts = calculateTransactionAmounts(amount, 'registration_fee');

  if (feeAmounts.grossAmount !== REGISTRATION_GROSS_AMOUNT) {
    throw new Error(`Registration payment must be exactly KES ${REGISTRATION_GROSS_AMOUNT}`);
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
      amount: feeAmounts.grossAmount,
      grossAmount: feeAmounts.grossAmount,
      feeAmount: feeAmounts.feeAmount,
      netAmount: feeAmounts.netAmount,
      feeType: feeAmounts.feeType,
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
      amount: feeAmounts.grossAmount,
      grossAmount: feeAmounts.grossAmount,
      feeAmount: feeAmounts.feeAmount,
      netAmount: feeAmounts.netAmount,
      feeType: feeAmounts.feeType,
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
  cycleNumber?: number;
  tenXContributionId?: string;
  walletPayment?: boolean;
  processedAt?: Date;
}) {
  const cycleNumber = params.cycleNumber;
  const feeAmounts = calculateTransactionAmounts(
    params.amount,
    params.walletPayment ? 'wallet_deposit' : 'deposit',
    Boolean(cycleNumber),
  );
  const amount = feeAmounts.grossAmount;
  const creditedAmount = feeAmounts.netAmount;

  const processedAt = params.processedAt ?? new Date();
  const existingCompletedTxn = await Transaction.findOne({
    type: params.walletPayment ? 'wallet_deposit' : 'deposit',
    mpesaRef: params.mpesaRef,
    status: 'completed',
  }).select('_id');

  if (existingCompletedTxn) {
    return { applied: false, duplicate: true };
  }

  const claimedTxn = await Transaction.findOneAndUpdate(
    {
      checkoutRequestId: params.checkoutRequestId,
      type: params.walletPayment ? 'wallet_deposit' : 'deposit',
      depositProcessed: { $ne: true },
    },
    {
      $set: {
        status: 'completed',
        mpesaRef: params.mpesaRef,
        paymentGateway: 'payhero',
        cycleNumber: cycleNumber ?? null,
        amount,
        grossAmount: amount,
        feeAmount: feeAmounts.feeAmount,
        netAmount: creditedAmount,
        feeType: feeAmounts.feeType,
        description: params.walletPayment
          ? `Wallet deposit via PayHero STK - Ref: ${params.mpesaRef} - ${params.phone || 'unknown'}`
          : cycleNumber
          ? `Cycle ${cycleNumber} contribution via PayHero STK — Ref: ${params.mpesaRef} — ${params.phone || 'unknown'}`
          : `M-Pesa Savings Deposit — Ref: ${params.mpesaRef} — ${params.phone || 'unknown'}`,
        processedAt,
        depositProcessed: true,
      },
    },
    { new: true }
  ).select('_id status depositProcessed');

  if (!claimedTxn) {
    const pendingTxn = await Transaction.findOne({
      checkoutRequestId: params.checkoutRequestId,
      type: params.walletPayment ? 'wallet_deposit' : 'deposit',
    }).select('_id status depositProcessed');

    if (pendingTxn) {
      return { applied: false, duplicate: true };
    }

    throw new Error('Pending deposit transaction not found');
  }

  if (params.tenXContributionId) {
    await TenXContribution.findByIdAndUpdate(params.tenXContributionId, {
      status: 'SUCCESSFUL',
      payment_date: processedAt,
      transaction_reference: params.mpesaRef,
      $inc: { amount_paid: creditedAmount },
    });
  }

  if (params.walletPayment) {
    const existingWalletRecord = await Saving.findOne({
      member_id: params.memberId,
      transaction_ref: params.mpesaRef,
      transaction_type: 'deposit',
    });
    if (existingWalletRecord) return { applied: false, duplicate: true };

    const lastWalletRecord = await Saving.findOne({ member_id: params.memberId }).sort({ created_at: -1 });
    const balanceBefore = Number(lastWalletRecord?.balance_after || 0);
    const unlockDate = new Date(processedAt);
    unlockDate.setMonth(unlockDate.getMonth() + 3);
    await Saving.create({ member_id: params.memberId, amount: creditedAmount, transaction_type: 'deposit', balance_before: balanceBefore, balance_after: balanceBefore + creditedAmount, payment_method: 'mpesa', transaction_ref: params.mpesaRef, status: 'completed', lock_period_months: 3, unlock_date: unlockDate, maturity_status: 'locked', notes: `Wallet deposit via M-Pesa STK (KES ${feeAmounts.feeAmount} transaction fee)` });
  } else if (!cycleNumber && !params.tenXContributionId) {
    await recordSavingsDeposit({
      memberId: params.memberId,
      amount: creditedAmount,
      reference: params.mpesaRef,
      sourceLabel: params.sourceLabel,
      processedAt,
      note: params.phone ? `Phone: ${params.phone}` : undefined,
      notificationPath: '/accounts',
    });
  }

  if (cycleNumber) {
    await recordCyclePayment({
      memberId: params.memberId,
      amount: creditedAmount,
      phone: params.phone,
      cycleNumber,
      checkoutRequestId: params.checkoutRequestId,
      mpesaRef: params.mpesaRef,
      processedAt,
    });
  }

  return { applied: true, duplicate: false, ...feeAmounts };
}

async function recordCyclePayment(params: {
  memberId: string;
  amount: number;
  phone?: string;
  cycleNumber: number;
  checkoutRequestId: string;
  mpesaRef: string;
  processedAt: Date;
}) {
  const database = mongoose.connection.db;
  if (!database) throw new Error('Database connection unavailable');

  const payments = database.collection('payments');
  const existing = await payments.findOne({
    $or: [
      { mpesa_transaction_id: params.mpesaRef },
      { checkout_request_id: params.checkoutRequestId },
    ],
  });
  if (existing) return existing;

  const memberObjectId = new mongoose.Types.ObjectId(params.memberId);
  const result = await payments.insertOne({
    member_id: memberObjectId,
    paid_by: memberObjectId,
    amount: params.amount,
    phone: params.phone || '',
    mpesa_transaction_id: params.mpesaRef,
    checkout_request_id: params.checkoutRequestId,
    transaction_reference: params.mpesaRef,
    payment_method: 'payhero',
    status: 'completed',
    type: 'cycle_payment',
    cycle_number: params.cycleNumber,
    date: params.processedAt,
    created_at: params.processedAt,
    deposit_processed: true,
    notes: `Cycle ${params.cycleNumber} contribution via PayHero STK`,
  });
  await Member.findByIdAndUpdate(memberObjectId, {
    $inc: { total_cycle_contribution: params.amount, cycle_contribution_count: 1 },
    $set: { payment_status: 'paid', payment_date: params.processedAt },
  });
  await advanceCycleWhenComplete(params.cycleNumber);
  return { _id: result.insertedId };
}

async function advanceCycleWhenComplete(cycleNumber: number) {
  const database = mongoose.connection.db;
  if (!database) return;
  const cycles = database.collection('cycles');
  const currentCycle = await cycles.findOne({ cycle_number: cycleNumber, status: 'active' });
  if (!currentCycle) return;
  const selectedIds = Array.isArray(currentCycle.member_ids)
    ? currentCycle.member_ids.map((id: unknown) => String(id))
    : (await Member.find({ status: { $ne: 'deleted' } }).select('_id').lean()).map((member) => String(member._id));
  if (selectedIds.length === 0) return;
  const paidCount = await database.collection('payments').countDocuments({
    cycle_number: cycleNumber,
    status: 'completed',
    member_id: { $in: selectedIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  if (paidCount < selectedIds.length) return;
  const closed = await cycles.updateOne(
    { _id: currentCycle._id, status: 'active' },
    { $set: { status: 'completed', recipient_paid: true, updated_at: new Date() } },
  );
  if (closed.modifiedCount !== 1) return;
  const nextNumber = Number(currentCycle.cycle_number) + 1;
  await cycles.insertOne({
    cycle_number: nextNumber,
    start_date: new Date(),
    end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'active',
    contribution_amount: currentCycle.contribution_amount || 224,
    expected_amount: selectedIds.length * Number(currentCycle.contribution_amount || 224),
    total_members: selectedIds.length,
    member_ids: selectedIds.map((id) => new mongoose.Types.ObjectId(id)),
    paid_members_count: 0,
    total_amount_collected: 0,
    next_recipient: selectedIds[0] ? new mongoose.Types.ObjectId(selectedIds[0]) : null,
    recipient_paid: false,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await database.collection('members').updateMany(
    { _id: { $in: selectedIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { $set: { payment_status: 'pending', payment_date: null } },
  );
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
  walletPayment?: boolean;
}) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  return Transaction.findOne({
    memberId: params.memberId,
    type: params.walletPayment ? 'wallet_deposit' : 'deposit',
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
  cycleNumber?: number;
  walletPayment?: boolean;
}) {
  const transactionType = params.walletPayment ? 'wallet_deposit' : 'deposit';
  const feeAmounts = calculateTransactionAmounts(
    params.amount,
    transactionType,
    Boolean(params.cycleNumber),
  );
  const description = params.walletPayment
    ? `Wallet deposit - STK Pending - ${params.phone}`
    : `M-Pesa Savings Deposit — STK Pending — ${params.phone}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const txnRef = createTransactionRef();

    try {
      const txnDoc = await Transaction.findOneAndUpdate(
        {
          checkoutRequestId: params.checkoutRequestId,
          type: transactionType,
        },
        {
          $setOnInsert: {
            transactionRef: txnRef,
            memberId: params.memberId,
            type: transactionType,
            amount: feeAmounts.grossAmount,
            ...feeAmounts,
            description,
            status: 'pending',
            checkoutRequestId: params.checkoutRequestId,
            cycleNumber: params.cycleNumber ?? null,
            paymentGateway: 'payhero',
            createdBy: null,
          },
          $set: params.cycleNumber ? { cycleNumber: params.cycleNumber } : {},
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
        type: transactionType,
      }).select('_id checkoutRequestId memberId amount status mpesaRef depositProcessed');

      if (existingByCheckout) {
        return existingByCheckout;
      }

      const existingSimilarPending = await findReusablePendingDepositTransaction({
        memberId: params.memberId,
        amount: params.amount,
        phone: params.phone,
        walletPayment: params.walletPayment,
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

router.get('/provider-diagnostics', protect, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const username = process.env.PAYHERO_API_USERNAME;
  const vendorId = process.env.PAYHERO_VENDOR_ID || process.env.PAYHERO_ACCOUNT_ID;
  const channelId = process.env.PAYHERO_CHANNEL_ID;
  const accountId = process.env.PAYHERO_ACCOUNT_ID;
  const tillNumber = process.env.PAYHERO_TILL_NUMBER || '6938069';
  const configuredMode = String(process.env.PAYHERO_PAYMENT_MODE || '').trim().toLowerCase();
  const paymentMode = configuredMode || (channelId && accountId ? 'channel' : 'global');
  const callbackUrl = process.env.PAYHERO_CALLBACK_URL;
  const apiUrl = normalizePayHeroBaseUrl(process.env.PAYHERO_API_URL);
  const vendorIdIsValid = /^\d+$/.test(String(vendorId || '').trim()) && Number(vendorId) > 0;
  const channelIdIsValid = /^\d+$/.test(String(channelId || '').trim()) && Number(channelId) > 0;
  const accountIdIsValid = /^\d+$/.test(String(accountId || '').trim()) && Number(accountId) > 0;

  return res.json({
    success: true,
    data: {
      configured: {
        username: !!username,
        vendorId: !!vendorId,
        channelId: !!channelId,
        accountId: !!accountId,
        callbackUrl: !!callbackUrl,
        vendorIdIsValid,
        channelIdIsValid,
        accountIdIsValid,
        readyForCollection: paymentMode === 'channel'
          ? Boolean(username && channelIdIsValid && accountIdIsValid && callbackUrl)
          : Boolean(username && vendorIdIsValid && callbackUrl),
      },
      values: {
        apiUrl,
        callbackUrl,
        usernameMasked: maskSecret(username),
        vendorId: vendorId ? maskSecret(vendorId) : null,
        channelId,
        accountId: accountId ? maskSecret(accountId) : null,
        tillNumber: tillNumber ? maskSecret(tillNumber) : null,
        paymentMode,
        service: 'smcf-sacco-backend',
        commit: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || null,
      },
      fingerprints: {
        username: envFingerprint(username),
      },
      notes: paymentMode === 'channel'
        ? 'Payments use the PayHero v2 channel flow. The channel ID must identify the active Till channel, while account ID must be the PayHero account resource ID, not the Till number.'
        : 'Payments use the PayHero global flow. Set PAYHERO_PAYMENT_MODE=channel with the matching PayHero account and channel IDs to route through a specific channel.',
    },
  });
});

// ─── POST /api/mpesa/deposit ─────────────────────────────────────────────────
// Initiates an STK Push to the member's phone.
// Body: { memberId: string, amount: number, phone: string }

router.post('/deposit', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, amount, phone, paymentType, cycleNumber: requestedCycleNumber } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });
    if (!phone)    return res.status(400).json({ success: false, message: 'Phone number is required' });
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: 'Deposit amount must be positive' });

    const payHeroMember = await Member.findById(memberId).select('name email phone');
    if (!payHeroMember) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.round(Number(amount));
    const cyclePayment = paymentType === 'cycle';
    const tenXPayment = paymentType === 'tenx';
    const walletPayment = paymentType === 'wallet';
    let tenXContributionId: string | undefined;
    let cycleNumber = Number(requestedCycleNumber) || undefined;

    if (cyclePayment && !cycleNumber && mongoose.connection.db) {
      const activeCycle = await mongoose.connection.db.collection('cycles').findOne(
        { status: 'active' },
        { sort: { cycle_number: -1 } },
      );
      cycleNumber = Number(activeCycle?.cycle_number) || undefined;
    }
    if (cyclePayment && !cycleNumber) {
      return res.status(400).json({ success: false, message: 'No active cycle is available for payment' });
    }
    let feeAmounts;
    try {
      feeAmounts = calculateTransactionAmounts(numAmount, walletPayment ? 'wallet_deposit' : 'deposit', cyclePayment);
    } catch (error) {
      return res.status(400).json({ success: false, message: toErrorMessage(error, 'Invalid deposit amount') });
    }
    if (cyclePayment && mongoose.connection.db) {

          if (tenXPayment) {
            const member = await Member.findOne({ _id: memberId, is10XMember: true }).select('_id');
            const periodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            const period = await TenXPeriod.findOneAndUpdate(
              { period: periodKey },
              { $setOnInsert: { period: periodKey, due_amount: 1000, status: 'OPEN' } },
              { upsert: true, new: true, setDefaultsOnInsert: true },
            );
            if (!member) return res.status(403).json({ success: false, message: 'You are not enrolled in the 10X Group' });
            if (!period) return res.status(400).json({ success: false, message: 'No 10X contribution period is open' });
            const pending = await TenXContribution.findOne({ member_id: member._id, period_id: period._id, status: 'PENDING' });
            if (pending) return res.status(409).json({ success: false, message: 'A 10X payment is already pending', data: pending });
            const existingContribution = await TenXContribution.findOne({ member_id: member._id, period_id: period._id, status: 'SUCCESSFUL' });
            const contribution = existingContribution
              ? await TenXContribution.findByIdAndUpdate(existingContribution._id, { status: 'PENDING', payment_method: 'mpesa', transaction_reference: `10X-STK-${Date.now()}` }, { new: true })
              : await TenXContribution.create({
                  member_id: member._id,
                  period_id: period._id,
                  period: period.period,
                  amount_due: period.due_amount,
                  amount_paid: 0,
                  payment_method: 'mpesa',
                  transaction_reference: `10X-STK-${Date.now()}`,
                  status: 'PENDING',
                  source: 'AUTOMATIC',
                });
            tenXContributionId = contribution ? String(contribution._id) : undefined;
          }
      const activeCycle = await mongoose.connection.db.collection('cycles').findOne(
        { cycle_number: cycleNumber },
        { sort: { cycle_number: -1 } },
      );
      const selectedMemberIds = Array.isArray(activeCycle?.member_ids)
        ? activeCycle.member_ids.map((id: unknown) => String(id))
        : null;
      if (selectedMemberIds && !selectedMemberIds.includes(String(memberId))) {
        return res.status(403).json({ success: false, message: 'You are not selected to participate in this cycle' });
      }
    }

    const reusablePendingTxn = await findReusablePendingDepositTransaction({
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      walletPayment,
    });

    if (reusablePendingTxn?.checkoutRequestId) {
      const existingCheckoutRequestId = String(reusablePendingTxn.checkoutRequestId);

      pendingDeposits.set(existingCheckoutRequestId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        cyclePayment,
        cycleNumber,
        tenXContributionId,
        walletPayment,
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
          ...feeAmounts,
        },
      });
    }

    // ── Simulation mode (no credentials set) ──────────────────────────────
    const hasCredentials = hasPayHeroCredentials();

    if (!hasCredentials) {
      const simId = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      pendingDeposits.set(simId, {
        memberId,
        amount: numAmount,
        phone: mpesaPhone,
        status: 'pending',
        cyclePayment,
        cycleNumber,
        tenXContributionId,
        walletPayment,
        createdAt: Date.now(),
      });

      // Auto-complete after 5 s (simulate customer entering PIN)
      setTimeout(async () => {
        const d = pendingDeposits.get(simId);
        if (!d || d.status !== 'pending') return;
        try {
          const ref = `SIM${Date.now()}`;
          await recordDeposit(d.memberId, d.amount, d.phone, ref, d.cycleNumber, simId, d.tenXContributionId, d.walletPayment);
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
        data: { checkoutRequestId: simId, ...feeAmounts },
      });
    }

    // ── Real STK Push via PayHero ────────────────────────────────────
    const stkData = await sendPayHeroSTK(
      mpesaPhone,
      numAmount,
      'SMCF-SAVINGS',
      tenXPayment ? 'SMCF 10X Contribution' : walletPayment ? 'SMCF Wallet Deposit' : 'SMCF SACCO Savings Deposit',
      { name: String(payHeroMember.name || ''), email: payHeroMember.email ? String(payHeroMember.email) : null }
    );
    // PayHero proxies the Safaricom response — CheckoutRequestID may be top-level
    // or nested under data depending on the PayHero version.
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || 'Payment request could not be initiated. Please try again.',
      });
    }

    // Create (or reuse) DB record immediately so retries remain idempotent.
    const txnDoc = await createOrGetPendingDepositTransaction({
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      checkoutRequestId,
      cycleNumber,
      walletPayment,
    });
    if (tenXContributionId) {
      await TenXContribution.findByIdAndUpdate(tenXContributionId, { payment_id: txnDoc._id });
    }

    const mapStatus: PendingDeposit['status'] =
      txnDoc.status === 'completed' ? 'success' : txnDoc.status === 'failed' ? 'failed' : 'pending';

    pendingDeposits.set(checkoutRequestId, {
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: mapStatus,
      mpesaRef: txnDoc.mpesaRef || undefined,
      cyclePayment,
      cycleNumber,
      tenXContributionId,
      walletPayment,
      createdAt: Date.now(),
    });

    // Start server-side PayHero polling — no callback dependency
    if (txnDoc.status === 'pending' && txnDoc.depositProcessed !== true) {
      pollSACCOPayment('deposit', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone).catch(
        (err) => console.error('[pollSACCOPayment deposit]', err)
      );
    }

    return res.json({ success: true, data: { checkoutRequestId, ...feeAmounts } });
  } catch (err) {
    next(err);
  }
});

async function recordDeposit(memberId: string, amount: number, phone: string, mpesaRef: string, cycleNumber?: number, checkoutRequestId?: string, tenXContributionId?: string, walletPayment?: boolean) {
  const feeAmounts = calculateTransactionAmounts(amount, walletPayment ? 'wallet_deposit' : 'deposit', Boolean(cycleNumber));
  const creditedAmount = feeAmounts.netAmount;
  const transactionRef = createTransactionRef();
  await Transaction.create({
    transactionRef,
    memberId,
    type: walletPayment ? 'wallet_deposit' : 'deposit',
    paymentGateway: 'payhero',
    cycleNumber: cycleNumber ?? null,
    amount: feeAmounts.grossAmount,
    ...feeAmounts,
    description: walletPayment
      ? `Wallet deposit via PayHero STK - Ref: ${mpesaRef} - ${phone}`
      : cycleNumber
      ? `Cycle ${cycleNumber} contribution via PayHero STK — Ref: ${mpesaRef} — ${phone}`
      : `M-Pesa Savings Deposit — Ref: ${mpesaRef} — ${phone}`,
    status: 'completed',
    checkoutRequestId: checkoutRequestId || null,
    mpesaRef,
    createdBy: null,
  });

  if (walletPayment) {
    const lastWalletRecord = await Saving.findOne({ member_id: memberId }).sort({ created_at: -1 });
    const balanceBefore = Number(lastWalletRecord?.balance_after || 0);
    const unlockDate = new Date();
    unlockDate.setMonth(unlockDate.getMonth() + 3);
    await Saving.create({ member_id: memberId, amount: creditedAmount, transaction_type: 'deposit', balance_before: balanceBefore, balance_after: balanceBefore + creditedAmount, payment_method: 'mpesa', transaction_ref: mpesaRef, status: 'completed', lock_period_months: 3, unlock_date: unlockDate, maturity_status: 'locked', notes: `Wallet deposit via M-Pesa STK (KES ${feeAmounts.feeAmount} transaction fee)` });
  } else if (tenXContributionId) {
    await TenXContribution.findByIdAndUpdate(tenXContributionId, {
      status: 'SUCCESSFUL', payment_date: new Date(), transaction_reference: mpesaRef, $inc: { amount_paid: creditedAmount },
    });
  } else if (!cycleNumber) {
    await recordSavingsDeposit({
      memberId,
      amount: creditedAmount,
      reference: mpesaRef,
      sourceLabel: 'M-Pesa',
      processedAt: new Date(),
      note: phone ? `Phone: ${phone}` : undefined,
      notificationPath: '/accounts',
    });
  }

  if (cycleNumber && checkoutRequestId && !tenXContributionId) {
    await recordCyclePayment({
      memberId,
      amount: creditedAmount,
      phone,
      cycleNumber,
      checkoutRequestId,
      mpesaRef,
      processedAt: new Date(),
    });
  }
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

    const payHeroMember = await Member.findById(memberId).select('name email phone');
    if (!payHeroMember) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.round(Number(amount));
    const feeAmounts = calculateTransactionAmounts(numAmount, 'share_purchase');
    const hasCredentials = hasPayHeroCredentials();

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
            amount: feeAmounts.grossAmount,
            ...feeAmounts,
            description: `M-Pesa Share Purchase — Ref: ${ref} — ${mpesaPhone}`,
            status: 'completed',
            mpesaRef: ref,
            createdBy: null,
          });
          await Member.findByIdAndUpdate(memberId, { $inc: { shares: feeAmounts.netAmount } });
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
        data: { checkoutRequestId: simId, ...feeAmounts },
      });
    }

    const stkData = await sendPayHeroSTK(
      mpesaPhone,
      numAmount,
      'SMCF-SHARES',
      'SMCF SACCO Share Purchase',
      { name: String(payHeroMember.name || ''), email: payHeroMember.email ? String(payHeroMember.email) : null }
    );
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || 'Payment request could not be initiated. Please try again.',
      });
    }

    const txnRef = createTransactionRef();
    const txnDoc   = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'share_purchase',
      amount: feeAmounts.grossAmount,
      ...feeAmounts,
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

    return res.json({ success: true, data: { checkoutRequestId, ...feeAmounts } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mpesa/registration-fee/initiate ───────────────────────────────
// Initiates one-time registration payment (KES 100 registration fee + KES 10 transaction fee).

router.post('/registration-fee/initiate', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { memberId, phone } = req.body;

    if (!memberId) return res.status(400).json({ success: false, message: 'memberId is required' });

    const member = await Member.findById(memberId).select('name email phone registrationFeePaid registrationFeePendingCheckoutId');
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (member.registrationFeePaid) {
      return res.status(409).json({ success: false, message: 'Registration fee already paid' });
    }

    const mpesaPhone = normalizePhone(phone || member.phone || '');
    if (!mpesaPhone || mpesaPhone.length < 12) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    }

    const numAmount = REGISTRATION_GROSS_AMOUNT;
    const feeAmounts = calculateTransactionAmounts(numAmount, 'registration_fee');
    const hasCredentials = hasPayHeroCredentials();

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
        ...feeAmounts,
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
            amount: numAmount,
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

    const stkData = await sendPayHeroSTK(
      mpesaPhone,
      numAmount,
      'SMCF-REGFEE',
      'SMCF SACCO Registration Fee',
      { name: String(member.name || ''), email: member.email ? String(member.email) : null }
    );
    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({
        success: false,
        message: stkData.message || 'Payment request could not be initiated. Please try again.',
      });
    }

    const txnRef = createTransactionRef();
    const txnDoc = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'registration_fee',
      amount: numAmount,
      ...feeAmounts,
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

    return res.json({ success: true, data: { checkoutRequestId, ...feeAmounts } });
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
    if (Number(amount) !== REGISTRATION_GROSS_AMOUNT) {
      return res.status(400).json({ success: false, message: `Amount must be KES ${REGISTRATION_GROSS_AMOUNT} including the KES ${UNIFIED_TRANSACTION_FEE} transaction fee` });
    }

    const member = await findMemberByPhoneForRegistration(String(phone || ''));
    if (!member) return res.status(404).json({ success: false, message: 'No unpaid member found for the provided phone' });

    const memberDoc = member as { _id: unknown; phone?: unknown };

    await settleRegistrationFeePayment({
      memberId: String(memberDoc._id),
      amount: REGISTRATION_GROSS_AMOUNT,
      ...calculateTransactionAmounts(REGISTRATION_GROSS_AMOUNT, 'registration_fee'),
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

// ─── POST /api/mpesa/payhero/callback ────────────────────────────────────────
// PayHero posts the final provider result here. Business settlement remains in
// the existing SACCO settlement functions above.

router.post('/payhero/callback', async (req: Request, res: Response) => {
  res.status(200).json({ success: true });

  try {
    const payload = asRecord(req.body);
    const checkoutRequestId = extractCheckoutRequestId(payload);
    const externalReference = [
      getPathValue(payload, ['ExternalReference']),
      getPathValue(payload, ['external_reference']),
      getPathValue(payload, ['externalReference']),
      getPathValue(payload, ['merchant_reference']),
    ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    const status = String(
      getPathValue(payload, ['status'])
      ?? getPathValue(payload, ['Status'])
      ?? getPathValue(payload, ['transaction_status'])
      ?? getPathValue(payload, ['ResultCode'])
      ?? ''
    ).toLowerCase();
    const success = ['0', 'success', 'successful', 'completed', 'complete'].includes(status);
    const amountValue = getPathValue(payload, ['amount']) ?? getPathValue(payload, ['Amount']);
    const callbackAmount = amountValue === undefined ? undefined : Number(amountValue);
    const mpesaRef = [
      getPathValue(payload, ['MpesaReceiptNumber']),
      getPathValue(payload, ['mpesaReceiptNumber']),
      getPathValue(payload, ['receipt_number']),
      getPathValue(payload, ['receiptNumber']),
      getPathValue(payload, ['transaction_id']),
      getPathValue(payload, ['TransactionID']),
    ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    const resultDesc = String(
      getPathValue(payload, ['message'])
      ?? getPathValue(payload, ['ResultDesc'])
      ?? getPathValue(payload, ['description'])
      ?? 'Payment failed or was cancelled'
    );

    console.info('[payhero callback]', {
      checkoutRequestId: checkoutRequestId || null,
      externalReference: externalReference || null,
      status,
      hasReceipt: Boolean(mpesaRef),
      amount: Number.isFinite(callbackAmount) ? callbackAmount : null,
    });

    if (!checkoutRequestId) return;

    const transaction = await Transaction.findOne({
      $or: [
        { checkoutRequestId },
        ...(externalReference ? [{ transactionRef: externalReference }] : []),
      ],
      type: { $in: ['deposit', 'wallet_deposit', 'share_purchase', 'registration_fee', 'loan_repayment'] },
    }).select('_id memberId amount grossAmount feeAmount netAmount type loanId cycleNumber status depositProcessed');

    if (!transaction) {
      console.warn('[payhero callback] pending transaction not found', { checkoutRequestId });
      return;
    }

    if (!success || !mpesaRef) {
      await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'pending' },
        { status: 'failed', processedAt: new Date() },
      );
      for (const pending of [pendingDeposits, pendingSharePurchases, pendingRegistrationFees, pendingRepayments]) {
        const item = pending.get(checkoutRequestId);
        if (item) {
          item.status = 'failed';
          item.resultDesc = resultDesc;
          pending.set(checkoutRequestId, item);
        }
      }
      return;
    }

    if (Number.isFinite(callbackAmount) && callbackAmount !== Number(transaction.amount)) {
      await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'pending' },
        { status: 'failed', processedAt: new Date() },
      );
      console.warn('[payhero callback] amount mismatch', {
        checkoutRequestId,
        expectedAmount: Number(transaction.amount),
        receivedAmount: callbackAmount,
      });
      return;
    }

    const paidAmount = Number.isFinite(callbackAmount) ? Number(callbackAmount) : Number(transaction.amount);
    const memberId = String(transaction.memberId);

    if (transaction.type === 'deposit' || transaction.type === 'wallet_deposit') {
      const pending = pendingDeposits.get(checkoutRequestId);
      await settlePendingDeposit({
        checkoutRequestId,
        memberId,
        amount: paidAmount,
        phone: pending?.phone,
        mpesaRef,
        sourceLabel: 'PayHero STK',
        cycleNumber: pending?.cyclePayment ? pending.cycleNumber : transaction.cycleNumber ?? undefined,
        tenXContributionId: pending?.tenXContributionId,
        walletPayment: transaction.type === 'wallet_deposit' || pending?.walletPayment,
        processedAt: new Date(),
      });
      if (pending) {
        pending.status = 'success';
        pending.mpesaRef = mpesaRef;
        pending.amount = paidAmount;
        pendingDeposits.set(checkoutRequestId, pending);
      }
      return;
    }

    if (transaction.type === 'share_purchase') {
      const shareAmounts = calculateTransactionAmounts(paidAmount, 'share_purchase');
      const claimed = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'pending', depositProcessed: { $ne: true } },
        {
          status: 'completed',
          mpesaRef,
          amount: paidAmount,
          grossAmount: shareAmounts.grossAmount,
          feeAmount: shareAmounts.feeAmount,
          netAmount: shareAmounts.netAmount,
          feeType: shareAmounts.feeType,
          description: `M-Pesa Share Purchase — Ref: ${mpesaRef}`,
          processedAt: new Date(),
          depositProcessed: true,
          paymentGateway: 'payhero',
        },
        { new: true },
      );
      if (claimed) {
        await Member.findByIdAndUpdate(memberId, { $inc: { shares: shareAmounts.netAmount } });
        await recalculateMemberRiskScore(memberId);
      }
      const pending = pendingSharePurchases.get(checkoutRequestId);
      if (pending) {
        pending.status = 'success';
        pending.mpesaRef = mpesaRef;
        pending.amount = paidAmount;
        pendingSharePurchases.set(checkoutRequestId, pending);
      }
      return;
    }

    if (transaction.type === 'registration_fee') {
      const pending = pendingRegistrationFees.get(checkoutRequestId);
      await settleRegistrationFeePayment({
        memberId,
        amount: paidAmount,
        phone: pending?.phone || '',
        mpesaRef,
        checkoutRequestId,
        source: 'callback',
      });
      if (pending) {
        pending.status = 'success';
        pending.mpesaRef = mpesaRef;
        pending.amount = paidAmount;
        pendingRegistrationFees.set(checkoutRequestId, pending);
      }
      return;
    }

    if (transaction.type === 'loan_repayment' && transaction.loanId) {
      const repaymentAmounts = calculateTransactionAmounts(paidAmount, 'loan_repayment');
      const claimed = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'pending', depositProcessed: { $ne: true } },
        { status: 'completed', mpesaRef, amount: paidAmount, ...repaymentAmounts, processedAt: new Date(), depositProcessed: true, paymentGateway: 'payhero' },
        { new: true },
      );
      if (!claimed) return;
      const result = await processRepayment(
        transaction.loanId,
        repaymentAmounts.netAmount,
        'mpesa',
        `PayHero Ref: ${mpesaRef}`,
        null,
      );
      const pending = pendingRepayments.get(checkoutRequestId);
      if (pending) {
        pending.status = 'success';
        pending.mpesaRef = mpesaRef;
        pending.amount = paidAmount;
        pending.loanCompleted = result.loanCompleted;
        pendingRepayments.set(checkoutRequestId, pending);
      }
    }
  } catch (err) {
    console.error('[payhero callback error]', toErrorMessage(err, 'Unable to process callback'));
  }
});

// ─── POST /api/mpesa/callback ────────────────────────────────────────────────
// Safaricom-compatible callback kept for backwards compatibility.

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
    const depositTxn = await Transaction.findOne({
      checkoutRequestId: CheckoutRequestID,
      type: { $in: ['deposit', 'wallet_deposit'] },
    }).select('memberId amount description type');

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
          { checkoutRequestId: CheckoutRequestID, type: { $in: ['deposit', 'wallet_deposit'] } },
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
          walletPayment: deposit?.walletPayment || depositTxn?.type === 'wallet_deposit',
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
        const shareAmounts = calculateTransactionAmounts(amt, 'share_purchase');
        const txn = await Transaction.findOneAndUpdate(
          { checkoutRequestId: CheckoutRequestID, type: 'share_purchase', status: 'pending' },
          {
            status: 'completed',
            mpesaRef,
            amount: amt,
            ...shareAmounts,
            description: `M-Pesa Share Purchase — Ref: ${mpesaRef} — ${sharePurchase.phone}`,
            processedAt: new Date(),
            depositProcessed: true,
          },
          { new: true }
        );

        // Only increment once if pending transaction existed.
        if (txn) {
          await Member.findByIdAndUpdate(sharePurchase.memberId, { $inc: { shares: shareAmounts.netAmount } });
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
        if (amt === REGISTRATION_GROSS_AMOUNT) {
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
        const repaymentAmounts = calculateTransactionAmounts(amt, 'loan_repayment');
        const result = await processRepayment(
          repayment.loanId, repaymentAmounts.netAmount, 'mpesa',
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
    if (!amount || Number(amount) <= UNIFIED_TRANSACTION_FEE)
      return res.status(400).json({ success: false, message: `Minimum repayment is greater than KES ${UNIFIED_TRANSACTION_FEE}` });

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (!['disbursed', 'active'].includes(loan.status))
      return res.status(400).json({ success: false, message: 'Loan is not active' });

    const payHeroMember = await Member.findById(loan.memberId).select('name email phone');

    const mpesaPhone = normalizePhone(phone);
    const numAmount  = Math.round(Number(amount));
    const feeAmounts = calculateTransactionAmounts(numAmount, 'loan_repayment');
    if (feeAmounts.netAmount > Math.round(loan.balance)) {
      return res.status(400).json({ success: false, message: `Amount after the KES ${UNIFIED_TRANSACTION_FEE} fee cannot exceed the outstanding balance of KES ${Math.round(loan.balance).toLocaleString()}` });
    }

    const hasCredentials = hasPayHeroCredentials();

    if (!hasCredentials) {
      const simId = `REPSIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      pendingRepayments.set(simId, {
        loanId,
        memberId: String(loan.memberId),
        amount: feeAmounts.grossAmount,
        ...feeAmounts,
        phone: mpesaPhone,
        status: 'pending',
        createdAt: Date.now(),
      });

      setTimeout(async () => {
        const r = pendingRepayments.get(simId);
        if (!r || r.status !== 'pending') return;
        try {
          const ref = `REPSIM${Date.now()}`;
          const result = await processRepayment(r.loanId, feeAmounts.netAmount, 'mpesa', `Phone: ${r.phone} Ref: ${ref}`, null);
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

    // ── Real STK Push via PayHero ────────────────────────────────────
    const stkData = await sendPayHeroSTK(
      mpesaPhone,
      numAmount,
      loan.loanNumber,
      `SMCF Loan Repayment ${loan.loanNumber}`,
      { name: String(payHeroMember?.name || ''), email: payHeroMember?.email ? String(payHeroMember.email) : null }
    );

    const checkoutRequestId = extractCheckoutRequestId(stkData);

    if (!checkoutRequestId) {
      return res.status(400).json({ success: false, message: stkData.message || 'Payment request could not be initiated. Please try again.' });
    }

    const memberId = String(loan.memberId);

    // Create a DB placeholder so we survive restarts
    const txnRef = createTransactionRef();
    const txnDoc   = await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: 'loan_repayment',
      amount: feeAmounts.grossAmount,
      ...feeAmounts,
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

    // Start server-side PayHero polling
    pollSACCOPayment('loan_repay', checkoutRequestId, String(txnDoc._id), memberId, numAmount, mpesaPhone, loanId).catch(
      (err) => console.error('[pollSACCOPayment loan-repay]', err)
    );

    return res.json({ success: true, data: { checkoutRequestId, ...feeAmounts } });
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
// Called BEFORE opening PayHero payment link.
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
    const manualType: FeeableTransactionType = type === 'loan_repay' ? 'loan_repayment' : 'deposit';
    let feeAmounts;
    try {
      feeAmounts = calculateTransactionAmounts(numAmount, manualType);
    } catch (error) {
      return res.status(400).json({ success: false, message: toErrorMessage(error, 'Invalid payment amount') });
    }

    const normPhone = phone ? normalizePhone(String(phone)) : 'unknown';
    const txnType   = type === 'loan_repay' ? 'loan_repayment' : type === 'share_subscribe' ? 'share_purchase' : 'deposit';
    const loanTag   = (type === 'loan_repay' && loanId) ? ` [loanId:${loanId}]` : '';

    const txnRef = createTransactionRef();

    await Transaction.create({
      transactionRef: txnRef,
      memberId,
      type: txnType,
      amount: feeAmounts.grossAmount,
      ...feeAmounts,
      description: `M-Pesa via PayHero — Pending admin confirmation${loanTag}`,
      status: 'pending',
      createdBy: null,
    });

    pendingManualPayments.set(txnRef, {
      type,
      memberId,
      loanId,
      amount: numAmount,
      phone: normPhone,
      txnRef,
      createdAt: Date.now(),
    });

    return res.json({ success: true, data: { transactionRef: txnRef, ...feeAmounts } });
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

    const pending = pendingManualPayments.get(transactionRef);
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Payment record not found or expired' });
    }

    const mpesaRef = `PAYHERO-CONFIRM-${Date.now()}`;
    const pendingFeeAmounts = calculateTransactionAmounts(
      pending.amount,
      pending.type === 'loan_repay' ? 'loan_repayment' : 'deposit',
    );

    if (pending.type === 'deposit') {
      // Mark transaction completed + add to savings
      await Transaction.findOneAndUpdate(
        { transactionRef },
        {
          status: 'completed',
          ...pendingFeeAmounts,
          description: `M-Pesa Savings Deposit via PayHero — Member confirmed`,
          processedAt: new Date(),
          depositProcessed: true,
        }
      );
      try {
        await recordSavingsDeposit({
          memberId: pending.memberId,
          amount: pendingFeeAmounts.netAmount,
          reference: mpesaRef,
          sourceLabel: 'PayHero payment link',
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
        pendingFeeAmounts.netAmount,
        'mpesa',
        `PayHero payment — Member confirmed — ${mpesaRef}`,
        null
      );
    }

    pendingManualPayments.delete(transactionRef);
    return res.json({ success: true, data: { message: 'Payment confirmed and recorded.' } });
  } catch (err) {
    next(err);
  }
});

export default router;
