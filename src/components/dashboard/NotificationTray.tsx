"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions/notification-actions";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Bell, BellRing, X, Check, Trophy, Wallet, ShieldAlert, Zap, Loader2, CheckCheck, Heart, MessageSquare } from "lucide-react";

export default function NotificationTray() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real-time listener — no polling needed
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString() }));
      setNotifications(docs);
      setLoading(false);
    }, (err) => {
      console.error("[NotificationTray] Listener error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);


  const toggleTray = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    
    // Auto-mark all as read when opening
    if (nextState && unreadCount > 0 && user) {
       // 🚀 OPTIMISTIC UI: Mark all as read locally first
       setNotifications(prev => prev.map(n => ({ ...n, read: true })));

       try {
         const idToken = await user.getIdToken();
         // Fire and forget background update
         markAllNotificationsReadAction(idToken).catch(err => {
           console.error("[NotificationTray] Background mark all read error:", err);
         });
       } catch (error) {
         console.error("[NotificationTray] Token retrieval error:", error);
       }
    }
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't close tray
    if (!user) return;

    // 🚀 OPTIMISTIC UI: Update local state immediately
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    try {
      const idToken = await user.getIdToken();
      // Fire and forget background update
      markNotificationReadAction(idToken, id).catch(err => {
        console.error("[NotificationTray] Background mark read error:", err);
      });
    } catch (error) {
      console.error("[NotificationTray] Token retrieval error:", error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button 
        onClick={toggleTray}
        className={`relative p-2.5 rounded-sm border transition-all ${
          unreadCount > 0 
           ? 'bg-accent/10 border-accent/30 text-accent animate-pulse shadow-[0_0_20px_rgba(0,255,102,0.1)]' 
           : 'bg-surface border-surface-border text-gray-400 hover:text-white'
        }`}
      >
        {unreadCount > 0 ? <BellRing className="w-5 h-5 pointer-events-none" /> : <Bell className="w-5 h-5" />}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-black shadow-lg">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-0 md:inset-auto md:absolute md:right-0 md:mt-4 w-full h-[100dvh] md:h-auto md:w-96 bg-[#0a0a0a] border-x md:border border-white/10 md:rounded-sm shadow-[0_20px_80px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="p-5 md:p-4 bg-black border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                 <Zap className="w-4 h-4 text-accent" />
                 <h3 className="text-[11px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white">Tactical Alerts</h3>
              </div>
              <div className="flex items-center gap-4">
                 {unreadCount > 0 && (
                    <button 
                      onClick={toggleTray}
                      className="text-[9px] font-black text-accent uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark All
                    </button>
                 )}
                 <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white p-1 hover:bg-white/5 rounded-full transition-all">
                   <X className="w-5 h-5 md:w-4 md:h-4" />
                 </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 p-12">
                   <div className="bg-white/5 p-4 rounded-full">
                      <BellRing className="w-10 h-10 text-gray-500" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">Neural Comms Clear</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {[...notifications].sort((a, b) => {
                    const dateA = new Date(a.createdAt).getTime();
                    const dateB = new Date(b.createdAt).getTime();
                    return dateB - dateA; // Most recent first
                  }).map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-5 md:p-4 transition-all relative group ${!n.read ? 'bg-accent-[rgba(0,255,102,0.02)]' : 'bg-transparent'}`}
                    >
                      {!n.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent shadow-[0_0_15px_rgba(0,255,102,0.6)]" />
                      )}
                      
                      <div className="flex items-start gap-4">
                         <div className={`p-2.5 rounded-[4px] shrink-0 ${
                           n.type === 'MATCH' ? 'bg-accent/10 border border-accent/20 text-accent' :
                           n.type === 'DISPUTE' ? 'bg-red-500/10 border border-red-500/20 text-red-500' :
                           n.type === 'LIKE' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                           n.type === 'SYSTEM' || n.type === 'COMMUNITY' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' :
                           'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                         }`}>
                            {n.type === 'MATCH' ? <Trophy className="w-4 h-4 md:w-3.5 md:h-3.5" /> :
                             n.type === 'DISPUTE' ? <ShieldAlert className="w-4 h-4 md:w-3.5 md:h-3.5" /> :
                             n.type === 'LIKE' ? <Heart className="w-4 h-4 md:w-3.5 md:h-3.5 fill-current" /> :
                             n.type === 'SYSTEM' || n.type === 'COMMUNITY' ? <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" /> :
                             <Wallet className="w-4 h-4 md:w-3.5 md:h-3.5" />}
                         </div>
                         
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                               <p className={`text-[11px] md:text-[10px] font-black uppercase tracking-widest ${n.read ? 'text-gray-500' : 'text-white'}`}>
                                 {n.title}
                               </p>
                               <p className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">
                                 {new Date(n.createdAt).toLocaleDateString()}
                               </p>
                            </div>
                            <p className={`text-xs md:text-[11px] leading-relaxed font-medium ${n.read ? 'text-gray-600' : 'text-gray-400 opacity-90'}`}>
                               {n.message}
                            </p>
                            
                            {!n.read && (
                              <button 
                                onClick={(e) => handleMarkRead(n.id, e)}
                                className="mt-3 flex items-center gap-1.5 text-[9px] md:text-[8px] font-black uppercase tracking-[0.2em] text-accent hover:text-white transition-colors"
                              >
                                 <Check className="w-3 h-3" /> Dismiss Alert
                              </button>
                            )}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-black border-t border-white/10 text-center shrink-0">
               <p className="text-[8px] text-gray-700 font-black uppercase tracking-[0.4em]">Tactical Feed 01 // Secure Connection</p>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
