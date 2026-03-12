import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Landmark, RefreshCw, ExternalLink, Clock, CheckCircle2, Loader2, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

const LIPIA_PAYMENT_URL = "https://lipia-online.vercel.app/link/smcfholdings";

type Step = "input" | "sent";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberPhone?: string | null;
  currentShares?: number;
}

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

export function ShareSubscriptionDialog({ open, onClose, memberId, memberPhone, currentShares = 0 }: Props) {
  const [step,    setStep]    = useState<Step>("input");
  const [amount,  setAmount]  = useState("");
  const [phone,   setPhone]   = useState(memberPhone ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("input");
      setAmount("");
      setPhone(memberPhone ?? "");
      setLoading(false);
    }
  }, [open, memberPhone]);

  async function handlePay() {
    const num = Number(amount);
    if (!num || num < 100) { toast.error("Minimum share subscription is KES 100"); return; }
    if (!phone.trim()) { toast.error("Enter your M-Pesa phone number"); return; }

    setLoading(true);
    try {
      await api.post("/mpesa/payment-initiated", {
        memberId,
        amount: num,
        phone: phone.trim(),
        type: "share_subscribe",
      });
      window.open(LIPIA_PAYMENT_URL, "_blank", "noopener,noreferrer");
      setStep("sent");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = Number(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">

        {/* Step 1: Input */}
        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <div className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Landmark className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Subscribe for Shares
              </DialogTitle>
              <DialogDescription>
                Purchase share capital via M-Pesa. Your current share balance is{" "}
                <span className="font-semibold text-foreground">KES {Number(currentShares).toLocaleString()}</span>.
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
                          ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-400"
                          : "border-border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                      )}
                    >
                      {q.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="share-amount">Amount (KES)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">KES</span>
                  <Input
                    id="share-amount"
                    type="number"
                    min={100}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 text-lg font-bold"
                    placeholder="0"
                  />
                </div>
                {amountNum > 0 && (
                  <p className="text-xs text-muted-foreground">
                    New share capital balance will be{" "}
                    <span className="font-semibold text-purple-600">
                      KES {(currentShares + amountNum).toLocaleString()}
                    </span>{" "}
                    after confirmation.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="share-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="share-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="e.g. 0712 345 678"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-900/10 flex items-start gap-3 px-4 py-3">
                <div className="flex items-center justify-center rounded bg-[#00A550] px-2 py-0.5 shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-black tracking-wide">M-PESA</span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  Payment goes to <span className="font-semibold text-foreground"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO Till 6938069</span> via Lipia Online.
                  Your share capital will be updated after staff confirmation.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handlePay}
                disabled={loading || !amount || amountNum < 100 || !phone.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {loading ? "Opening…" : "Pay via Lipia"}
              </Button>
            </div>
          </>
        )}

        {/* Step 2: Sent */}
        {step === "sent" && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping" />
              <div className="relative p-5 rounded-full bg-purple-100 dark:bg-purple-900/40">
                <Clock className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg">Complete Payment on Lipia</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Pay <span className="font-semibold text-foreground">KES {amountNum.toLocaleString()}</span> on the Lipia tab that just opened.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Purpose</span>
                <span className="font-semibold">Share Capital Subscription</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-purple-600">KES {amountNum.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Pay To</span>
                <span className="font-semibold"><span className="text-[#C9A227]">SMC</span><span className="text-[#2D7A36]">F</span> SACCO (Till 6938069)</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-[12px] text-amber-700 dark:text-amber-400 text-left w-full flex items-start gap-2">
              <span className="text-base">⏳</span>
              <span>
                Your subscription will show as <strong>Pending</strong> until a staff member confirms it.
                Your share capital will update immediately after confirmation.
              </span>
            </div>

            <Button
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white h-11 text-base font-semibold"
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
