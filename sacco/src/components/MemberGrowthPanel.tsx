import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type GrowthOverview = {
  currentSavings: number;
  averageMonthlyContribution: number;
  contributionTrend: number | null;
  history: { month: string; amount: number; count: number }[];
  projection: { available: boolean; reason?: string; basis?: string; months?: { months: number; amount: number }[] };
  nextMilestone: { amount: number; remaining: number } | null;
  goals: {
    _id: string;
    title: string;
    description?: string | null;
    targetAmount: number;
    targetDate?: string | null;
    currentAmount: number;
    progress: number;
    remaining: number;
    progressBasis: string;
  }[];
};

export function MemberGrowthPanel({ onSave }: { onSave: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const { data } = useQuery({
    queryKey: ["member-growth-overview"],
    queryFn: () => api.get<GrowthOverview>("/member-growth/overview"),
    staleTime: 60_000,
  });
  const createGoal = useMutation({
    mutationFn: () => api.post("/member-growth/goals", {
      title,
      targetAmount: Number(targetAmount),
      targetDate: targetDate || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-growth-overview"] });
      setOpen(false);
      setTitle("");
      setTargetAmount("");
      setTargetDate("");
      toast.success("Savings goal created");
    },
    onError: (error: Error) => toast.error(error.message || "Unable to create savings goal"),
  });

  const overview = data as GrowthOverview | undefined;
  const goals = overview?.goals ?? [];
  const currentSavings = Number(overview?.currentSavings ?? 0);
  const average = Number(overview?.averageMonthlyContribution ?? 0);
  const trend = overview?.contributionTrend;
  const primaryGoal = goals[0];

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-heading text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              My financial journey
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Progress based on your verified SACCO savings activity.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" /> New goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a savings goal</DialogTitle>
                <DialogDescription>Choose what you are saving toward. Your progress uses your current SACCO savings balance.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createGoal.mutate(); }}>
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Goal name</Label>
                  <Input id="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Emergency fund" required maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-target">Target amount (KES)</Label>
                  <Input id="goal-target" type="number" min="1" step="1" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-date">Target date (optional)</Label>
                  <Input id="goal-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
                </div>
                <Button type="submit" disabled={createGoal.isPending}>{createGoal.isPending ? "Creating..." : "Create goal"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total saved</p>
            <p className="mt-1 text-lg font-semibold">KES {currentSavings.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Recent monthly average</p>
            <p className="mt-1 text-lg font-semibold">KES {Math.round(average).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Contribution months</p>
            <p className="mt-1 text-lg font-semibold">{overview?.history.length ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Next move</p>
            <Button variant="link" className="h-auto px-0 pt-1" onClick={onSave}>Save now <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-heading text-lg"><Target className="h-5 w-5 text-primary" /> My goals</CardTitle>
          {primaryGoal && <span className="text-xs text-muted-foreground">{goals.length} active</span>}
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-center">
              <p className="font-medium">Give your savings a purpose</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a goal to track what you are building toward.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <div key={goal._id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{goal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        KES {goal.currentAmount.toLocaleString()} of KES {goal.targetAmount.toLocaleString()}
                      </p>
                    </div>
                    <span className="font-semibold text-primary">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="mt-3 h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    KES {goal.remaining.toLocaleString()} remaining
                    {goal.targetDate ? ` · target ${new Date(goal.targetDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Your next milestone</CardTitle></CardHeader>
          <CardContent>
            {overview?.nextMilestone ? (
              <>
                <p className="text-2xl font-semibold">KES {overview.nextMilestone.amount.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">KES {overview.nextMilestone.remaining.toLocaleString()} remaining based on your verified savings balance.</p>
              </>
            ) : <p className="text-sm text-muted-foreground">You have reached the currently configured milestones.</p>}
            {trend !== null && trend !== undefined && (
              <p className="mt-3 text-sm text-muted-foreground">
                {trend >= 0 ? "Your recent contribution pace is ahead" : "Your recent contribution pace is below"} your earlier recorded pace by {Math.abs(trend)}%.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">If you keep going</CardTitle></CardHeader>
          <CardContent>
            {overview?.projection?.available ? (
              <>
                <p className="text-xs text-muted-foreground">Projection based on recent completed savings contributions. This is not a guarantee.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {overview.projection.months?.map((item) => (
                    <div key={item.months} className="rounded-lg border p-2 text-center">
                      <p className="text-xs text-muted-foreground">{item.months} months</p>
                      <p className="mt-1 text-sm font-semibold">KES {item.amount.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">{overview?.projection?.reason ?? "Keep saving to build enough history for a meaningful projection."}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
