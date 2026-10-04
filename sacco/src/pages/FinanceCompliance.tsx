import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileCheck2, Landmark, ReceiptText, ShieldCheck, Wallet, TrendingUp, CircleDollarSign } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { exportKraFilingReport } from "@/lib/pdf-export";

type FinanceTransaction = {
  _id: string;
  processedAt?: string | null;
  type: string;
  memberId?: { name?: string | null } | null;
  amount: number;
  feeAmount?: number;
};

type AuditActivity = {
  _id: string;
  action: string;
  tableName: string;
  createdAt?: string | null;
};

type FinanceOverview = {
  verifiedTransactions?: {
    verifiedTransactionCount?: number;
    verifiedTransactionVolume?: number;
  };
  memberFunds: Record<string, number>;
  organizationalFunds: {
    income?: number;
    expenses?: number;
    classificationRequired?: number;
    message?: string;
    transactionFees?: number;
    loanInterest?: number;
    otherIncome?: number;
    netPosition?: number;
  };
  monthlyPerformance?: { label: string; income: number; expenses: number; volume: number }[];
  incomeSources?: { transactionFees: number; loanInterest: number; otherIncome: number };
  expenseBreakdown?: Record<string, number>;
  recentTransactions: FinanceTransaction[];
  recentAuditActivity: AuditActivity[];
};

type FinancialStatementOverview = {
  closingCashBalance?: number;
};

function kes(value: unknown) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function readableLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1");
}

function readableTransactionType(value: string) {
  return value.replace(/_/g, " ");
}

