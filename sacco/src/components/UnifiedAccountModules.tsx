import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarSync, Wallet } from "lucide-react";

type UnifiedAccountData = {
  wallet?: {
    balance?: number;
    totalDeposits?: number;
    totalWithdrawals?: number;
    transactions?: any[];
  };
  cycles?: {
    active?: {
      cycleNumber?: number;
      status?: string;
      endDate?: string | null;
      daysLeft?: number | null;
      contributionAmount?: number | null;
      memberContribution?: number;
      paymentCount?: number;
    } | null;
    payments?: any[];
  };
};

function kes(value: unknown) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

export function UnifiedAccountModules({ data, isLoading }: { data?: UnifiedAccountData; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const wallet = data?.wallet;
  const cycle = data?.cycles?.active;
  const walletTransactions = wallet?.transactions ?? [];
  const cyclePayments = data?.cycles?.payments ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> Wallet Balance</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{kes(wallet?.balance)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wallet Deposits</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{kes(wallet?.totalDeposits)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wallet Withdrawals</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{kes(wallet?.totalWithdrawals)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarSync className="h-5 w-5" /> Active Cycle</CardTitle></CardHeader>
        <CardContent>
          {!cycle ? (
            <p className="py-4 text-sm text-muted-foreground">No active cycle is linked to this SACCO account yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Cycle</p><p className="font-semibold">#{cycle.cycleNumber ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Contribution</p><p className="font-semibold">{kes(cycle.memberContribution)}</p></div>
              <div><p className="text-xs text-muted-foreground">Payments</p><p className="font-semibold">{cycle.paymentCount ?? 0}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="default">{cycle.status ?? "active"}</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Wallet Transactions</CardTitle></CardHeader>
        <CardContent>
          {walletTransactions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No wallet transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {walletTransactions.slice(0, 20).map((transaction: any) => (
                    <TableRow key={String(transaction._id ?? transaction.id)}>
                      <TableCell>{transaction.processedAt ? new Date(transaction.processedAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="capitalize">{String(transaction.type ?? "transaction").replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-right font-medium">{kes(transaction.amount)}</TableCell>
                      <TableCell><Badge variant={transaction.status === "completed" ? "default" : "outline"}>{transaction.status ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {cyclePayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Cycle Contribution History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cyclePayments.map((payment: any) => (
              <div key={String(payment._id ?? payment.id)} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <span>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "—"}</span>
                <span className="font-medium">{kes(payment.amount)}</span>
                <Badge variant="default">{payment.status ?? "completed"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}