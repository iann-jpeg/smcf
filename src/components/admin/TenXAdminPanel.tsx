import { useEffect, useState } from "react";
import { ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import API_BASE from "@/lib/api";
import { authService } from "@/lib/authService";

const headers = () => ({ ...authService.getAuthHeaders(), "Content-Type": "application/json" });
const money = (value = 0) => `KES ${Number(value).toLocaleString()}`;

export default function TenXAdminPanel({ members, readOnly }: { members: any[]; readOnly: boolean }) {
  const { toast } = useToast();
  const [overview, setOverview] = useState<any>(null);
  const [tenXMembers, setTenXMembers] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");

  const load = async () => {
    const [overviewResponse, membersResponse, contributionsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/tenx/admin/overview`, { headers: authService.getAuthHeaders() }),
      fetch(`${API_BASE}/api/tenx/admin/members`, { headers: authService.getAuthHeaders() }),
      fetch(`${API_BASE}/api/tenx/admin/contributions`, { headers: authService.getAuthHeaders() }),
    ]);
    const overviewBody = await overviewResponse.json();
    const membersBody = await membersResponse.json();
    const contributionsBody = await contributionsResponse.json();
    if (overviewBody.success) setOverview(overviewBody.data);
    if (membersBody.success) setTenXMembers(membersBody.data);
    if (contributionsBody.success) setContributions(contributionsBody.data);
  };

  useEffect(() => { load(); }, []);

  const assign = async (member: any, enrolled: boolean) => {
    const response = await fetch(`${API_BASE}/api/tenx/admin/members/${member._id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ is10XMember: enrolled }) });
    const body = await response.json();
    if (!response.ok) { toast({ title: "10X update failed", description: body.error, variant: "destructive" }); return; }
    toast({ title: enrolled ? "Member added to 10X" : "Member removed from 10X" });
    load();
  };

  const savePeriod = async () => {
    const response = await fetch(`${API_BASE}/api/tenx/admin/periods`, { method: "POST", headers: headers(), body: JSON.stringify({ period, due_amount: Number(amount), status: "OPEN" }) });
    const body = await response.json();
    if (!response.ok) { toast({ title: "Period update failed", description: body.error, variant: "destructive" }); return; }
    toast({ title: "10X period saved" });
    setAmount("");
    load();
  };

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Members", overview?.totalMembers], ["Expected", money(overview?.expected)], ["Collected", money(overview?.collected)], ["Outstanding", money(overview?.outstanding)], ["Payment rate", `${overview?.paymentRate || 0}%`]].map(([label, value]) => <Card key={String(label)}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{value ?? "-"}</p></CardContent></Card>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />10X Members</CardTitle></CardHeader><CardContent className="space-y-3">{members.map((member) => { const enrolled = Boolean(member.is10XMember); return <div className="flex items-center justify-between gap-3 border-b py-2" key={member._id}><div><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.member_id}</p></div>{enrolled ? <Button variant="outline" size="sm" disabled={readOnly} onClick={() => assign(member, false)}>Remove</Button> : <Button size="sm" disabled={readOnly} onClick={() => assign(member, true)}><Plus className="mr-1 h-4 w-4" />Add</Button>}</div>; })}</CardContent></Card>
      <Card><CardHeader><CardTitle>Contribution period</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="tenx-period">Month</Label><Input id="tenx-period" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></div><div><Label htmlFor="tenx-amount">Due amount (KES)</Label><Input id="tenx-amount" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><Button disabled={readOnly || !amount} onClick={savePeriod}>Save open period</Button>{overview?.period && <p className="text-sm text-muted-foreground">Open: {overview.period.period} at {money(overview.period.due_amount)}</p>}</CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />10X Contributions</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Member</th><th className="p-2">Period</th><th className="p-2">Due</th><th className="p-2">Paid</th><th className="p-2">Status</th><th className="p-2">Reference</th></tr></thead><tbody>{contributions.map((item) => <tr className="border-b" key={item._id}><td className="p-2">{item.member_id?.name} ({item.member_id?.member_id})</td><td className="p-2">{item.period}</td><td className="p-2">{money(item.amount_due)}</td><td className="p-2">{money(item.amount_paid)}</td><td className="p-2"><Badge>{item.status}</Badge></td><td className="p-2">{item.transaction_reference || "-"}</td></tr>)}</tbody></table></div></CardContent></Card>
  </div>;
}
