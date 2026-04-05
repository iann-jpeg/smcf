import { useMemo } from "react";
import { useMembers } from "@/hooks/useMembers";
import { useLoans } from "@/hooks/useLoans";
import { useTransactions } from "@/hooks/useTransactions";
import { useGuarantors } from "@/hooks/useGuarantors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, Users, Landmark, Shield, Download } from "lucide-react";
import {
  exportBalanceSheet,
  exportIncomeStatement,
  exportLoanPortfolio,
  exportGuarantorExposure,
  exportMemberStatements,
} from "@/lib/pdf-export";

export default function Reports() {
  const { data: members = [] } = useMembers();
  const { data: loans = [] } = useLoans();
  const { data: transactions = [] } = useTransactions();
  const { data: guarantors = [] } = useGuarantors();

  // Balance sheet
  const balanceSheet = useMemo(() => {
    const totalSavings = members.reduce((s, m: any) => s + Number(m.savings), 0);
    const totalShares = members.reduce((s, m: any) => s + Number(m.shares), 0);
    const totalLoanBalance = loans.reduce((s, l: any) => s + Number(l.balance), 0);
    const totalDeposits = totalSavings + totalShares;
    const equity = totalDeposits - totalLoanBalance;
    return { totalSavings, totalShares, totalLoanBalance, totalDeposits, equity };
  }, [members, loans]);

  // Income statement
  const incomeStatement = useMemo(() => {
    const interestIncome = loans.reduce((s, l: any) => s + (Number(l.total_payable) - Number(l.principal)), 0);
    const disbursed = loans.filter((l: any) => ["active", "disbursed", "completed"].includes(l.status)).length;
    return { interestIncome, disbursed };
  }, [loans]);

  // Loan portfolio
  const portfolio = useMemo(() => {
    const active = loans.filter((l: any) => ["active", "disbursed"].includes(l.status));
    const defaulted = loans.filter((l: any) => l.status === "defaulted");
    const pending = loans.filter((l: any) => l.status === "pending");
    const totalOutstanding = active.reduce((s, l: any) => s + Number(l.balance), 0);
    const defaultedAmount = defaulted.reduce((s, l: any) => s + Number(l.balance), 0);
    const par30 = totalOutstanding > 0 ? ((defaultedAmount / totalOutstanding) * 100).toFixed(1) : "0.0";
    return { active, defaulted, pending, totalOutstanding, defaultedAmount, par30, total: loans.length };
  }, [loans]);

  // Guarantor exposure
  const guarantorExposure = useMemo(() => {
    const grouped: Record<string, { name: string; total: number; count: number }> = {};
    guarantors.forEach((g: any) => {
      const mid = g.member_id;
      if (!grouped[mid]) grouped[mid] = { name: g.members?.name ?? "Unknown", total: 0, count: 0 };
      grouped[mid].total += Number(g.guarantee_amount);
      grouped[mid].count += 1;
    });
    return Object.entries(grouped).map(([id, v]) => {
      const member = members.find((m: any) => m.id === id);
      const savings = member ? Number((member as any).savings) : 0;
      const maxAllowed = savings * 3;
      const ratio = maxAllowed > 0 ? ((v.total / maxAllowed) * 100).toFixed(1) : "N/A";
      return { ...v, savings, maxAllowed, ratio };
    }).sort((a, b) => Number(b.ratio) - Number(a.ratio));
  }, [guarantors, members]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Live financial reports from database</p>
      </div>

      <Tabs defaultValue="balance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="balance" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="income" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Income Statement</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1.5"><Landmark className="h-3.5 w-3.5" /> Loan Portfolio</TabsTrigger>
          <TabsTrigger value="guarantor" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Guarantor Exposure</TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Member Statements</TabsTrigger>
        </TabsList>

        {/* Balance Sheet */}
        <TabsContent value="balance" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="font-heading">Balance Sheet</CardTitle>
                <CardDescription>Assets, liabilities, and equity snapshot</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => exportBalanceSheet(balanceSheet)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:hidden">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Assets</p>
                  <p className="text-sm">Loan Portfolio (Outstanding)</p>
                  <p className="font-semibold">KES {balanceSheet.totalLoanBalance.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Liabilities</p>
                  <p className="text-sm">Member Savings</p>
                  <p className="font-semibold">KES {balanceSheet.totalSavings.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Equity</p>
                  <p className="text-sm">Share Capital</p>
                  <p className="font-semibold">KES {balanceSheet.totalShares.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm font-medium">Total Deposits (Savings + Shares)</p>
                  <p className="font-bold">KES {balanceSheet.totalDeposits.toLocaleString()}</p>
                </div>
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Amount (KES)</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow><TableCell className="font-semibold" colSpan={2}>Assets</TableCell></TableRow>
                    <TableRow><TableCell className="pl-8">Loan Portfolio (Outstanding)</TableCell><TableCell className="text-right font-mono">{balanceSheet.totalLoanBalance.toLocaleString()}</TableCell></TableRow>
                    <TableRow className="border-t"><TableCell className="font-semibold" colSpan={2}>Liabilities</TableCell></TableRow>
                    <TableRow><TableCell className="pl-8">Member Savings</TableCell><TableCell className="text-right font-mono">{balanceSheet.totalSavings.toLocaleString()}</TableCell></TableRow>
                    <TableRow className="border-t"><TableCell className="font-semibold" colSpan={2}>Equity</TableCell></TableRow>
                    <TableRow><TableCell className="pl-8">Share Capital</TableCell><TableCell className="text-right font-mono">{balanceSheet.totalShares.toLocaleString()}</TableCell></TableRow>
                    <TableRow className="bg-muted/50 font-bold"><TableCell>Total Deposits (Savings + Shares)</TableCell><TableCell className="text-right font-mono">{balanceSheet.totalDeposits.toLocaleString()}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Income Statement */}
        <TabsContent value="income" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="font-heading">Income Statement</CardTitle>
                <CardDescription>Revenue from interest on active loans</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => exportIncomeStatement({ ...incomeStatement, totalTransactions: transactions.length })}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Interest Income (Projected)</p>
                  <p className="text-2xl font-bold font-heading">KES {incomeStatement.interestIncome.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Loans Disbursed</p>
                  <p className="text-2xl font-bold font-heading">{incomeStatement.disbursed}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold font-heading">{transactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loan Portfolio */}
        <TabsContent value="portfolio" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 pb-4"><p className="text-sm text-muted-foreground">Total Loans</p><p className="text-2xl font-bold font-heading">{portfolio.total}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold font-heading">{portfolio.active.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-sm text-muted-foreground">Defaulted</p><p className="text-2xl font-bold font-heading text-destructive">{portfolio.defaulted.length}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-sm text-muted-foreground">PAR &gt;30</p><p className="text-2xl font-bold font-heading">{portfolio.par30}%</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading">Loan Portfolio Detail</CardTitle>
                <Button size="sm" variant="outline" onClick={() => exportLoanPortfolio(
                  { total: portfolio.total, active: portfolio.active.length, defaulted: portfolio.defaulted.length, par30: portfolio.par30 },
                  loans.map((l: any) => ({ loan_number: l.loan_number, memberName: l.members?.name ?? "—", principal: Number(l.principal), balance: Number(l.balance), status: l.status, risk_rating: l.risk_rating }))
                )}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <>
                <div className="space-y-3 md:hidden">
                  {loans.map((loan: any) => (
                    <div key={loan.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs truncate">{loan.loan_number}</p>
                        <Badge variant={loan.status === "active" || loan.status === "completed" ? "default" : loan.status === "defaulted" ? "destructive" : "secondary"}>{loan.status}</Badge>
                      </div>
                      <p className="text-sm">{loan.members?.name ?? "—"}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Principal</p>
                          <p className="font-medium">KES {Number(loan.principal).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="font-medium">KES {Number(loan.balance).toLocaleString()}</p>
                        </div>
                      </div>
                      <Badge variant={loan.risk_rating === "low" ? "default" : loan.risk_rating === "high" ? "destructive" : "secondary"}>{loan.risk_rating}</Badge>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan #</TableHead><TableHead>Member</TableHead><TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead>Risk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((loan: any) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                          <TableCell>{loan.members?.name ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono">KES {Number(loan.principal).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">KES {Number(loan.balance).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={loan.status === "active" || loan.status === "completed" ? "default" : loan.status === "defaulted" ? "destructive" : "secondary"}>{loan.status}</Badge></TableCell>
                          <TableCell><Badge variant={loan.risk_rating === "low" ? "default" : loan.risk_rating === "high" ? "destructive" : "secondary"}>{loan.risk_rating}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guarantor Exposure */}
        <TabsContent value="guarantor" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="font-heading">Guarantor Exposure Report</CardTitle>
                <CardDescription>Guarantee concentration and risk by member</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => exportGuarantorExposure(guarantorExposure)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <>
                <div className="space-y-3 md:hidden">
                  {guarantorExposure.map((g, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{g.name}</p>
                        <Badge variant={Number(g.ratio) > 80 ? "destructive" : Number(g.ratio) > 50 ? "secondary" : "default"}>{g.ratio}%</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p>Total: KES {g.total.toLocaleString()}</p>
                        <p>Savings: KES {g.savings.toLocaleString()}</p>
                        <p>Max: KES {g.maxAllowed.toLocaleString()}</p>
                        <p>Guarantees: {g.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guarantor</TableHead><TableHead className="text-right">Total Guaranteed</TableHead>
                        <TableHead className="text-right">Savings</TableHead><TableHead className="text-right">Max Allowed</TableHead>
                        <TableHead className="text-right">Exposure %</TableHead><TableHead className="text-center">Guarantees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guarantorExposure.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell className="text-right font-mono">KES {g.total.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">KES {g.savings.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">KES {g.maxAllowed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={Number(g.ratio) > 80 ? "destructive" : Number(g.ratio) > 50 ? "secondary" : "default"}>{g.ratio}%</Badge>
                          </TableCell>
                          <TableCell className="text-center">{g.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Member Statements */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle className="font-heading">Member Statements</CardTitle>
                <CardDescription>Account summary for all members</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => exportMemberStatements(members as any)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <>
                <div className="space-y-3 md:hidden">
                  {members.map((m: any) => (
                    <div key={m.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{m.name}</p>
                        <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{m.member_id}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p>Savings: KES {Number(m.savings).toLocaleString()}</p>
                        <p>Shares: KES {Number(m.shares).toLocaleString()}</p>
                        <p className="col-span-2">Loan Balance: KES {Number(m.loan_balance).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member ID</TableHead><TableHead>Name</TableHead>
                        <TableHead className="text-right">Savings</TableHead><TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Loan Balance</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m: any) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono text-xs">{m.member_id}</TableCell>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-right font-mono">KES {Number(m.savings).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">KES {Number(m.shares).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">KES {Number(m.loan_balance).toLocaleString()}</TableCell>
                          <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
