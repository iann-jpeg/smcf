import { useEffect, useState } from "react";
import { CheckCircle2, Clock, CreditCard, Download, Receipt, Shield, Sparkles, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

type TenXProgress = {
  enrolled: boolean;
  member: { dueAmount: number; amountPaid: number; status: Contribution["status"]; paymentDate?: string | null };
  group: {
    enrolledMembers: number;
    current: {
      period: string;
      dueAmount: number;
      expected: number;
      collected: number;
      outstanding: number;
      paidMembers: number;
      paymentRate: number;
      status: string;
    };
    cumulativeExpected: number;
    cumulativeCollected: number;
    cumulativeRate: number;
  };
  history: Array<{
    period: string;
    collected: number;
    paidMembers: number;
    paymentRate: number;
  }>;
};

const money = (value = 0) => `KES ${Number(value).toLocaleString()}`;
const periodLabel = (value?: string) => value ? new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Current period";

export default function TenXMemberPanel({ userData }: { userData: any }) {
  const { toast } = useToast();
  const [data, setData] = useState<TenXData | null>(null);
  const [progress, setProgress] = useState<TenXProgress | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(userData?.phone || userData?.phoneNumber || "");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [progressResult, contributionResult] = await Promise.allSettled([
      fetch(`${API_BASE}/api/tenx/progress`, { headers: authService.getAuthHeaders() }),
      fetch(`${API_BASE}/api/tenx/me`, { headers: authService.getAuthHeaders() }),
    ]);
    if (progressResult.status === "fulfilled" && progressResult.value.ok) {
      const body = await progressResult.value.json();
      if (body.success) setProgress(body.data);
    }
    if (contributionResult.status === "fulfilled" && contributionResult.value.ok) {
      const body = await contributionResult.value.json();
      if (body.success) setData(body.data);
    }
  };

  useEffect(() => { if (userData?._id || userData?.id) load(); }, [userData?._id, userData?.id]);

  if (!progress) return null;
  const current = data?.currentPeriod;
  const contributions = data?.contributions || [];
  const currentPayment = contributions.find((item) => item.period === current?.period && item.status === "SUCCESSFUL");
  const pending = contributions.find((item) => item.period === current?.period && item.status === "PENDING");
  const group = progress.group;
  const currentGroup = group.current;
  const personalPaid = progress.member.amountPaid >= progress.member.dueAmount && progress.member.dueAmount > 0;

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
    <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/40 dark:via-background dark:to-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-emerald-700" />The 10X Group is moving</CardTitle>
            <CardDescription>One shared view of the momentum everyone is creating together.</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit gap-1 bg-amber-100 text-amber-900"><Sparkles className="h-3.5 w-3.5" />Live group progress</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-white/5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />Members enrolled</p><p className="mt-1 text-2xl font-bold">{group.enrolledMembers}</p><p className="text-xs text-muted-foreground">building the fund</p></div>
          <div className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-white/5"><p className="text-xs text-muted-foreground">{periodLabel(currentGroup.period)} collected</p><p className="mt-1 text-2xl font-bold">{money(currentGroup.collected)}</p><p className="text-xs text-muted-foreground">of {money(currentGroup.expected)} target</p></div>
          <div className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-white/5"><p className="text-xs text-muted-foreground">Group completion</p><p className="mt-1 text-2xl font-bold text-emerald-700">{currentGroup.paymentRate}%</p><p className="text-xs text-muted-foreground">{currentGroup.paidMembers} members paid this period</p></div>
          <div className="rounded-xl bg-white/80 p-3 shadow-sm dark:bg-white/5"><p className="text-xs text-muted-foreground">Journey to date</p><p className="mt-1 text-2xl font-bold text-amber-700">{group.cumulativeRate}%</p><p className="text-xs text-muted-foreground">{money(group.cumulativeCollected)} raised across tracked periods</p></div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">{periodLabel(currentGroup.period)} progress</span><span className="font-semibold text-emerald-700">{currentGroup.paymentRate}%</span></div>
          <Progress value={currentGroup.paymentRate} className="h-3 bg-emerald-100 dark:bg-emerald-950" />
          <p className="mt-2 text-xs text-muted-foreground">{currentGroup.outstanding > 0 ? `${money(currentGroup.outstanding)} remaining to complete this month's group target.` : "This month's group target is complete. Amazing teamwork!"}</p>
        </div>
        {group.history.length > 1 && <div className="flex items-end gap-1.5" aria-label="Recent 10X contribution momentum">
          {group.history.slice(0, 6).reverse().map((item) => <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={item.period}><div className="flex h-14 w-full items-end"><div className="w-full rounded-t bg-emerald-500/80 transition-all" style={{ height: `${Math.max(8, item.paymentRate)}%` }} title={`${periodLabel(item.period)}: ${item.paymentRate}%`} /></div><span className="text-[10px] text-muted-foreground">{new Date(`${item.period}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</span></div>)}
        </div>}
        {progress.enrolled ? <div className="rounded-xl border border-emerald-200 bg-emerald-100/60 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"><p className="font-medium">{personalPaid ? "You are helping push the group forward." : "Your contribution can move the group closer to 100%."}</p><p className="mt-1 text-muted-foreground">Your status: {personalPaid ? "paid" : progress.member.status === "PENDING" ? "payment due" : progress.member.status.toLowerCase()}.</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20"><p className="font-medium">Following the 10X journey</p><p className="mt-1 text-muted-foreground">You are not enrolled yet, but you can see the group progress here.</p></div>}
      </CardContent>
    </Card>
    {data && progress.enrolled && <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
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
    </Card>}
    {contributions.length > 0 && <Card><CardHeader><CardTitle>My 10X Contributions</CardTitle><CardDescription>Verified payment history</CardDescription></CardHeader><CardContent><div className="divide-y">{contributions.map((item) => <div className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={item._id}><div><p className="font-medium">{periodLabel(item.period)}</p><p className="text-sm text-muted-foreground">{item.transaction_reference || "No reference yet"}</p></div><div><p>{money(item.amount_paid || item.amount_due)}</p><Badge variant={item.status === "SUCCESSFUL" ? "default" : "secondary"}>{item.status}</Badge></div>{item.status === "SUCCESSFUL" && <Button variant="ghost" size="sm" onClick={() => viewReceipt(item)}><Download className="mr-2 h-4 w-4" />Receipt</Button>}</div>)}</div></CardContent></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>10X Group Contribution</DialogTitle><DialogDescription>{periodLabel(current?.period)} | {money(current?.due_amount)}</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Member</Label><p className="font-medium">{userData.name} ({userData.member_id || userData.memberId})</p></div><div><Label htmlFor="tenx-phone">M-Pesa phone number</Label><Input id="tenx-phone" value={phone} onChange={(event) => setPhone(event.target.value)} /></div></div><DialogFooter><Button onClick={startPayment} disabled={busy || !phone}>{busy ? "Starting..." : "Proceed to payment"}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
