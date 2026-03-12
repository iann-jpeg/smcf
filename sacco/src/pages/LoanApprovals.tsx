import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useMembers } from "@/hooks/useMembers";
import { useLoans } from "@/hooks/useLoans";
import { calculateRiskScore } from "@/lib/risk-engine";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Users, AlertTriangle, Gavel, Eye, ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function statusIcon(status: string) {
  if (status === "approved") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-warning" />;
}

function riskBadgeVariant(level: string) {
  if (level === "low") return "default" as const;
  if (level === "medium") return "secondary" as const;
  return "destructive" as const;
}

// Map approval levels based on loan amount
function getRequiredLevels(principal: number): string[] {
  if (principal <= 100_000) return ["credit_officer"];
  if (principal <= 500_000) return ["credit_officer", "credit_committee"];
  return ["credit_officer", "credit_committee", "board"];
}

const LEVEL_LABELS: Record<string, string> = {
  credit_officer: "Credit Officer",
  credit_committee: "Credit Committee",
  board: "Board",
};

const ROLE_OPTIONS = [
  { value: "credit_officer", label: "Credit Officer" },
  { value: "credit_committee", label: "Credit Committee" },
  { value: "board", label: "Board" },
];

export default function LoanApprovals() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: membersData = [] } = useMembers();

  const [activeRole, setActiveRole] = useState("credit_officer");
  const [reviewLoan, setReviewLoan] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Fetch pending loans with their approvals and guarantors
  const { data: loans = [], isLoading } = useLoans();

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ loanId, decision, notes }: { loanId: string; decision: string; notes: string }) => {
      await api.post(`/loans/${loanId}/approvals`, {
        approvalLevel: activeRole,
        decision,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: reviewAction === "approve" ? "Application Approved" : "Application Rejected" });
      setReviewLoan(null);
      setReviewAction(null);
      setReviewNote("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Compute approval status for each loan
  const enrichedLoans = useMemo(() => {
    return loans.map((loan: any) => {
      const requiredLevels = getRequiredLevels(loan.principal);
      const approvals = loan.loan_approvals || [];
      const levels = requiredLevels.map((level) => {
        const approval = approvals.find((a: any) => a.approval_level === level);
        return {
          role: level,
          label: LEVEL_LABELS[level] || level,
          status: approval ? approval.decision : "pending",
          approver: approval?.approver_id,
          date: approval?.created_at?.split("T")[0],
          note: approval?.notes,
        };
      });
      const isRejected = levels.some((l) => l.status === "rejected");
      const isFullyApproved = levels.every((l) => l.status === "approved");
      const overallStatus = isRejected ? "rejected" : isFullyApproved ? "approved" : "pending";
      const nextPending = levels.find((l) => l.status === "pending");

      const member = membersData.find((m: any) => m.id === loan.member_id);
      const risk = member ? calculateRiskScore(member) : null;

      return { ...loan, levels, overallStatus, nextPending, risk, memberName: loan.members?.name ?? "Unknown" };
    });
  }, [loans, membersData]);

  // Filter: only show loans that have the active role in their required levels
  const roleLoans = enrichedLoans.filter((l: any) => l.levels.some((lv: any) => lv.role === activeRole));
  const pendingForRole = roleLoans.filter((l: any) => l.nextPending?.role === activeRole);
  const processedByRole = roleLoans.filter((l: any) => {
    const level = l.levels.find((lv: any) => lv.role === activeRole);
    return level && level.status !== "pending";
  });

  const stats = useMemo(() => ({
    totalPending: enrichedLoans.filter((a: any) => a.overallStatus === "pending").length,
    totalApproved: enrichedLoans.filter((a: any) => a.overallStatus === "approved").length,
    totalRejected: enrichedLoans.filter((a: any) => a.overallStatus === "rejected").length,
    pendingForRole: pendingForRole.length,
  }), [enrichedLoans, pendingForRole]);

  const handleAction = (loan: any, action: "approve" | "reject") => {
    setReviewLoan(loan);
    setReviewAction(action);
    setReviewNote("");
  };

  const confirmAction = () => {
    if (!reviewLoan || !reviewAction) return;
    if (reviewAction === "reject" && !reviewNote.trim()) {
      toast({ title: "Note required", description: "Please provide a rejection reason.", variant: "destructive" });
      return;
    }
    approvalMutation.mutate({ loanId: reviewLoan.id, decision: reviewAction === "approve" ? "approved" : "rejected", notes: reviewNote });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" /> Loan Approvals
          </h1>
          <p className="text-muted-foreground text-sm">Review, approve, or reject pending loan applications</p>
        </div>
        <Select value={activeRole} onValueChange={setActiveRole}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Clock className="h-5 w-5 text-warning" /></div>
              <div><p className="text-2xl font-bold font-heading">{stats.pendingForRole}</p><p className="text-xs text-muted-foreground">Awaiting Your Review</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold font-heading">{stats.totalPending}</p><p className="text-xs text-muted-foreground">Total Pending</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold font-heading">{stats.totalApproved}</p><p className="text-xs text-muted-foreground">Fully Approved</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><XCircle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold font-heading">{stats.totalRejected}</p><p className="text-xs text-muted-foreground">Rejected</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Pending ({pendingForRole.length})</TabsTrigger>
          <TabsTrigger value="processed" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Processed ({processedByRole.length})</TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> All ({enrichedLoans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingForRole.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500/50" />
                <p className="font-medium">No pending applications for {LEVEL_LABELS[activeRole]}</p>
                <p className="text-sm">All caught up! Switch roles to view other queues.</p>
              </CardContent>
            </Card>
          ) : (
            pendingForRole.map((loan: any) => (
              <Card key={loan.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-heading font-bold text-lg">{loan.memberName}</p>
                          <p className="text-sm text-muted-foreground">{loan.loan_number} · Applied {loan.applied_at?.split("T")[0]}</p>
                        </div>
                        <Badge variant={riskBadgeVariant(loan.risk_rating || "medium")} className="text-sm">
                          Risk: {loan.risk?.compositeScore ?? "N/A"}/100
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><p className="text-muted-foreground text-xs">Principal</p><p className="font-semibold">KES {loan.principal?.toLocaleString()}</p></div>
                        <div><p className="text-muted-foreground text-xs">Rate / Model</p><p className="font-semibold">{loan.interest_rate}% {loan.interest_model}</p></div>
                        <div><p className="text-muted-foreground text-xs">Term</p><p className="font-semibold">{loan.term_months} months</p></div>
                        <div><p className="text-muted-foreground text-xs">Guarantors</p><p className="font-semibold">{loan.loan_guarantors?.length ?? 0}</p></div>
                      </div>
                      {loan.loan_guarantors?.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Guarantors:</span>
                            {loan.loan_guarantors.map((g: any) => {
                              const cs = g.consent_status ?? 'pending';
                              return (
                                <Badge
                                  key={g.id}
                                  variant="outline"
                                  className={cn(
                                    "text-xs gap-1",
                                    cs === 'accepted' && "border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20",
                                    cs === 'rejected' && "border-red-300 text-red-700 bg-red-50 dark:bg-red-900/20",
                                    cs === 'pending' && "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20"
                                  )}
                                >
                                  {cs === 'accepted' ? <ShieldCheck className="h-3 w-3" /> : cs === 'rejected' ? <ShieldX className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {g.members?.name}
                                </Badge>
                              );
                            })}
                          </div>
                          {loan.loan_guarantors.some((g: any) => (g.consent_status ?? 'pending') === 'pending') && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Awaiting guarantor consent — member has been notified</span>
                            </div>
                          )}
                        </div>
                      )}
                      {loan.risk && (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Savings", value: loan.risk.savingsConsistency },
                            { label: "Repayment", value: loan.risk.repaymentHistory },
                            { label: "Leverage", value: loan.risk.loanToSavingsRatio },
                          ].map((item) => (
                            <div key={item.label} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{item.label}</span>
                                <span className="font-medium">{item.value}%</span>
                              </div>
                              <Progress value={item.value} className="h-1.5" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-1">
                        {loan.levels.map((level: any, i: number) => (
                          <div key={level.role} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              {statusIcon(level.status)}
                              <span className={cn("text-xs", level.status === "approved" && "text-emerald-600", level.status === "rejected" && "text-destructive", level.status === "pending" && "text-muted-foreground")}>
                                {level.label}
                              </span>
                            </div>
                            {i < loan.levels.length - 1 && <div className="h-px w-4 bg-border" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex lg:flex-col gap-2 lg:min-w-[140px]">
                      <Button className="flex-1 gap-1.5" onClick={() => handleAction(loan, "approve")}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                      <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => handleAction(loan, "reject")}><XCircle className="h-4 w-4" /> Reject</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          <Card><CardContent className="pt-6"><LoanTable loans={processedByRole} activeRole={activeRole} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <Card><CardContent className="pt-6"><LoanTable loans={enrichedLoans} activeRole={activeRole} showPipeline /></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!reviewLoan && !!reviewAction} onOpenChange={() => { setReviewLoan(null); setReviewAction(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approve" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
              {reviewAction === "approve" ? "Approve" : "Reject"} {reviewLoan?.loan_number}
            </DialogTitle>
            <DialogDescription>
              {reviewLoan?.memberName} — KES {reviewLoan?.principal?.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {reviewLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Risk Score</p><p className="font-bold text-lg">{reviewLoan.risk?.compositeScore ?? "N/A"}/100</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Term</p><p className="font-bold text-lg">{reviewLoan.term_months}mo</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Guarantors</p><p className="font-bold text-lg">{reviewLoan.loan_guarantors?.length ?? 0}</p></div>
              </div>

              {reviewLoan.risk?.factors?.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Risk Factors</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewLoan.risk.factors.map((f: any, i: number) => (
                      <Badge key={i} variant={f.impact === "positive" ? "default" : f.impact === "negative" ? "destructive" : "secondary"} className="text-xs">{f.label}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Approval Pipeline</Label>
                <div className="flex items-center gap-2">
                  {reviewLoan.levels.map((level: any, i: number) => (
                    <div key={level.role} className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center",
                          level.status === "approved" && "border-emerald-500 bg-emerald-500/10",
                          level.status === "rejected" && "border-destructive bg-destructive/10",
                          level.status === "pending" && "border-warning/60 bg-warning/10",
                        )}>{statusIcon(level.status)}</div>
                        <span className="text-[10px] text-muted-foreground">{level.label}</span>
                      </div>
                      {i < reviewLoan.levels.length - 1 && <div className="h-px w-6 bg-border mt-[-1rem]" />}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Review Note {reviewAction === "reject" && <span className="text-destructive">*</span>}</Label>
                <Textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder={reviewAction === "approve" ? "Optional comments..." : "Reason for rejection (required)..."} rows={3} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewLoan(null); setReviewAction(null); }}>Cancel</Button>
            <Button variant={reviewAction === "approve" ? "default" : "destructive"} disabled={approvalMutation.isPending || (reviewAction === "reject" && !reviewNote.trim())} onClick={confirmAction}>
              {approvalMutation.isPending ? "Processing..." : reviewAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoanTable({ loans, activeRole, showPipeline = false }: { loans: any[]; activeRole: string; showPipeline?: boolean }) {
  if (loans.length === 0) return <p className="text-center text-muted-foreground py-8">No applications to display.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Loan #</TableHead>
          <TableHead>Member</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-center">Risk</TableHead>
          <TableHead>Applied</TableHead>
          {showPipeline ? <TableHead>Pipeline</TableHead> : <><TableHead>Decision</TableHead><TableHead>Note</TableHead></>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan: any) => {
          const level = loan.levels.find((l: any) => l.role === activeRole);
          return (
            <TableRow key={loan.id}>
              <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
              <TableCell className="font-medium">{loan.memberName}</TableCell>
              <TableCell className="text-right">KES {loan.principal?.toLocaleString()}</TableCell>
              <TableCell className="text-center"><Badge variant={riskBadgeVariant(loan.risk_rating || "medium")}>{loan.risk?.compositeScore ?? "—"}</Badge></TableCell>
              <TableCell className="text-sm">{loan.applied_at?.split("T")[0]}</TableCell>
              {showPipeline ? (
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {loan.levels.map((l: any) => (
                      <div key={l.role} className="flex items-center gap-1">
                        {statusIcon(l.status)}
                        <span className="text-[10px] text-muted-foreground">{l.label.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </TableCell>
              ) : (
                <>
                  <TableCell>{level && <Badge variant={level.status === "approved" ? "default" : level.status === "rejected" ? "destructive" : "secondary"}>{level.status}</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{level?.note || "—"}</TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
