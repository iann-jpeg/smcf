import { CalendarDays, CheckCircle2, CircleDollarSign } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FinancialCalendarEvent = {
  date: Date | string;
  label: string;
  amount?: number;
  tone?: "default" | "success" | "warning";
};

type FinancialCalendarProps = {
  events?: FinancialCalendarEvent[];
  title?: string;
  emptyLabel?: string;
};

const asDate = (value: Date | string) => value instanceof Date ? value : parseISO(value);

export function FinancialCalendar({ events = [], title = "Financial calendar", emptyLabel = "No upcoming financial dates." }: FinancialCalendarProps) {
  const upcoming = events
    .map((event) => ({ ...event, parsedDate: asDate(event.date) }))
    .filter((event) => !Number.isNaN(event.parsedDate.getTime()))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading"><CalendarDays className="h-4 w-4 text-primary" />{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{emptyLabel}</p> : (
          <div className="space-y-2">
            {upcoming.map((event, index) => {
              const today = isSameDay(event.parsedDate, new Date());
              const Icon = event.amount ? CircleDollarSign : CheckCircle2;
              return (
                <div key={`${event.label}-${event.parsedDate.toISOString()}-${index}`} className="flex items-center gap-3 rounded-lg border p-3">
                  <Icon className={cn("h-4 w-4 shrink-0", event.tone === "success" ? "text-emerald-600" : event.tone === "warning" ? "text-amber-600" : "text-primary")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.label}</p>
                    <p className={cn("text-xs", today ? "font-semibold text-primary" : "text-muted-foreground")}>{today ? "Today" : format(event.parsedDate, "dd MMM yyyy")}</p>
                  </div>
                  {event.amount !== undefined && <span className="text-sm font-semibold">KES {event.amount.toLocaleString()}</span>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
