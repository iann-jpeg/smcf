import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard, RefreshCw, CheckCircle2, Loader2, Smartphone, XCircle, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Step = "input" | "processing" | "success" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
  loan: {
    id: string;
    loan_number: string;
    balance: number;
    monthly_installment: number;
  };
  memberPhone?: string | null;
}

export function LoanRepaymentDialog({ open, onClose, loan, memberPhone }: Props) {
  const [step,          setStep]          = useState<Step>("input");
  const [amount,        setAmount]        = useState(String(loan.monthly_installment || ""));
  const [phone,         setPhone]         = useState(memberPhone ?? "");
  const [loading,       setLoading]       = useState(false);
  const [mpesaRef,      setMpesaRef]      = useState<string | null>(null);
  const [loanCompleted, setLoanCompleted] = useState(false);
  const [failReason,    setFailReason]    = useState<string | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const stopPolling = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    if (open) {
      setStep("input");
      setAmount(String(loan.monthly_installment || ""));
      setPhone(memberPhone ?? "");
      setLoading(false);
      setMpesaRef(null);
      setLoanCompleted(false);
      setFailReason(null);
      stopPolling();
    }
    return () => stopPolling();
  }, [open, loan, memberPhone, stopPolling]);

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const d = await api.get<{ status: string; mpesaRef?: string; loanCompleted?: boolean; resultDesc?: string }>(
          `/mpesa/repay-status/${id}`
        );
        if (d.status === "success") {
          stopPolling();
          setMpesaRef(d.mpesaRef ?? null);
          setLoanCompleted(!!d.loanCompleted);
          setStep("success");
          queryClient.invalidateQueries({ queryKey: ["my-loans"] });
          queryClient.invalidateQueries({ queryKey: ["my-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["my-repayments"] });
          queryClient.invalidateQueries({ queryKey: ["loans"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          queryClient.invalidateQueries({ queryKey: ["members"] });
        } else if (d.status === "failed") {
          stopPolling();
          setFailReason(d.resultDesc || "Payment cancelled or failed. Please try again.");
          setStep("failed");
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setFailReason("Payment timed out. If you completed the payment, contact support.");
      setStep("failed");
    }, 2 * 60 * 1000);
  }

  async function handlePay() {
    const num = Number(amount);
    if (!num || num < 10)  { toast.error("Enter an amount of at least KES 10"); return; }
    if (!phone.trim())     { toast.error("Enter your M-Pesa phone number"); return; }

    setLoading(true);
    try {
      // api.post unwraps json.data, so the result is { checkoutRequestId }
      const res = await api.post<{ checkoutRequestId: string }>("/mpesa/loan-repay", {
        loanId: loan.id,
        amount: num,
        phone: phone.trim(),
      });
      const id = res?.checkoutRequestId;
      if (!id) throw new Error("No checkout ID returned — please try again");
      setStep("processing");
      startPolling(id);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to send M-Pesa prompt. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = Number(amount) || 0;
  const pct       = loan.balance > 0 ? Math.min(100, Math.round((amountNum / loan.balance) * 100)) : 0;
  const isFull    = amountNum >= loan.balance;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopPolling(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">

        {/* Step 1: Input */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Repay Loan via M-Pesa
              </DialogTitle>
              <DialogDescription>
                An STK push will be sent to your phone. Enter your M-Pesa PIN to complete the payment for <span className="font-semibold text-foreground">{loan.loan_number}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="rounded-xl border bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding Balance</p>
                <p className="text-2xl font-bold font-heading text-destructive">
                  KES {Number(loan.balance).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Monthly installment: <span className="font-semibold text-foreground">KES {Number(loan.monthly_installment).toLocaleString()}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.round(loan.monthly_installment)))}
                    className={cn(
                      "rounded-lg border-2 py-3 px-2 text-xs font-semibold transition-all text-center",
                      !isFull && amountNum > 0
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "border-border hover:border-blue-300 hover:bg-blue-50/50"
                    )}
                  >
                    <Banknote className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <span className="block font-bold">Lipa Pole Pole</span>
                    <span className="text-[10px] text-muted-foreground">Partial / Instalment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(Math.round(loan.balance)))}
                    className={cn(
                      "rounded-lg border-2 py-3 px-2 text-xs font-semibold transition-all text-center",
                      isFull && amountNum > 0
                        ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "border-border hover:border-green-300 hover:bg-green-50/50"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                    <span className="block font-bold">Full Clearance</span>
                    <span className="text-[10px] text-muted-foreground">Clear entire balance</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Quick Select</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[loan.monthly_installment, Math.round(loan.monthly_installment * 2), loan.balance].map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAmount(String(Math.round(q)))}
                      className={cn(
                        "rounded-lg border-2 py-2 px-1 text-xs font-semibold transition-all text-center",
                        amountNum === Math.round(q)
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "border-border hover:border-blue-300 hover:bg-blue-50/50"
                      )}
                    >
                      <span className="block text-[9px] text-muted-foreground mb-0.5">
                        {i === 0 ? "1 Month" : i === 1 ? "2 Months" : "Full Balance"}
                      </span>
                      {Math.round(q).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repay-amount">Custom Amount (KES)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">KES</span>
                  <Input
                    id="repay-amount"
                    type="number"
                    min={10}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 text-lg font-bold"
                    placeholder="0"
                  />
                </div>
                {amountNum > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paying <span className="font-semibold text-blue-600">{pct}%</span> of outstanding balance.
                      {isFull && <span className="text-green-600 font-semibold ml-1">This will fully clear the loan!</span>}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repay-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="repay-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="e.g. 0712 345 678"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 flex items-start gap-3 px-4 py-3">
                <div className="flex items-center justify-center rounded bg-[#00A550] px-2 py-0.5 shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-black tracking-wide">M-PESA</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  A prompt will be sent to your phone. Enter your PIN to pay <span className="font-semibold text-foreground"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO Accounts</span>. Payment is instant.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 gap-2"
                onClick={handlePay}
                disabled={loading || !amount || amountNum < 10 || !phone.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                {loading ? "Sending..." : "Send M-Pesa Prompt"}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
              <div className="relative p-5 rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Smartphone className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg">Check Your Phone</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                An M-Pesa STK push has been sent to <span className="font-semibold text-foreground">{phone}</span>. Enter your PIN to pay{" "}
                <span className="font-semibold text-foreground">KES {amountNum.toLocaleString()}</span> towards loan {loan.loan_number}.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Loan</span>
                <span className="font-mono font-semibold">{loan.loan_number}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-blue-600">KES {amountNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Status</span>
                <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Awaiting PIN...
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-[12px] text-amber-700 dark:text-amber-400 text-left w-full flex items-start gap-2">
              <span className="text-base">📱</span>
              <span>A pop-up should appear on your phone. Enter your <strong>M-Pesa PIN</strong> to complete the payment. This page will update automatically.</span>
            </div>

            <Button variant="outline" className="w-full" onClick={() => { stopPolling(); setStep("input"); }}>
              <RefreshCw className="mr-2 h-4 w-4" /> Cancel / Try Again
            </Button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative p-5 rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-green-700 dark:text-green-400">
                {loanCompleted ? "Loan Fully Cleared! 🎉" : "Repayment Confirmed!"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                KES {amountNum.toLocaleString()} has been applied to loan {loan.loan_number}.
                {loanCompleted && " Your loan is now fully cleared."}
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-bold text-green-600">KES {amountNum.toLocaleString()}</span>
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

            <Button className="w-full gap-2 h-11 text-base font-semibold" onClick={onClose}>
              <CheckCircle2 className="h-5 w-5" /> Done
            </Button>
          </div>
        )}

        {/* Step 4: Failed */}
        {step === "failed" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative p-5 rounded-full bg-red-100 dark:bg-red-900/40">
              <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-red-700 dark:text-red-400">Payment Failed</h3>
              <p className="text-muted-foreground text-sm max-w-xs">{failReason}</p>
            </div>

            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              <Button className="flex-1 gap-2" onClick={() => setStep("input")}>
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  
  );
}
