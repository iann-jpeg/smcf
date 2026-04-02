import { useQuery } from "@tanstack/react-query";
import { api, normalizeLoan } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";

export function useGuarantors() {
  const queryKey = ["guarantors-raw"];
  useRealtimeSubscription("loan_guarantors", queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Pull all loans; guarantor data is embedded in each loan
      const res = await api.get("/loans");
      const loans = (Array.isArray(res) ? res : (res as any).data ?? []).map(normalizeLoan);
      // Flatten guarantors from all loans
      const guarantors: any[] = [];
      for (const loan of loans) {
        for (const g of loan.loan_guarantors ?? []) {
          guarantors.push({
            ...g,
            loans: { loan_number: loan.loan_number, status: loan.status },
          });
        }
      }
      return guarantors;
    },
  });
}

export function useGuarantorExposure() {
  const queryKey = ["guarantor-exposure"];
  useRealtimeSubscription("loan_guarantors", queryKey);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await api.get("/loans");
      const loans = (Array.isArray(res) ? res : (res as any).data ?? []).map(normalizeLoan);

      const map = new Map<string, { name: string; savings: number; totalGuaranteed: number; activeGuarantees: number }>();

      for (const loan of loans) {
        for (const g of loan.loan_guarantors ?? []) {
          const memberId = g.member_id;
          const memberName = g.members?.name ?? "Unknown";
          const memberSavings = Number(g.members?.savings ?? 0);

          if (!map.has(memberId)) {
            map.set(memberId, { name: memberName, savings: memberSavings, totalGuaranteed: 0, activeGuarantees: 0 });
          }
          const entry = map.get(memberId)!;
          if (["repaying", "disbursed", "approved", "active"].includes(loan.status)) {
            entry.totalGuaranteed += Number(g.guarantee_amount ?? 0);
            entry.activeGuarantees += 1;
          }
        }
      }

      return Array.from(map.entries()).map(([id, g]) => ({
        id,
        name: g.name,
        totalGuaranteed: g.totalGuaranteed,
        savings: g.savings,
        maxAllowed: g.savings * 3,
        activeGuarantees: g.activeGuarantees,
        exposureRatio: g.savings > 0 ? (g.totalGuaranteed / (g.savings * 3)) * 100 : 0,
      }));
    },
  });
}
