/**
 * Polling-based "realtime" subscription – replaces the Supabase postgres_changes hook.
 * Refetches the query every `intervalMs` ms while the browser tab is visible.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type RealtimeSubscriptionEntry = {
  count: number;
  intervalMs: number;
  timerId: ReturnType<typeof setInterval> | null;
  queryKey: string[];
};

const realtimeSubscriptions = new Map<string, RealtimeSubscriptionEntry>();

function startRealtimeTimer(queryClient: ReturnType<typeof useQueryClient>, entry: RealtimeSubscriptionEntry) {
  if (entry.timerId) {
    clearInterval(entry.timerId);
  }

  entry.timerId = setInterval(() => {
    if (!document.hidden) {
      queryClient.invalidateQueries({ queryKey: entry.queryKey });
    }
  }, entry.intervalMs);
}

export function useRealtimeSubscription(
  _tableName: string,       // kept for API compat (ignored)
  queryKey: string[],
  intervalMs = 30_000       // poll every 30 s by default
) {
  const queryClient = useQueryClient();
  const key = queryKey.join(",");

  useEffect(() => {
    const existing = realtimeSubscriptions.get(key);

    if (existing) {
      existing.count += 1;
      if (intervalMs < existing.intervalMs) {
        existing.intervalMs = intervalMs;
        startRealtimeTimer(queryClient, existing);
      }
    } else {
      const entry: RealtimeSubscriptionEntry = {
        count: 1,
        intervalMs,
        timerId: null,
        queryKey: [...queryKey],
      };
      startRealtimeTimer(queryClient, entry);
      realtimeSubscriptions.set(key, entry);
    }

    return () => {
      const current = realtimeSubscriptions.get(key);
      if (!current) return;

      current.count -= 1;
      if (current.count <= 0) {
        if (current.timerId) {
          clearInterval(current.timerId);
        }
        realtimeSubscriptions.delete(key);
      }
    };
  }, [queryClient, key, intervalMs]);
}
