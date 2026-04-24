import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  TrendingDown, TrendingUp, Users, Landmark,
  CheckCircle2, XCircle, AlertTriangle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoanSafetyResult } from "@/lib/loan-safety-engine";

interface Props {
  result: LoanSafetyResult;
  requestedLoan: number;
}

const decisionConfig = {
  APPROVE: { icon: ShieldCheck, label: "APPROVED", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30" },
  REDUCE:  { icon: ShieldAlert, label: "REDUCE AMOUNT", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30" },
  REJECT:  { icon: ShieldX, label: "REJECTED", color: "text-red-600", bg: "bg-red-500/10 border-red-500/30" },
};

const riskColors: Record<string, string> = {
  LOW: "text-emerald-600", MEDIUM: "text-amber-600", HIGH: "text-orange-600", VERY_HIGH: "text-red-600",
};

const capitalColors: Record<string, string> = {
  SAFE: "text-emerald-600", CAUTION: "text-amber-600", DANGER: "text-red-600",
};

export function LoanSafetyPanel({ result, requestedLoan }: Props) {
  const { decision, reasons, suggestedAmount, layer1, layer2, layer3, layer4 } = result;
  const cfg = decisionConfig[decision];
  const DecisionIcon = cfg.icon;

  return (
    <div className="space-y-4">
      {/* Master Decision Banner */}
      <div className={cn("rounded-lg border-2 p-4 text-center space-y-2", cfg.bg)}>
        <DecisionIcon className={cn("h-8 w-8 mx-auto", cfg.color)} />
        <p className={cn("text-lg font-bold font-heading", cfg.color)}>{cfg.label}</p>
        {suggestedAmount && (
          <p className="text-sm text-muted-foreground">
            Suggested: <span className="font-semibold">KES {suggestedAmount.toLocaleString()}</span>
          </p>
        )}
        <div className="text-xs text-muted-foreground space-y-1 text-left mt-2">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              {decision === "APPROVE" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> :
               decision === "REDUCE" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /> :
               <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Layer 1: Safe Loan Limit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Layer 1 — Safe Loan Limit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Savings Limit</p>
              <p className="font-semibold">KES {layer1.savingsLimit.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{layer1.trustScoreTier}</p>
            </div>
            <div className="rounded border p-2">
              <p className="text-muted-foreground">Capital Limit (5%)</p>
              <p className="font-semibold">KES {layer1.capitalLimit.toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded border bg-muted/50 p-2 text-center">
            <p className="text-muted-foreground">Safe Loan Limit</p>
            <p className={cn("text-lg font-bold", requestedLoan > layer1.safeLoanLimit ? "text-destructive" : "text-emerald-600")}>
              KES {layer1.safeLoanLimit.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Layer 2: Risk Level */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Layer 2 — Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="text-center">
            <span className={cn("text-2xl font-bold", riskColors[layer2.riskLevel])}>
              {layer2.riskScore}
            </span>
            <span className="text-muted-foreground">/100</span>
            <Badge variant="outline" className={cn("ml-2 text-[10px]", riskColors[layer2.riskLevel])}>
              {layer2.riskLevel.replace("_", " ")}
            </Badge>
          </div>
          <div className="space-y-2">
            {layer2.factors.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between mb-0.5">
                  <span>{f.label} ({(f.weight * 100).toFixed(0)}%)</span>
                  <span className="font-semibold">{f.score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full",
                      f.score >= 70 ? "bg-emerald-500" : f.score >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Layer 3: Guarantor Requirements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Layer 3 — Guarantor Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Guarantors needed</span>
            <span className={cn("font-semibold", layer3.guarantorCountMet ? "text-emerald-600" : "text-destructive")}>
              {layer3.providedCount} / {layer3.requiredCount}
              {layer3.guarantorCountMet ? " ✓" : " ✗"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Combined savings</span>
            <span className="font-semibold">KES {layer3.totalGuarantorSavings.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Required (120% coverage)</span>
            <span className={cn("font-semibold", layer3.guarantorStrengthMet ? "text-emerald-600" : "text-destructive")}>
              KES {layer3.requiredGuarantorSavings.toLocaleString()}
              {layer3.guarantorStrengthMet ? " ✓" : " ✗"}
            </span>
          </div>
          <Progress
            value={Math.min(100, layer3.requiredGuarantorSavings > 0
              ? (layer3.totalGuarantorSavings / layer3.requiredGuarantorSavings) * 100
              : 100)}
            className="h-2"
          />
        </CardContent>
      </Card>

      {/* Layer 4: Capital Safety */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Layer 4 — Capital Safety
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Current exposure</span>
            <span className="font-semibold">{(layer4.currentExposure * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>After this loan</span>
            <span className={cn("font-semibold", capitalColors[layer4.status])}>
              {(layer4.projectedExposure * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Safety threshold</span>
            <span className="font-semibold text-muted-foreground">≤ 40%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden relative">
            {/* Safe zone */}
            <div className="absolute inset-y-0 left-0 bg-emerald-500/30" style={{ width: "40%" }} />
            {/* Caution zone */}
            <div className="absolute inset-y-0 bg-amber-500/30" style={{ left: "40%", width: "20%" }} />
            {/* Danger zone */}
            <div className="absolute inset-y-0 bg-red-500/30" style={{ left: "60%", right: 0 }} />
            {/* Marker */}
            <div
              className={cn("absolute inset-y-0 w-1 rounded", capitalColors[layer4.status].replace("text-", "bg-"))}
              style={{ left: `${Math.min(100, layer4.projectedExposure * 100)}%` }}
            />
          </div>
          <Badge variant="outline" className={cn("text-[10px]", capitalColors[layer4.status])}>
            {layer4.status}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
