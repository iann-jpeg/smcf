/**
 * Polling-based "realtime" subscription – replaces the Supabase postgres_changes hook.
 * Refetches the query every `intervalMs` ms while the browser tab is visible.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeSubscription(
  _tableName: string,       // kept for API compat (ignored)
  queryKey: string[],
  intervalMs = 30_000       // poll every 30 s by default
) {
  const queryClient = useQueryClient();
  const key = queryKey.join(",");

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) {
        queryClient.invalidateQueries({ queryKey });
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [queryClient, key, intervalMs]);
}
