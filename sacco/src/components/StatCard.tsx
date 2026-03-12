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
  default: "border-border",
  accent: "border-accent/30 bg-accent/5",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  destructive: "border-destructive/30 bg-destructive/5",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  accent: "bg-accent/20 text-accent-foreground",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/20 text-destructive",
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <div className={cn("stat-card animate-fade-in", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-heading font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs font-medium mt-1", trend.positive ? "text-success" : "text-destructive")}>
              {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", iconStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
