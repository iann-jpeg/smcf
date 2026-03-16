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
import { protect, AuthRequest } from '../middleware/auth';
import { processRepayment } from './repayments';

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

// Purge stale entries every 10 min
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingDeposits.entries()) {
    if (v.createdAt < cutoff) pendingDeposits.delete(k);
  }
}, 10 * 60 * 1000);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Send STK push via Lipia Online to till 6938069 */
async function sendLipiaSTK(phone: string, amount: number, reference: string, description: string) {
  const apiKey  = process.env.LIPIA_API_KEY!;
  const baseUrl = process.env.LIPIA_API_URL || 'https://lipia-api.kreativelabske.com/api';
  const callbackUrl = process.env.MPESA_CALLBACK_URL || 'https://smcf-sacco-backend.onrender.com/api/mpesa/callback';

  // Lipia requires 07xx/01xx format — convert from 254xxx if needed
  const lipiaPhone = normalizePhoneForLipia(phone);

  const attempts = [
    {
      url: `${baseUrl}/payments/stk-push`,
      body: {
        phone_number: lipiaPhone,
        amount,
        external_reference: reference,
      },
    },
    {
      url: `${baseUrl}/request/stk`,
      body: {
        phone: lipiaPhone,
        amount,
        reference,
        description,
        callback_url: callbackUrl,
      },
    },
  ];

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
    let data: any = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText || 'Unexpected response from payment service' };
    }

    if (!res.ok) {
      lastStatus = res.status;
      lastReason = typeof data === 'string' ? data : (data?.error?.message || data?.message || data?.error || 'Unknown error');
      continue;
    }

    if (data?.success === false) {
      lastStatus = 400;
      lastReason = data?.error?.mpesaError?.errorMessage || data?.error?.message || data?.message || 'Payment initiation failed';
      continue;
    }

    const checkoutRequestId = extractCheckoutRequestId(data);
    if (!checkoutRequestId) {
      lastStatus = 502;
      lastReason = 'Payment service response missing checkout request id';
      continue;
    }

    return {
      ...data,
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

function extractCheckoutRequestId(payload: any): string | undefined {
  return (
    payload?.data?.TransactionReference ||
    payload?.data?.CheckoutRequestID ||
    payload?.data?.checkoutRequestId ||
    payload?.data?.checkout_request_id ||
    payload?.data?.checkoutRequestID ||
    payload?.data?.requestId ||
    payload?.data?.reference ||
    payload?.CheckoutRequestID ||
    payload?.checkoutRequestId ||
    payload?.checkout_request_id ||
    payload?.transactionReference ||
    payload?.reference
  );
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

async function recordDeposit(memberId: string, amount: number, phone: string, mpesaRef: string) {
  const count = await Transaction.countDocuments();
  const transactionRef = `TXN${new Date().getFullYear()}${String(count + 1).padStart(8, '0')}`;
  await Transaction.create({
    transactionRef,
    memberId,
    type: 'deposit',
    amount,
    description: `M-Pesa Savings Deposit — Ref: ${mpesaRef} — ${phone}`,
    status: 'completed',
    createdBy: null,
  });
  await Member.findByIdAndUpdate(memberId, { $inc: { savings: amount } });
}

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

    pendingDeposits.set(checkoutRequestId, {
      memberId,
      amount: numAmount,
      phone: mpesaPhone,
      status: 'pending',
      createdAt: Date.now(),
    });

    return res.json({ success: true, data: { checkoutRequestId } });
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
    const items: { Name: string; Value: any }[] = CallbackMetadata?.Item || [];
    const get = (n: string) => items.find((i: any) => i.Name === n)?.Value;

    const mpesaRef = get('MpesaReceiptNumber') as string || `MPESA${Date.now()}`;
    const paidAmt  = Number(get('Amount'));

    // ── Savings deposit ──────────────────────────────────────────────────
    const deposit = pendingDeposits.get(CheckoutRequestID);
    if (deposit) {
      if (ResultCode !== 0) {
        deposit.status    = 'failed';
        deposit.resultDesc = ResultDesc || 'Payment cancelled or failed';
      } else {
        const amt = paidAmt || deposit.amount;
        await recordDeposit(deposit.memberId, amt, deposit.phone, mpesaRef);
        deposit.status   = 'success';
        deposit.mpesaRef = mpesaRef;
        deposit.amount   = amt;
      }
      pendingDeposits.set(CheckoutRequestID, deposit);
      return;
    }

    // ── Loan repayment ───────────────────────────────────────────────────
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
    const deposit = pendingDeposits.get(req.params.checkoutRequestId);
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Request not found or expired' });
    }
    return res.json({
      success: true,
      data: {
        status:     deposit.status,
        mpesaRef:   deposit.mpesaRef,
        amount:     deposit.amount,
        resultDesc: deposit.resultDesc,
      },
    });
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
        } catch (e: any) {
          r.status = 'failed';
          r.resultDesc = e.message || 'Simulation error';
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

    pendingRepayments.set(checkoutRequestId, {
      loanId,
      memberId: String(loan.memberId),
      amount: numAmount,
      phone: mpesaPhone,
      status: 'pending',
      createdAt: Date.now(),
    });

    return res.json({ success: true, data: { checkoutRequestId } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/mpesa/repay-status/:checkoutRequestId ─────────────────────────

router.get('/repay-status/:checkoutRequestId', protect, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = pendingRepayments.get(req.params.checkoutRequestId);
    if (!r) return res.status(404).json({ success: false, message: 'Request not found or expired' });
    return res.json({
      success: true,
      data: { status: r.status, mpesaRef: r.mpesaRef, amount: r.amount, loanCompleted: r.loanCompleted, resultDesc: r.resultDesc },
    });
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

    const count  = await Transaction.countDocuments();
    const txnRef = `TXN${new Date().getFullYear()}${String(count + 1).padStart(8, '0')}`;

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
        }
      );
      await Member.findByIdAndUpdate(pending.memberId, { $inc: { savings: pending.amount } });

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
