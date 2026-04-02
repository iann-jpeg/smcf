import { useQuery } from "@tanstack/react-query";
import { api, normalizeTransaction } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";

export function useTransactions(limit = 50) {
  const queryKey = ["transactions"];
  useRealtimeSubscription("transactions", queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get(`/transactions?limit=${limit}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeTransaction);
    },
  });
}

export function useTransactionsByMember(memberId: string) {
  return useQuery({
    queryKey: ["transactions", "member", memberId],
    queryFn: async () => {
      const res = await api.get(`/transactions?memberId=${memberId}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeTransaction);
    },
    enabled: !!memberId,
  });
}
