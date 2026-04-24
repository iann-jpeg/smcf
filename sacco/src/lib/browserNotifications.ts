export function canUseBrowserNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function showBrowserNotification(title: string, body: string, tag?: string): Promise<void> {
  if (!canUseBrowserNotifications()) return;

  try {
    if (Notification.permission === "default") {
      // Ask once; if denied we silently skip in future calls.
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, { body, tag, renotify: false });
        return;
      }
    }

    new Notification(title, { body, tag });
  } catch {
    // Notification API failures should never break the app flow.
  }
}
