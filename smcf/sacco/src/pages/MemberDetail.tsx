import { useParams, Link } from "react-router-dom";
import { useMember, useUpdateMember, useLinkMemberAccount } from "@/hooks/useMembers";
import { useLoansByMember } from "@/hooks/useLoans";
import { useTransactionsByMember } from "@/hooks/useTransactions";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Wallet, Landmark, TrendingUp, Pencil, Link2, Link2Off, UserCheck, FileText, Eye, Download, X } from "lucide-react";
import { MemberAvatar } from "@/components/MemberAvatar";
import { StatCard } from "@/components/StatCard";
import { useState } from "react";

function downloadDataUrl(dataUrl: string, filename = "document") {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
import { toast } from "sonner";

function riskLabel(score: number) {
  if (score >= 75) return { label: "Low Risk", variant: "default" as const };
  if (score >= 50) return { label: "Medium Risk", variant: "secondary" as const };
  return { label: "High Risk", variant: "destructive" as const };
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  business_development: "Business Development Loan",
  education: "Education Loan",
  emergency: "Emergency Loan",
  asset_acquisition: "Asset Acquisition Loan",
  personal: "Personal Loan",
};

function formatLoanType(value?: string) {
  if (!value) return "—";
  return LOAN_TYPE_LABELS[value] ?? value;
}

function formatInterestModel(value?: string) {
  if (!value) return "flat";
  return value === "reducing_balance" ? "reducing" : value;
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const { data: member, isLoading } = useMember(id ?? "");
  const { data: loans = [] } = useLoansByMember(id ?? "");
  const { data: transactions = [] } = useTransactionsByMember(id ?? "");
  const updateMember = useUpdateMember();
  const linkAccount = useLinkMemberAccount();

  // Fetch all registered user accounts (admin only, for linking)
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // api.get already unwraps the `data` envelope via handle(), so res IS the array
      const res = await api.get<{ _id: string; email: string; fullName: string | null; roles: string[] }[]>("/users");
      return Array.isArray(res) ? res : (res as any).data ?? [];
    },
    enabled: isAdmin,
  });

  // ── Document preview state ──
  const [previewDoc, setPreviewDoc] = useState<{ src: string; label: string } | null>(null);

  // ── Edit dialog state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", shares: "", savings: "", status: "active",
  });

  const openEdit = () => {
    if (!member) return;
    setEditForm({
      name: member.name ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      shares: String(member.shares ?? 0),
      savings: String(member.savings ?? 0),
      status: member.status ?? "active",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!id || !editForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      await updateMember.mutateAsync({
        id,
        name: editForm.name.trim(),
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        shares: Number(editForm.shares) || 0,
        savings: Number(editForm.savings) || 0,
        status: editForm.status,
      });
      toast.success("Member details updated");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  // ── Link Account dialog state ──
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const handleLink = async () => {
    if (!id || !selectedUserId) {
      toast.error("Please select a user account");
      return;
    }
    try {
      await linkAccount.mutateAsync({ id, userId: selectedUserId });
      toast.success("Account linked successfully. Member can now log in to view their account.");
      setLinkOpen(false);
      setSelectedUserId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to link account");
    }
  };

  const handleUnlink = async () => {
    if (!id) return;
    try {
      await linkAccount.mutateAsync({ id, userId: null });
      toast.success("Account unlinked");
    } catch (err: any) {
      toast.error(err.message || "Failed to unlink account");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Member not found.</p>
        <Button variant="outline" asChild><Link to="/members">← Back to Members</Link></Button>
      </div>
    );
  }

  const risk = riskLabel(member.risk_score ?? 50);
  const linkedUserRaw = (member as any).user_id;
  const linkedUserId =
    typeof linkedUserRaw === "string"
      ? linkedUserRaw
      : linkedUserRaw && typeof linkedUserRaw === "object"
        ? String(linkedUserRaw._id ?? linkedUserRaw.id ?? "")
        : null;
  const linkedUserEmailFromMember =
    linkedUserRaw && typeof linkedUserRaw === "object" && typeof linkedUserRaw.email === "string"
      ? linkedUserRaw.email
      : null;
  const linkedUserNameFromMember =
    linkedUserRaw && typeof linkedUserRaw === "object"
      ? (linkedUserRaw.fullName ?? linkedUserRaw.full_name ?? linkedUserRaw.name ?? null)
      : null;
  const linkedUser = allUsers.find((u) => u._id === linkedUserId);
  const linkedAccountEmail = linkedUser?.email ?? linkedUserEmailFromMember ?? linkedUserId;
  const linkedAccountName = linkedUser?.fullName ?? linkedUserNameFromMember;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/members"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold">{member.name}</h1>
            <Badge variant={member.status === "active" ? "default" : member.status === "suspended" ? "destructive" : "secondary"}>
              {member.status}
            </Badge>
            <Badge variant={risk.variant}>{risk.label} ({member.risk_score ?? 50})</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{member.member_id} · {member.phone || "—"} · {member.email || "—"}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-3.5 w-3.5" /> Link Account
            </Button>
          </div>
        )}
      </div>

      {/* ── Linked account banner ── */}
      {isAdmin && (
        <Card className={linkedUserId ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/20" : "border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20"}>
          <CardContent className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className={`h-4 w-4 ${linkedUserId ? "text-green-600" : "text-amber-600"}`} />
              {linkedUserId ? (
                <span>
                  Linked to <strong>{linkedAccountEmail}</strong>
                  {linkedAccountName ? ` (${linkedAccountName})` : ""}
                  {" — "}member can sign in and view their account.
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  No user account linked — member cannot sign in yet.
                </span>
              )}
            </div>
            {linkedUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={handleUnlink}
                disabled={linkAccount.isPending}
              >
                <Link2Off className="h-3.5 w-3.5" /> Unlink
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Share Capital"
          value={`KES ${Number(member.shares).toLocaleString()}`}
          subtitle={`Units: ${(Number(member.shares) / 100).toLocaleString()} @ KES 100/unit`}
          icon={Landmark}
          variant="accent"
        />
        <StatCard
          title="Share Units"
          value={`${(Number(member.shares) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} units`}
          subtitle="1 unit = KES 100"
          icon={Landmark}
          variant="accent"
        />
        <StatCard title="Savings" value={`KES ${Number(member.savings).toLocaleString()}`} icon={Wallet} variant="success" />
        <StatCard title="Loan Balance" value={`KES ${Number(member.loan_balance).toLocaleString()}`} icon={TrendingUp} variant={Number(member.loan_balance) > 0 ? "warning" : "default"} />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="loans">Loan Accounts</TabsTrigger>
        </TabsList>

        {/* ── Profile tab ── */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identity card */}
            <Card>
              <CardHeader><CardTitle className="font-heading text-base">Identity & Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 pb-2">
                  <MemberAvatar name={member.name} photo={(member as any).profile_photo} size="lg" />
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{member.member_id}</p>
                  </div>
                </div>
                {([
                  { label: "National ID / Passport", value: (member as any).national_id },
                  { label: "Phone", value: member.phone },
                  { label: "Email", value: member.email },
                  { label: "Date of Birth", value: (member as any).date_of_birth ? new Date((member as any).date_of_birth).toLocaleDateString() : null },
                  { label: "Gender", value: (member as any).gender },
                  { label: "County / Address", value: (member as any).county },
                  { label: "Occupation", value: (member as any).occupation },
                  { label: "Employer / Business", value: (member as any).employer },
                  { label: "Date Joined", value: member.join_date ? new Date(member.join_date as string).toLocaleDateString() : null },
                ] as { label: string; value: string | null | undefined }[]).map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4 text-sm border-b last:border-0 pb-2 last:pb-0">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right">{value || <span className="text-muted-foreground italic">Not provided</span>}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Documents card */}
            <Card>
              <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {([
                  { label: "ID Copy", key: "doc_id_copy" },
                  { label: "Passport Photo", key: "doc_passport_photo" },
                  { label: "Signed Membership Form", key: "doc_membership_form" },
                  { label: "KRA PIN Certificate", key: "doc_kra_pin_certificate" },
                ] as { label: string; key: string }[]).map(({ label, key }) => {
                  const doc = (member as any)[key] as string | null;
                  const isImg = doc?.startsWith("data:image");
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                      <span className="text-sm">{label}</span>
                      {doc ? (
                        <div className="flex gap-2">
                          <Badge variant="default" className="text-xs">Uploaded</Badge>
                          {isImg ? (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPreviewDoc({ src: doc, label })}><Eye className="h-3 w-3" />View</Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => downloadDataUrl(doc, label)}><Download className="h-3 w-3" />Download</Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Not uploaded</Badge>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Transaction History</CardTitle></CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {transactions.map((txn: any) => (
                      <div key={txn.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs truncate">{txn.transaction_ref}</p>
                          <Badge variant={txn.status === "completed" ? "default" : "destructive"}>{txn.status}</Badge>
                        </div>
                        <p className="text-sm">{txn.type}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{new Date(txn.processed_at).toLocaleDateString()}</span>
                          <span className="font-semibold">KES {Number(txn.amount).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount (KES)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((txn: any) => (
                          <TableRow key={txn.id}>
                            <TableCell className="font-mono text-xs">{txn.transaction_ref}</TableCell>
                            <TableCell>{new Date(txn.processed_at).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium">{txn.type}</TableCell>
                            <TableCell className="text-right font-semibold">{Number(txn.amount).toLocaleString()}</TableCell>
                            <TableCell><Badge variant={txn.status === "completed" ? "default" : "destructive"}>{txn.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Loan Accounts</CardTitle></CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No loan accounts.</p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {loans.map((loan: any) => (
                      <div key={loan.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs truncate">{loan.loan_number}</p>
                          <Badge variant={loan.status === "defaulted" ? "destructive" : loan.status === "pending" ? "outline" : "default"}>
                            {loan.status}
                          </Badge>
                        </div>
                        <p className="text-sm">{formatLoanType(loan.loan_type)} • {loan.interest_rate}% {formatInterestModel(loan.interest_model)} • {loan.term_months}mo</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Principal</p>
                            <p className="font-medium">KES {Number(loan.principal).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Balance</p>
                            <p className="font-semibold">KES {Number(loan.balance).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loan #</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead>Rate / Model</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loans.map((loan: any) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                            <TableCell className="text-right">KES {Number(loan.principal).toLocaleString()}</TableCell>
                            <TableCell className="text-sm">{formatLoanType(loan.loan_type)} • {loan.interest_rate}% {formatInterestModel(loan.interest_model)}</TableCell>
                            <TableCell>{loan.term_months}mo</TableCell>
                            <TableCell className="text-right font-semibold">KES {Number(loan.balance).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={loan.status === "defaulted" ? "destructive" : loan.status === "pending" ? "outline" : "default"}>
                                {loan.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Edit Member Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member — {member.member_id}</DialogTitle>
            <DialogDescription>Update this member's profile details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {[
              { label: "Full Name", id: "e-name", field: "name", type: "text", required: true },
              { label: "Email", id: "e-email", field: "email", type: "email", required: false },
              { label: "Phone", id: "e-phone", field: "phone", type: "text", required: false },
              { label: "Savings (KES)", id: "e-savings", field: "savings", type: "number", required: false },
              { label: "Shares (KES)", id: "e-shares", field: "shares", type: "number", required: false },
            ].map(({ label, id, field, type }) => (
              <div key={id} className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor={id} className="text-right text-sm">{label}</Label>
                <Input
                  id={id}
                  type={type}
                  className="col-span-3"
                  value={(editForm as any)[field]}
                  onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                />
              </div>
            ))}
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right text-sm">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateMember.isPending}>
              {updateMember.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Account Dialog ── */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link User Account</DialogTitle>
            <DialogDescription>
              Select the registered user account to link to <strong>{member.name}</strong>. Once linked, the member can sign in with that account to view their savings, loans, and transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>Registered User Account</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user account…" />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.email}{u.fullName ? ` — ${u.fullName}` : ""}{" "}
                    <span className="text-xs text-muted-foreground">({u.roles.join(", ")})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Don't see the member's account? Ask them to sign up first at the Sign In page, then come back here to link.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={handleLink} disabled={linkAccount.isPending || !selectedUserId}>
              {linkAccount.isPending ? "Linking…" : "Link Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image preview lightbox ─────────────────────────────────────── */}
      {previewDoc && (
        <Dialog open onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-heading flex items-center justify-between">
                {previewDoc.label}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center rounded-lg overflow-hidden bg-muted/40 max-h-[70vh]">
              <img
                src={previewDoc.src}
                alt={previewDoc.label}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => downloadDataUrl(previewDoc.src, previewDoc.label)}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
              <Button onClick={() => setPreviewDoc(null)}>
                <X className="h-4 w-4 mr-2" /> Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
