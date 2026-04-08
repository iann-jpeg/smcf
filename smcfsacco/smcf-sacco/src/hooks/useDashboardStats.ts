import { useQuery } from "@tanstack/react-query";
import { api, normalizeTransaction } from "@/lib/api";
import { useRealtimeSubscription } from "./useRealtimeQuery";

// Exported so App.tsx can prefetch this query as soon as auth is confirmed.
export async function fetchDashboardStats() {
  const raw = await api.get("/dashboard/stats");
  const s = (raw as any);

  // Normalise the recent transactions that come back embedded
  const recentTransactions = (s.recentTransactions ?? []).map(normalizeTransaction);

  const totalMembers     = s.totalMembers     ?? 0;
  const totalSavings     = s.totalSavings     ?? 0;
  const totalShares      = s.totalShares      ?? 0;
  const totalLoans       = s.totalLoanBalance ?? 0;
  const pendingApprovals = s.pendingLoans     ?? 0;
  const activeLoans      = s.activeLoans      ?? 0;

  const availableLiquidity = totalSavings + totalShares - totalLoans;
  const liquidityRatio = (totalSavings + totalShares) > 0
    ? (availableLiquidity / (totalSavings + totalShares)) * 100 : 0;
  const capitalAdequacy = totalShares > 0
    ? Math.round((totalShares / (totalLoans || 1)) * 100 * 10) / 10 : 0;

  return {
    totalMembers,
    totalSavings,
    totalShares,
    totalLoans,
    activeLoans,
    availableLiquidity,
    liquidityRatio: Math.round(liquidityRatio * 10) / 10,
    pendingApprovals,
    defaultRate: s.defaultRate ?? 0,
    par30: s.par30 ?? 0,
    capitalAdequacy,
    interestIncome: s.interestIncome ?? 0,
    activeGuarantees: s.activeGuarantees ?? 0,
    recentTransactions,
  };
}

export const DASHBOARD_STATS_KEY = ["dashboard-stats"] as const;

export function useDashboardStats() {
  // One subscription is enough — all three tables feed the same endpoint/key.
  useRealtimeSubscription("transactions", DASHBOARD_STATS_KEY as unknown as string[]);

  return useQuery({
    queryKey: DASHBOARD_STATS_KEY,
    queryFn: fetchDashboardStats,
  });
}
