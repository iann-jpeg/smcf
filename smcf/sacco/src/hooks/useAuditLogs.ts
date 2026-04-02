import { useQuery } from "@tanstack/react-query";
import { api, normalizeAuditLog } from "@/lib/api";

export function useAuditLogs(limit = 50) {
  return useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const res = await api.get(`/audit-logs?limit=${limit}`);
      const arr = Array.isArray(res) ? res : (res as any).data ?? [];
      return arr.map(normalizeAuditLog);
    },
  });
}
