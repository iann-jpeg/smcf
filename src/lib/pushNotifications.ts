// Push Notification Service
// Manages service worker registration and push subscriptions
// Enables notifications even when user is not on the site

import { playNotificationSound } from './notificationSounds';

// VAPID public key for push notifications (from environment variable)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BISgKVrTV-OdFzVEaxt4ugMbIk-dbEQW22ESUfqQomeZURsV5fIq3CToWmjb-j2jW4f5dgL3VHdGLkmTxTlwoUU';

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let pushSubscription: PushSubscription | null = null;

// Register the service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('✅ Service Worker registered:', registration.scope);
    serviceWorkerRegistration = registration;
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotificationSound();
      }
    });
    
    // Check for updates
    registration.addEventListener('updatefound', () => {
      console.log('🔄 Service Worker update found');
    });
    
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Request push notification permission
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('🔔 Notification permission:', permission);
  return permission;
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!serviceWorkerRegistration) {
    await registerServiceWorker();
  }
  
  if (!serviceWorkerRegistration) {
    console.warn('No service worker registration');
    return null;
  }

  try {
    const permission = await requestPushPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    // Check for existing subscription
    let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription
      subscription = await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('✅ Push subscription created');
    }
    
    pushSubscription = subscription;
    
    // Store subscription for the member
    await storeSubscription(subscription);
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return null;
  }
}

// Convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

// Store subscription on server for the member
async function storeSubscription(subscription: PushSubscription): Promise<void> {
  const memberId = localStorage.getItem('smcf-member-id');
  if (!memberId) {
    console.log('No member ID found, storing subscription locally');
    localStorage.setItem('smcf-push-subscription', JSON.stringify(subscription.toJSON()));
    return;
  }

  try {
    // Store subscription with member info
    localStorage.setItem('smcf-push-subscription', JSON.stringify({
      ...subscription.toJSON(),
      memberId,
      subscribedAt: new Date().toISOString()
    }));
    
    // You can also send to backend here if you have a push endpoint
    // await fetch(`${API_BASE}/api/push/subscribe`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ memberId, subscription: subscription.toJSON() })
    // });
    
    console.log('✅ Push subscription stored for member:', memberId);
  } catch (error) {
    console.error('Failed to store subscription:', error);
  }
}

// Show a local notification (works even in background)
export async function showPushNotification(
  title: string,
  options?: NotificationOptions & { playSound?: boolean }
): Promise<void> {
  const { playSound = true, ...notificationOptions } = options || {};
  
  if (!serviceWorkerRegistration) {
    await registerServiceWorker();
  }
  
  // Play sound
  if (playSound) {
    await playNotificationSound();
  }
  
  // Show notification via service worker (works in background)
  if (serviceWorkerRegistration) {
    // Use service worker showNotification which supports vibrate
    await serviceWorkerRegistration.showNotification(title, {
      icon: '/newsmcflogo.png',
      badge: '/newsmcflogo.png',
      requireInteraction: true,
      ...notificationOptions
    } as NotificationOptions);
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // Fallback to regular notification - wrapped in try-catch for strict mode compatibility
    try {
      new Notification(title, {
        icon: '/newsmcflogo.png',
        badge: '/newsmcflogo.png',
        ...notificationOptions
      });
    } catch (error) {
      console.warn('Failed to create browser notification:', error);
    }
  }
}

// Initialize push notifications on app load
export async function initializePushNotifications(): Promise<void> {
  // Register service worker
  await registerServiceWorker();
  
  // Check if member has logged in before
  const memberId = localStorage.getItem('smcf-member-id');
  const hasSubscription = localStorage.getItem('smcf-push-subscription');
  
  if (memberId || hasSubscription) {
    // Auto-subscribe if they've logged in before
    await subscribeToPush();
  }
}

// Store member ID when they log in (for future push notifications)
export function storeMemberIdForPush(memberId: string): void {
  localStorage.setItem('smcf-member-id', memberId);
  // Subscribe to push if not already
  subscribeToPush();
}

// Check if push is supported
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

// Get current push subscription
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!serviceWorkerRegistration) {
    await registerServiceWorker();
  }
  
  if (!serviceWorkerRegistration) return null;
  
  return serviceWorkerRegistration.pushManager.getSubscription();
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  if (subscription) {
    const result = await subscription.unsubscribe();
    localStorage.removeItem('smcf-push-subscription');
    console.log('🔕 Unsubscribed from push notifications');
    return result;
  }
  return false;
}
