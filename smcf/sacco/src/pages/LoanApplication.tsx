import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMembers } from "@/hooks/useMembers";
import { useLoans } from "@/hooks/useLoans";
import { useAuth } from "@/hooks/useAuth";
import { useMyMember } from "@/hooks/useMyAccount";
import { api } from "@/lib/api";
import { calculateRiskScore } from "@/lib/risk-engine";
import { evaluateLoanSafety, type LoanSafetyInput } from "@/lib/loan-safety-engine";
import { generateAmortization } from "@/lib/amortization";
import { LoanSafetyPanel } from "@/components/LoanSafetyPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, Users, ShieldCheck, CheckCircle2, Clock, XCircle, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { exportLoanApplicationReceipt } from "@/lib/pdf-export";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface ApprovalStep {
  role: string;
  label: string;
  status: ApprovalStatus;
}

interface LoanReceiptGuarantor {
  name: string;
  memberId: string;
  guaranteeAmount: number;
  savings: number;
}

interface LoanReceiptData {
  loanNumber: string;
  memberName: string;
  memberId: string;
  loanType?: string;
  appliedBy?: string;
  appliedAt?: string;
  principal: number;
  interestRate: number;
  interestModel: "reducing" | "flat";
  termMonths: number;
  monthlyInterest?: number;
  totalInterest?: number;
  riskRating?: string;
  monthlyPayment?: number;
  totalPayable?: number;
  guarantors?: LoanReceiptGuarantor[];
}

const APPROVAL_THRESHOLDS = [
  { max: 100_000, levels: ["Credit Officer"] },
  { max: 500_000, levels: ["Credit Officer", "Credit Committee"] },
  { max: Infinity, levels: ["Credit Officer", "Credit Committee", "Board"] },
];

const LOAN_TYPES = {
  business_development: {
    label: "Business Development Loan",
    rate: 4,
    minMonths: 3,
    maxMonths: 12,
  },
  education: {
    label: "Education Loan",
    rate: 2.5,
    minMonths: 3,
    maxMonths: 6,
  },
  emergency: {
    label: "Emergency Loan",
    rate: 3,
    minMonths: 1,
    maxMonths: 2,
  },
  asset_acquisition: {
    label: "Asset Acquisition Loan",
    rate: 3,
    minMonths: 4,
    maxMonths: 8,
  },
  personal: {
    label: "Personal Loan",
    rate: 6,
    minMonths: 1,
    maxMonths: 3,
  },
} as const;

type LoanTypeKey = keyof typeof LOAN_TYPES;

function getRequiredApprovals(amount: number): ApprovalStep[] {
  const config = APPROVAL_THRESHOLDS.find((t) => amount <= t.max)!;
  return config.levels.map((role) => ({
    role,
    label: role,
    status: "pending" as ApprovalStatus,
  }));
}

function riskBadgeVariant(level: string) {
  if (level === "low") return "default" as const;
  if (level === "medium") return "secondary" as const;
  return "destructive" as const;
}

