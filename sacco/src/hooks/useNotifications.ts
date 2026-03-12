import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, normalizeNotification } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";
import { useAuth } from "./useAuth";

export function useNotifications() {
  const { user } = useAuth();
  const queryKey = ["notifications"];
  useRealtimeSubscription("notifications", queryKey);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get("/notifications");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeNotification);
    },
    enabled: !!user,
  });

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
