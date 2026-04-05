import { useState } from "react";
import { useLoans } from "@/hooks/useLoans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Gavel, CreditCard, Loader2, CheckCircle2, ArrowRight, Download, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { exportLoanApplicationReceipt } from "@/lib/pdf-export";
import { toast } from "sonner";

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline", approved: "secondary", disbursed: "secondary",
    repaying: "default", cleared: "default", defaulted: "destructive", rejected: "destructive",
    active: "default", completed: "default",
  };
  return map[status] || "secondary";
}

function riskBadge(risk: string) {
  if (risk === "low") return "default" as const;
  if (risk === "medium") return "secondary" as const;
  return "destructive" as const;
}

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mpesa",         label: "M-Pesa (Manual)" },
  { value: "cheque",        label: "Cheque" },
];

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

function getLoanProgress(loan: any) {
  const total = Number(loan.total_payable ?? 0);
  const balance = Number(loan.balance ?? 0);
  if (!total || Number.isNaN(total)) return null;
  const paid = Math.max(0, total - (Number.isNaN(balance) ? total : balance));
  const pct = Math.min(100, Math.max(0, (paid / total) * 100));
  return { total, paid, pct };
}

export default function Loans() {
  const navigate = useNavigate();
  const { data: loans = [], isLoading } = useLoans();
  const qc = useQueryClient();

  const [payLoan,  setPayLoan]  = useState<any | null>(null);
  const [amount,   setAmount]   = useState("");
  const [method,   setMethod]   = useState("cash");
  const [note,     setNote]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [disbursing, setDisbursing] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<any | null>(null);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["repayment-history", historyLoan?.id],
    queryFn: async () => {
      if (!historyLoan?.id) return null;
      return api.get(`/repayments/loan/${historyLoan.id}/history`);
    },
    enabled: !!historyLoan?.id,
  });

  function openPayDialog(loan: any) {
    setPayLoan(loan);
    setAmount(String(loan.monthly_installment || ""));
    setMethod("cash");
    setNote("");
    setSuccess(false);
  }

  function closePayDialog() {
    setPayLoan(null);
    setSuccess(false);
  }

  async function handleDisburse(loanId: string) {
    if (!confirm("Confirm disbursement of this loan?")) return;
    setDisbursing(true);
    try {
      await api.put(`/loans/${loanId}/disburse`);
      toast.success("Loan disbursed successfully");
      qc.invalidateQueries({ queryKey: ["loans"] });
    } catch (error: any) {
      toast.error(error?.message || "Failed to disburse loan");
    } finally {
      setDisbursing(false);
    }
  }

  async function handleRecordPayment() {
    const num = Number(amount);
    if (!num || num < 1) { toast.error("Enter a valid amount"); return; }
    if (num > Number(payLoan.balance)) { toast.error(`Amount exceeds outstanding balance KES ${Number(payLoan.balance).toLocaleString()}`); return; }
    setSaving(true);
    try {
      await api.post(`/repayments/loan/${payLoan.id}/pay`, { amount: num, method, note });
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["repayments"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Payment recorded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadReceipt(loan: any) {
    const ref = loan.loan_number ?? "this loan";
    if (!confirm(`Download receipt for ${ref}?`)) return;
    const guarantors = (loan.loan_guarantors ?? []).map((g: any) => ({
      name: g.members?.name ?? "Guarantor",
      memberId: g.members?.member_id ?? g.member_id ?? "",
      guaranteeAmount: Number(g.guarantee_amount ?? 0),
      savings: Number(g.members?.savings ?? 0),
    }));

    exportLoanApplicationReceipt({
      loanNumber: loan.loan_number ?? "LN-NEW",
      memberName: loan.members?.name ?? "Member",
      memberId: loan.members?.member_id ?? loan.member_id ?? "",
      loanType: formatLoanType(loan.loan_type),
      appliedAt: loan.applied_at ?? loan.created_at,
      principal: Number(loan.principal ?? 0),
      interestRate: Number(loan.interest_rate ?? 0),
      interestModel: loan.interest_model ?? "reducing",
      termMonths: Number(loan.term_months ?? 0),
      monthlyInterest: loan.monthly_interest ? Number(loan.monthly_interest) : undefined,
      totalInterest: loan.total_interest ? Number(loan.total_interest) : undefined,
      riskRating: loan.risk_rating ?? undefined,
      monthlyPayment: loan.monthly_installment ? Number(loan.monthly_installment) : undefined,
      totalPayable: loan.total_payable ? Number(loan.total_payable) : undefined,
      guarantors,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Loan Portfolio</h1>
          <p className="text-muted-foreground text-sm">{loans.length} total loans</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/loans/approvals")}>
            <Gavel className="h-4 w-4" /> Approvals
          </Button>
          <Button className="gap-2" onClick={() => navigate("/loans/apply") }>
            <Plus className="h-4 w-4" /> New Loan Application
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : loans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No loans found. Create your first loan application to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rate (Monthly)</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan: any) => {
                  const progress = getLoanProgress(loan);
                  return (
                  <TableRow key={loan.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                    <TableCell className="font-medium">{loan.members?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">KES {Number(loan.principal).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{formatLoanType(loan.loan_type)}</TableCell>
                    <TableCell className="text-sm">{loan.interest_rate}% {formatInterestModel(loan.interest_model)}</TableCell>
                    <TableCell>{loan.term_months}mo</TableCell>
                    <TableCell className="text-right">KES {Number(loan.monthly_installment).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">KES {Number(loan.balance).toLocaleString()}</TableCell>
                    <TableCell>
                      {progress ? (
                        <div className="min-w-[120px]">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>KES {Math.round(progress.paid).toLocaleString()}</span>
                            <span>{Math.round(progress.pct)}%</span>
                          </div>
                          <Progress value={progress.pct} className="h-1.5" />
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge variant={riskBadge(loan.risk_rating ?? "medium")}>{loan.risk_rating ?? "medium"}</Badge></TableCell>
                    <TableCell><Badge variant={statusBadge(loan.status)}>{loan.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {loan.status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs border-green-400 text-green-600 hover:bg-green-50 hover:text-green-700 whitespace-nowrap"
                            onClick={() => handleDisburse(loan.id)}
                            disabled={disbursing}
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Disburse
                          </Button>
                        )}
                        {["active", "disbursed", "repaying"].includes(loan.status) && Number(loan.balance) > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs border-blue-400 text-blue-600 hover:bg-blue-50 hover:text-blue-700 whitespace-nowrap"
                            onClick={() => openPayDialog(loan)}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Record Payment
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => handleDownloadReceipt(loan)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Receipt
                        </Button>
                        {["active", "disbursed", "repaying", "completed", "defaulted"].includes(loan.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            onClick={() => setHistoryLoan(loan)}
                          >
                            <History className="h-3.5 w-3.5" />
                            History
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Admin Record Payment Dialog ───────────────────── */}
      <Dialog open={!!payLoan} onOpenChange={(v) => { if (!v) closePayDialog(); }}>
        <DialogContent className="sm:max-w-md">
          {!success ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-heading">
                  <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  Record Loan Payment
                </DialogTitle>
                <DialogDescription>
                  Recording a cash / offline payment for{" "}
                  <span className="font-semibold text-foreground">{payLoan?.loan_number}</span>
                  {" "}—{" "}<span className="font-semibold text-foreground">{payLoan?.members?.name ?? "Member"}</span>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Balance card */}
                <div className="rounded-xl border bg-muted/40 p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-xl font-bold text-destructive">KES {Number(payLoan?.balance ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Installment</p>
                    <p className="text-xl font-bold">KES {Number(payLoan?.monthly_installment ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Quick Select</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[payLoan?.monthly_installment, (payLoan?.monthly_installment ?? 0) * 2, payLoan?.balance].map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAmount(String(Math.round(q ?? 0)))}
                        className="rounded-lg border-2 py-1.5 px-1 text-xs font-semibold transition-colors border-border hover:border-blue-300 hover:bg-blue-50/50"
                      >
                        <span className="block text-[9px] text-muted-foreground mb-0.5">
                          {i === 0 ? "1 Month" : i === 1 ? "2 Months" : "Full Balance"}
                        </span>
                        {Math.round(q ?? 0).toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-pay-amount">Amount (KES)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">KES</span>
                    <Input id="admin-pay-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 text-base font-bold" placeholder="0" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-pay-note">Note / Reference (optional)</Label>
                  <Textarea id="admin-pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bank ref #001234, collected by treasurer..." rows={2} />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={closePayDialog}>Cancel</Button>
                <Button className="flex-1 gap-2" onClick={handleRecordPayment} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {saving ? "Recording…" : "Record Payment"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center text-center py-6 gap-5">
              <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-xl text-green-700 dark:text-green-400">Payment Recorded!</h3>
                <p className="text-sm text-muted-foreground">
                  KES {Number(amount).toLocaleString()} has been applied to <span className="font-semibold text-foreground">{payLoan?.loan_number}</span>.
                  Loan balance and transaction history have been updated.
                </p>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={closePayDialog}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Repayment History Dialog ───────────────────── */}
      <Dialog open={!!historyLoan} onOpenChange={(v) => { if (!v) setHistoryLoan(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <History className="h-5 w-5 text-primary" /> Repayment History
            </DialogTitle>
            <DialogDescription>
              {historyLoan?.loan_number} — {historyLoan?.members?.name ?? "Member"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-semibold">KES {Number(historyLoan?.balance ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Monthly Installment</p>
              <p className="text-lg font-semibold">KES {Number(historyLoan?.monthly_installment ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-lg font-semibold capitalize">{historyLoan?.status ?? "—"}</p>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-6"><Skeleton className="h-10 w-full" /></div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Repayment Schedule</h3>
                {historyData?.schedule?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Due (KES)</TableHead>
                        <TableHead className="text-right">Paid (KES)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.schedule.map((r: any) => (
                        <TableRow key={r._id ?? r.id}>
                          <TableCell>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="text-right">{Number(r.amountDue ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(r.amountPaid ?? 0).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={statusBadge(String(r.status ?? "pending"))}>{r.status}</Badge></TableCell>
                          <TableCell>{r.paidDate ? new Date(r.paidDate).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No repayment schedule found.</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Payment Transactions</h3>
                {historyData?.payments?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead className="text-right">Amount (KES)</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.payments.map((p: any) => (
                        <TableRow key={p._id ?? p.id}>
                          <TableCell>{new Date(p.processedAt ?? p.processed_at ?? p.createdAt ?? p.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono text-xs">{p.transactionRef ?? p.transaction_ref ?? "—"}</TableCell>
                          <TableCell className="text-right">{Number(p.amount ?? 0).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={statusBadge(String(p.status ?? "completed"))}>{p.status ?? "completed"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No repayment transactions yet.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}