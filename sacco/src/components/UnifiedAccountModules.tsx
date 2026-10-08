import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarSync, Wallet, Download, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportPaymentReceipt } from "@/lib/pdf-export";
import { api } from "@/lib/api";
import { toast } from "sonner";

type UnifiedAccountData = {
  member?: {
    cycleContributionCount?: number;
    totalCycleContribution?: number;
  };
  wallet?: {
    balance?: number;
    availableForWithdrawal?: number;
    lockedAmount?: number;
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
  onPayTenX,
  onDepositSavings,
  onWithdrawalRequested,
}: {
  data?: UnifiedAccountData;
  isLoading: boolean;
  memberName?: string;
  memberId?: string;
  onPayCycle?: () => void;
  onPayTenX?: () => void;
  onDepositSavings?: () => void;
  onWithdrawalRequested?: () => void;
}) {
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  const wallet = data?.wallet;
  const cycle = data?.cycles?.active;
  const cycleEligible = data?.cycles?.eligible ?? Boolean(cycle);
  const walletTransactions = wallet?.transactions ?? [];
  const cyclePayments = data?.cycles?.payments ?? [];
  const tenX = data?.tenX;
  const pendingWithdrawal = walletTransactions.some((transaction: any) =>
    String(transaction.type ?? transaction.transaction_type).toLowerCase() === "withdrawal"
    && String(transaction.status).toLowerCase() === "pending",
  );
  const availableBalance = Math.max(0, Number(wallet?.availableForWithdrawal ?? wallet?.balance ?? 0));
  const requestedAmount = Number(withdrawalAmount);
  const withdrawalFee = (amount: number) => amount <= 100 ? 15 : amount <= 500 ? 18 : amount <= 1000 ? 30 : amount <= 2500 ? 38 : amount <= 5000 ? 95 : amount <= 10000 ? 145 : amount <= 20000 ? 235 : amount <= 50000 ? 350 : 385;
  const fee = requestedAmount > 0 ? withdrawalFee(requestedAmount) : 0;
  const estimatedNet = Math.max(0, requestedAmount - fee);

  const submitWithdrawal = async () => {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > availableBalance) {
      toast.error("Enter an amount within your available wallet balance.");
      return;
    }
    if (!accountName.trim() || !accountNumber.trim() || !bankName.trim()) {
      toast.error("Complete the payout account details.");
      return;
    }
    setWithdrawalSubmitting(true);
    try {
      await api.post("/savings/withdrawal", {
        amount: requestedAmount,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        bank_name: bankName.trim(),
      });
      toast.success("Withdrawal request submitted for admin approval.");
      setWithdrawalOpen(false);
      setWithdrawalAmount("");
      setAccountName("");
      setAccountNumber("");
      setBankName("");
      onWithdrawalRequested?.();
    } catch (error: any) {
      toast.error(error?.message || "Could not submit the withdrawal request.");
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" /> Wallet Balance</CardTitle><div className="flex gap-2">{onDepositSavings && <Button size="sm" onClick={onDepositSavings}>Deposit via STK</Button>}{onWithdrawalRequested && <Button size="sm" variant="outline" onClick={() => setWithdrawalOpen(true)} disabled={availableBalance <= 0 || pendingWithdrawal}>Withdraw</Button>}</div></div></CardHeader>
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

      <Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request wallet withdrawal</DialogTitle>
            <DialogDescription>Withdrawals require administrator approval. The fee is deducted from the requested amount.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="withdrawal-amount">Amount (KES)</Label><Input id="withdrawal-amount" type="number" min="1" max={availableBalance} value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} /><p className="text-xs text-muted-foreground">Available balance: {kes(availableBalance)}</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="withdrawal-account-name">Account name</Label><Input id="withdrawal-account-name" value={accountName} onChange={(event) => setAccountName(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="withdrawal-account-number">Account number</Label><Input id="withdrawal-account-number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="withdrawal-bank-name">Bank name</Label><Input id="withdrawal-bank-name" value={bankName} onChange={(event) => setBankName(event.target.value)} /></div>
            {requestedAmount > 0 && <div className="rounded-md bg-muted p-3 text-sm"><div className="flex justify-between"><span>Transaction fee</span><span>{kes(fee)}</span></div><div className="flex justify-between font-semibold"><span>Estimated net payout</span><span>{kes(estimatedNet)}</span></div></div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setWithdrawalOpen(false)}>Cancel</Button><Button onClick={submitWithdrawal} disabled={withdrawalSubmitting}>{withdrawalSubmitting ? "Submitting..." : "Submit request"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

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
                <div><p className="text-xs text-muted-foreground">This cycle</p><p className="font-semibold">{cycle.paymentCount ?? 0}</p></div>
                <div><p className="text-xs text-muted-foreground">Contributions made</p><p className="font-semibold">{data?.member?.cycleContributionCount ?? 0}</p></div>
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
            <div className="space-y-3 py-2"><p className="text-sm text-muted-foreground">You are enrolled in 10X. The current monthly period is being prepared.</p>{onPayTenX && <Button onClick={onPayTenX}><Wallet className="mr-2 h-4 w-4" /> Pay 10X via STK</Button>}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Period</p><p className="font-semibold">{tenX.period}</p></div>
                <div><p className="text-xs text-muted-foreground">Amount due</p><p className="font-semibold">{kes(tenX.amountDue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={tenX.status === "SUCCESSFUL" ? "default" : "outline"}>{tenX.status === "SUCCESSFUL" ? "Paid" : "Pending"}</Badge></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid this period</span><span className="font-medium">{kes(tenX.amountPaid)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, (Number(tenX.amountPaid || 0) / Math.max(1, Number(tenX.amountDue || 0))) * 100))}%` }} /></div>
                <p className="text-xs text-muted-foreground">Remaining: {kes(Math.max(0, Number(tenX.amountDue || 0) - Number(tenX.amountPaid || 0)))}</p>
              </div>
              {onPayTenX && Number(tenX.amountPaid || 0) < Number(tenX.amountDue || 0) && <Button className="mt-1" onClick={onPayTenX}><Wallet className="mr-2 h-4 w-4" /> Pay 10X via STK</Button>}
              {(tenX.contributions ?? []).length > 0 && <div className="space-y-1 border-t pt-3"><p className="text-xs font-medium">Recent 10X payments</p>{tenX.contributions.slice(0, 5).map((item: any) => <div key={String(item._id)} className="flex justify-between text-xs text-muted-foreground"><span>{item.period} · {item.status}</span><span>{kes(item.amount_paid)}</span></div>)}</div>}
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
                  {walletTransactions.slice(0, 20).map((transaction: any) => {
                    const transactionDate = transaction.processedAt
                      ?? transaction.processed_at
                      ?? transaction.createdAt
                      ?? transaction.created_at
                      ?? transaction.date;
                    return (
                    <TableRow key={String(transaction._id ?? transaction.id)}>
                      <TableCell>{transactionDate ? new Date(transactionDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="capitalize">{transaction.cycleNumber || transaction.cycle_number ? `Cycle ${transaction.cycleNumber || transaction.cycle_number} contribution` : String(transaction.type ?? "transaction").replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-right font-medium">{kes(transaction.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={transaction.status === "completed" ? "default" : "outline"}>{transaction.status ?? "—"}</Badge>
                          <Button variant="ghost" size="icon" title="Download receipt" onClick={() => exportPaymentReceipt({ memberName, memberId, amount: transaction.amount, date: transactionDate, status: transaction.status, type: transaction.type ?? transaction.transaction_type, reference: transaction.mpesaRef || transaction.transactionRef || transaction.transaction_ref, gateway: transaction.paymentGateway || transaction.payment_method })}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
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