import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, QrCode, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Purpose = "savings" | "wallet" | "cycle" | "share_purchase";
type Gateway = "pesapal" | "qr";

interface Props {
  memberId: string;
  cycleNumber?: number | null;
  onComplete?: () => void;
}

function qrImage(value: string) {
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}

export function BackupPaymentOptions({ memberId, cycleNumber, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState<Purpose>("savings");
  const [gateway, setGateway] = useState<Gateway>("pesapal");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<{ id: string; image: string; reference: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  function close() {
    if (pollRef.current) clearInterval(pollRef.current);
    setOpen(false);
    setQr(null);
    setStatus("idle");
    setLoading(false);
  }

  async function pollQr(id: string) {
    const check = async () => {
      try {
        const result = await api.get<{ status?: string; mpesaRef?: string }>(`/mpesa/qr/${encodeURIComponent(id)}/status`);
        const state = String(result.status || "").toLowerCase();
        if (state === "success" || state === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("success");
          toast.success("M-Pesa QR payment verified successfully");
          onComplete?.();
        } else if (["failed", "cancelled", "declined"].includes(state)) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("failed");
        }
      } catch {
        // Keep checking while the payer completes the QR payment.
      }
    };
    await check();
    pollRef.current = setInterval(() => void check(), 5000);
  }

  async function startPayment() {
    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setLoading(true);
    setStatus("pending");
    try {
      if (gateway === "pesapal") {
        const order = await api.post<{ orderTrackingId?: string; redirectUrl?: string }>("/pesapal/orders", {
          memberId,
          amount: value,
          purpose,
          cycleNumber: purpose === "cycle" ? cycleNumber : undefined,
        });
        if (order.redirectUrl) {
          window.location.assign(order.redirectUrl);
          return;
        }
        if (!order.orderTrackingId) throw new Error("Pesapal did not return an order reference");
        toast.success("Pesapal payment order created. Complete it from the payment page.");
        setStatus("pending");
        return;
      }

      const result = await api.post<{ checkoutRequestId: string; reference: string; qrCode: string }>("/mpesa/qr/generate", {
        memberId,
        amount: value,
        purpose,
      });
      setQr({ id: result.checkoutRequestId, reference: result.reference, image: qrImage(result.qrCode) });
      void pollQr(result.checkoutRequestId);
    } catch (error) {
      setStatus("failed");
      toast.error(error instanceof Error ? error.message : "Backup payment could not be started");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="gap-2 border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-4 w-4" /> Backup payment options
      </Button>
      <Dialog open={open} onOpenChange={(value) => { if (!value) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alternative payment</DialogTitle>
            <DialogDescription>
              Use Pesapal or a Daraja M-Pesa QR code if the normal M-Pesa prompt is unavailable. Your existing M-Pesa flow is unchanged.
            </DialogDescription>
          </DialogHeader>

          {!qr && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={gateway === "pesapal" ? "default" : "outline"} onClick={() => setGateway("pesapal")} className="gap-2">
                  <CreditCard className="h-4 w-4" /> Pesapal
                </Button>
                <Button type="button" variant={gateway === "qr" ? "default" : "outline"} onClick={() => setGateway("qr")} className="gap-2">
                  <QrCode className="h-4 w-4" /> M-Pesa QR
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["savings", "Savings"],
                  ["wallet", "Wallet"],
                  ["cycle", "Cycle"],
                  ["share_purchase", "Shares"],
                ] as const).map(([value, label]) => (
                  <Button key={value} type="button" variant={purpose === value ? "secondary" : "outline"} onClick={() => setPurpose(value)}>
                    {label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="backup-payment-amount">Amount (KES)</Label>
                <Input id="backup-payment-amount" type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Enter amount" />
              </div>
              <Button type="button" className="w-full gap-2" disabled={loading} onClick={() => void startPayment()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : gateway === "qr" ? <QrCode className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                {gateway === "qr" ? "Generate M-Pesa QR" : "Continue with Pesapal"}
              </Button>
              {status === "failed" && <p className="flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" /> Payment could not be started.</p>}
            </div>
          )}

          {qr && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Scan this QR code in the M-Pesa app and confirm the amount shown.</p>
              <img src={qr.image} alt="M-Pesa payment QR code" className="mx-auto h-64 w-64 rounded-lg border p-2" />
              <p className="text-xs text-muted-foreground">Reference: <span className="font-semibold">{qr.reference}</span></p>
              {status === "pending" && <p className="text-sm">Waiting for M-Pesa confirmation…</p>}
              {status === "success" && <p className="font-semibold text-green-600">Payment received successfully.</p>}
              {status === "failed" && <p className="text-sm text-destructive">Payment was not completed.</p>}
              <Button type="button" variant="outline" className="w-full" onClick={close}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