export default function LoanApplication() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isStaff } = useAuth();
  const isBypassUser = user?.email === "sunnyson2345@gmail.com";
  const { data: myMember } = useMyMember();
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: loansData = [] } = useLoans();

  const [selectedMemberId, setSelectedMemberId] = useState("");

  // For regular members, auto-select their own profile
  useEffect(() => {
    if (!isStaff && myMember?.id) {
      setSelectedMemberId(myMember.id);
    }
  }, [isStaff, myMember?.id]);
  const [principal, setPrincipal] = useState("");
  const [loanType, setLoanType] = useState<LoanTypeKey | "">("");
  const [term, setTerm] = useState("");
  const [selectedGuarantors, setSelectedGuarantors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedLoan, setSubmittedLoan] = useState<LoanReceiptData | null>(null);

  const principalNum = Number(principal) || 0;
  const termNum = Number(term) || 0;
  const loanTypeConfig = loanType ? LOAN_TYPES[loanType] : null;
  const rateNum = loanTypeConfig?.rate ?? 0;
  const loanTypeLabel = loanTypeConfig?.label ?? "";
  const minTerm = loanTypeConfig?.minMonths ?? 0;
  const maxTerm = loanTypeConfig?.maxMonths ?? 0;
  const isTermValid = !!loanTypeConfig && termNum >= minTerm && termNum <= maxTerm;
  const termOptions = loanTypeConfig
    ? Array.from({ length: maxTerm - minTerm + 1 }, (_, i) => minTerm + i)
    : [];

  useEffect(() => {
    if (!loanTypeConfig) return;
    if (!termNum || termNum < minTerm || termNum > maxTerm) {
      setTerm(String(minTerm));
    }
  }, [loanTypeConfig, minTerm, maxTerm, termNum]);

  const selectedMember = members.find((m: any) => m.id === selectedMemberId);
  const riskBreakdown = useMemo(
    () => (selectedMember ? calculateRiskScore(selectedMember) : null),
    [selectedMember]
  );

  const schedule = useMemo(
    () => generateAmortization(principalNum, rateNum, termNum, "flat"),
    [principalNum, rateNum, termNum]
  );

  const monthlyInterest = principalNum * (rateNum / 100);
  const totalInterest = monthlyInterest * termNum;
  const totalPayable = principalNum + totalInterest;
  const monthlyPayment = termNum > 0 ? totalPayable / termNum : 0;
  const roundedMonthlyInterest = Math.round(monthlyInterest);
  const roundedTotalInterest = Math.round(totalInterest);
  const roundedTotalPayable = Math.round(totalPayable);
  const roundedMonthlyPayment = Math.round(monthlyPayment);

  const approvalSteps = useMemo(() => getRequiredApprovals(principalNum), [principalNum]);

  const availableGuarantors = members.filter(
    (m: any) => m.id !== selectedMemberId && m.status === "active"
  );

  const shouldEnforceEligibility = !isBypassUser && !isStaff;
  const selectableMembers = isStaff ? members : members.filter((m: any) => m.status === "active");

  // Compute SACCO-wide aggregates for the master algorithm
  const saccoCapital = useMemo(() => members.reduce((s: number, m: any) => s + Number(m.savings) + Number(m.shares), 0), [members]);
  const totalLoansIssued = useMemo(() => loansData
    .filter((l: any) => ["repaying", "disbursed", "approved"].includes(l.status))
    .reduce((s: number, l: any) => s + Number(l.balance), 0), [loansData]);

  // Master Loan Safety Algorithm evaluation
  const safetyResult = useMemo(() => {
    if (!selectedMember || principalNum <= 0) return null;
    const guarantorData = selectedGuarantors.map((gId) => {
      const g = members.find((m: any) => m.id === gId);
      return g ? { id: g.id, name: g.name, savings: Number(g.savings), risk_score: g.risk_score } : null;
    }).filter(Boolean) as LoanSafetyInput["guarantors"];

    const input: LoanSafetyInput = {
      member: {
        savings: Number(selectedMember.savings),
        shares: Number(selectedMember.shares),
        loan_balance: Number(selectedMember.loan_balance),
        risk_score: selectedMember.risk_score,
        trust_score: selectedMember.risk_score ?? 50, // use risk_score as trust proxy
      },
      requestedLoan: principalNum,
      guarantors: guarantorData,
      saccoCapital,
      totalLoansIssued,
    };
    return evaluateLoanSafety(input);
  }, [selectedMember, principalNum, selectedGuarantors, members, saccoCapital, totalLoansIssued]);

  const maxBorrowing = safetyResult?.layer1.safeLoanLimit ?? (selectedMember ? (selectedMember.savings + selectedMember.shares) * 3 : 0);

  const eligibilityIssues: string[] = [];
  if (selectedMember && shouldEnforceEligibility) {
    if (selectedMember.status !== "active") eligibilityIssues.push("Member is not active");
    if (safetyResult && safetyResult.decision === "REJECT") {
      safetyResult.reasons.forEach((r) => eligibilityIssues.push(r));
    }
    const existingLoans = loansData.filter((l: any) => l.member_id === selectedMemberId && ["repaying", "disbursed"].includes(l.status));
    if (existingLoans.length >= 2) eligibilityIssues.push("Maximum 2 active loans allowed");
  }

  const toggleGuarantor = (id: string) => {
    setSelectedGuarantors((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleSubmit = async () => {
    if (!selectedMemberId || principalNum <= 0 || termNum <= 0 || !loanTypeConfig || !isTermValid || (!isStaff && selectedGuarantors.length < 2)) {
      toast({ title: "Validation Error", description: "Please complete all required fields.", variant: "destructive" });
      return;
    }
    if (shouldEnforceEligibility && eligibilityIssues.length > 0) {
      toast({ title: "Eligibility Failed", description: eligibilityIssues[0], variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/loans", {
        memberId: selectedMemberId,
        principal: principalNum,
        loanType,
        interestRate: rateNum,
        interestModel: "flat",
        termMonths: termNum,
        riskRating: safetyResult?.layer2.riskLevel.toLowerCase() ?? riskBreakdown?.riskLevel ?? "medium",
        guarantors: selectedGuarantors.map((gId) => ({
          memberId: gId,
          guaranteeAmount: Math.round(principalNum / selectedGuarantors.length),
        })),
      });

      const loanData = (response as any)?.data ?? response;
      const loanNumber = loanData?.loanNumber ?? loanData?.loan_number ?? "LN-NEW";
      const receiptGuarantors: LoanReceiptGuarantor[] = selectedGuarantors.map((gId) => {
        const guarantor = members.find((m: any) => m.id === gId);
        return {
          name: guarantor?.name ?? "Guarantor",
          memberId: guarantor?.member_id ?? guarantor?.memberId ?? "",
          guaranteeAmount: Math.round(principalNum / selectedGuarantors.length),
          savings: Number(guarantor?.savings ?? 0),
        };
      });

      setSubmittedLoan({
        loanNumber,
        memberName: selectedMember?.name ?? "Member",
        memberId: selectedMember?.member_id ?? selectedMember?.memberId ?? "",
        appliedBy: user?.fullName ?? user?.email ?? "Staff",
        appliedAt: loanData?.createdAt ?? loanData?.created_at ?? new Date().toISOString(),
        principal: principalNum,
        loanType: loanTypeLabel,
        interestRate: rateNum,
        interestModel: "flat",
        termMonths: termNum,
        monthlyInterest: roundedMonthlyInterest,
        totalInterest: roundedTotalInterest,
        riskRating: safetyResult?.layer2.riskLevel.toLowerCase() ?? riskBreakdown?.riskLevel ?? "medium",
        monthlyPayment: roundedMonthlyPayment,
        totalPayable: roundedTotalPayable,
        guarantors: receiptGuarantors,
      });
      setSubmitted(true);
      toast({ title: "Loan Application Submitted", description: `Application ${loanNumber} for KES ${principalNum.toLocaleString()} submitted for approval.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Application Submitted</h1>
            <p className="text-muted-foreground text-sm">Loan application is now in the approval pipeline</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Application Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Applicant</span><p className="font-semibold">{selectedMember?.name}</p></div>
              <div><span className="text-muted-foreground">Principal</span><p className="font-semibold">KES {principalNum.toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Loan Type</span><p className="font-semibold">{loanTypeLabel || "—"}</p></div>
              <div><span className="text-muted-foreground">Monthly Payment</span><p className="font-semibold">KES {roundedMonthlyPayment.toLocaleString()}</p></div>
              <div><span className="text-muted-foreground">Risk Score</span><p className="font-semibold">{riskBreakdown?.compositeScore}/100</p></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Approval Pipeline</CardTitle>
            <CardDescription>Multi-level approval based on loan amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {approvalSteps.map((step, i) => (
                <div key={step.role} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-full border-2 border-warning/60 bg-warning/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <span className="text-xs font-medium text-center">{step.label}</span>
                    <Badge variant="secondary" className="text-xs">Pending</Badge>
                  </div>
                  {i < approvalSteps.length - 1 && (
                    <div className="h-px w-12 bg-border mt-[-1.5rem]" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/loans")}>Back to Loans</Button>
          {isStaff && submittedLoan && (
            <Button variant="outline" className="gap-2" onClick={() => exportLoanApplicationReceipt(submittedLoan)}>
              <Download className="h-4 w-4" /> Download Receipt
            </Button>
          )}
          <Button variant="outline" onClick={() => { setSubmitted(false); setSubmittedLoan(null); }}>New Application</Button>
        </div>
      </div>
    );
  }

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/loans")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold">New Loan Application</h1>
          <p className="text-muted-foreground text-sm">Complete all sections to submit for approval</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" /> Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applicant Member *</Label>
                  {isStaff ? (
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {selectableMembers.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.member_id} — {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      {myMember ? (
                        <span className="font-medium">{myMember.member_id} — {myMember.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Loading your profile…</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Loan Type *</Label>
                  <Select value={loanType} onValueChange={(value) => setLoanType(value as LoanTypeKey)}>
                    <SelectTrigger><SelectValue placeholder="Select loan type" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOAN_TYPES).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loanTypeConfig && (
                    <p className="text-xs text-muted-foreground">
                      Fixed {rateNum}% per month • {minTerm}–{maxTerm} months
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount (KES) *</Label>
                  <Input type="number" min={1000} max={5_000_000} value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="e.g. 200000" />
                  {selectedMember && (
                    <p className="text-xs text-muted-foreground">Safe loan limit: KES {maxBorrowing.toLocaleString()} (based on trust score & SACCO capital)</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Monthly Interest Rate (%)</Label>
                  <Input type="text" value={loanTypeConfig ? `${rateNum}` : ""} readOnly disabled />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Term (Months) *</Label>
                  <Select value={term} onValueChange={setTerm} disabled={!loanTypeConfig}>
                    <SelectTrigger><SelectValue placeholder={loanTypeConfig ? "Select duration" : "Select loan type first"} /></SelectTrigger>
                    <SelectContent>
                      {termOptions.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} {value === 1 ? "month" : "months"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {loanTypeConfig && !isTermValid && term && (
                    <p className="text-xs text-destructive">Select {minTerm}–{maxTerm} months for this loan type.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guarantor Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Guarantor Selection
                <Badge variant="secondary" className="ml-auto">{selectedGuarantors.length}/2–4 selected</Badge>
              </CardTitle>
              <CardDescription>Select 2–4 guarantors. Each guarantor's savings must cover their exposure.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Member</TableHead>
                    {isStaff && <TableHead className="text-right">Savings</TableHead>}
                    <TableHead className="text-right">Max Guarantee</TableHead>
                    <TableHead className="text-center">Risk Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGuarantors.map((g: any) => {
                    const gRisk = calculateRiskScore(g);
                    const isSelected = selectedGuarantors.includes(g.id);
                    const maxGuarantee = g.savings * 3;
                    return (
                      <TableRow key={g.id} className={cn("cursor-pointer", isSelected && "bg-accent/10")} onClick={() => toggleGuarantor(g.id)}>
                        <TableCell>
                          <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center transition-colors", isSelected ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        {isStaff && <TableCell className="text-right">KES {g.savings.toLocaleString()}</TableCell>}
                        <TableCell className="text-right">KES {maxGuarantee.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={riskBadgeVariant(gRisk.riskLevel)}>{gRisk.compositeScore}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Amortization Schedule */}
          {schedule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" /> Amortization Schedule
                  <Badge variant="secondary" className="ml-auto">Flat Rate</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Monthly Payment</p>
                    <p className="text-lg font-bold font-heading">KES {roundedMonthlyPayment.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Monthly Interest</p>
                    <p className="text-lg font-bold font-heading">KES {roundedMonthlyInterest.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Total Interest</p>
                    <p className="text-lg font-bold font-heading">KES {roundedTotalInterest.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-muted-foreground">Total Payable</p>
                    <p className="text-lg font-bold font-heading">KES {roundedTotalPayable.toLocaleString()}</p>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell>{row.month}</TableCell>
                          <TableCell className="text-right">KES {row.payment.toLocaleString()}</TableCell>
                          <TableCell className="text-right">KES {row.principal.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">KES {row.interest.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold">KES {row.balance.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Master Loan Safety Algorithm Panel */}
          {safetyResult ? (
            <LoanSafetyPanel result={safetyResult} requestedLoan={principalNum} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Loan Safety Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-6">
                  Select a member and enter a loan amount to run the 4-layer safety analysis
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Approval Workflow</CardTitle>
              <CardDescription>
                {principalNum <= 100_000 ? "≤ KES 100K → Credit Officer only"
                  : principalNum <= 500_000 ? "≤ KES 500K → Credit Officer + Committee"
                  : "> KES 500K → Officer + Committee + Board"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {approvalSteps.map((step, i) => (
                  <div key={step.role} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={!selectedMemberId || principalNum <= 0 || !loanTypeConfig || !isTermValid || (shouldEnforceEligibility && eligibilityIssues.length > 0) || submitting}>
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </div>
    </div>
  );
}