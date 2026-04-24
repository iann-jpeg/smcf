import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Bar, BarChart, Cell } from "recharts";
import { Trophy, Target, TrendingUp, Sparkles, Star, Award, Gem, Crown, Sprout, TreeDeciduous, PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";

interface GrowthDashboardTabProps {
  member: {
    savings: number;
    shares: number;
    loan_balance: number;
    risk_score: number | null;
  };
  savingsHistory: { amount: number; month: string }[];
}

const MILESTONES = [
  { threshold: 5000, label: "Seedling Saver", emoji: "🌱", icon: Sprout, color: "hsl(var(--chart-3))" },
  { threshold: 10000, label: "Growing Saver", emoji: "🌿", icon: TreeDeciduous, color: "hsl(var(--chart-2))" },
  { threshold: 25000, label: "Steady Saver", emoji: "🌳", icon: TreeDeciduous, color: "hsl(var(--chart-1))" },
  { threshold: 50000, label: "Star Saver", emoji: "⭐", icon: Star, color: "hsl(var(--chart-4))" },
  { threshold: 100000, label: "Diamond Saver", emoji: "💎", icon: Gem, color: "hsl(var(--chart-5))" },
  { threshold: 250000, label: "Elite Saver", emoji: "🏆", icon: Trophy, color: "hsl(var(--primary))" },
  { threshold: 500000, label: "SACCO Champion", emoji: "👑", icon: Crown, color: "hsl(var(--accent-foreground))" },
];

const DIVIDEND_RATE = 0.10;

export function GrowthDashboardTab({ member, savingsHistory }: GrowthDashboardTabProps) {
  const savings = Number(member.savings);
  const shares = Number(member.shares);
  const totalContribution = savings + shares;

  // Badges earned
  const earned = useMemo(() => MILESTONES.filter((m) => savings >= m.threshold), [savings]);
  const nextMilestone = useMemo(() => MILESTONES.find((m) => savings < m.threshold), [savings]);
  const progressToNext = nextMilestone
    ? Math.min(100, Math.round((savings / nextMilestone.threshold) * 100))
    : 100;

  // Celebration state — detect newly earned badge
  const [celebrating, setCelebrating] = useState(false);
  const [celebratedBadge, setCelebratedBadge] = useState<typeof MILESTONES[0] | null>(null);
  const prevEarnedCount = useRef<number | null>(null);

  const fireConfetti = useCallback(() => {
    const duration = 2500;
    const end = Date.now() + duration;
    const colors = ["#fbbf24", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Big burst in center
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.5 },
      colors,
    });
  }, []);

  useEffect(() => {
    if (prevEarnedCount.current === null) {
      // First render — store count, don't celebrate
      prevEarnedCount.current = earned.length;
      return;
    }
    if (earned.length > prevEarnedCount.current) {
      const newBadge = earned[earned.length - 1];
      setCelebratedBadge(newBadge);
      setCelebrating(true);
      fireConfetti();
      const timer = setTimeout(() => setCelebrating(false), 5000);
      prevEarnedCount.current = earned.length;
      return () => clearTimeout(timer);
    }
    prevEarnedCount.current = earned.length;
  }, [earned.length, fireConfetti]);

  // Projected milestones timeline
  const avgMonthlySaving = useMemo(() => {
    if (savingsHistory.length < 2) return 0;
    const sorted = [...savingsHistory].sort((a, b) => a.month.localeCompare(b.month));
    const recent = sorted.slice(-6);
    return recent.reduce((s, e) => s + Number(e.amount), 0) / recent.length;
  }, [savingsHistory]);

  const timeline = useMemo(() => {
    if (avgMonthlySaving <= 0) return [];
    return MILESTONES.filter((m) => savings < m.threshold).map((m) => {
      const remaining = m.threshold - savings;
      const months = Math.ceil(remaining / avgMonthlySaving);
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + months);
      return {
        ...m,
        months,
        targetDate: targetDate.toLocaleDateString("en-KE", { month: "short", year: "numeric" }),
        remaining,
      };
    });
  }, [savings, avgMonthlySaving]);

  // Dividend projection data — project 12 months
  const dividendProjection = useMemo(() => {
    const data = [];
    let cumSavings = savings;
    let cumShares = shares;
    const monthlyAdd = avgMonthlySaving > 0 ? avgMonthlySaving : 0;
    for (let i = 0; i <= 12; i++) {
      const total = cumSavings + cumShares;
      const annualDividend = Math.round(total * DIVIDEND_RATE);
      const month = new Date();
      month.setMonth(month.getMonth() + i);
      data.push({
        month: month.toLocaleDateString("en-KE", { month: "short", year: "2-digit" }),
        contribution: Math.round(total),
        dividend: annualDividend,
      });
      cumSavings += monthlyAdd;
    }
    return data;
  }, [savings, shares, avgMonthlySaving]);

  const currentDividend = Math.round(totalContribution * DIVIDEND_RATE);
  const projectedDividend = dividendProjection.length > 0
    ? dividendProjection[dividendProjection.length - 1].dividend
    : currentDividend;

  return (
    <div className="space-y-6">
      {/* Celebration Banner */}
      {celebrating && celebratedBadge && (
        <div className="animate-scale-in rounded-xl border-2 border-primary bg-primary/10 p-5 text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <PartyPopper className="h-6 w-6 text-primary animate-bounce" />
            <span className="text-4xl">{celebratedBadge.emoji}</span>
            <PartyPopper className="h-6 w-6 text-primary animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-primary">🎉 New Badge Unlocked!</h3>
          <p className="text-sm font-semibold">{celebratedBadge.label}</p>
          <p className="text-xs text-muted-foreground">
            You reached KES {celebratedBadge.threshold.toLocaleString()} in savings!
          </p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Badges Earned
          </CardTitle>
        </CardHeader>
        <CardContent>
          {earned.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <Target className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Save KES {((nextMilestone?.threshold ?? 5000) - savings).toLocaleString()} more to earn your first badge!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {earned.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.threshold}
                    className="flex flex-col items-center gap-2 rounded-lg border bg-primary/5 p-4 text-center"
                  >
                    <span className="text-3xl">{m.emoji}</span>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      KES {m.threshold.toLocaleString()}
                    </p>
                  </div>
                );
              })}
              {/* Locked badges */}
              {MILESTONES.filter((m) => savings < m.threshold)
                .slice(0, 2)
                .map((m) => (
                  <div
                    key={m.threshold}
                    className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center opacity-40"
                  >
                    <span className="text-3xl grayscale">{m.emoji}</span>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      KES {m.threshold.toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          )}

          {/* Progress to next */}
          {nextMilestone && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Next: {nextMilestone.emoji} {nextMilestone.label}
                </span>
                <span className="font-semibold">{progressToNext}%</span>
              </div>
              <Progress value={progressToNext} className="h-2" />
              <p className="text-xs text-muted-foreground">
                KES {(nextMilestone.threshold - savings).toLocaleString()} remaining
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestones Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Projected Milestones
              <Badge variant="outline" className="text-[10px]">
                Based on avg KES {Math.round(avgMonthlySaving).toLocaleString()}/mo
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-6">
                {timeline.slice(0, 5).map((item, idx) => (
                  <div key={item.threshold} className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-2 top-1 h-5 w-5 rounded-full border-2 border-primary bg-background flex items-center justify-center text-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {item.emoji} {item.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          ~{item.months} month{item.months > 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Target: KES {item.threshold.toLocaleString()} · Est. {item.targetDate}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dividend Projection */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Live Dividend Projection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-primary/5 p-4 text-center">
              <p className="text-xs text-muted-foreground">Current Contributions</p>
              <p className="text-lg font-bold">KES {totalContribution.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-chart-2/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">Est. Annual Dividend Now</p>
              <p className="text-lg font-bold text-primary">KES {currentDividend.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-chart-4/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">Projected in 12 Months</p>
              <p className="text-lg font-bold text-primary">KES {projectedDividend.toLocaleString()}</p>
              {projectedDividend > currentDividend && (
                <div className="flex items-center justify-center gap-1 text-xs text-primary mt-1">
                  <TrendingUp className="h-3 w-3" />
                  +KES {(projectedDividend - currentDividend).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <ChartContainer
            config={{
              dividend: { label: "Est. Dividend (KES)", color: "hsl(var(--chart-2))" },
              contribution: { label: "Total Contributions (KES)", color: "hsl(var(--primary))" },
            }}
            className="h-[280px] w-full"
          >
            <AreaChart data={dividendProjection}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="contribution"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.1)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="dividend"
                stroke="hsl(var(--chart-2))"
                fill="hsl(var(--chart-2) / 0.15)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          <p className="text-xs text-muted-foreground text-center">
            * Projections based on 10% annual dividend rate and your current saving pace of KES {Math.round(avgMonthlySaving).toLocaleString()}/month.
            Actual dividends depend on SACCO performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
