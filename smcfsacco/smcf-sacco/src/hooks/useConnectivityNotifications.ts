import { useEffect, useRef } from "react";
import { playNotificationSound } from "@/lib/sound";
import { showBrowserNotification } from "@/lib/browserNotifications";

export function useConnectivityNotifications(enabled = true) {
  const lastStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const notifyState = (online: boolean) => {
      if (lastStateRef.current === online) return;
      lastStateRef.current = online;

      if (online) {
        playNotificationSound();
        void showBrowserNotification(
          "SMCF Back Online",
          "Connection restored. Notifications are syncing again.",
          "smcf-connectivity-online"
        );
      } else {
        playNotificationSound();
        void showBrowserNotification(
          "SMCF Offline Mode",
          "You are offline. Cached notifications remain available.",
          "smcf-connectivity-offline"
        );
      }
    };

    notifyState(navigator.onLine);

    const onOnline = () => notifyState(true);
    const onOffline = () => notifyState(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [enabled]);
}
