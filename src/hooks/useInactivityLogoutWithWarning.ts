import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface UseInactivityLogoutWithWarningOptions {
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
  
  /**
   * Show warning notification before logout (in milliseconds)
   * Default: 60000 (1 minute before)
   */
  warningTime?: number;
}

/**
 * Enhanced custom hook for auto-logout after user inactivity with visual warning
 * Tracks user interactions, shows warning, and logs out after specified timeout
 */
export const useInactivityLogoutWithWarning = ({
  timeout = 15 * 60 * 1000, // 15 minutes default
  onLogout,
  enabled = true,
  events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'],
  warningTime = 60000, // 1 minute warning
}: UseInactivityLogoutWithWarningOptions) => {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const [showingWarning, setShowingWarning] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Show warning notification
  const showWarning = useCallback(() => {
    if (showingWarning) return;
    
    setShowingWarning(true);
    const remainingSeconds = Math.floor(warningTime / 1000);
    
    toast.warning('Inactivity Warning', {
      description: `You will be logged out in ${remainingSeconds} seconds due to inactivity. Move your mouse or press any key to stay logged in.`,
      duration: warningTime,
      action: {
        label: 'Stay Logged In',
        onClick: () => {
          setShowingWarning(false);
          resetTimer();
        },
      },
    });
  }, [showingWarning, warningTime]);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Clear existing timers
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (warningTimeoutIdRef.current) {
      clearTimeout(warningTimeoutIdRef.current);
    }
    
    // Dismiss any existing warnings
    if (showingWarning) {
      setShowingWarning(false);
    }

    // Set warning timer
    const warningDelay = timeout - warningTime;
    if (warningDelay > 0) {
      warningTimeoutIdRef.current = setTimeout(() => {
        showWarning();
      }, warningDelay);
    }

    // Set logout timer
    timeoutIdRef.current = setTimeout(() => {
      console.log('Auto-logout: User inactive for', timeout / 1000, 'seconds');
      toast.info('Session Expired', {
        description: 'You have been logged out due to inactivity.',
        duration: 3000,
      });
      onLogout();
    }, timeout);
  }, [timeout, warningTime, onLogout, showWarning, showingWarning]);

  // Setup activity listeners
  useEffect(() => {
    if (!enabled) {
      // Clear timers if disabled
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (warningTimeoutIdRef.current) {
        clearTimeout(warningTimeoutIdRef.current);
      }
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

  // Return reset function and last activity time
  return { 
    resetTimer,
    getLastActivityTime: () => lastActivityRef.current,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, timeout - elapsed);
    }
  };
};
