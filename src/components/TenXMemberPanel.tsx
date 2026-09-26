import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, Download, Receipt, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

type Contribution = {
  _id: string;
  period: string;
  amount_due: number;
  amount_paid: number;
  payment_date?: string;
  transaction_reference?: string;
  receipt_number?: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED" | "CANCELLED";
};

type TenXData = {
  currentPeriod?: { period: string; due_amount: number; due_date?: string };
  contributions: Contribution[];
};

const money = (value = 0) => `KES ${Number(value).toLocaleString()}`;
const periodLabel = (value?: string) => value ? new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Current period";

export default function TenXMemberPanel({ userData }: { userData: any }) {
  const { toast } = useToast();
  const [data, setData] = useState<TenXData | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(userData?.phone || userData?.phoneNumber || "");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch(`${API_BASE}/api/tenx/me`, { headers: authService.getAuthHeaders() });
    if (!response.ok) return;
    const body = await response.json();
    if (body.success) setData(body.data);
  };

  useEffect(() => { if (userData?._id || userData?.id) load(); }, [userData?._id, userData?.id]);

  if (!data) return null;
  const current = data.currentPeriod;
  const currentPayment = data.contributions.find((item) => item.period === current?.period && item.status === "SUCCESSFUL");
  const pending = data.contributions.find((item) => item.period === current?.period && item.status === "PENDING");

  const startPayment = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/tenx/payments/stk-push`, { method: "POST", headers: { ...authService.getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ phone, period: current?.period }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to start payment");
      setOpen(false);
      toast({ title: "Payment prompt sent", description: "Complete the M-Pesa prompt. Your contribution will update after verification." });
      window.setTimeout(load, 3000);
    } catch (error: any) { toast({ title: "Payment could not start", description: error.message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const viewReceipt = (item: Contribution) => {
    const receipt = ["SMART MOVES DEVELOPMENT AGENCY", "SMCF / 10X GROUP", "", `Receipt Number: ${item.receipt_number || "Pending"}`, `Member: ${userData.name || ""}`, `Member Number: ${userData.member_id || userData.memberId || ""}`, `Contribution Period: ${periodLabel(item.period)}`, `Amount Paid: ${money(item.amount_paid)}`, `Payment Date: ${item.payment_date ? new Date(item.payment_date).toLocaleString() : ""}`, `Payment Reference: ${item.transaction_reference || ""}`, "Payment Status: PAID"]; 
    const popup = window.open("", "10x-receipt", "width=720,height=800");
    if (popup) { popup.document.write(`<pre style="font:16px/1.8 sans-serif;max-width:620px;margin:48px auto;white-space:pre-wrap">${receipt.join("\n")}</pre>`); popup.document.close(); }
  };

  return <section className="space-y-4">
    <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-emerald-700" />10X Group</CardTitle><CardDescription>Restricted monthly contribution account</CardDescription></div>
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">10X MEMBER</Badge>
      </CardHeader>
      <CardContent>
        {!current ? <p className="text-sm text-muted-foreground">No open contribution period.</p> : <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-sm text-muted-foreground">10X Monthly Contribution</p><p className="text-xl font-semibold">{periodLabel(current.period)}</p><p className="mt-1 text-lg">{money(current.due_amount)}</p>{pending && <p className="mt-2 flex items-center gap-2 text-sm text-amber-700"><Clock className="h-4 w-4" />Payment pending verification</p>}{currentPayment && <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Paid {currentPayment.payment_date ? new Date(currentPayment.payment_date).toLocaleDateString() : ""}</p>}</div>
          {currentPayment ? <Button variant="outline" onClick={() => viewReceipt(currentPayment)}><Receipt className="mr-2 h-4 w-4" />View receipt</Button> : <Button onClick={() => setOpen(true)} disabled={Boolean(pending)}><CreditCard className="mr-2 h-4 w-4" />Make 10X payment</Button>}
        </div>}
      </CardContent>
    </Card>
    {data.contributions.length > 0 && <Card><CardHeader><CardTitle>My 10X Contributions</CardTitle><CardDescription>Verified payment history</CardDescription></CardHeader><CardContent><div className="divide-y">{data.contributions.map((item) => <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={item._id}><div><p className="font-medium">{periodLabel(item.period)}</p><p className="text-sm text-muted-foreground">{item.transaction_reference || "No reference yet"}</p></div><div><p>{money(item.amount_paid || item.amount_due)}</p><Badge variant={item.status === "SUCCESSFUL" ? "default" : "secondary"}>{item.status}</Badge></div>{item.status === "SUCCESSFUL" && <Button variant="ghost" size="sm" onClick={() => viewReceipt(item)}><Download className="mr-2 h-4 w-4" />Receipt</Button>}</div>)}</div></CardContent></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>10X Group Contribution</DialogTitle><DialogDescription>{periodLabel(current?.period)} | {money(current?.due_amount)}</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Member</Label><p className="font-medium">{userData.name} ({userData.member_id || userData.memberId})</p></div><div><Label htmlFor="tenx-phone">M-Pesa phone number</Label><Input id="tenx-phone" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></div><DialogFooter><Button onClick={startPayment} disabled={busy || !phone}>{busy ? "Starting..." : "Proceed to payment"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
