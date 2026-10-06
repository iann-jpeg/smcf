import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CycleProgressVisualProps = { cycleNumber?: string | number; paid: number; total: number; collected?: number; target?: number; };

export function CycleProgressVisual({ cycleNumber, paid, total, collected = 0, target = 0 }: CycleProgressVisualProps) {
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base font-heading"><CalendarCheck className="h-4 w-4 text-primary" />Cycle {cycleNumber || "progress"}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="font-medium">{paid} of {total} members paid</span><span className="font-semibold text-primary">{Math.round(progress)}%</span></div><Progress value={progress} /><div className="flex justify-between text-xs text-muted-foreground"><span>Collected: KES {Number(collected).toLocaleString()}</span>{target > 0 && <span>Target: KES {Number(target).toLocaleString()}</span>}</div></CardContent></Card>;
}
