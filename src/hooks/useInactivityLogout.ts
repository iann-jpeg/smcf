import { useEffect, useRef } from 'react';

interface UseInactivityLogoutProps {
  timeout?: number; // in milliseconds
  onLogout: () => void;
  enabled?: boolean;
}

export const useInactivityLogout = ({
  timeout = 3 * 60 * 1000, // Default: 3 minutes
  onLogout,
  enabled = true,
}: UseInactivityLogoutProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        console.log('User inactive for 3 minutes - logging out');
        onLogout();
      }, timeout);
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Reset timer on any activity
    const handleActivity = () => {
      resetTimer();
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [timeout, enabled, onLogout]);

  return { resetTimer };
};
