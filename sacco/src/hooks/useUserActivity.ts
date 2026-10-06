import { useQuery } from "@tanstack/react-query";
import { api, normalizeUserActivity } from "@/lib/api";

export function useUserActivity(limit = 100) {
  return useQuery({
    queryKey: ["user-activity", limit],
    queryFn: async () => {
      const res = await api.get(`/user-activity?limit=${limit}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeUserActivity);
    },
    staleTime: 30_000,
  });
}
