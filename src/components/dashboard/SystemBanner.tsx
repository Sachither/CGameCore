"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { markNotificationReadAction } from "@/app/actions/user-actions";
import { 
  Bell, 
  X, 
  Info, 
  AlertTriangle, 
  Coins, 
  ShieldAlert,
  ChevronRight
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'MATCH' | 'FINANCE' | 'ALERT' | 'DISPUTE';
  read: boolean;
  createdAt: Timestamp;
}

export default function SystemBanner() {
  const { user } = useAuth();
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen for all unread notifications, then filter/sort in JS to avoid index requirement
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // Filter and sort in memory
        const validTypes = ["SYSTEM", "FINANCE", "ALERT"];
        const notifications = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Notification))
          .filter(n => validTypes.includes(n.type))
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

        if (notifications.length > 0) {
          setActiveNotification(notifications[0]);
        } else {
          setActiveNotification(null);
        }
      } else {
        setActiveNotification(null);
      }
    });

    return () => unsub();
  }, [user]);

  const handleDismiss = async () => {
    if (!activeNotification || !user) return;
    setIsDismissing(true);
    try {
      const idToken = await user.getIdToken();
      const result = await markNotificationReadAction(idToken, activeNotification.id);
      if (result.success) {
        // Immediately clear the notification from UI
        setActiveNotification(null);
      }
    } catch (error) {
      console.error("[SystemBanner] Dismiss failed:", error);
    }
    setIsDismissing(false);
  };

  if (!activeNotification) return null;

  const getIcon = () => {
    switch (activeNotification.type) {
      case 'FINANCE': return <Coins className="w-4 h-4 text-yellow-400" />;
      case 'ALERT': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (activeNotification.type) {
      case 'FINANCE': return "bg-yellow-500/10 border-yellow-500/20 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.1)]";
      case 'ALERT': return "bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]";
      default: return "bg-blue-500/10 border-blue-500/20 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]";
    }
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] w-full max-w-2xl px-4 animate-in slide-in-from-top-4 duration-500">
      <div className={`relative flex items-center gap-4 p-4 rounded-sm border ${getStyles()} backdrop-blur-md overflow-hidden group`}>
        {/* Animated Background Pulse */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="shrink-0 flex items-center justify-center p-2 rounded-full bg-white/5 border border-white/5">
           {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic opacity-80">{activeNotification.title}</span>
            <div className="h-px flex-1 bg-current opacity-10" />
          </div>
          <p className="text-white text-[11px] font-bold uppercase tracking-wider leading-relaxed">
            {activeNotification.message}
          </p>
        </div>

        <button 
          onClick={handleDismiss}
          disabled={isDismissing}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-sm bg-black/40 border border-white/5 hover:border-white/20 hover:bg-black transition-all disabled:opacity-50"
        >
          {isDismissing ? (
            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <X className="w-4 h-4 text-white" />
          )}
        </button>

        {/* Tactical Scan Line */}
        <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-40 shadow-[0_0_10px_currentColor]" />
      </div>
    </div>
  );
}
