import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

function riskLevel(loanBalance: number, guaranteeAmount: number) {
  if (loanBalance <= 0) return { label: "No Risk", color: "text-emerald-600", variant: "default" as const };
  const exposure = guaranteeAmount / Math.max(loanBalance, 1);
  if (exposure > 0.5) return { label: "High", color: "text-red-500", variant: "destructive" as const };
  if (exposure > 0.25) return { label: "Medium", color: "text-amber-500", variant: "outline" as const };
  return { label: "Low", color: "text-green-500", variant: "default" as const };
}

function statusVariant(status: string) {
  switch (status) {
    case "active": case "disbursed": return "default" as const;
    case "pending": return "outline" as const;
    case "defaulted": return "destructive" as const;
    case "completed": case "paid": return "secondary" as const;
    default: return "secondary" as const;
  }
}

interface Props {
  guaranteedLoans: any[];
  isLoading?: boolean;
}

export function GuarantorVisibility({ guaranteedLoans, isLoading }: Props) {
  const stats = useMemo(() => {
    const totalExposure = guaranteedLoans.reduce((s, g) => s + Number(g.guarantee_amount), 0);
    const activeGuarantees = guaranteedLoans.filter(
      (g) => g.loans && ["active", "disbursed", "pending"].includes(g.loans.status)
    );
    const atRisk = activeGuarantees.filter(
      (g) => g.loans && g.loans.status !== "pending" && Number(g.loans.balance) > 0
    );
    return { totalExposure, activeCount: activeGuarantees.length, atRiskCount: atRisk.length };
  }, [guaranteedLoans]);

  if (guaranteedLoans.length === 0 && !isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Guarantor Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Active Guarantees</p>
            <p className="text-xl font-bold">{stats.activeCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Exposure</p>
            <p className="text-xl font-bold">KES {stats.totalExposure.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">At Risk</p>
            <p className={cn("text-xl font-bold", stats.atRiskCount > 0 ? "text-destructive" : "text-emerald-600")}>
              {stats.atRiskCount}
            </p>
          </div>
        </div>

        {/* Loans table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Loan #</TableHead>
              <TableHead className="text-right">Your Guarantee</TableHead>
              <TableHead className="text-right">Loan Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guaranteedLoans.map((g: any) => {
              const loan = g.loans;
              if (!loan) return null;
              const borrower = loan.members;
              const balance = Number(loan.balance);
              const risk = riskLevel(balance, Number(g.guarantee_amount));
              return (
                <TableRow key={g.id}>
                  <TableCell className="font-medium text-sm">
                    {borrower?.name ?? "—"}
                    <span className="block text-[10px] text-muted-foreground">{borrower?.member_id}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                  <TableCell className="text-right">KES {Number(g.guarantee_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">KES {balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(loan.status)}>{loan.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={risk.variant} className={cn("text-[10px]", risk.color)}>
                      {risk.label === "High" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {risk.label === "No Risk" && <ShieldCheck className="h-3 w-3 mr-1" />}
                      {risk.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