export default function FinanceCompliance() {
  const { data: finance, isLoading: financeLoading } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: async () => api.get<FinanceOverview>("/finance/overview"),
  });
  const { data: statements, isLoading: statementsLoading } = useQuery({
    queryKey: ["finance-statements-overview"],
    queryFn: async () => api.get<FinancialStatementOverview>("/financial-statements/overview"),
  });

  const memberFunds = finance?.memberFunds ?? {};
  const organizationalFunds = finance?.organizationalFunds ?? {};
  const recentTransactions = finance?.recentTransactions ?? [];
  const recentAuditActivity = finance?.recentAuditActivity ?? [];
  const loading = financeLoading || statementsLoading;
  const incomeSources = finance?.incomeSources ?? { transactionFees: 0, loanInterest: 0, otherIncome: 0 };
  const expenses = finance?.expenseBreakdown ?? {};
  const totalIncome = Number(organizationalFunds.income || 0);
  const totalExpenses = Number(organizationalFunds.expenses || 0);
  const sourceChart = [
    { name: "Transaction Fees", value: incomeSources.transactionFees, color: "#2d7a36" },
    { name: "Loan Interest", value: incomeSources.loanInterest, color: "#c9a227" },
    { name: "Other Income", value: incomeSources.otherIncome, color: "#7c3aed" },
  ];

  const downloadKraReport = () => {
    exportKraFilingReport({
      periodLabel: new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
      verifiedTransactionCount: finance?.verifiedTransactions?.verifiedTransactionCount,
      verifiedTransactionVolume: finance?.verifiedTransactions?.verifiedTransactionVolume,
      memberDeposits: memberFunds.deposits,
      income: organizationalFunds.income,
      expenses: organizationalFunds.expenses,
      closingCashBalance: statements?.closingCashBalance,
      classificationRequired: organizationalFunds.classificationRequired,
      transactions: recentTransactions.map((transaction) => ({
        processedAt: transaction.processedAt,
        type: transaction.type,
        memberName: transaction.memberId?.name || undefined,
        amount: transaction.amount,
      })),
      auditActivity: recentAuditActivity,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Finance & Compliance</h1>
          <p className="text-sm text-muted-foreground">Finance preparation and evidence tracking over existing SACCO records.</p>
        </div>
        <Button onClick={downloadKraReport} disabled={loading} className="gap-2"><Download className="h-4 w-4" /> Download KRA Filing PDF</Button>
      </div>

      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="flex gap-3 py-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>These figures are system records for review. Tax obligations, classifications, and filings require authorized finance or tax-professional review.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Income</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold text-green-700">{loading ? "—" : kes(totalIncome)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Expenses</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(totalExpenses)}</p><p className="text-xs text-muted-foreground">Awaiting classification</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Net Position</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(totalIncome - totalExpenses)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Transaction Fees</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(incomeSources.transactionFees)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Loan Interest</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(incomeSources.loanInterest)}</p><p className="text-xs text-muted-foreground">Scheduled interest</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ReceiptText className="h-4 w-4" /> Verified Transactions</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : finance?.verifiedTransactions?.verifiedTransactionCount ?? 0}</p><p className="text-xs text-muted-foreground">{kes(finance?.verifiedTransactions?.verifiedTransactionVolume)} total volume</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> Member Deposits</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(memberFunds.deposits)}</p><p className="text-xs text-muted-foreground">Not organizational income</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Landmark className="h-4 w-4" /> Closing Cash</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(statements?.closingCashBalance)}</p><p className="text-xs text-muted-foreground">Existing SACCO statement</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Compliance State</CardTitle></CardHeader><CardContent><Badge variant="outline">Action required</Badge><p className="mt-2 text-xs text-muted-foreground">Configure obligations and evidence before filing claims.</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5" /> Income vs Expenses</CardTitle><p className="text-sm text-muted-foreground">Monthly performance</p></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={finance?.monthlyPerformance ?? []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={(value) => `KES ${Number(value).toLocaleString()}`} /><Tooltip formatter={(value: number) => kes(value)} /><Legend /><Bar dataKey="income" name="Income" fill="#2d7a36" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#cbd5e1" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CircleDollarSign className="h-5 w-5" /> Income Sources</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={2}>{sourceChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: number) => kes(value)} /></PieChart></ResponsiveContainer></div><div className="space-y-3 self-center">{sourceChart.map((entry) => <div key={entry.name} className="flex justify-between gap-4 text-sm"><span>{entry.name}</span><strong>{kes(entry.value)}</strong></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Expense Breakdown</CardTitle></CardHeader><CardContent className="space-y-3">{Object.entries({ hosting: expenses.hosting, domain: expenses.domain, paymentApi: expenses.paymentApi, maintenance: expenses.maintenance, bankCharges: expenses.bankCharges, taxes: expenses.taxes }).map(([key, value]) => <div key={key} className="flex justify-between text-sm"><span className="capitalize text-muted-foreground">{readableLabel(key)}</span><strong>{kes(value)}</strong></div>)}<div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">Expense categories are ready for classification. No expense records are currently stored in the SACCO ledger.</div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-lg">Member Funds Activity</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{Object.entries(memberFunds).map(([key, value]) => <div key={key} className="rounded-lg border p-3"><p className="text-xs capitalize text-muted-foreground">{readableLabel(key)}</p><p className="mt-1 font-semibold">{kes(value)}</p></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Organizational Finance</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between"><span className="text-muted-foreground">Recorded income</span><strong>{kes(organizationalFunds.income)}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Recorded expenses</span><strong>{kes(organizationalFunds.expenses)}</strong></div><div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{organizationalFunds.message}</div><p className="text-xs text-muted-foreground">Unclassified verified transactions: {organizationalFunds.classificationRequired ?? 0}</p></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle className="text-lg">Recent Verified Transactions</CardTitle></CardHeader><CardContent>{recentTransactions.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No verified transactions in the selected period.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Member</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{recentTransactions.map((transaction) => <TableRow key={transaction._id}><TableCell>{transaction.processedAt ? new Date(transaction.processedAt).toLocaleDateString() : "—"}</TableCell><TableCell className="capitalize">{readableTransactionType(transaction.type)}</TableCell><TableCell>{transaction.memberId?.name ?? "—"}</TableCell><TableCell className="text-right font-medium">{kes(transaction.amount)}</TableCell><TableCell><Badge>Verified</Badge></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileCheck2 className="h-5 w-5" /> Recent Audit Activity</CardTitle></CardHeader><CardContent>{recentAuditActivity.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No audit activity in the selected period.</p> : <div className="space-y-2">{recentAuditActivity.map((entry) => <div key={entry._id} className="flex justify-between gap-4 border-b py-2 text-sm last:border-0"><span>{entry.action} <span className="text-muted-foreground">on {entry.tableName}</span></span><span className="shrink-0 text-xs text-muted-foreground">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}</span></div>)}</div>}</CardContent></Card>
    </div>
  );
}