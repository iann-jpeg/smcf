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
  default: "border-slate-200 bg-white hover:shadow-md",
  accent: "border-t-4 border-t-amber-500 bg-gradient-to-br from-amber-50 to-white hover:shadow-lg",
  success: "border-t-4 border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-white hover:shadow-lg",
  warning: "border-t-4 border-t-rose-500 bg-gradient-to-br from-rose-50 to-white hover:shadow-lg",
  destructive: "border-t-4 border-t-blue-500 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg",
};

const iconStyles = {
  default: "bg-slate-100 text-slate-600",
  accent: "bg-amber-100 text-amber-600",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-rose-100 text-rose-600",
  destructive: "bg-blue-100 text-blue-600",
};

const titleColorStyles = {
  default: "text-slate-600",
  accent: "text-amber-800",
  success: "text-emerald-800",
  warning: "text-rose-800",
  destructive: "text-blue-800",
};

const valueColorStyles = {
  default: "text-slate-900",
  accent: "text-amber-700",
  success: "text-emerald-700",
  warning: "text-rose-700",
  destructive: "text-blue-700",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("stat-card animate-fade-in rounded-lg border shadow-sm transition-all", variantStyles[variant])}>
      <div className="flex items-start justify-between p-5">
        <div className="flex-1">
          <p className={cn("text-sm font-medium", titleColorStyles[variant])}>{title}</p>
          <p className={cn("text-3xl font-bold mt-2", valueColorStyles[variant])}>{value}</p>
          {subtitle && <p className={cn("text-xs mt-2", variant === "default" ? "text-muted-foreground" : titleColorStyles[variant])}>{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs font-medium mt-2", trend.positive ? "text-emerald-600" : "text-rose-600")}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg flex-shrink-0", iconStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
