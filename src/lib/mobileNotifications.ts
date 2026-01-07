// Capacitor Local Notifications for Mobile App (APK)
// This module provides push notification support for the mobile app
// Works gracefully when running in web browser without Capacitor

export interface MobileNotificationOptions {
  id?: number;
  title: string;
  body: string;
  sound?: string;
  smallIcon?: string;
  largeIcon?: string;
  channelId?: string;
  group?: string;
  extra?: any;
}

// Cached module references
let capacitorLoaded = false;
let Capacitor: any = null;
let LocalNotifications: any = null;

// Try to load Capacitor modules (called on first use)
async function ensureCapacitorLoaded(): Promise<boolean> {
  if (capacitorLoaded) {
    return Capacitor !== null && LocalNotifications !== null;
  }
  
  capacitorLoaded = true;
  
  try {
    // @ts-ignore - Capacitor modules are optional and may not be installed in web-only mode
    const core = await import('@capacitor/core');
    Capacitor = core.Capacitor;
    
    // @ts-ignore - Capacitor modules are optional and may not be installed in web-only mode
    const notifications = await import('@capacitor/local-notifications');
    LocalNotifications = notifications.LocalNotifications;
    
    console.log('✅ Capacitor modules loaded successfully');
    return true;
  } catch (error) {
    console.log('ℹ️ Running in web mode - Capacitor not available');
    Capacitor = null;
    LocalNotifications = null;
    return false;
  }
}

// Check if running on native platform
export function isNativePlatform(): boolean {
  if (!Capacitor) return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Async check for native platform (ensures modules are loaded)
export async function isNativePlatformAsync(): Promise<boolean> {
  await ensureCapacitorLoaded();
  return isNativePlatform();
}

// Request notification permissions
export async function requestMobileNotificationPermission(): Promise<boolean> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    console.log('Not running on native platform, skipping mobile notification permission');
    return false;
  }

  try {
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('Failed to request mobile notification permission:', error);
    return false;
  }
}

// Check if notifications are enabled
export async function areMobileNotificationsEnabled(): Promise<boolean> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('Failed to check mobile notification permission:', error);
    return false;
  }
}

// Generate unique notification ID
let notificationIdCounter = 0;
function generateNotificationId(): number {
  notificationIdCounter = (notificationIdCounter + 1) % 2147483647;
  return Date.now() + notificationIdCounter;
}

// Show local notification on mobile
export async function showMobileNotification(
  options: MobileNotificationOptions
): Promise<void> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    console.log('Not running on native platform, skipping mobile notification');
    return;
  }

  try {
    const notificationId = options.id ?? generateNotificationId();

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: options.title,
          body: options.body,
          sound: options.sound || 'default',
          smallIcon: options.smallIcon || 'ic_stat_notify',
          largeIcon: options.largeIcon,
          channelId: options.channelId || 'smcf_notifications',
          group: options.group || 'smcf',
          extra: options.extra,
          // Schedule for immediate delivery
          schedule: {
            at: new Date(Date.now() + 100),
          },
        },
      ],
    });
    console.log('Mobile notification scheduled:', options.title);
  } catch (error) {
    console.error('Failed to show mobile notification:', error);
  }
}

// Create notification channel (Android) - HIGH PRIORITY for loud notifications
export async function createNotificationChannel(): Promise<void> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications || !Capacitor) {
    return;
  }

  if (Capacitor.getPlatform() === 'android') {
    try {
      await LocalNotifications.createChannel({
        id: 'smcf_notifications',
        name: 'SMCF Notifications',
        description: 'Smart Money Cash Flow notifications for payments, loans, and updates',
        importance: 5, // MAX - ensures loud sound and heads-up display
        visibility: 1, // PUBLIC
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#3b82f6',
      });
      
      // Also create a high priority channel for urgent notifications
      await LocalNotifications.createChannel({
        id: 'smcf_urgent',
        name: 'SMCF Urgent Notifications',
        description: 'Urgent notifications that require immediate attention',
        importance: 5, // MAX
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#ef4444',
      });
      
      console.log('Notification channels created with MAX importance');
    } catch (error) {
      console.error('Failed to create notification channel:', error);
    }
  }
}

// Initialize mobile notifications
export async function initializeMobileNotifications(): Promise<boolean> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    console.log('Not running on native platform, skipping mobile notification initialization');
    return false;
  }

  try {
    // Create notification channel for Android
    await createNotificationChannel();

    // Request permissions
    const granted = await requestMobileNotificationPermission();

    if (granted) {
      // Listen for notification taps
      await LocalNotifications.addListener('localNotificationActionPerformed', (notification: any) => {
        console.log('Notification tapped:', notification);
        // Handle notification tap - you can navigate to specific screens based on notification.extra
        const extra = notification.notification?.extra;
        if (extra) {
          // Dispatch custom event for the app to handle navigation
          window.dispatchEvent(new CustomEvent('smcf-notification-tap', { 
            detail: extra 
          }));
        }
      });

      // Listen for received notifications
      await LocalNotifications.addListener('localNotificationReceived', (notification: any) => {
        console.log('Notification received:', notification);
      });

      console.log('Mobile notifications initialized successfully');
      return true;
    } else {
      console.warn('Mobile notification permission not granted');
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize mobile notifications:', error);
    return false;
  }
}

// Cancel all notifications
export async function cancelAllMobileNotifications(): Promise<void> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    return;
  }

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n: any) => ({ id: n.id })),
      });
    }
  } catch (error) {
    console.error('Failed to cancel mobile notifications:', error);
  }
}

// Get pending notifications count
export async function getPendingMobileNotificationsCount(): Promise<number> {
  const isNative = await isNativePlatformAsync();
  if (!isNative || !LocalNotifications) {
    return 0;
  }

  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch (error) {
    console.error('Failed to get pending notifications:', error);
    return 0;
  }
}
