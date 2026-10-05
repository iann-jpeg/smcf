import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, RefreshCw, CheckCircle2, Loader2, Smartphone, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { playAtmDepositSound } from "@/lib/sound";

type Step = "agreement" | "input" | "processing" | "success" | "failed";
type PaymentMethod = "mpesa" | "card";
const WALLET_AGREEMENT_VERSION = "2026-10-04";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberPhone?: string | null;
  paymentType?: "wallet" | "savings" | "cycle" | "tenx";
  cycleNumber?: number | null;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export function DepositSavingsDialog({ open, onClose, memberId, memberPhone, paymentType = "savings", cycleNumber }: Props) {
  const [step,        setStep]        = useState<Step>("input");
  const [amount,      setAmount]      = useState("");
  const [phone,       setPhone]       = useState(memberPhone ?? "");
  const [loading,     setLoading]     = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [autoPayment, setAutoPayment] = useState(false);
  const [checkoutId,  setCheckoutId]  = useState<string | null>(null);
  const [mpesaRef,    setMpesaRef]    = useState<string | null>(null);
  const [failReason,  setFailReason]  = useState<string | null>(null);
  const [walletAgreementChecked, setWalletAgreementChecked] = useState(false);
  const [walletAgreementLoading, setWalletAgreementLoading] = useState(false);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    if (open) {
      setStep(paymentType === "wallet" ? "agreement" : "input");
      setAmount("");
      setPhone(memberPhone ?? "");
      setLoading(false);
      setPaymentMethod("mpesa");
      setAutoPayment(false);
      setCheckoutId(null);
      setMpesaRef(null);
      setFailReason(null);
      setWalletAgreementChecked(false);
      stopPolling();
      // Wallet terms must be accepted before every Wallet deposit.
      setWalletAgreementLoading(false);
    }
    return () => stopPolling();
  }, [open, memberPhone, paymentType, stopPolling]);

  function startPolling(id: string) {
    const checkStatus = async () => {
      try {
        const res = await api.get(`/mpesa/status/${id}`);
        const d = ((res as any)?.data ?? res) as any;
        const statusValues = [
          d?.status,
          d?.providerStatus,
          d?.paymentStatus,
          d?.transaction_status,
        ].map((value) => String(value ?? "").trim().toLowerCase());
        const isFinanciallyComplete = String(d?.financialPostingStatus ?? "").toLowerCase() === "completed";
        const isSuccess = statusValues.some((value) => ["success", "successful", "completed", "complete", "paid", "approved", "confirmed"].includes(value))
          && (!d?.financialPostingStatus || isFinanciallyComplete);
        const isFailed = statusValues.some((value) => ["failed", "cancelled", "canceled", "declined", "reversed"].includes(value));
        if (isSuccess) {
          stopPolling();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["my-member"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-transactions"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-savings-history"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-unified-account"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-loans"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-repayments"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["my-guarantor-requests"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["members"], refetchType: "active" }),
              queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "active" }),
            ]);
            playAtmDepositSound();
            setMpesaRef(d.mpesaRef ?? null);
            setStep("success");
        } else if (isFailed) {
          stopPolling();
          setFailReason(d.resultDesc || "Payment cancelled or failed. Please try again.");
          setStep("failed");
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    void checkStatus();
    pollRef.current = setInterval(() => { void checkStatus(); }, 5_000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setFailReason("Payment timed out. If you completed the payment, contact support.");
      setStep("failed");
    }, 5 * 60 * 1000);
  }

  async function handlePay() {
    const num = Number(amount);
    if (!num || num < 1) { toast.error("Enter a deposit amount"); return; }
    if (paymentMethod === "mpesa" && !phone.trim()) { toast.error("Enter your M-Pesa phone number"); return; }

    setLoading(true);
    try {
      if (paymentMethod === "card") {
        const res = await api.post("/pesapal/orders", {
          memberId,
          amount: num,
          purpose: paymentType === "wallet" ? "wallet" : paymentType === "cycle" ? "cycle" : "savings",
          cycleNumber,
          subscription: autoPayment,
          consentAccepted: autoPayment,
        });
        const order = (res as any)?.data ?? res;
        if (order.redirectUrl) {
          window.location.assign(String(order.redirectUrl));
          return;
        }
        setCheckoutId(String(order.orderTrackingId || ""));
        setStep("processing");
        startPesapalPolling(String(order.orderTrackingId || ""));
        return;
      }
      const res = await api.post("/mpesa/deposit", {
        memberId,
        amount: num,
        phone: phone.trim(),
        paymentType,
        cycleNumber,
      });
      const id = (res as any)?.checkoutRequestId || (res as any)?.data?.checkoutRequestId;
      if (!id) throw new Error("No checkout ID returned");
      setCheckoutId(id);
      setStep("processing");
      startPolling(id);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to send M-Pesa prompt. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startPesapalPolling(orderTrackingId: string) {
    const checkStatus = async () => {
      try {
        const res = await api.get(`/pesapal/orders/${encodeURIComponent(orderTrackingId)}/status`);
        const d = ((res as any)?.data ?? res) as any;
        const status = String(d?.status || "").toLowerCase();
        if (["success", "completed"].includes(status) && d?.financialPostingStatus === "completed") {
          stopPolling();
          await queryClient.invalidateQueries({ queryKey: ["my-member"], refetchType: "active" });
          await queryClient.invalidateQueries({ queryKey: ["my-transactions"], refetchType: "active" });
          await queryClient.invalidateQueries({ queryKey: ["my-savings-history"], refetchType: "active" });
          await queryClient.invalidateQueries({ queryKey: ["my-unified-account"], refetchType: "active" });
          playAtmDepositSound();
          setMpesaRef(d.paymentReference ?? null);
          setStep("success");
        } else if (status === "failed") {
          stopPolling();
          setFailReason("Card payment failed or was cancelled.");
          setStep("failed");
        }
      } catch {
        // Keep polling through temporary network errors.
      }
    };
    void checkStatus();
    pollRef.current = setInterval(() => { void checkStatus(); }, 5000);
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setFailReason("Card payment timed out. If you completed it, contact support.");
      setStep("failed");
    }, 5 * 60 * 1000);
  }

  const amountNum = Number(amount) || 0;
  const feeAmount = paymentType === "cycle" ? 0 : 10;
  const netAmount = Math.max(0, amountNum - feeAmount);
  const minimumAmount = paymentType === "cycle" ? 1 : 11;
  const destinationLabel = paymentType === "wallet"
    ? "your wallet"
    : paymentType === "cycle"
      ? `Cycle${cycleNumber ? ` #${cycleNumber}` : ""}`
      : paymentType === "tenx"
        ? "the 10X Group"
        : "your savings account";
  const creditVerb = paymentType === "cycle" || paymentType === "tenx" ? "Contributing" : "Depositing";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopPolling(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">

        {step === "agreement" && paymentType === "wallet" && (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-heading">Wallet Deposit Agreement</DialogTitle>
              <DialogDescription>Please review these important Wallet terms before this deposit.</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">
              <ul className="list-disc space-y-2 pl-5">
                <li>Wallet deposits cannot be withdrawn for at least 3 months from the deposit date.</li>
                <li>Withdrawals after maturity are subject to the applicable withdrawal fee.</li>
                <li>Approved withdrawals are normally processed within 3 working days.</li>
                <li>Applicable transaction fees are shown before payment.</li>
                <li>The Wallet is separate from SACCO Savings and Cycles.</li>
                <li>Review your transaction details before confirming.</li>
              </ul>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={walletAgreementChecked} onChange={(event) => setWalletAgreementChecked(event.target.checked)} />
              <span>By continuing, I confirm that I have read and understood the Wallet terms.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={walletAgreementLoading}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                disabled={!walletAgreementChecked || walletAgreementLoading}
                onClick={async () => {
                  setWalletAgreementLoading(true);
                  try {
                    await api.post("/members/me/wallet-agreement", { version: WALLET_AGREEMENT_VERSION });
                    setStep("input");
                  } catch (error: any) {
                    toast.error(error?.message || "Unable to accept the Wallet agreement.");
                  } finally {
                    setWalletAgreementLoading(false);
                  }
                }}
              >
                {walletAgreementLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & Continue"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Input */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                {paymentType === "wallet" ? "Deposit to Wallet" : paymentType === "cycle" ? `Pay Cycle ${cycleNumber ? `#${cycleNumber} ` : ""}` : paymentType === "tenx" ? "Pay 10X Contribution" : "Deposit Savings"}
              </DialogTitle>
              <DialogDescription>
                  Select a payment method and amount. Card payments are verified by Pesapal before the SMCF account is credited.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod("mpesa")} className={cn("rounded-lg border-2 px-3 py-2 text-sm font-semibold", paymentMethod === "mpesa" ? "border-green-500 bg-green-50 text-green-700" : "border-border")}>M-Pesa</button>
                <button type="button" onClick={() => setPaymentMethod("card")} className={cn("rounded-lg border-2 px-3 py-2 text-sm font-semibold", paymentMethod === "card" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border")}>Card (Pesapal)</button>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Amount</Label>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={cn(
                        "rounded-lg border-2 py-2 text-sm font-semibold transition-all",
                        amountNum === q
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-400"
                          : "border-border hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-900/10"
                      )}
                    >
                      {q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-amount">Amount (KES)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">KES</span>
                  <Input
                    id="deposit-amount"
                    type="number"
                    min={1}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 text-lg font-bold"
                    placeholder="0"
                  />
                </div>
                {amountNum > 0 && (
                  <div className="rounded-lg border bg-muted/40 divide-y text-xs">
                    <div className="flex justify-between px-3 py-2"><span>Amount charged</span><span className="font-semibold">KES {amountNum.toLocaleString()}</span></div>
                    <div className="flex justify-between px-3 py-2"><span>Transaction fee</span><span className="font-semibold">KES {feeAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between px-3 py-2"><span>Amount credited</span><span className="font-semibold text-green-600">KES {netAmount.toLocaleString()}</span></div>
                  </div>
                )}
              </div>

              {paymentMethod === "mpesa" && <div className="space-y-1.5">
                <Label htmlFor="deposit-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="deposit-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="e.g. 0712 345 678"
                  />
                </div>
              </div>}

              {paymentMethod === "card" && (
                <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <input type="checkbox" checked={autoPayment} onChange={(event) => setAutoPayment(event.target.checked)} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="font-medium">Enable automatic monthly card payments</span>
                    <span className="mt-1 block text-xs text-muted-foreground">You will authorize the recurring payment through Pesapal. SMCF never receives or stores your card number or CVV.</span>
                  </span>
                </label>
              )}

              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/10 flex items-start gap-3 px-4 py-3">
                <div className="flex items-center justify-center rounded bg-[#00A550] px-2 py-0.5 shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-black tracking-wide">{paymentMethod === "mpesa" ? "M-PESA" : "PESAPAL"}</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  {paymentMethod === "mpesa" ? "A prompt will be sent directly to your phone. Enter your PIN to complete the payment." : "You will be redirected to Pesapal to complete the secure card payment. SMCF posts the payment only after provider verification."}
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handlePay}
                disabled={loading || !amount || amountNum < minimumAmount || (paymentMethod === "mpesa" && !phone.trim())}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                {loading ? "Starting..." : paymentMethod === "mpesa" ? "Send M-Pesa Prompt" : "Continue to Pesapal"}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-green-400/20 animate-ping" />
              <div className="relative p-5 rounded-full bg-green-100 dark:bg-green-900/40">
                <Smartphone className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg">Check Your Phone</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                An M-Pesa STK push has been sent to <span className="font-semibold text-foreground">{phone}</span>. Enter your PIN to confirm the deposit of{" "}
                <span className="font-semibold text-foreground">KES {amountNum.toLocaleString()}</span>.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Pay To</span>
                <span className="font-semibold"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO Accounts</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-green-600">KES {amountNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Transaction fee</span>
                <span className="font-semibold">KES {feeAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount credited</span>
                <span className="font-bold text-green-600">KES {netAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-1.5 text-green-600 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Awaiting PIN...
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-[12px] text-amber-700 dark:text-amber-400 text-left w-full flex items-start gap-2">
              <span className="text-base">📱</span>
              <span>A pop-up should appear on your phone. Enter your <strong>M-Pesa PIN</strong> to complete the deposit. This page will update automatically.</span>
            </div>

            <Button variant="outline" className="w-full" onClick={() => { stopPolling(); setStep("input"); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Cancel / Try Again
            </Button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="relative p-5 rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-green-700 dark:text-green-400">Deposit Confirmed!</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {creditVerb} KES {netAmount.toLocaleString()} to {destinationLabel}.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount Deposited</span>
                <span className="font-bold text-green-600">KES {netAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount charged</span>
                <span className="font-semibold">KES {amountNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Transaction fee</span>
                <span className="font-semibold">KES {feeAmount.toLocaleString()}</span>
              </div>
              {mpesaRef && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">M-Pesa Ref</span>
                  <span className="font-mono text-xs">{mpesaRef}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Status</span>
                <span className="text-green-600 font-semibold">✓ Completed</span>
              </div>
            </div>

            <Button className="w-full gap-2 h-11 text-base font-semibold bg-green-600 hover:bg-green-700 text-white" onClick={onClose}>
              <CheckCircle2 className="h-5 w-5" /> Done
            </Button>
          </div>
        )}

        {/* Step 4: Failed */}
        {step === "failed" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="relative p-5 rounded-full bg-red-100 dark:bg-red-900/40">
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-red-700 dark:text-red-400">Payment Failed</h3>
              <p className="text-muted-foreground text-sm max-w-xs">{failReason || "The payment was cancelled or failed. Please try again."}</p>
            </div>

            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setStep("input"); setFailReason(null); }}>
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Contact <span className="font-semibold">+254 759 097 157</span> if you were charged but the balance did not update.
            </p>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
