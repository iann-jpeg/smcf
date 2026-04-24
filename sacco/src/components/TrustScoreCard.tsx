import { useMemo } from "react";
import { calculateTrustScore, type TrustScoreBreakdown } from "@/lib/trust-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, TrendingUp, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const factorIcons = [Wallet, TrendingUp, Activity];

const statusColor: Record<string, string> = {
  excellent: "text-emerald-600",
  good: "text-green-500",
  average: "text-amber-500",
  poor: "text-red-500",
};

const statusBg: Record<string, string> = {
  excellent: "bg-emerald-500",
  good: "bg-green-500",
  average: "bg-amber-500",
  poor: "bg-red-500",
};

interface Props {
  member: any;
  repayments: any[];
  savingsHistory: any[];
  transactions: any[];
}

export function TrustScoreCard({ member, repayments, savingsHistory, transactions }: Props) {
  const score: TrustScoreBreakdown = useMemo(
    () => calculateTrustScore(member, repayments, savingsHistory, transactions),
    [member, repayments, savingsHistory, transactions]
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          SMCF Trust Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score display */}
        <div className="flex items-center gap-5">
          <div className="relative flex items-center justify-center">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(score.overall / 100) * 264} 264`}
                className="stroke-primary transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold", score.color)}>{score.overall}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-lg font-bold", score.color)}>{score.grade}</span>
              <Badge variant="outline" className="text-xs">{score.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your behavioral trust score reflects your financial discipline, savings consistency, and SACCO engagement.
            </p>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="space-y-3">
          {score.insights.map((insight, i) => {
            const Icon = factorIcons[i];
            return (
              <div key={insight.factor} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{insight.factor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold", statusColor[insight.status])}>
                      {insight.score}/100
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] capitalize", statusColor[insight.status])}
                    >
                      {insight.status}
                    </Badge>
                  </div>
                </div>
                <Progress value={insight.score} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.detail}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
