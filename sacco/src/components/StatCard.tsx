import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  variant?: "default" | "accent" | "success" | "warning" | "destructive";
}

const variantStyles = {
  default: "border bg-card",
  accent: "border-amber-300 bg-amber-50/60",
  success: "border-emerald-200 bg-emerald-50/60",
  warning: "border-rose-200 bg-rose-50/60",
  destructive: "border-blue-200 bg-blue-50/60",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  accent: "bg-amber-100 text-amber-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-rose-100 text-rose-700",
  destructive: "bg-blue-100 text-blue-700",
};

const titleColorStyles = {
  default: "text-muted-foreground",
  accent: "text-amber-700",
  success: "text-emerald-700",
  warning: "text-rose-700",
  destructive: "text-blue-700",
};

const valueColorStyles = {
  default: "text-foreground",
  accent: "text-amber-800",
  success: "text-emerald-800",
  warning: "text-rose-800",
  destructive: "text-blue-800",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("stat-card animate-fade-in rounded-2xl shadow-sm transition-shadow", variantStyles[variant])}>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", titleColorStyles[variant])}>{title}</p>
          <p className={cn("mt-2 text-2xl font-bold", valueColorStyles[variant])}>{value}</p>
          {subtitle && <p className={cn("mt-1 text-xs", variant === "default" ? "text-muted-foreground" : titleColorStyles[variant])}>{subtitle}</p>}
          {trend && (
            <p className={cn("mt-2 text-xs font-medium", trend.positive ? "text-emerald-600" : "text-rose-600")}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn("flex-shrink-0 rounded-xl p-2.5", iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
