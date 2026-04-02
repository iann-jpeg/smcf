import { useMembers } from "@/hooks/useMembers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX, Wallet, TrendingUp, ArrowDownUp } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";

function riskBadge(score: number) {
  if (score >= 75) return <Badge variant="default">Low Risk</Badge>;
  if (score >= 50) return <Badge variant="secondary">Medium Risk</Badge>;
  return <Badge variant="destructive">High Risk</Badge>;
}

function scoreColor(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

export default function RiskScoring() {
  const navigate = useNavigate();
  const { data: members = [], isLoading } = useMembers();

  const scored = useMemo(() => {
    return members
      .map((m: any) => ({
        ...m,
        riskScore: m.risk_score ?? 50,
        riskLevel: (m.risk_score ?? 50) >= 75 ? "low" : (m.risk_score ?? 50) >= 50 ? "medium" : "high",
      }))
      .sort((a: any, b: any) => a.riskScore - b.riskScore);
  }, [members]);

  const lowCount = scored.filter((s: any) => s.riskLevel === "low").length;
  const medCount = scored.filter((s: any) => s.riskLevel === "medium").length;
  const highCount = scored.filter((s: any) => s.riskLevel === "high").length;
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((a: number, b: any) => a + b.riskScore, 0) / scored.length) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Risk Scoring Engine</h1>
        <p className="text-muted-foreground text-sm">Member risk assessment based on financial data</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Average Risk Score" value={`${avgScore}/100`} icon={ShieldCheck} />
        <StatCard title="Low Risk Members" value={lowCount.toString()} icon={ShieldCheck} variant="success" />
        <StatCard title="Medium Risk Members" value={medCount.toString()} icon={ShieldAlert} variant="warning" />
        <StatCard title="High Risk Members" value={highCount.toString()} icon={ShieldX} variant="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Member Risk Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {scored.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No members to score yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead className="text-right">Loan Balance</TableHead>
                  <TableHead className="text-center">Risk Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scored.map((m: any) => (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/members/${m.id}`)}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{Number(m.shares).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.savings).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(m.loan_balance).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-lg font-bold", scoreColor(m.riskScore))}>{m.riskScore}</span>
                    </TableCell>
                    <TableCell>{riskBadge(m.riskScore)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Scoring Methodology</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" /> Savings Consistency (30%)</div>
              <p className="text-muted-foreground">Measures deposit regularity. Consistent monthly deposits score higher.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Repayment History (40%)</div>
              <p className="text-muted-foreground">Evaluates loan repayment track record. Highest weighted factor.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold"><ArrowDownUp className="h-4 w-4 text-primary" /> Loan-to-Savings Ratio (30%)</div>
              <p className="text-muted-foreground">Assesses financial leverage. Lower ratios indicate conservative borrowing.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
