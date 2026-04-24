import { useState, useEffect, useMemo } from "react";
import { generateGrowthTips, type GrowthTip } from "@/lib/growth-intelligence";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Landmark, Flame, ShieldCheck, Lightbulb, ChevronLeft, ChevronRight, X, Sparkles, PiggyBank, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<GrowthTip["icon"], React.ComponentType<{ className?: string }>> = {
  savings: Wallet,
  loan: TrendingUp,
  shares: Landmark,
  streak: Flame,
  risk: ShieldCheck,
  dividend: PiggyBank,
  guarantor: Users,
  milestone: Trophy,
};

const impactColor: Record<GrowthTip["impact"], string> = {
  high: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  medium: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  low: "bg-chart-3/15 text-chart-3 border-chart-3/30",
};

const impactLabel: Record<GrowthTip["impact"], string> = {
  high: "High Impact",
  medium: "Medium Impact",
  low: "Low Impact",
};

interface GrowthInsightsPopupProps {
  member: { savings: number; shares: number; loan_balance: number; risk_score: number | null; status: string };
  loans: any[];
  savingsHistory: any[];
}

export function GrowthInsightsPopup({ member, loans, savingsHistory }: GrowthInsightsPopupProps) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const tips = useMemo(
    () => generateGrowthTips(member, loans, savingsHistory),
    [member, loans, savingsHistory]
  );

  // Show popup after a short delay when tips are available
  useEffect(() => {
    if (tips.length === 0) return;
    const dismissed = sessionStorage.getItem("growth-tips-dismissed");
    if (dismissed) return;
    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [tips.length]);

  if (tips.length === 0) return null;

  const tip = tips[currentIndex];
  const Icon = iconMap[tip.icon];

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem("growth-tips-dismissed", "true");
  };

  const next = () => setCurrentIndex((i) => (i + 1) % tips.length);
  const prev = () => setCurrentIndex((i) => (i - 1 + tips.length) % tips.length);

  return (
    <>
      {/* Floating button to reopen */}
      {!open && (
        <Button
          size="sm"
          variant="outline"
          className="fixed bottom-6 right-6 z-50 gap-2 shadow-lg border-primary/30 bg-background hover:bg-primary/5"
          onClick={() => { setOpen(true); setCurrentIndex(0); }}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Growth Tips
          <Badge variant="secondary" className="text-[10px] ml-1">{tips.length}</Badge>
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Lightbulb className="h-5 w-5 text-primary" />
              Financial Growth Insight
            </DialogTitle>
            <DialogDescription className="text-xs">
              Personalized tip {currentIndex + 1} of {tips.length} based on your account activity
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tip card */}
            <div className="rounded-lg border bg-muted/30 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{tip.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] border", impactColor[tip.impact])}>
                      {impactLabel[tip.impact]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {tip.message}
                  </p>
                  {tip.badge && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <Trophy className="h-3.5 w-3.5" />
                      {tip.badge}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            {tips.length > 1 && (
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <div className="flex gap-1">
                  {tips.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        i === currentIndex ? "bg-primary w-4" : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={next} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
