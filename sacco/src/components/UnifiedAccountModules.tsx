import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarSync, Wallet, Download, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportPaymentReceipt } from "@/lib/pdf-export";

type UnifiedAccountData = {
  wallet?: {
    balance?: number;
    totalDeposits?: number;
    totalWithdrawals?: number;
    transactions?: any[];
  };
  cycles?: {
    eligible?: boolean;
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
  tenX?: {
    enrolled?: boolean;
    period?: string | null;
    amountDue?: number;
    amountPaid?: number;
    status?: string;
    contributions?: any[];
  } | null;
};

function kes(value: unknown) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

export function UnifiedAccountModules({
  data,
  isLoading,
  memberName = "Member",
  memberId = "",
  onPayCycle,
  onDepositSavings,
}: {
  data?: UnifiedAccountData;
  isLoading: boolean;
  memberName?: string;
  memberId?: string;
  onPayCycle?: () => void;
  onDepositSavings?: () => void;
}) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const wallet = data?.wallet;
  const cycle = data?.cycles?.active;
  const cycleEligible = data?.cycles?.eligible ?? Boolean(cycle);
  const walletTransactions = wallet?.transactions ?? [];
  const cyclePayments = data?.cycles?.payments ?? [];
  const tenX = data?.tenX;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> Wallet Balance</CardTitle>{onDepositSavings && <Button size="sm" onClick={onDepositSavings}>Deposit via STK</Button>}</div></CardHeader>
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
            <div className="py-4"><p className="text-sm text-muted-foreground">{cycleEligible ? "No cycle record is currently linked to this SACCO account." : "You are not selected to participate in the active cycle."}</p></div>
          ) : (
            <div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Cycle</p><p className="font-semibold">#{cycle.cycleNumber ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Contribution</p><p className="font-semibold">{kes(cycle.memberContribution)}</p></div>
                <div><p className="text-xs text-muted-foreground">Payments</p><p className="font-semibold">{cycle.paymentCount ?? 0}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="default">{cycle.status ?? "active"}</Badge></div>
              </div>
              {onPayCycle && cycleEligible && (
                <Button className="mt-4" onClick={onPayCycle}>
                  <Wallet className="mr-2 h-4 w-4" /> Pay Active Cycle via STK
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UsersRound className="h-5 w-5" /> 10X Group</CardTitle></CardHeader>
        <CardContent>
          {!tenX?.enrolled ? (
            <p className="py-2 text-sm text-muted-foreground">You are not currently enrolled in the 10X Group.</p>
          ) : !tenX.period ? (
            <p className="py-2 text-sm text-muted-foreground">You are enrolled in 10X. No contribution period is open right now.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Period</p><p className="font-semibold">{tenX.period}</p></div>
                <div><p className="text-xs text-muted-foreground">Amount due</p><p className="font-semibold">{kes(tenX.amountDue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={tenX.status === "SUCCESSFUL" ? "default" : "outline"}>{tenX.status === "SUCCESSFUL" ? "Paid" : "Pending"}</Badge></div>
              </div>
              <p className="text-sm text-muted-foreground">Paid this period: {kes(tenX.amountPaid)}</p>
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
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={transaction.status === "completed" ? "default" : "outline"}>{transaction.status ?? "—"}</Badge>
                          <Button variant="ghost" size="icon" title="Download receipt" onClick={() => exportPaymentReceipt({ memberName, memberId, amount: transaction.amount, date: transaction.processedAt, status: transaction.status, type: transaction.type, reference: transaction.mpesaRef || transaction.transactionRef, gateway: transaction.paymentGateway })}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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
                <div className="flex items-center gap-2">
                  <Badge variant="default">{payment.status ?? "completed"}</Badge>
                  <Button variant="ghost" size="icon" title="Download receipt" onClick={() => exportPaymentReceipt({ memberName, memberId, amount: payment.amount, date: payment.created_at || payment.date, status: payment.status, type: "cycle_payment", cycleNumber: payment.cycle_number, reference: payment.mpesa_transaction_id || payment.transaction_reference, gateway: "Lipia STK / M-Pesa" })}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}