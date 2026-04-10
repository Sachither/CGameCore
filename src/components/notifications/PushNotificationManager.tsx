"use client";
import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { initializePushNotifications, listenForForegroundMessages, showLocalNotification } from '@/lib/push-client';

// Maps notification types to emoji icons for the OS tray
const NOTIFICATION_ICONS: Record<string, string> = {
  MATCH_INVITE:   '⚔️',
  QF_SEEDED:      '🏆',
  RESULT_CLOSED:  '✅',
  MATCH_EXPIRING: '⚠️',
  CIRCUIT_START:  '🎮',
  DEFAULT:        '📡',
};

export default function PushNotificationManager() {
  const { user, profile } = useAuth();
  const initializedRef = useRef(false);
  const lastSeenRef = useRef<Set<string>>(new Set());

  // Step 1: Initialize FCM push once user is logged in
  useEffect(() => {
    if (!user || initializedRef.current) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    initializedRef.current = true;

    (async () => {
      try {
        await initializePushNotifications(user.uid);
        await listenForForegroundMessages();
      } catch (err) {
        // Non-critical — app still works without push
        console.warn('[PushManager] Init skipped:', err);
      }
    })();
  }, [user?.uid]);

  // Step 2: Firestore-driven notifications (Spark-compatible)
  // onSnapshot watches for NEW unread notifications and fires browser alerts.
  // This works as long as the browser tab is open — no server push needed.
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false)
    );

    const unsub = onSnapshot(q, (snap) => {
      snap.docs.forEach(async (docSnap) => {
        const id = docSnap.id;
        // Skip notifications we've already processed in this session
        if (lastSeenRef.current.has(id)) return;
        lastSeenRef.current.add(id);

        const data = docSnap.data();

        // Only show for docs created after the page loaded (not historical backlog)
        const createdMs = data.createdAt?.toMillis?.() || 0;
        const sessionStart = Date.now() - 5000; // 5s grace window
        if (createdMs < sessionStart) return;

        const icon = NOTIFICATION_ICONS[data.type] || NOTIFICATION_ICONS.DEFAULT;
        const title = `${icon} ${data.title || 'CGameCore'}`;
        const body = data.message || 'You have a new update.';
        const url = data.matchId
          ? (data.circuitId ? `/dashboard/tournaments/view/${data.circuitId}` : `/match/${data.matchId}`)
          : '/dashboard';

        // Fire browser tray notification
        showLocalNotification(title, body, url);

        // Mark as read so it doesn't re-fire on next snapshot
        try {
          await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true });
        } catch {
          // Non-critical
        }
      });
    }, (err) => {
      // Permission errors are expected if notification rules haven't been deployed
      if (err.code !== 'permission-denied') {
        console.error('[PushManager] Notification listener error:', err);
      }
    });

    return () => unsub();
  }, [user?.uid]);

  // No UI — this is a headless background manager
  return null;
}
