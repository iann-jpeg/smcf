import { useMembers, useDeleteMember, useCreateMember } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, UserPlus, Trash2, Wallet, Landmark, Activity, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function riskColor(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "suspended") return "destructive" as const;
  return "secondary" as const;
}

function formatKES(value: number) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function barHeightClass(value: number, max: number) {
  if (max <= 0) return "h-3";
  const ratio = Math.max(0, Math.min(1, value / max));
  if (ratio >= 0.9) return "h-9";
  if (ratio >= 0.75) return "h-8";
  if (ratio >= 0.6) return "h-7";
  if (ratio >= 0.45) return "h-6";
  if (ratio >= 0.3) return "h-5";
  if (ratio >= 0.15) return "h-4";
  return "h-3";
}

function buildMemberReport(member: any) {
  const shares = Number(member.shares || 0);
  const savings = Number(member.savings || 0);
  const loan = Number(member.loan_balance || 0);
  const risk = Number(member.risk_score ?? 50);

  const tags: Array<{ label: string; className: string }> = [];

  if (member.status !== "active") {
    tags.push({ label: "Needs Attention", className: "bg-amber-100 text-amber-800 border-amber-300" });
  }
  if (loan > shares + savings) {
    tags.push({ label: "Overexposed", className: "bg-rose-100 text-rose-800 border-rose-300" });
  } else if (savings > loan * 1.2 && risk >= 70) {
    tags.push({ label: "Stable", className: "bg-emerald-100 text-emerald-800 border-emerald-300" });
  } else if (savings > shares * 1.4) {
    tags.push({ label: "Strong Saver", className: "bg-sky-100 text-sky-800 border-sky-300" });
  }

  if (tags.length === 0) {
    tags.push({ label: "Balanced", className: "bg-slate-100 text-slate-700 border-slate-300" });
  }

  return tags.slice(0, 2);
}

