import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  currentShares: number;
  memberId: string;  // mongo _id of the current member (for cache invalidation)
}

type Step = "input" | "success";

interface TransferResult {
  amount: number;
  to: { name: string; memberId: string; newShares: number };
  from: { newShares: number };
}

export function ShareTransferDialog({ open, onClose, currentShares, memberId }: Props) {
  const qc = useQueryClient();
  const [step,            setStep]            = useState<Step>("input");
  const [recipientId,     setRecipientId]     = useState("");
  const [amount,          setAmount]          = useState("");
  const [note,            setNote]            = useState("");
  const [loading,         setLoading]         = useState(false);
  const [result,          setResult]          = useState<TransferResult | null>(null);

  useEffect(() => {
    if (open) {
      setStep("input");
      setRecipientId("");
      setAmount("");
      setNote("");
      setLoading(false);
      setResult(null);
    }
  }, [open]);

  async function handleTransfer() {
    const num = Number(amount);
    if (!recipientId.trim()) { toast.error("Enter the recipient's Member ID"); return; }
    if (!num || num < 100)   { toast.error("Minimum transfer amount is KES 100"); return; }
    if (num > currentShares) { toast.error(`Insufficient shares — you have KES ${currentShares.toLocaleString()}`); return; }

    setLoading(true);
    try {
      const res = await api.post<TransferResult>("/shares/transfer", {
        recipientMemberId: recipientId.trim().toUpperCase(),
        amount: num,
        description: note.trim() || undefined,
      });
      setResult(res);
      setStep("success");
      // Invalidate member cache so share balance refreshes
      qc.invalidateQueries({ queryKey: ["my-member"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["my-share-summary"] });
      qc.invalidateQueries({ queryKey: ["my-transactions"] });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Transfer failed. Please check the recipient ID and try again.");
    } finally {
      setLoading(false);
    }
  }

  const amountNum = Number(amount) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">

        {step === "input" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading">
                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Transfer Share Capital
              </DialogTitle>
              <DialogDescription>
                Transfer part of your share capital to another SACCO member. Your current balance is{" "}
                <span className="font-semibold text-foreground">KES {Number(currentShares).toLocaleString()}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="transfer-recipient">Recipient Member ID</Label>
                <Input
                  id="transfer-recipient"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  placeholder="e.g. MCF001"
                  className="uppercase"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the SACCO member ID of the person you want to transfer to.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-amount">Amount (KES)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm select-none">KES</span>
                  <Input
                    id="transfer-amount"
                    type="number"
                    min={100}
                    max={currentShares}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-12 text-lg font-bold"
                    placeholder="0"
                  />
                </div>
                {amountNum > currentShares && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Exceeds your available share capital.
                  </p>
                )}
                {amountNum > 0 && amountNum <= currentShares && (
                  <p className="text-xs text-muted-foreground">
                    Remaining after transfer:{" "}
                    <span className="font-semibold text-foreground">
                      KES {(currentShares - amountNum).toLocaleString()}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-note">Note (optional)</Label>
                <Input
                  id="transfer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for transfer"
                  maxLength={200}
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 text-[12px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Share transfers are <strong>irreversible</strong>. Please verify the recipient member ID before confirming.</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleTransfer}
                disabled={loading || !recipientId.trim() || amountNum < 100 || amountNum > currentShares}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {loading ? "Transferring…" : "Transfer Shares"}
              </Button>
            </div>
          </>
        )}

        {step === "success" && result && (
          <div className="flex flex-col items-center text-center py-4 gap-5">
            <div className="p-5 rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg">Transfer Complete</h3>
              <p className="text-muted-foreground text-sm">
                KES {result.amount.toLocaleString()} has been transferred to{" "}
                <span className="font-semibold text-foreground">{result.to.name}</span>.
              </p>
            </div>

            <div className="w-full rounded-xl border bg-muted/40 divide-y text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">To</span>
                <span className="font-semibold">{result.to.name} ({result.to.memberId})</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Amount Transferred</span>
                <span className="font-bold text-blue-600">KES {result.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Your New Share Capital</span>
                <span className="font-semibold">KES {result.from.newShares.toLocaleString()}</span>
              </div>
            </div>

            <Button className="w-full h-11" onClick={onClose}>
              <CheckCircle2 className="mr-2 h-5 w-5" /> Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
