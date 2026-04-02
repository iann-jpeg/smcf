/**
 * Payment API client for the SMCF SACCO portal.
 *
 * All payment-initiation calls are routed through the MAIN SMCF backend so
 * that both apps share a single Lipia Online / M-Pesa integration.
 *
 * Required env vars (set in .env / Vercel dashboard):
 *   VITE_SMCF_PAYMENT_URL  – base URL of the main SMCF backend
 *                             e.g. https://smcf-backend.onrender.com/api
 *   VITE_SMCF_API_KEY      – shared API key (SACCO_API_KEY on the backend)
 */

const PAYMENT_BASE =
  (import.meta.env.VITE_SMCF_PAYMENT_URL as string) ||
  "http://localhost:4000/api";

const PAYMENT_KEY =
  (import.meta.env.VITE_SMCF_API_KEY as string) || "";

function paymentHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-sacco-key": PAYMENT_KEY,
  };
}

export interface PaymentInitiateBody {
  phone: string;
  amount: number;
  type?: "deposit" | "loan_repay" | "share_subscribe";
  description?: string;
  /** Transaction ref returned by the sacco backend, for cross-reference */
  externalRef?: string;
}

export interface PaymentInitiateResult {
  lipiaPaymentUrl: string;
  till: string;
  message: string;
}

/**
 * Record a payment initiation in the main SMCF backend and retrieve the
 * Lipia payment link URL.  Fire-and-forget safe — callers should wrap in
 * `.catch(() => {})` if they don't want failures to block the UX.
 */
export async function initiateSaccoPayment(
  body: PaymentInitiateBody
): Promise<PaymentInitiateResult> {
  const res = await fetch(`${PAYMENT_BASE}/sacco-payments/initiate`, {
    method: "POST",
    headers: paymentHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({})) as { success?: boolean; error?: string; data?: PaymentInitiateResult };

  if (!res.ok) {
    throw new Error(json.error || `Payment bridge error: HTTP ${res.status}`);
  }

  return json.data as PaymentInitiateResult;
}
