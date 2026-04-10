"use client";
import { useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * usePushNotifications
 * ─────────────────────────────────────────────────────────────
 * Requests browser notification permission on first mount,
 * registers a Firebase Cloud Messaging (FCM) token, and
 * saves it to Firestore so the backend can target this device.
 *
 * Works on: Chrome, Edge, Firefox, Safari 16.4+ (iOS/macOS),
 *           Android Chrome, Samsung Internet.
 */
export function usePushNotifications(uid: string | undefined) {
  useEffect(() => {
    if (!uid || typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // 1. Request permission (shows the browser prompt if not yet granted)
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // 2. Load Firebase Messaging dynamically (avoids SSR issues)
        const { getMessaging, getToken } = await import("firebase/messaging");
        const firebaseApp = await import("@/lib/firebase").then(m => m.default);

        // 3. Register the service worker
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // 4. Post the Firebase config to the service worker so it can init
        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        swReg.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });

        // 5. Get/refresh the FCM registration token
        const messaging = getMessaging(firebaseApp);
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

        if (!vapidKey) {
          console.warn("[Push] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set. Push tokens disabled.");
          return;
        }

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        });

        if (!token) {
          console.warn("[Push] No FCM token returned — push notifications unavailable.");
          return;
        }

        // 6. Persist the token in Firestore under the user's device tokens subcollection
        const tokenRef = doc(db, "users", uid, "fcmTokens", token.slice(-20));
        await setDoc(tokenRef, {
          token,
          updatedAt: serverTimestamp(),
          userAgent: navigator.userAgent.slice(0, 200),
        }, { merge: true });

        console.log("[Push] FCM token registered.");
      } catch (err) {
        // Non-fatal — app works fine without push support
        console.warn("[Push] Registration error:", err);
      }
    };

    register();
  }, [uid]);
}
