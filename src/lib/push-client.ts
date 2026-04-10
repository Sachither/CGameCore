// Client-side push notification utilities
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const VAPID_KEY = 'BICgV-U5a3HLURM1_wKKFzUCughU_X6JVnbXw9O0Tb0wpKXRMebECv4QkbNcp4JT0jeEy8DdjtmD60jBpZ8NE3Y';

/**
 * Register the service worker and pass Firebase config to it
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    // Pass Firebase config to the service worker so it can initialize Firebase
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Wait for SW to be active
    await navigator.serviceWorker.ready;

    if (reg.active) {
      reg.active.postMessage({ type: 'FIREBASE_CONFIG', config });
    }

    return reg;
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Request notification permission and get FCM token.
 * Saves the token to Firestore under users/{uid}/fcmTokens/{token}
 */
export async function initializePushNotifications(uid: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Check browser support
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Push] Firebase Messaging not supported in this browser.');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied.');
      return null;
    }

    // Register service worker
    await registerServiceWorker();

    // Dynamically import messaging to avoid SSR issues
    const { getMessaging } = await import('firebase/messaging');
    const { default: app } = await import('./firebase');
    const messaging = getMessaging(app);

    // Get FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn('[Push] No FCM token received.');
      return null;
    }

    // Save token to Firestore
    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', token),
      { token, createdAt: serverTimestamp(), userAgent: navigator.userAgent },
      { merge: true }
    );

    console.log('[Push] FCM token registered.');
    return token;
  } catch (err) {
    console.error('[Push] Initialization error:', err);
    return null;
  }
}

/**
 * Listen for foreground messages and fire browser Notification API.
 * Called when app is open/focused.
 */
export async function listenForForegroundMessages() {
  if (typeof window === 'undefined') return;

  try {
    const supported = await isSupported();
    if (!supported) return;

    const { getMessaging } = await import('firebase/messaging');
    const { default: app } = await import('./firebase');
    const messaging = getMessaging(app);

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'CGameCore';
      const body = payload.notification?.body || 'You have a new update.';
      const icon = payload.notification?.icon || '/icon-192.png';

      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon });
      }
    });
  } catch (err) {
    console.error('[Push] Foreground listener error:', err);
  }
}

/**
 * Fire a local browser notification (used with Firestore onSnapshot)
 * Works even on Spark plan - purely client-side
 */
export function showLocalNotification(title: string, body: string, url?: string) {
  // 🔒 Guard against Notification API not being available or permission not granted
  if (typeof window === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'cgamecore-' + Date.now(),
  });

  if (url) {
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  }
}
