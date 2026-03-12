import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCircle2, XCircle, Info, Check, CalendarIcon, Filter, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function typeIcon(type: string) {
  if (type === "approval") return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
  if (type === "rejection") return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  return <Info className="h-5 w-5 text-primary shrink-0" />;
}

function typeLabel(type: string) {
  if (type === "approval") return "Approval";
  if (type === "rejection") return "Rejection";
  return "Info";
}

export default function Notifications() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading, unreadCount } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filtered = useMemo(() => {
    return notifications.filter((n: any) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (readFilter === "unread" && n.read) return false;
      if (readFilter === "read" && !n.read) return false;
      if (dateFrom && isBefore(new Date(n.created_at), startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(new Date(n.created_at), endOfDay(dateTo))) return false;
      return true;
    });
  }, [notifications, typeFilter, readFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setTypeFilter("all");
    setReadFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilters = typeFilter !== "all" || readFilter !== "all" || dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount} unread · {notifications.length} total
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllRead.mutate()}>
            <Check className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="rejection">Rejection</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={readFilter} onValueChange={setReadFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {hasFilters && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          Showing {filtered.length} of {notifications.length} notifications
        </p>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No notifications found</p>
              <p className="text-sm">{hasFilters ? "Try adjusting your filters." : "You're all caught up!"}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((n: any) => (
            <Card
              key={n.id}
              className={cn("cursor-pointer transition-colors hover:bg-accent/30", !n.read && "border-primary/20 bg-accent/10")}
              onClick={() => { markRead.mutate(n.id); if (n.link) navigate(n.link); }}
            >
              <CardContent className="py-4 flex items-start gap-4">
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabel(n.type)}</Badge>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
