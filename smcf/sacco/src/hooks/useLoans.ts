import { useQuery } from "@tanstack/react-query";
import { api, normalizeLoan } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";

export function useLoans() {
  const queryKey = ["loans"];
  useRealtimeSubscription("loans", queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get("/loans");
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeLoan);
    },
  });
}

export function useLoansByMember(memberId: string) {
  return useQuery({
    queryKey: ["loans", "member", memberId],
    queryFn: async () => {
      const res = await api.get(`/loans?memberId=${memberId}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeLoan);
    },
    enabled: !!memberId,
  });
}
