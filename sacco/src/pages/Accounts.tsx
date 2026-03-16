import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTransactions } from "@/hooks/useTransactions";
import { useMembers } from "@/hooks/useMembers";
import { api, normalizeTransaction } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, TrendingUp, Users, Coins, X } from "lucide-react";
import { toast } from "sonner";

export default function Accounts() {
  const qc = useQueryClient();
  const { data: members = [], isLoading: membersLoading } = useMembers();
  const { data: transactions = [], isLoading: txnLoading } = useTransactions(50);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  // Dividend distribution state
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendPeriod, setDividendPeriod] = useState(String(new Date().getFullYear()));
  const [distributing, setDistributing] = useState(false);
  const [distResult, setDistResult] = useState<any | null>(null);

  // Pending payments (status = pending)
  const { data: pending = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["transactions", "pending"],
    queryFn: async () => {
      const res = await api.get("/transactions?status=pending&limit=100");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeTransaction);
    },
    refetchInterval: 30_000,
  });

  // Past dividend distributions
  const { data: dividends = [], refetch: refetchDividends } = useQuery({
    queryKey: ["transactions", "dividends"],
    queryFn: async () => {
      const res = await api.get("/transactions?type=dividend&limit=200");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeTransaction);
    },
  });

  async function confirmPayment(id: string) {
    setConfirmingId(id);
    try {
      await api.patch(`/transactions/${id}/confirm`, {});
      toast.success("Payment confirmed — balances updated.");
      await Promise.all([
        refetchPending(),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
        qc.invalidateQueries({ queryKey: ["members"] }),
        qc.invalidateQueries({ queryKey: ["loans"] }),
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to confirm payment.");
    } finally {
      setConfirmingId(null);
    }
  }

  async function declinePayment(id: string) {
    setDecliningId(id);
    try {
      await api.patch(`/transactions/${id}/decline`, {});
      toast.success("Payment declined — member notified.");
      await Promise.all([
        refetchPending(),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to decline payment.");
    } finally {
      setDecliningId(null);
    }
  }

  async function distributeDividends() {
    const total = Number(dividendAmount);
    if (!total || total < 1)         { toast.error("Enter a valid dividend amount"); return; }
    if (!dividendPeriod.trim())      { toast.error("Enter the distribution period"); return; }
    setDistributing(true);
    setDistResult(null);
    try {
      const res: any = await api.post("/shares/distribute-dividends", {
        totalDividend: total,
        period: dividendPeriod.trim(),
      });
      setDistResult(res);
      toast.success(`Dividends distributed to ${res.membersProcessed} members.`);
      refetchDividends();
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    } catch (err: any) {
      toast.error(err?.message || "Distribution failed.");
    } finally {
      setDistributing(false);
    }
  }

  // Derive chart of accounts from member aggregates
  const chartOfAccounts = useMemo(() => {
    const totalSavings = members.reduce((s: number, m: any) => s + Number(m.savings), 0);
    const totalShares = members.reduce((s: number, m: any) => s + Number(m.shares), 0);
    const totalLoanBalance = members.reduce((s: number, m: any) => s + Number(m.loan_balance), 0);
    const cashAndBank = totalSavings + totalShares - totalLoanBalance;

    return [
      { code: "1000", name: "Cash & Bank", type: "Asset", balance: cashAndBank },
      { code: "1100", name: "Loan Receivables", type: "Asset", balance: totalLoanBalance },
      { code: "2000", name: "Member Savings", type: "Liability", balance: totalSavings },
      { code: "2100", name: "Member Share Capital", type: "Equity", balance: totalShares },
    ];
  }, [members]);

  const isLoading = membersLoading || txnLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Accounts & Ledger</h1>
        <p className="text-muted-foreground text-sm">Double-entry accounting system</p>
      </div>

      <Tabs defaultValue="coa">
        <TabsList>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pending Payments
            {pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold h-4 min-w-4 px-1">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="dividends">
            <Coins className="mr-1.5 h-3.5 w-3.5" />
            Dividends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coa">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance (KES)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartOfAccounts.map((acc) => (
                      <TableRow key={acc.code}>
                        <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell><Badge variant="secondary">{acc.type}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{acc.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              {txnLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>M-Pesa Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-xs">{txn.transaction_ref}</TableCell>
                        <TableCell className="font-mono text-xs">{txn.mpesa_ref || txn.mpesaRef || "—"}</TableCell>
                        <TableCell>{new Date(txn.processed_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{txn.members?.name ?? "—"}</TableCell>
                        <TableCell>{txn.type}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(txn.amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={txn.status === "completed" ? "default" : txn.status === "declined" ? "destructive" : "secondary"}>{txn.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              {pendingLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : pending.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending payments.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell>{new Date(txn.processed_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{txn.members?.name ?? txn.member_name ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{txn.type}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{txn.description ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(txn.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => confirmPayment(txn.id)}
                              disabled={confirmingId === txn.id || decliningId === txn.id}
                            >
                              {confirmingId === txn.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />}
                              {confirmingId === txn.id ? "Confirming…" : "Confirm"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                              onClick={() => declinePayment(txn.id)}
                              disabled={confirmingId === txn.id || decliningId === txn.id}
                            >
                              {decliningId === txn.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <X className="h-3.5 w-3.5" />}
                              {decliningId === txn.id ? "Declining…" : "Decline"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Dividend Distribution ─────────────────────────────────────── */}
        <TabsContent value="dividends" className="space-y-4">

          {/* Distribution form */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Coins className="h-5 w-5 text-yellow-500" />
                Distribute Dividends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">
                Enter the total dividend pool to distribute proportionally to all active members based on their share capital.
              </p>

              {/* Summary of current share capital */}
              {members.length > 0 && (() => {
                const totalShares   = members.reduce((s: number, m: any) => s + Number(m.shares), 0);
                const eligibleCount = members.filter((m: any) => Number(m.shares) > 0).length;
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Total Share Capital</p>
                      <p className="font-bold text-lg">KES {totalShares.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Eligible Members</p>
                      <p className="font-bold text-lg flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" /> {eligibleCount}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="div-amount">Total Dividend Pool (KES)</Label>
                  <Input
                    id="div-amount"
                    type="number"
                    min={1}
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    placeholder="e.g. 500000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="div-period">Period</Label>
                  <Input
                    id="div-period"
                    value={dividendPeriod}
                    onChange={(e) => setDividendPeriod(e.target.value)}
                    placeholder="e.g. 2025 or Q1-2025"
                  />
                </div>
              </div>

              {Number(dividendAmount) > 0 && (() => {
                const totalShares = members.reduce((s: number, m: any) => s + Number(m.shares), 0);
                if (!totalShares) return null;
                const sample = members
                  .filter((m: any) => Number(m.shares) > 0)
                  .slice(0, 3)
                  .map((m: any) => ({
                    name: m.name,
                    proportion: ((Number(m.shares) / totalShares) * 100).toFixed(1),
                    dividend: Math.round((Number(m.shares) / totalShares) * Number(dividendAmount)),
                  }));
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-900/10 dark:border-blue-800 p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" /> Preview (first 3 members)
                    </p>
                    {sample.map((s: any) => (
                      <div key={s.name} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{s.name} ({s.proportion}%)</span>
                        <span className="font-semibold">KES {s.dividend.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <Button
                className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={distributeDividends}
                disabled={distributing || !dividendAmount || !dividendPeriod.trim()}
              >
                {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                {distributing ? "Distributing…" : "Distribute Dividends"}
              </Button>

              {distResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-700 p-4 space-y-2">
                  <p className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Distribution complete — {distResult.period}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    KES {Number(distResult.totalDividend).toLocaleString()} distributed to{" "}
                    <strong>{distResult.membersProcessed}</strong> members.
                  </p>
                  <div className="max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead className="text-right">Share %</TableHead>
                          <TableHead className="text-right">Dividend</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distResult.distributions?.map((d: any) => (
                          <TableRow key={d.ref}>
                            <TableCell className="text-sm">{d.name}</TableCell>
                            <TableCell className="text-right text-sm">{d.proportion}%</TableCell>
                            <TableCell className="text-right font-semibold text-sm">KES {Number(d.dividend).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past dividends */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Past Dividend Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              {(dividends as any[]).length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">No dividend distributions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (KES)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dividends as any[]).map((txn: any) => (
                      <TableRow key={txn.id}>
                        <TableCell className="text-sm">{new Date(txn.processed_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium text-sm">{txn.members?.name ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{txn.description ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{Number(txn.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
