import { useEffect, useState } from "react";
import { Download, Plus, ShieldCheck } from "lucide-react";
import { api, getApiBaseForDebug } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Member = { _id: string; memberId: string; name: string; phone?: string | null; is10XMember?: boolean };
type Contribution = { _id: string; member_id?: { name?: string; memberId?: string }; period: string; amount_due: number; amount_paid: number; status: string; transaction_reference?: string; receipt_number?: string };
type Overview = { totalMembers: number; expected: number; collected: number; outstanding: number; paymentRate: number; period?: { period: string; due_amount: number } };
type AuditEntry = { _id: string; action: string; description: string; created_at?: string; admin_id?: { fullName?: string; email?: string } };

const money = (value = 0) => `KES ${Number(value).toLocaleString()}`;

export default function TenXAdmin() {
  const { hasRole } = useAuth();
  const readOnly = !hasRole("admin") && !hasRole("treasurer");
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [manual, setManual] = useState({ member_id: "", period: new Date().toISOString().slice(0, 7), amount_paid: "", payment_method: "cash", transaction_reference: "", notes: "" });

  const load = async () => {
    const [overviewData, membersData, contributionData, auditData] = await Promise.all([
      api.get<Overview>("/tenx/admin/overview"),
      api.get<Member[]>("/tenx/admin/members"),
      api.get<Contribution[]>("/tenx/admin/contributions"),
      api.get<AuditEntry[]>("/tenx/admin/audit"),
    ]);
    const allMembersData = await api.get<Member[]>("/members");
    const enrolledIds = new Set((Array.isArray(membersData) ? membersData : []).map((member) => String(member._id)));
    setOverview(overviewData);
    setMembers((Array.isArray(allMembersData) ? allMembersData : []).map((member) => ({
      ...member,
      is10XMember: enrolledIds.has(String(member._id)) || Boolean(member.is10XMember),
      memberId: member.memberId || (member as any).member_id,
    })));
    setContributions(Array.isArray(contributionData) ? contributionData : []);
    setAudit(Array.isArray(auditData) ? auditData : []);
  };

  useEffect(() => { load().catch((error) => toast.error(error.message || "Could not load 10X administration")); }, []);

  const setEnrollment = async (member: Member, enrolled: boolean) => {
    try {
      await api.patch(`/tenx/admin/members/${member._id}`, { is10XMember: enrolled });
      setMembers((current) => current.map((item) => item._id === member._id ? { ...item, is10XMember: enrolled } : item));
      toast.success(enrolled ? `${member.name} added to 10X` : `${member.name} removed from 10X`);
      await load();
    } catch (error: any) { toast.error(error.message || "Could not update 10X membership"); }
  };

  const savePeriod = async () => {
    try {
      await api.post("/tenx/admin/periods", { period, due_amount: Number(amount), status: "OPEN" });
      setAmount("");
      toast.success("10X contribution period saved");
      await load();
    } catch (error: any) { toast.error(error.message || "Could not save contribution period"); }
  };

  const recordManual = async () => {
    try {
      if (!manual.member_id || !manual.period || !manual.amount_paid || !manual.transaction_reference) throw new Error("Member, period, amount, and reference are required");
      await api.post("/tenx/admin/contributions/manual", { ...manual, amount_paid: Number(manual.amount_paid) });
      setManual((current) => ({ ...current, amount_paid: "", transaction_reference: "", notes: "" }));
      toast.success("Manual 10X contribution recorded");
      await load();
    } catch (error: any) { toast.error(error.message || "Could not record manual contribution"); }
  };

  const downloadCsv = async () => {
    try {
      const token = localStorage.getItem("smcf_auth_token");
      const response = await fetch(`${getApiBaseForDebug()}/api/tenx/admin/reports.csv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not download report");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smcf-10x-contributions.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) { toast.error(error.message || "Could not download report"); }
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-heading font-bold">10X Group</h1><p className="text-sm text-muted-foreground">Manage enrolled members and monthly contributions from the SACCO administration.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Members", overview?.totalMembers], ["Expected", money(overview?.expected)], ["Collected", money(overview?.collected)], ["Outstanding", money(overview?.outstanding)], ["Payment rate", `${overview?.paymentRate || 0}%`]].map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{value ?? "-"}</p></CardContent></Card>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Choose 10X members</CardTitle><p className="text-sm text-muted-foreground">Select participants from all SACCO members.</p></CardHeader><CardContent className="max-h-[30rem] space-y-3 overflow-y-auto">{members.length === 0 ? <p className="text-sm text-muted-foreground">No SACCO members found.</p> : members.map((member) => <div className="flex items-center justify-between gap-3 border-b py-2" key={member._id}><div><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.memberId} {member.phone ? `| ${member.phone}` : ""}</p></div><div className="flex items-center gap-2">{member.is10XMember && <Badge variant="secondary">10X</Badge>}{member.is10XMember ? <Button size="sm" variant="outline" disabled={readOnly} onClick={() => setEnrollment(member, false)}>Remove</Button> : <Button size="sm" disabled={readOnly} onClick={() => setEnrollment(member, true)}><Plus className="mr-1 h-4 w-4" />Add</Button>}</div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Contribution period</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="tenx-period">Month</Label><Input id="tenx-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div><div><Label htmlFor="tenx-amount">Due amount (KES)</Label><Input id="tenx-amount" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><Button disabled={readOnly || !amount} onClick={savePeriod}>Save open period</Button>{overview?.period && <p className="text-sm text-muted-foreground">Open: {overview.period.period} at {money(overview.period.due_amount)}</p>}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Record manual contribution</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="manual-member">Member</Label><select id="manual-member" className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={manual.member_id} onChange={(event) => setManual({ ...manual, member_id: event.target.value })}><option value="">Select enrolled member</option>{members.filter((member) => member.is10XMember).map((member) => <option value={member._id} key={member._id}>{member.name} ({member.memberId})</option>)}</select></div><div><Label htmlFor="manual-period">Period</Label><Input id="manual-period" type="month" value={manual.period} onChange={(event) => setManual({ ...manual, period: event.target.value })} /></div><div><Label htmlFor="manual-amount">Amount paid (KES)</Label><Input id="manual-amount" type="number" min="0" value={manual.amount_paid} onChange={(event) => setManual({ ...manual, amount_paid: event.target.value })} /></div><div><Label htmlFor="manual-method">Payment method</Label><Input id="manual-method" value={manual.payment_method} onChange={(event) => setManual({ ...manual, payment_method: event.target.value })} /></div><div><Label htmlFor="manual-reference">Reference</Label><Input id="manual-reference" value={manual.transaction_reference} onChange={(event) => setManual({ ...manual, transaction_reference: event.target.value })} /></div><div><Label htmlFor="manual-notes">Notes</Label><Input id="manual-notes" value={manual.notes} onChange={(event) => setManual({ ...manual, notes: event.target.value })} /></div><div className="md:col-span-2"><Button disabled={readOnly} onClick={recordManual}>Record manual payment</Button></div></CardContent></Card>
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>10X Contributions</CardTitle><Button variant="outline" onClick={downloadCsv}><Download className="mr-2 h-4 w-4" />CSV report</Button></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Member</th><th className="p-2">Period</th><th className="p-2">Due</th><th className="p-2">Paid</th><th className="p-2">Status</th><th className="p-2">Reference</th></tr></thead><tbody>{contributions.map((item) => <tr className="border-b" key={item._id}><td className="p-2">{item.member_id?.name} ({item.member_id?.memberId})</td><td className="p-2">{item.period}</td><td className="p-2">{money(item.amount_due)}</td><td className="p-2">{money(item.amount_paid)}</td><td className="p-2"><Badge>{item.status}</Badge></td><td className="p-2">{item.transaction_reference || item.receipt_number || "-"}</td></tr>)}</tbody></table></div></CardContent></Card>
    <Card><CardHeader><CardTitle>10X Audit Log</CardTitle></CardHeader><CardContent><div className="space-y-2">{audit.map((entry) => <div className="border-b py-2 text-sm" key={entry._id}><p className="font-medium">{entry.action}</p><p className="text-muted-foreground">{entry.description} | {entry.admin_id?.fullName || entry.admin_id?.email || "Admin"} {entry.created_at ? `| ${new Date(entry.created_at).toLocaleString()}` : ""}</p></div>)}</div></CardContent></Card>
  </div>;
}
