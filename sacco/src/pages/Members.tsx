import { useMembers, useDeleteMember, useCreateMember } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import { MemberAvatar } from "@/components/MemberAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Search, UserPlus, Trash2 } from "lucide-react";
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

  const filtered = members.filter((m: any) =>
    m.name.toLowerCase().includes(search.toLowerCase()) || m.member_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Members</h1>
          <p className="text-muted-foreground text-sm">{members.length} registered members</p>
        </div>
        <Button className="gap-2" onClick={openAdd}>
          <UserPlus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search members..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Shares (KES)</TableHead>
                  <TableHead className="text-right">Savings (KES)</TableHead>
                  <TableHead className="text-right">Loan Bal. (KES)</TableHead>
                  <TableHead className="text-center">Risk Score</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/members/${m.id}`)}>
                    <TableCell className="font-mono text-xs">{m.member_id}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MemberAvatar name={m.name} photo={m.profile_photo} size="sm" />
                        {m.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{m.phone}</TableCell>
                    <TableCell className="text-right">{Number(m.shares).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.savings).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.loan_balance).toLocaleString()}</TableCell>
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
