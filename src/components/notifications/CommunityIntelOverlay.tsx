"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Zap, X, MessageSquare, Heart, BellRing } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { markNotificationAsReadAction } from '@/app/actions/notification-actions';

export default function CommunityIntelOverlay() {
  const { user } = useAuth();
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // Listen for unread notifications for this user in their subcollection
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("isRead", "==", false),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setActiveAlert(data);
        
        // Auto-dismiss after 8 seconds
        const timer = setTimeout(() => {
          setActiveAlert(null);
        }, 8000);
        return () => clearTimeout(timer);
      } else {
        setActiveAlert(null);
      }
    }, (err) => {
      console.error("[CommunityIntel] Snapshot error:", err);
    });

    return () => unsub();
  }, [user]);

  const dismiss = async () => {
    if (!activeAlert || !user) return;
    const alertId = activeAlert.id;
    setActiveAlert(null);
    await markNotificationAsReadAction(user.uid, alertId);
  };

  const viewIntel = async () => {
    if (!activeAlert) return;
    const channel = activeAlert.game === 'GENERAL' ? 'community' : 'community'; // Can extend to specific game channels if needed
    await dismiss();
    router.push(`/dashboard/community`);
  };

  if (!activeAlert) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[1000] w-full max-w-sm px-4 animate-in slide-in-from-right-10 duration-500">
      <div className="bg-[#0c0c0c] border border-accent/20 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-accent w-full animate-pulse-slow" />
        
        <div className="p-4 flex items-start gap-4">
           <div className={`p-2.5 rounded-sm ring-1 ${activeAlert.type === 'LIKE' ? 'bg-accent/10 ring-accent/30' : 'bg-blue-500/10 ring-blue-500/30'}`}>
              {activeAlert.type === 'LIKE' ? (
                <Heart className="w-5 h-5 text-accent fill-accent/20" />
              ) : (
                <MessageSquare className="w-5 h-5 text-blue-400" />
              )}
           </div>

           <div className="flex-1">
              <h4 className="text-[10px] font-black text-sub uppercase tracking-[0.2em] mb-1 italic flex items-center gap-2">
                <Zap className="w-3 h-3 text-accent" />
                Community Intel
              </h4>
              <p className="text-white text-xs font-bold uppercase tracking-tight leading-tight mt-1">
                <span className="text-accent">{activeAlert.senderName}</span> {activeAlert.type === 'LIKE' ? 'liked your message' : 'replied to you'}
              </p>
              <p className="text-[10px] text-gray-500 italic mt-2 line-clamp-1 border-l border-white/10 pl-2">
                "{activeAlert.messageSnippet}..."
              </p>
           </div>

           <button 
             onClick={dismiss}
             className="text-gray-600 hover:text-white transition-colors"
           >
              <X className="w-4 h-4" />
           </button>
        </div>

        <div className="bg-surface-hover/50 border-t border-white/5 flex">
           <button 
             onClick={viewIntel}
             className="w-full py-3 text-[9px] font-black uppercase tracking-[0.2em] text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2"
           >
             Interrogate Intelligence
           </button>
        </div>
      </div>
    </div>
  );
}
