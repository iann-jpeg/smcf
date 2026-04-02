// SMCF Service Worker for Push Notifications
// This enables notifications even when the user is not on the site

const CACHE_NAME = 'smcf-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 SMCF Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('✅ SMCF Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('📬 Push notification received');
  
  let data = {
    title: 'SMCF Notification',
    body: 'You have a new notification',
    icon: '/newsmcflogo.png',
    badge: '/newsmcflogo.png',
    tag: 'smcf-notification',
    vibrate: [200, 100, 200, 100, 200],
    sound: '/notification.wav'
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/newsmcflogo.png',
    badge: data.badge || '/newsmcflogo.png',
    tag: data.tag || 'smcf-notification',
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open SMCF' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: data
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'smcf-sync') {
    console.log('🔄 Background sync triggered');
  }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Play notification sound request
  if (event.data && event.data.type === 'PLAY_NOTIFICATION') {
    // Broadcast to all clients to play sound
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PLAY_NOTIFICATION_SOUND',
          data: event.data.data
        });
      });
    });
  }
});
