// Firebase Messaging Service Worker
// Handles push notifications when the app is in the background or closed
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// NOTE: These values are injected at runtime via the client.
// The service worker receives the config from the main app via postMessage.
let firebaseApp = null;
let messaging = null;

// Listen for config from the main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    try {
      if (!firebaseApp) {
        firebaseApp = firebase.initializeApp(event.data.config);
        messaging = firebase.messaging(firebaseApp);

        // Handle background messages
        messaging.onBackgroundMessage((payload) => {
          const { title, body, icon, data } = payload.notification || {};
          self.registration.showNotification(title || 'CGameCore', {
            body: body || 'You have a new notification.',
            icon: icon || '/icon-192.png',
            badge: '/icon-192.png',
            data: data || {},
            vibrate: [200, 100, 200],
            tag: 'cgamecore-notification',
            renotify: true,
          });
        });
      }
    } catch (e) {
      console.error('[SW] Firebase init error:', e);
    }
  }
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
