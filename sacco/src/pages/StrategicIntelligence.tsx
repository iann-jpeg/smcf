import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Minus, Target, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Metric = "membership" | "savings" | "loans" | "revenue" | "expenses";
type CardData = { metric: Metric; actual: number | null; target: number | null; variance: number | null; forecast: number | null; forecastAssumption: string; progress: number | null; status: string; trend: string; explanation: string };
type Overview = { cards: CardData[]; goals: Array<{ _id: string; title: string; status: string; dueDate: string; milestones: Array<{ title: string; completed: boolean }> }>; warnings: Array<{ metric: string; severity: string; message: string }>; recommendations: string[]; assumptions: string[]; scorecard: { score: number | null }; calendarEvents: Array<{ title: string; startsAt: string; type: string }> };

const labels: Record<Metric, string> = { membership: "Membership", savings: "Savings", loans: "Loan portfolio", revenue: "Revenue", expenses: "Expenses" };
const formatValue = (metric: Metric, value: number | null) => value === null ? "Unavailable" : metric === "membership" ? Math.round(value).toLocaleString() : `KES ${Math.round(value).toLocaleString()}`;
const statusLabel: Record<string, string> = { on_track: "On track", at_risk: "At risk", behind: "Behind", not_configured: "Target not set" };

export default function StrategicIntelligence() {
  const { isStaff } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [scenario, setScenario] = useState<Record<string, number>>({ membership: 0.03, savings: 0.02, loans: 0.02, revenue: 0.02, expenses: 0.01 });
  const [simulation, setSimulation] = useState<unknown>(null);
  useEffect(() => { if (!isStaff) return; void api.get<Overview>("/strategic-intelligence/overview").then(setOverview).catch((e: Error) => setError(e.message)); }, [isStaff]);
  const runScenario = async () => {
    const base = Object.fromEntries((overview?.cards || []).map((item) => [item.metric, item.actual]));
    setSimulation(await api.post("/strategic-intelligence/scenarios", { base, monthlyGrowth: scenario, months: 12 }));
  };
  if (!isStaff) return <Card><CardContent className="p-6"><h1 className="text-lg font-semibold">Staff access required</h1><p className="text-sm text-muted-foreground">Strategic intelligence is restricted to SACCO staff.</p></CardContent></Card>;
  if (error) return <Card><CardContent className="p-6 text-destructive">{error}</CardContent></Card>;
  if (!overview) return <div className="space-y-4" aria-label="Loading strategic intelligence"><div className="h-9 w-72 animate-pulse rounded bg-muted" /><div className="grid gap-4 md:grid-cols-3"><div className="h-36 animate-pulse rounded bg-muted" /><div className="h-36 animate-pulse rounded bg-muted" /><div className="h-36 animate-pulse rounded bg-muted" /></div></div>;
  return (
    <div className="space-y-6">
      <div><p className="text-sm text-muted-foreground">Management planning workspace</p><h1 className="text-2xl font-bold tracking-tight">Strategic intelligence</h1><p className="text-sm text-muted-foreground">Verified SACCO aggregates, transparent targets and explicitly labelled planning assumptions.</p></div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Strategic KPI cards">
        {overview.cards.map((item) => {
          const Trend = item.trend === "up" ? ArrowUp : item.trend === "down" ? ArrowDown : Minus;
          return <Card key={item.metric}><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{labels[item.metric]}</CardTitle><Target className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{formatValue(item.metric, item.actual)}</div><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Badge variant={item.status === "on_track" ? "default" : item.status === "not_configured" ? "outline" : "secondary"}>{statusLabel[item.status] || item.status}</Badge><span className="flex items-center"><Trend className="mr-1 h-3 w-3" />{item.trend === "insufficient_history" ? "Insufficient history" : "Trend"}</span></div><dl className="mt-3 space-y-1 text-xs text-muted-foreground"><div className="flex justify-between"><dt>Target</dt><dd>{formatValue(item.metric, item.target)}</dd></div><div className="flex justify-between"><dt>Variance</dt><dd>{formatValue(item.metric, item.variance)}</dd></div><div className="flex justify-between"><dt>Forecast</dt><dd>{formatValue(item.metric, item.forecast)}</dd></div></dl><p className="mt-2 text-xs">{item.explanation}</p></CardContent></Card>;
        })}
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Early warnings and recommendations</CardTitle></CardHeader><CardContent className="space-y-3">{overview.warnings.length ? overview.warnings.map((warning) => <div key={warning.metric} className="rounded-md border p-3 text-sm"><Badge variant="destructive">{warning.severity}</Badge><p className="mt-1">{warning.message}</p></div>) : <p className="text-sm text-muted-foreground">No warnings from actual-vs-target trajectories.</p>}{overview.recommendations.map((recommendation) => <p key={recommendation} className="text-sm text-muted-foreground">• {recommendation}</p>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Scorecard</CardTitle></CardHeader><CardContent><div className="text-4xl font-bold">{overview.scorecard.score === null ? "—" : `${overview.scorecard.score}%`}</div><p className="mt-2 text-sm text-muted-foreground">Equal weights across configured metrics. Each metric is capped at 100% progress.</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />What-if simulator</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Enter monthly growth assumptions. Results are planning scenarios, not member-level forecasts.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{(Object.keys(labels) as Metric[]).map((metric) => <label key={metric} className="text-sm">{labels[metric]} growth<input aria-label={`${labels[metric]} monthly growth`} type="number" step="0.01" value={scenario[metric]} onChange={(e) => setScenario((old) => ({ ...old, [metric]: Number(e.target.value) }))} className="mt-1 h-9 w-full rounded-md border bg-background px-3" /></label>)}</div><Button className="mt-4" onClick={() => void runScenario()}>Calculate scenarios</Button>{simulation ? <pre className="mt-4 max-h-56 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(simulation, null, 2)}</pre> : null}</CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Goals and milestones</CardTitle></CardHeader><CardContent>{overview.goals.length ? overview.goals.map((goal) => <div key={goal._id} className="border-b py-3 last:border-0"><div className="flex justify-between gap-3 text-sm font-medium"><span>{goal.title}</span><Badge variant="outline">{goal.status}</Badge></div><p className="text-xs text-muted-foreground">Due {new Date(goal.dueDate).toLocaleDateString()} · {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length} milestones complete</p></div>) : <p className="text-sm text-muted-foreground">No strategic goals have been defined.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Planning calendar</CardTitle></CardHeader><CardContent>{overview.calendarEvents.length ? overview.calendarEvents.slice(0, 8).map((event) => <div key={`${event.title}-${event.startsAt}`} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{event.title}</span><span className="text-xs text-muted-foreground">{new Date(event.startsAt).toLocaleDateString()}</span></div>) : <p className="text-sm text-muted-foreground">No upcoming calendar events.</p>}</CardContent></Card></div>
      <p className="text-xs text-muted-foreground">Assumptions: {overview.assumptions.join(" ")}</p>
    </div>
  );
}
