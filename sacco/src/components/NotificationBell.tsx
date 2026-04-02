import { useNavigate } from "react-router-dom";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, CheckCircle2, XCircle, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function typeIcon(type: string) {
  if (type === "approval") return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  if (type === "rejection") return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <Info className="h-4 w-4 text-primary shrink-0" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [], unreadCount } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="font-heading font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => markAllRead.mutate()}>
              <Check className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-[340px]">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((n: any) => (
              <button
                key={n.id}
                className={cn(
                  "w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors border-b border-border/50",
                  !n.read && "bg-accent/20"
                )}
                onClick={() => { markRead.mutate(n.id); if (n.link) navigate(n.link); }}
              >
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </button>
            ))
          )}
        </ScrollArea>
        <Separator />
        <div className="px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => navigate("/notifications")}>
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
