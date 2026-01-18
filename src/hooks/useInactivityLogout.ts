import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityLogoutOptions {
  /**
   * Time in milliseconds before auto-logout
   * Default: 15 minutes (900000 ms)
   */
  timeout?: number;
  
  /**
   * Callback function to execute on logout
   */
  onLogout: () => void;
  
  /**
   * Whether the feature is enabled
   * Default: true
   */
  enabled?: boolean;
  
  /**
   * Events to track for user activity
   * Default: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
   */
  events?: string[];
}

/**
 * Custom hook for auto-logout after user inactivity
 * Tracks user interactions and logs out after specified timeout
 */
export const useInactivityLogout = ({
  timeout = 15 * 60 * 1000, // 15 minutes default
  onLogout,
  enabled = true,
  events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'],
}: UseInactivityLogoutOptions) => {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (warningTimeoutIdRef.current) {
      clearTimeout(warningTimeoutIdRef.current);
    }

    // Set new timer for logout
    timeoutIdRef.current = setTimeout(() => {
      console.log('Auto-logout: User inactive for', timeout / 1000, 'seconds');
      onLogout();
    }, timeout);

    // Optional: Set warning timer (1 minute before logout)
    const warningTime = timeout - 60000; // 1 minute before logout
    if (warningTime > 0) {
      warningTimeoutIdRef.current = setTimeout(() => {
        console.log('Auto-logout warning: 1 minute remaining');
        // You can show a notification here if needed
      }, warningTime);
    }
  }, [timeout, onLogout]);

  // Setup activity listeners
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initialize timer
    resetTimer();

    // Add event listeners for user activity
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, true);
    });

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer, true);
      });
      
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (warningTimeoutIdRef.current) {
        clearTimeout(warningTimeoutIdRef.current);
      }
    };
  }, [enabled, events, resetTimer]);

  // Return reset function in case manual reset is needed
  return { resetTimer };
};