export default function Members() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", shares: "", savings: "", status: "active",
  });
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isStaff = hasRole("admin") || hasRole("credit_officer") || hasRole("treasurer");
  const { data: members = [], isLoading } = useMembers();
  const deleteMember = useDeleteMember();
  const createMember = useCreateMember();

  // Auto-generate suggested member ID
  // Fix: read only the last 3 chars as the sequence to avoid compounding corrupted prefixes
  const nextMemberId = (() => {
    const year = new Date().getFullYear().toString().slice(-2);
    const max = members.reduce((acc: number, m: any) => {
      const id = String(m.member_id ?? "");
      const seq = parseInt(id.slice(-3), 10);
      return isNaN(seq) ? acc : Math.max(acc, seq);
    }, 0);
    return `MEM${year}${String(max + 1).padStart(3, "0")}`;
  })();

  const [memberId, setMemberId] = useState("");

  const openAdd = () => {
    if (!isStaff) {
      toast.error("You need admin, credit officer, or treasurer role to add members");
      return;
    }
    setMemberId(nextMemberId);
    setForm({ name: "", email: "", phone: "", shares: "", savings: "", status: "active" });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !memberId.trim()) {
      toast.error("Name and Member ID are required");
      return;
    }
    try {
      await createMember.mutateAsync({
        memberId: memberId.trim(),
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        shares: form.shares ? Number(form.shares) : 0,
        savings: form.savings ? Number(form.savings) : 0,
        status: form.status,
      });
      toast.success(`${form.name} added successfully`);
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMember.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.name} has been removed`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = members.filter((m: any) => {
    const term = search.toLowerCase();
    const name = String(m.name || "").toLowerCase();
    const memberIdValue = String(m.member_id || "").toLowerCase();
    return name.includes(term) || memberIdValue.includes(term);
  });

  const totalShares = members.reduce((sum: number, m: any) => sum + Number(m.shares || 0), 0);
  const totalSavings = members.reduce((sum: number, m: any) => sum + Number(m.savings || 0), 0);
  const totalLoanBalance = members.reduce((sum: number, m: any) => sum + Number(m.loan_balance || 0), 0);
  const avgRiskScore = members.length
    ? Math.round(members.reduce((sum: number, m: any) => sum + Number(m.risk_score ?? 50), 0) / members.length)
    : 0;
  const activeCount = members.filter((m: any) => m.status === "active").length;

  const maxShares = Math.max(...members.map((m: any) => Number(m.shares || 0)), 0);
  const maxSavings = Math.max(...members.map((m: any) => Number(m.savings || 0)), 0);
  const maxLoans = Math.max(...members.map((m: any) => Number(m.loan_balance || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Members</h1>
          <p className="text-muted-foreground text-sm">Corporate member portfolio overview for {members.length} registered members</p>
        </div>
        <Button className="gap-2" onClick={openAdd}>
          <UserPlus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Portfolio Savings</CardTitle>
              <Wallet className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{formatKES(totalSavings)}</p>
            <p className="text-xs text-muted-foreground mt-1">Across all member accounts</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Portfolio Shares</CardTitle>
              <Landmark className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{formatKES(totalShares)}</p>
            <p className="text-xs text-muted-foreground mt-1">Capital participation level</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Outstanding Loans</CardTitle>
              <Activity className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{formatKES(totalLoanBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Current portfolio exposure</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Portfolio Health</CardTitle>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{avgRiskScore}/100</p>
            <p className="text-xs text-muted-foreground mt-1">{activeCount} active members</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or member ID..." className="pl-9 bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Savings</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Shares</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Loans</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No members found. Add your first member to get started.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead>Member ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Shares (KES)</TableHead>
                  <TableHead className="text-right">Savings (KES)</TableHead>
                  <TableHead className="text-right">Loan Bal. (KES)</TableHead>
                  <TableHead className="text-center">Mini Analytics</TableHead>
                  <TableHead>Member Report</TableHead>
                  <TableHead className="text-center">Risk Score</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => navigate(`/members/${m.id}`)}>
                    <TableCell className="font-mono text-xs">{m.member_id}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={m.name} photo={m.profile_photo} size="sm" />
                        <div>
                          <p className="font-medium leading-none">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{String(m.email || "No email")}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{String(m.phone || "—")}</TableCell>
                    <TableCell className="text-right">{Number(m.shares).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.savings).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.loan_balance).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="mx-auto w-[92px] rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                        <div className="flex items-end justify-center gap-1.5 h-10">
                          <div className={cn("w-2 rounded-sm bg-indigo-500", barHeightClass(Number(m.shares || 0), maxShares))} />
                          <div className={cn("w-2 rounded-sm bg-sky-500", barHeightClass(Number(m.savings || 0), maxSavings))} />
                          <div className={cn("w-2 rounded-sm bg-rose-500", barHeightClass(Number(m.loan_balance || 0), maxLoans))} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {buildMemberReport(m).map((tag) => (
                          <span
                            key={`${m.id}-${tag.label}`}
                            className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold", tag.className)}
                          >
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("font-bold", riskColor(m.risk_score ?? 50))}>{m.risk_score ?? 50}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.member_id})?<br />
              This action cannot be undone and will remove all associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDelete}
              disabled={deleteMember.isPending}
            >
              {deleteMember.isPending ? "Deleting…" : "Delete Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Member</DialogTitle>
            <DialogDescription>Fill in the member details below. Member ID and Name are required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="memberId" className="text-right text-sm">Member ID</Label>
              <Input
                id="memberId"
                className="col-span-3"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                placeholder="e.g. MEM24001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="name" className="text-right text-sm">Full Name</Label>
              <Input
                id="name"
                className="col-span-3"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="email" className="text-right text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                className="col-span-3"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="phone" className="text-right text-sm">Phone</Label>
              <Input
                id="phone"
                className="col-span-3"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="savings" className="text-right text-sm">Savings (KES)</Label>
              <Input
                id="savings"
                type="number"
                min="0"
                className="col-span-3"
                value={form.savings}
                onChange={(e) => setForm({ ...form, savings: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="shares" className="text-right text-sm">Shares (KES)</Label>
              <Input
                id="shares"
                type="number"
                min="0"
                className="col-span-3"
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="status" className="text-right text-sm">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createMember.isPending}>
              {createMember.isPending ? "Adding…" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
