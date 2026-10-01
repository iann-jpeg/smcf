import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, BarChart3, CalendarPlus, CheckCircle2, Download, FastForward, FileText, Landmark, Megaphone, RefreshCw, Save, Send, Settings, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const money = (value: unknown) => `KES ${Number(value || 0).toLocaleString()}`;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-KE") : "-";

export default function CycleAdmin() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "overview");
  const [savingMember, setSavingMember] = useState<string | null>(null);
  const [cycleAmount, setCycleAmount] = useState("");
  const [walletMembers, setWalletMembers] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletAction, setWalletAction] = useState<string | null>(null);
  const [walletDrafts, setWalletDrafts] = useState<Record<string, string>>({});
  const [startingCycle, setStartingCycle] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const response = await api.get<any>("/cycle-admin/overview");
      setData(response?.data ?? response ?? {});
    } catch (error: any) {
      toast({ title: "Unable to load cycle administration", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => { void load(); }, [load]);

  const currentCycle = data.currentCycle;
  const stats = data.stats || {};
  const members = Array.isArray(data.members) ? data.members : [];
  const allMembers = Array.isArray(data.allMembers) ? data.allMembers : members;
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const disbursements = Array.isArray(data.disbursements) ? data.disbursements : [];
  const advancePayments = Array.isArray(data.advancePayments) ? data.advancePayments : [];
  useEffect(() => { if (currentCycle?.contribution_amount) setCycleAmount(String(currentCycle.contribution_amount)); }, [currentCycle?.contribution_amount]);
  useEffect(() => {
    setSelectedMemberIds(members.map((member: any) => String(member._id)));
  }, [data.currentCycle?._id, members.length]);
  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const [membersResponse, withdrawalsResponse] = await Promise.all([
        api.get<any>("/savings/admin/all"),
        api.get<any>("/savings/admin/pending-withdrawals"),
      ]);
      const membersResult = membersResponse?.data ?? membersResponse ?? [];
      const withdrawalsResult = withdrawalsResponse?.data ?? withdrawalsResponse ?? [];
      setWalletMembers(Array.isArray(membersResult) ? membersResult : []);
      setWalletDrafts(Object.fromEntries((Array.isArray(membersResult) ? membersResult : []).map((member: any) => [String(member._id), String(member.currentBalance || 0)])));
      setPendingWithdrawals(Array.isArray(withdrawalsResult) ? withdrawalsResult : []);
    } catch (error: any) {
      toast({ title: "Unable to load wallet records", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setWalletLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (tab === "wallet") void loadWallet(); }, [tab, loadWallet]);
  const pendingMembers = useMemo(() => {
    const paid = new Set((Array.isArray(data.paidMemberIds) ? data.paidMemberIds : []).map(String));
    return members.filter((member: any) => !paid.has(String(member._id)) && !paid.has(String(member.member_id)));
  }, [data.paidMemberIds, members]);

  const recordManualPayment = async (member: any, amount: number, noPayment = false) => {
    setSavingMember(String(member._id));
    try {
      await api.post("/cycle-admin/payments/manual", {
        memberId: member._id,
        amount: Number(amount || member.monthly_contribution || currentCycle?.contribution_amount || 200),
        phone: member.phone,
        cycleNumber: currentCycle?.cycle_number,
        noPayment,
      });
      toast({ title: "Cycle payment recorded", description: `${member.name} is marked paid for cycle #${currentCycle?.cycle_number}.` });
      await load();
    } catch (error: any) {
      toast({ title: "Could not record payment", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSavingMember(null);
    }
  };

  const exportRecords = () => {
    const rows = [["Member ID", "Name", "Phone", "Status", "Cycle Contribution"], ...members.map((member: any) => [member.memberId || member.member_id, member.name, member.phone || "", member.status || "", member.total_cycle_contribution || 0])];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `smcf-cycle-${currentCycle?.cycle_number || "records"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateCycleAmount = async () => {
    try {
      await api.put(`/cycle-admin/cycles/${currentCycle?._id}`, { contributionAmount: Number(cycleAmount), memberCount: members.length });
      toast({ title: "Contribution amount updated", description: `New cycle contribution: ${money(cycleAmount)}` });
      await load();
    } catch (error: any) {
      toast({ title: "Could not update cycle", description: error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const setupCycle = async () => {
    if (!window.confirm("Set up a new active cycle? The current active cycle will be completed.")) return;
    setStartingCycle(true);
    try {
      const payload = { contributionAmount: Number(cycleAmount || currentCycle?.contribution_amount || 224), memberIds: selectedMemberIds };
      await api.post("/cycle-admin/cycles/start", payload);
      toast({ title: "Cycle set up", description: "The new active cycle is ready for member payments." });
      await load();
    } catch (error: any) {
      toast({ title: "Could not set up cycle", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setStartingCycle(false);
    }
  };

  const actOnWithdrawal = async (withdrawalId: string, action: "approve" | "reject") => {
    setWalletAction(withdrawalId);
    try {
      await api.post(`/savings/admin/${action}-withdrawal/${withdrawalId}`, action === "reject" ? { rejection_reason: "Rejected by SACCO administrator" } : {});
      toast({ title: action === "approve" ? "Withdrawal approved" : "Withdrawal rejected", description: "Wallet records have been updated." });
      await loadWallet();
    } catch (error: any) {
      toast({ title: "Wallet action failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setWalletAction(null);
    }
  };

  const applyWalletInterest = async () => {
    setWalletAction("interest");
    try {
      await api.post("/savings/admin/apply-interest", {});
      toast({ title: "Interest applied", description: "Wallet balances and interest records were updated." });
      await loadWallet();
    } catch (error: any) {
      toast({ title: "Interest application failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setWalletAction(null);
    }
  };

  const saveWalletBalance = async (memberId: string) => {
    setWalletAction(memberId);
    try {
      await api.put(`/cycle-admin/wallet/${memberId}`, { currentBalance: Number(walletDrafts[memberId]) });
      toast({ title: "Wallet balance saved", description: "An adjustment transaction was added to the member ledger." });
      await loadWallet();
    } catch (error: any) {
      toast({ title: "Wallet save failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setWalletAction(null);
    }
  };

  if (!isAdmin) return <Card className="m-6 border-destructive/30"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><ShieldCheck className="h-5 w-5" /> Access restricted</CardTitle><CardDescription>Administrator access is required.</CardDescription></CardHeader></Card>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">SACCO Administration</p><h1 className="text-3xl font-bold tracking-tight">Cycles & Member Operations</h1><p className="text-sm text-muted-foreground">All cycle-side controls, payment tracking, disbursements and records in one admin workspace.</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => void setupCycle()} disabled={startingCycle || selectedMemberIds.length === 0}><CalendarPlus className="mr-2 h-4 w-4" /> {startingCycle ? "Setting up..." : "Set up cycle"}</Button><Button variant="outline" onClick={exportRecords}><Download className="mr-2 h-4 w-4" /> Export records</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric title="Active cycle" value={`#${stats.cycleNumber || "-"}`} icon={TrendingUp} /><Metric title="Paid this cycle" value={`${stats.paidMembers || 0}/${stats.totalMembers || 0}`} icon={CheckCircle2} /><Metric title="Collected" value={money(stats.collected)} icon={Wallet} /><Metric title="Pending members" value={String(stats.pendingMembers || 0)} icon={AlertCircle} /><Metric title="Paid in advance" value={String(advancePayments.length)} icon={FastForward} /></div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value); setSearchParams({ tab: value }); }} className="space-y-4">
        <TabsList className="flex w-full justify-start overflow-x-auto">{[["overview", "Overview"], ["members", "Members"], ["cycle-table", "Cycle table"], ["payments", "Payments"], ["advance", "Advance payments"], ["disbursements", "Disbursements"], ["analytics", "Analytics"], ["wallet", "Wallet deposits"], ["savings", "Savings & reserve"], ["admin", "Other admin"]].map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList>

        <TabsContent value="overview" className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Current cycle status</CardTitle><CardDescription>Cycle #{currentCycle?.cycle_number || "-"} · {currentCycle?.status || "not active"}</CardDescription></CardHeader><CardContent className="space-y-3"><ProgressRow label="Collection progress" value={stats.totalMembers ? (stats.paidMembers / stats.totalMembers) * 100 : 0} /><Row label="Target amount" value={money(stats.target)} /><Row label="Remaining" value={money(Math.max(0, Number(stats.target || 0) - Number(stats.collected || 0)))} /><Row label="Cycle dates" value={`${date(currentCycle?.start_date)} - ${date(currentCycle?.end_date)}`} /><div className="flex items-center gap-2 border-t pt-3"><Input className="w-36" type="number" value={cycleAmount} onChange={(event) => setCycleAmount(event.target.value)} aria-label="Contribution amount" /><Button size="sm" onClick={() => void updateCycleAmount()} disabled={!currentCycle?._id}>Update contribution</Button></div></CardContent></Card><Card><CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Legacy cycle actions are now available inside SACCO administration.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setTab("members")}><Wallet className="mr-2 h-4 w-4" /> Manage payment status</Button><Button variant="outline" onClick={() => setTab("disbursements")}><Landmark className="mr-2 h-4 w-4" /> Manage payouts</Button><Button variant="outline" onClick={exportRecords}><FileText className="mr-2 h-4 w-4" /> Export records</Button><Button asChild variant="outline"><Link to="/notifications"><Megaphone className="mr-2 h-4 w-4" /> Announcements</Link></Button></CardContent></Card></div></TabsContent>

        <TabsContent value="members"><Card><CardHeader><CardTitle>Choose cycle members</CardTitle><CardDescription>Select existing SACCO members who will participate when the next cycle is set up.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-2">{allMembers.map((member: any) => { const memberId = String(member._id); const selected = selectedMemberIds.includes(memberId); return <label key={memberId} className="flex cursor-pointer items-center gap-3 rounded-md border p-3"><input type="checkbox" checked={selected} onChange={() => setSelectedMemberIds((current) => selected ? current.filter((id) => id !== memberId) : [...current, memberId])} /><span><span className="block font-medium">{member.name}</span><span className="text-xs text-muted-foreground">{member.member_id || member.memberId} {member.phone ? `| ${member.phone}` : ""}</span></span></label>; })}</div><p className="text-xs text-muted-foreground">{selectedMemberIds.length} member{selectedMemberIds.length === 1 ? "" : "s"} selected for the next cycle.</p><div className="border-t pt-3">{members.map((member: any) => <MemberRow key={String(member._id)} member={member} pending={pendingMembers.some((item: any) => String(item._id) === String(member._id))} loading={savingMember === String(member._id)} onMarkPaid={(amount) => void recordManualPayment(member, amount)} onMarkNoPayment={(amount) => void recordManualPayment(member, amount, true)} />)}</div></CardContent></Card></TabsContent>

        <TabsContent value="cycle-table"><Card><CardHeader><CardTitle>Cycle member contribution table</CardTitle><CardDescription>Expected contribution, payment status, and cycle totals for the active cycle.</CardDescription></CardHeader><CardContent>{members.length === 0 ? <Empty text="No cycle members found." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Member</th><th className="p-2">Position</th><th className="p-2 text-right">Expected</th><th className="p-2 text-right">Paid</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{members.map((member: any) => { const pending = pendingMembers.some((item: any) => String(item._id) === String(member._id)); const payment = payments.find((item: any) => String(item.member_id?._id || item.member_id) === String(member._id)); const collected = !pending && Number(payment?.amount || 0) > 0; return <tr key={String(member._id)} className={collected ? "border-b last:border-0 bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35" : "border-b last:border-0"}><td className="p-2"><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.member_id || member.memberId}</p></td><td className="p-2">{member.position || "-"}</td><td className="p-2 text-right">{money(member.monthly_contribution || currentCycle?.contribution_amount || 224)}</td><td className="p-2 text-right">{money(payment?.amount || 0)}</td><td className="p-2"><Badge variant={pending ? "outline" : "default"}>{pending ? "Pending" : "Paid"}</Badge></td><td className="p-2">{pending && <Button size="sm" onClick={() => void recordManualPayment(member, Number(member.monthly_contribution || currentCycle?.contribution_amount || 224))} disabled={savingMember === String(member._id)}>Record paid</Button>}</td></tr>; })}</tbody></table></div>}</CardContent></Card></TabsContent>

        <TabsContent value="payments"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Cycle payment tracking</CardTitle><CardDescription>STK, manual and historical cycle payment records.</CardDescription></CardHeader><CardContent className="space-y-2">{payments.length === 0 ? <Empty text="No payments recorded for the active cycle." /> : payments.map((payment: any) => <div key={String(payment._id)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{payment.member_id?.name || payment.memberId || payment.phone || "Member"}</p><p className="text-xs text-muted-foreground">Cycle #{payment.cycle_number} · {payment.mpesa_transaction_id || payment.transaction_reference || "Manual"} · {date(payment.date || payment.created_at)}</p></div><div className="text-right"><p className="font-semibold">{money(payment.amount)}</p><Badge variant={payment.status === "completed" ? "default" : "outline"}>{payment.status || "pending"}</Badge></div></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="advance"><Card><CardHeader><CardTitle className="flex items-center gap-2"><FastForward className="h-4 w-4" /> Paid in advance</CardTitle><CardDescription>Members whose recorded contribution is ahead of the active cycle.</CardDescription></CardHeader><CardContent>{advancePayments.length === 0 ? <Empty text="No advance payments found." /> : advancePayments.map((item: any) => <div key={item.memberId} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.memberId} · {item.cyclesPaid} cycles paid</p></div><Badge variant="secondary">+{item.cyclesAhead} ahead</Badge></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="disbursements"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-4 w-4" /> Disbursement & payout history</CardTitle><CardDescription>Previous cycle payouts and recipient records.</CardDescription></CardHeader><CardContent>{disbursements.length === 0 ? <Empty text="No disbursement records found." /> : disbursements.map((item: any) => <div key={String(item._id)} className="flex items-center justify-between border-b py-3 last:border-0"><div><p className="font-medium">{item.recipient_id?.name || item.member_id || "Recipient"}</p><p className="text-xs text-muted-foreground">Cycle #{item.cycle_id?.cycle_number || item.cycle_number || "-"} · {item.mpesa_transaction_id || item.phone || "Manual"}</p></div><div className="text-right"><p className="font-semibold">{money(item.amount)}</p><Badge>{item.status || "completed"}</Badge></div></div>)}</CardContent></Card></TabsContent>

        <TabsContent value="analytics"><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Cycle analytics</CardTitle><CardDescription>Operational rates calculated from the active-cycle ledger.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><Row label="Payment rate" value={`${stats.totalMembers ? Math.round((stats.paidMembers / stats.totalMembers) * 100) : 0}%`} /><Row label="Average payment" value={money(stats.paidMembers ? Number(stats.collected) / Number(stats.paidMembers) : 0)} /><Row label="Cycles completed" value={String(Math.max(0, Number(stats.cycleNumber || 0) - 1))} /></CardContent></Card></TabsContent>

        <TabsContent value="wallet" className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Wallet deposits & withdrawals</h2><p className="text-sm text-muted-foreground">Edit a member&apos;s current wallet balance and save an auditable ledger adjustment.</p></div><Button onClick={() => void applyWalletInterest()} disabled={walletAction !== null}><TrendingUp className="mr-2 h-4 w-4" /> Apply monthly interest</Button></div><div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"><Card><CardHeader><CardTitle>Member wallet balances</CardTitle><CardDescription>{walletMembers.length} wallet records</CardDescription></CardHeader><CardContent>{walletLoading ? <Empty text="Loading wallet records..." /> : walletMembers.length === 0 ? <Empty text="No wallet records found." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Member</th><th className="p-2 text-right">Current balance</th><th className="p-2 text-right">Deposits</th><th className="p-2 text-right">Interest</th><th className="p-2">Save</th></tr></thead><tbody>{walletMembers.map((member: any) => <tr key={String(member._id)} className="border-b last:border-0"><td className="p-2"><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.member_id || member.memberId}</p></td><td className="p-2"><Input className="ml-auto w-32 text-right" type="number" min="0" value={walletDrafts[String(member._id)] ?? "0"} onChange={(event) => setWalletDrafts((current) => ({ ...current, [String(member._id)]: event.target.value }))} /></td><td className="p-2 text-right">{money(member.totalDeposits)}</td><td className="p-2 text-right">{money(member.totalInterestEarned)}</td><td className="p-2"><Button size="sm" variant="outline" onClick={() => void saveWalletBalance(String(member._id))} disabled={walletAction === String(member._id)}><Save className="mr-1 h-3.5 w-3.5" /> Save</Button></td></tr>)}</tbody></table></div>}</CardContent></Card><Card><CardHeader><CardTitle>Pending withdrawals</CardTitle><CardDescription>Approve or reject wallet withdrawals.</CardDescription></CardHeader><CardContent>{pendingWithdrawals.length === 0 ? <Empty text="No pending withdrawals." /> : <div className="space-y-3">{pendingWithdrawals.map((withdrawal: any) => <div key={String(withdrawal._id)} className="rounded-lg border p-3"><div className="flex items-center justify-between"><div><p className="font-medium">{withdrawal.member?.name || withdrawal.memberName || "Member"}</p><p className="text-xs text-muted-foreground">{date(withdrawal.createdAt || withdrawal.created_at)}</p></div><p className="font-semibold">{money(withdrawal.amount)}</p></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void actOnWithdrawal(String(withdrawal._id), "approve")} disabled={walletAction === String(withdrawal._id)}>Approve</Button><Button size="sm" variant="destructive" onClick={() => void actOnWithdrawal(String(withdrawal._id), "reject")} disabled={walletAction === String(withdrawal._id)}>Reject</Button></div></div>)}</div>}</CardContent></Card></div></TabsContent>
        <TabsContent value="savings"><ModuleLinks links={[["/members", "Member management", Wallet], ["/accounts", "Savings & wallet ledger", Wallet], ["/finance-compliance", "Reserve and compliance", ShieldCheck], ["/registration-fee", "Registration fees", FileText], ["/reports", "Financial reports", BarChart3]]} /></TabsContent>
        <TabsContent value="admin"><ModuleLinks links={[["/loans/approvals", "Loan approvals", CheckCircle2], ["/guarantors", "Guarantor management", ShieldCheck], ["/notifications", "Announcements and notifications", Megaphone], ["/admin-email", "Member messages", Send], ["/documents", "Member documents", FileText], ["/compliance", "Compliance and audit", ShieldCheck], ["/settings", "Admin settings", Settings]]} /></TabsContent>
      </Tabs>
      {loading && <p className="text-sm text-muted-foreground">Loading cycle administration...</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-md border bg-muted/20 p-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>; }
function ProgressRow({ label, value }: { label: string; value: number }) { return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span>{Math.round(value)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div>; }
function Empty({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>; }
function MemberRow({ member, pending, loading, onMarkPaid, onMarkNoPayment }: { member: any; pending: boolean; loading: boolean; onMarkPaid: (amount: number) => void; onMarkNoPayment: (amount: number) => void }) { const [amount, setAmount] = useState(String(member.monthly_contribution || 200)); return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.member_id || member.memberId} · {member.phone || "No phone"}</p></div><div className="flex items-center gap-2"><Input className="w-28" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={`Contribution for ${member.name}`} /><Badge variant={pending ? "outline" : "default"}>{pending ? "Pending" : "Paid"}</Badge>{pending && <><Button size="sm" onClick={() => onMarkPaid(Number(amount))} disabled={loading}>Record paid</Button><Button size="sm" variant="outline" onClick={() => onMarkNoPayment(Number(amount))} disabled={loading}>Mark paid</Button></>}</div></div>; }
function ModuleLinks({ links }: { links: Array<[string, string, any]> }) { return <div className="grid gap-4 md:grid-cols-2">{links.map(([href, label, Icon]) => <Card key={href}><CardContent className="flex items-center justify-between p-5"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-primary" /><span className="font-medium">{label}</span></div><Button asChild variant="outline" size="sm"><Link to={href}>Open</Link></Button></CardContent></Card>)}</div>; }
