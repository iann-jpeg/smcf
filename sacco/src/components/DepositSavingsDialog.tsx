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

type Step = "input" | "processing" | "success" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberPhone?: string | null;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export function DepositSavingsDialog({ open, onClose, memberId, memberPhone }: Props) {
  const [step,        setStep]        = useState<Step>("input");
  const [amount,      setAmount]      = useState("");
  const [phone,       setPhone]       = useState(memberPhone ?? "");
  const [loading,     setLoading]     = useState(false);
  const [checkoutId,  setCheckoutId]  = useState<string | null>(null);
  const [mpesaRef,    setMpesaRef]    = useState<string | null>(null);
  const [failReason,  setFailReason]  = useState<string | null>(null);
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
      setAmount("");
      setPhone(memberPhone ?? "");
      setLoading(false);
      setCheckoutId(null);
      setMpesaRef(null);
      setFailReason(null);
      stopPolling();
    }
    return () => stopPolling();
  }, [open, memberPhone, stopPolling]);

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/mpesa/status/${id}`);
        const d   = res as any;
        if (d.status === "success") {
          stopPolling();
          playAtmDepositSound();
          setMpesaRef(d.mpesaRef ?? null);
          setStep("success");
          queryClient.invalidateQueries({ queryKey: ["my-member"] });
          queryClient.invalidateQueries({ queryKey: ["my-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["my-savings-history"] });
          queryClient.invalidateQueries({ queryKey: ["members"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        } else if (d.status === "failed") {
          stopPolling();
          setFailReason(d.resultDesc || "Payment cancelled or failed. Please try again.");
          setStep("failed");
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 10_000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setFailReason("Payment timed out. If you completed the payment, contact support.");
      setStep("failed");
    }, 2 * 60 * 1000);
  }

  async function handlePay() {
    const num = Number(amount);
    if (!num || num < 1) { toast.error("Enter a deposit amount"); return; }
    if (!phone.trim()) { toast.error("Enter your M-Pesa phone number"); return; }

    setLoading(true);
    try {
      const res = await api.post("/mpesa/deposit", {
        memberId,
        amount: num,
        phone: phone.trim(),
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

  const amountNum = Number(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopPolling(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">

        {/* Step 1: Input */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
                  <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                Deposit Savings via M-Pesa
              </DialogTitle>
              <DialogDescription>
                Select an amount below. An M-Pesa STK push will be sent to your phone — just enter your PIN to complete the deposit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
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
                  <p className="text-xs text-muted-foreground">
                    Depositing{" "}
                    <span className="font-semibold text-green-600">KES {amountNum.toLocaleString()}</span>{" "}
                    into your savings account.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
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
              </div>

              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/10 flex items-start gap-3 px-4 py-3">
                <div className="flex items-center justify-center rounded bg-[#00A550] px-2 py-0.5 shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-black tracking-wide">M-PESA</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  A prompt will be sent directly to your phone. Enter your PIN to deposit to <span className="font-semibold text-foreground"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO Accounts</span>. Payment posts instantly.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handlePay}
                disabled={loading || !amount || amountNum < 1 || !phone.trim()}
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
                KES {amountNum.toLocaleString()} has been added to your savings account.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount Deposited</span>
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
