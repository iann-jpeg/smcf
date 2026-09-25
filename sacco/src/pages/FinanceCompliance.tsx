import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileCheck2, Landmark, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

type FinanceTransaction = {
  _id: string;
  processedAt?: string | null;
  type: string;
  memberId?: { name?: string | null } | null;
  amount: number;
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
  };
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Finance & Compliance</h1>
        <p className="text-sm text-muted-foreground">Finance preparation and evidence tracking over existing SACCO records.</p>
      </div>

      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="flex gap-3 py-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>These figures are system records for review. Tax obligations, classifications, and filings require authorized finance or tax-professional review.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ReceiptText className="h-4 w-4" /> Verified Transactions</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : finance?.verifiedTransactions?.verifiedTransactionCount ?? 0}</p><p className="text-xs text-muted-foreground">{kes(finance?.verifiedTransactions?.verifiedTransactionVolume)} total volume</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> Member Deposits</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(memberFunds.deposits)}</p><p className="text-xs text-muted-foreground">Not organizational income</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Landmark className="h-4 w-4" /> Closing Cash</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{loading ? "—" : kes(statements?.closingCashBalance)}</p><p className="text-xs text-muted-foreground">Existing SACCO statement</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Compliance State</CardTitle></CardHeader><CardContent><Badge variant="outline">Action required</Badge><p className="mt-2 text-xs text-muted-foreground">Configure obligations and evidence before filing claims.</p></CardContent></Card>
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