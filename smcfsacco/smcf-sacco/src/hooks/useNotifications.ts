import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, normalizeNotification } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";
import { useAuth } from "./useAuth";
import { playAtmDepositSound, playNotificationSound } from "@/lib/sound";
import { showBrowserNotification } from "@/lib/browserNotifications";
import { toast } from "sonner";

const STAFF_ROLES = new Set(["admin", "credit_officer", "credit_committee", "treasurer", "auditor"]);
const NOTIFICATION_CACHE_KEY = "smcf_notifications_cache";
const globalSeenUnreadIds = new Set<string>();
let globalUnreadSeeded = false;

function readCachedNotifications(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedNotifications(notifications: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATION_CACHE_KEY, JSON.stringify(notifications));
  } catch {
    // Ignore storage quota/privacy mode failures.
  }
}

function isMoneyInNotification(notification: any): boolean {
  const text = `${notification?.title || ""} ${notification?.message || ""}`.toLowerCase();
  return text.includes("deposit") || text.includes("payment confirmed") || text.includes("money received") || text.includes("received") || text.includes("credited");
}

function getNotificationIntensity(notification: any): "low" | "medium" | "high" {
  const type = String(notification?.type || "").toLowerCase();
  const text = `${notification?.title || ""} ${notification?.message || ""}`.toLowerCase();

  if (type.includes("error") || type.includes("rejection") || text.includes("failed") || text.includes("overdue") || text.includes("late fee")) {
    return "high";
  }

  if (type.includes("warning") || type.includes("approval") || type.includes("withdraw") || isMoneyInNotification(notification)) {
    return "medium";
  }

  return "low";
}

function showIntensityToast(intensity: "low" | "medium" | "high", title: string, body: string) {
  if (intensity === "high") {
    toast.error(title, { description: body });
    return;
  }

  if (intensity === "medium") {
    toast.warning(title, { description: body });
    return;
  }

  toast.info(title, { description: body });
}

export function useNotifications() {
  const { user } = useAuth();
  const queryKey = ["notifications"];
  useRealtimeSubscription("notifications", queryKey);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const res = await api.get("/notifications");
        const arr = Array.isArray(res) ? res : (res as any).data ?? [];
        const normalized = arr.map(normalizeNotification);
        writeCachedNotifications(normalized);
        return normalized;
      } catch {
        return readCachedNotifications();
      }
    },
    initialData: () => readCachedNotifications(),
    enabled: !!user,
  });

  useEffect(() => {
    const list = (query.data ?? []) as any[];
    if (!user || list.length === 0) return;

    const unread = list.filter((n) => !n.read);

    if (!globalUnreadSeeded) {
      for (const n of unread) {
        if (n?.id) globalSeenUnreadIds.add(String(n.id));
      }
      globalUnreadSeeded = true;
      return;
    }

    const newcomers = unread.filter((n) => n?.id && !globalSeenUnreadIds.has(String(n.id)));
    if (newcomers.length === 0) return;

    for (const n of newcomers) {
      globalSeenUnreadIds.add(String(n.id));
    }

    const isStaff = (user.roles || []).some((r) => STAFF_ROLES.has(r));
    const hasIncomingMoney = newcomers.some(isMoneyInNotification);
    const top = newcomers[0];
    const title = top?.title || "SMCF Notification";
    const body = top?.message || "You have a new notification.";
    const intensity = getNotificationIntensity(top);

    if (isStaff && hasIncomingMoney) {
      playAtmDepositSound();
      showIntensityToast(intensity, title, body);
      void showBrowserNotification(title, body, "smcf-notification-money");
      return;
    }

    playNotificationSound();
    showIntensityToast(intensity, title, body);
    void showBrowserNotification(title, body, "smcf-notification-general");
  }, [query.data, user]);

  const unreadCount = query.data?.filter((n: any) => !n.read).length ?? 0;
  return { ...query, unreadCount };
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.put("/notifications/mark-all-read");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
