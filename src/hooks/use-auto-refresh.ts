import { useEffect, useCallback, useRef } from 'react';

interface UseAutoRefreshOptions {
  /** Function to call when refresh is needed */
  onRefresh: () => void | Promise<void>;
  /** Refresh when tab becomes visible (default: true) */
  refreshOnVisible?: boolean;
  /** Refresh when window gains focus (default: true) */
  refreshOnFocus?: boolean;
  /** Refresh when coming back online (default: true) */
  refreshOnOnline?: boolean;
  /** Minimum time between refreshes in ms (default: 5000ms = 5 seconds) */
  debounceMs?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Hook to auto-refresh data when:
 * 1. User switches back to the tab (visibility change)
 * 2. User focuses the window
 * 3. Device comes back online
 * 4. App is opened/resumed
 * 
 * This ensures members always see the latest data when they open the app.
 */
export function useAutoRefresh({
  onRefresh,
  refreshOnVisible = true,
  refreshOnFocus = true,
  refreshOnOnline = true,
  debounceMs = 5000,
  debug = false,
}: UseAutoRefreshOptions) {
  const lastRefreshTime = useRef<number>(0);
  const isRefreshing = useRef<boolean>(false);

  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('🔄 [AutoRefresh]', ...args);
    }
  }, [debug]);

  // Debounced refresh function to prevent multiple rapid refreshes
  const triggerRefresh = useCallback(async (reason: string) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;

    // Skip if we refreshed recently
    if (timeSinceLastRefresh < debounceMs) {
      log(`Skipped refresh (${reason}) - too soon (${timeSinceLastRefresh}ms since last)`);
      return;
    }

    // Skip if already refreshing
    if (isRefreshing.current) {
      log(`Skipped refresh (${reason}) - already in progress`);
      return;
    }

    log(`Triggering refresh: ${reason}`);
    isRefreshing.current = true;
    lastRefreshTime.current = now;

    try {
      await onRefresh();
      log('Refresh completed successfully');
    } catch (error) {
      console.error('Auto-refresh error:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [onRefresh, debounceMs, log]);

  useEffect(() => {
    // Handle visibility change (user switches back to tab)
    const handleVisibilityChange = () => {
      if (refreshOnVisible && document.visibilityState === 'visible') {
        triggerRefresh('tab became visible');
      }
    };

    // Handle window focus
    const handleFocus = () => {
      if (refreshOnFocus) {
        triggerRefresh('window focused');
      }
    };

    // Handle coming back online
    const handleOnline = () => {
      if (refreshOnOnline) {
        triggerRefresh('device came online');
      }
    };

    // Handle page show (back/forward navigation, app resume)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache
        triggerRefresh('page restored from cache');
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pageshow', handlePageShow);

    log('Auto-refresh listeners registered');

    // Initial refresh on mount
    triggerRefresh('initial mount');

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', handlePageShow);
      log('Auto-refresh listeners removed');
    };
  }, [refreshOnVisible, refreshOnFocus, refreshOnOnline, triggerRefresh, log]);

  // Return a manual refresh function
  return { refresh: () => triggerRefresh('manual') };
}

/**
 * Simple hook that just refreshes on visibility change
 * Use this for lightweight components
 */
export function useRefreshOnVisible(onRefresh: () => void | Promise<void>) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onRefresh]);
}
