import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard, RefreshCw, ExternalLink, Clock, CheckCircle2, Loader2, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { initiateSaccoPayment } from "@/lib/paymentApi";
import { toast } from "sonner";

const LIPIA_PAYMENT_URL = "https://lipia-online.vercel.app/link/smcfholdings";

type Step = "input" | "sent";

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
  const [step,    setStep]    = useState<Step>("input");
  const [amount,  setAmount]  = useState(String(loan.monthly_installment || ""));
  const [phone,   setPhone]   = useState(memberPhone ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("input");
      setAmount(String(loan.monthly_installment || ""));
      setPhone(memberPhone ?? "");
      setLoading(false);
    }
  }, [open, loan, memberPhone]);

  async function handlePay() {
    const num = Number(amount);
    if (!num || num < 10)  { toast.error("Enter an amount of at least KES 10"); return; }
    if (!phone.trim())     { toast.error("Enter your M-Pesa phone number"); return; }

    setLoading(true);
    try {
      // Record payment in sacco backend (updates loan balance on admin confirmation)
      const saccoRecord = await api.post<{ transactionRef?: string }>("/mpesa/payment-initiated", {
        memberId: undefined, // server resolves from loanId
        amount: num,
        phone: phone.trim(),
        type: "loan_repay",
        loanId: loan.id,
      });

      // Also record in main SMCF backend — uses the same Lipia/M-Pesa payment gateway.
      // Fire-and-forget: a failure here must never block the user's payment flow.
      initiateSaccoPayment({
        phone: phone.trim(),
        amount: num,
        type: "loan_repay",
        description: `SMCF SACCO loan repayment — ${loan.loan_number}`,
        externalRef: (saccoRecord as any)?.data?.transactionRef,
      }).catch((e: Error) => console.warn("[paymentApi] bridge call failed (non-blocking):", e.message));

      window.open(LIPIA_PAYMENT_URL, "_blank", "noopener,noreferrer");
      setStep("sent");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = Number(amount) || 0;
  const pct       = loan.balance > 0 ? Math.min(100, Math.round((amountNum / loan.balance) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">

        {/* ── Step 1: Input ─────────────────────────────────────────────── */}
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
                Paying towards <span className="font-semibold text-foreground">{loan.loan_number}</span>. Select an amount and you will be taken to our secure payment page.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Outstanding balance card */}
              <div className="rounded-xl border bg-muted/40 p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding Balance</p>
                <p className="text-2xl font-bold font-heading text-destructive">
                  KES {Number(loan.balance).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Monthly installment: <span className="font-semibold text-foreground">KES {Number(loan.monthly_installment).toLocaleString()}</span>
                </p>
              </div>

              {/* Quick amounts */}
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

              {/* Amount input */}
              <div className="space-y-1.5">
                <Label htmlFor="repay-amount">Amount to Pay (KES)</Label>
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
                      {amountNum >= loan.balance && <span className="text-green-600 font-semibold ml-1">This will fully clear the loan!</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Phone */}
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

              {/* Lipia info strip */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 flex items-start gap-3 px-4 py-3">
                <div className="flex items-center justify-center rounded bg-[#00A550] px-2 py-0.5 shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-black tracking-wide">M-PESA</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  Payments go to <span className="font-semibold text-foreground"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO Till 6938069</span> via Lipia Online. A payment page will open in a new tab.
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {loading ? "Opening..." : "Pay via Lipia"}
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2: Awaiting payment ───────────────────────────────────── */}
        {step === "sent" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
              <div className="relative p-5 rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Clock className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg">Complete Payment on Lipia</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Pay{" "}
                <span className="font-semibold text-foreground">KES {amountNum.toLocaleString()}</span>{" "}
                on the Lipia tab that just opened using your M-Pesa number.
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
                <span className="text-muted-foreground">Pay To</span>
                <span className="font-semibold"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO (Till 6938069)</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Via</span>
                <span className="font-medium">Lipia Online</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-[12px] text-amber-700 dark:text-amber-400 text-left w-full flex items-start gap-2">
              <span className="text-base">⏳</span>
              <span>Once you complete the payment, your repayment will show as <strong>Pending</strong> until an admin confirms it. Your loan balance will update immediately after confirmation.</span>
            </div>

            <Button
              className="w-full gap-2 h-11 text-base font-semibold"
              onClick={onClose}
            >
              <CheckCircle2 className="h-5 w-5" /> Done — I Have Paid
            </Button>

            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setStep("input")}>
                <RefreshCw className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                variant="ghost"
                className="flex-1 gap-2 text-muted-foreground"
                onClick={() => window.open(LIPIA_PAYMENT_URL, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="h-4 w-4" /> Reopen Page
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Contact <span className="font-semibold">+254 759 097 157</span> if your balance does not update.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
