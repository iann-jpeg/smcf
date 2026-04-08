import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMarkAllRead, useNotifications } from "@/hooks/useNotifications";
import { getAdminMemberMessages, type MemberMessageItem } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type ActivityEntry = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: string;
};

type ActivityLevelFilter = "all" | "low" | "medium" | "high";
const SACCO_ACTIVITY_FILTER_KEY = "smcf-sacco-admin-activity-level-filter";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type?: string;
};

function getIntensity(notification: Pick<ActivityEntry, "type" | "title" | "message">): "low" | "medium" | "high" {
  const type = String(notification?.type || "").toLowerCase();
  const text = `${notification?.title || ""} ${notification?.message || ""}`.toLowerCase();

  if (type.includes("error") || type.includes("rejection") || text.includes("failed") || text.includes("overdue") || text.includes("late fee")) {
    return "high";
  }

  if (type.includes("warning") || type.includes("approval") || type.includes("withdraw") || text.includes("deposit") || text.includes("payment") || text.includes("received")) {
    return "medium";
  }

  return "low";
}

function intensityClass(level: "low" | "medium" | "high"): string {
  if (level === "high") return "bg-red-500";
  if (level === "medium") return "bg-amber-500";
  return "bg-emerald-500";
}

function levelFilterChipClasses(active: boolean): string {
  return active
    ? "bg-primary text-primary-foreground"
    : "bg-muted text-muted-foreground hover:bg-accent";
}

export function LiveActivityPanel() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const { data: notifications = [], unreadCount } = useNotifications() as { data: NotificationItem[]; unreadCount: number };
  const markAllRead = useMarkAllRead();
  const { data: memberMessages = [] } = useQuery({
    queryKey: ["header-live-member-messages"],
    queryFn: getAdminMemberMessages,
    enabled: isAdmin,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const notificationEntries: ActivityEntry[] = notifications.map((n) => ({
    id: `notif-${n.id}`,
    title: n.title,
    message: n.message,
    read: !!n.read,
    createdAt: n.created_at,
    type: n.type,
  }));

  const memberEntries: ActivityEntry[] = isAdmin
    ? memberMessages.map((m: MemberMessageItem) => ({
        id: `member-msg-${m._id}`,
        title: `Member message: ${m.subject}`,
        message: `${m.senderName}: ${m.message}`,
        read: m.status !== "new",
        createdAt: m.createdAt,
        type: "member-message",
      }))
    : [];

  const recent = [...notificationEntries, ...memberEntries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const unreadMemberMessages = memberEntries.filter((item) => !item.read).length;
  const combinedUnreadCount = unreadCount + unreadMemberMessages;
  const [levelFilter, setLevelFilter] = useState<ActivityLevelFilter>(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(SACCO_ACTIVITY_FILTER_KEY);
    return stored === "low" || stored === "medium" || stored === "high" || stored === "all"
      ? stored
      : "all";
  });
  const filteredRecent = recent.filter((item) => {
    if (levelFilter === "all") return true;
    return getIntensity(item) === levelFilter;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SACCO_ACTIVITY_FILTER_KEY, levelFilter);
  }, [levelFilter]);

  return (
    <div className="hidden xl:block rounded-md border bg-background/60 px-2 py-1.5 min-w-[340px] max-w-[520px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Live Activity</span>
          <Badge variant={combinedUnreadCount > 0 ? "destructive" : "secondary"} className="h-5 text-[10px]">
            {combinedUnreadCount} unread
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => markAllRead.mutate()}
          disabled={unreadCount === 0 || markAllRead.isPending}
        >
          Mark notifications seen
        </Button>
      </div>

      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-5 px-1.5 text-[10px] ${levelFilterChipClasses(levelFilter === "all")}`}
          onClick={() => setLevelFilter("all")}
        >
          All
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-5 px-1.5 text-[10px] ${levelFilterChipClasses(levelFilter === "low")}`}
          onClick={() => setLevelFilter("low")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Low
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-5 px-1.5 text-[10px] ${levelFilterChipClasses(levelFilter === "medium")}`}
          onClick={() => setLevelFilter("medium")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Medium
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-5 px-1.5 text-[10px] ${levelFilterChipClasses(levelFilter === "high")}`}
          onClick={() => setLevelFilter("high")}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> High
        </Button>
      </div>

      {filteredRecent.length === 0 ? (
        <p className="text-[11px] text-muted-foreground mt-1">No recent activity.</p>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-1">
          {filteredRecent.map((item) => {
            const level = getIntensity(item);
            return (
              <div key={item.id} className="rounded border px-2 py-1 bg-card/70">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${intensityClass(level)}`} />
                  <span className="text-[11px] font-medium truncate">{item.title}</span>
                  {!item.read && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{item.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
