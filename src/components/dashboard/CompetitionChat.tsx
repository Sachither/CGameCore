"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { sanitize } from "@/lib/validation-utils";
import { Send, Terminal, ShieldAlert, Activity, Target } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { sendCompetitionChatMessageAction } from "@/app/actions/chat-actions";

interface Message {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  isSystem?: boolean;
  isMod?: boolean;
  role?: string;
  createdAt: any;
}

export default function CompetitionChat({ competitionId, competitionTitle }: { competitionId: string, competitionTitle: string }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [chatError, setChatError] = useState<string | null>(null);

  const q = useMemo(() => {
    if (!competitionId) return null;
    // Do NOT use orderBy here — pending server timestamps on new writes
    // cause Firestore to drop the doc from the stream until the timestamp flushes.
    // We sort client-side instead for instant visibility.
    return query(
      collection(db, "competition_chats", competitionId, "messages"),
      limit(100)
    );
  }, [competitionId]);

  useEffect(() => {
    if (!q) return;

    const getTime = (t: any) => {
      if (!t) return Date.now();
      if (typeof t.toMillis === 'function') return t.toMillis();
      if (t._seconds) return t._seconds * 1000;
      if (t.seconds) return t.seconds * 1000;
      return Date.now();
    };

    const unsub = onSnapshot(q, 
      (snap) => {
        setChatError(null);
        try {
          const dbMsgs = snap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Message))
            // Client-side sort handles pending server timestamps (null) gracefully
            .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt))
            // Exclude any doc that somehow has the reserved system-intro id
            .filter(m => m.id !== 'system-intro');
          
          // System Initial Message for the War Room
          const systemInitial: Message = {
            id: 'system-intro',
            text: `COMMAND CENTER UP-LINK ESTABLISHED:
1. SECTORS: Monitor the Tactical Map for live standings.
2. ENGAGEMENT: Click "Jump to Arena" when your mission is live.
3. PROTOCOL: All matches require Extra Time/Penalties.
4. CONDUCT: This is a professional sector. Zero tolerance for toxicity.
Good hunting, operatives.`,
            senderUid: 'system',
            senderName: 'HQ OVERLORD',
            isSystem: true,
            createdAt: { seconds: 0 }
          };

          setMessages([systemInitial, ...dbMsgs]);
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 100);
        } catch (e) {
          console.error("Chat parsing error:", e);
        }
      },
      (error) => {
        if (error.code === 'permission-denied') {
          setChatError("Syncing Comm Permissions...");
        } else {
          setChatError(error.message);
        }
      }
    );

    return () => unsub();
  }, [q]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!msg.trim()) return;

    if (!user) {
       toast.error("Auth Failure", "Operative not identified locally.");
       return;
    }

    const text = msg.trim();
    setMsg("");

    try {
      const idToken = await user.getIdToken();
      const result = await sendCompetitionChatMessageAction(idToken, competitionId, text);

      if (!result.success) {
        toast.error("Transmission Failure", result.error || "Failed to send message");
        // Restore message on failure
        setMsg(text);
      }
    } catch (err: any) {
      toast.error("Transmission Failure", err.message);
      // Restore message on failure
      setMsg(text);
    }
  };

  return (
    <div className="bg-surface/30 border border-white/5 rounded-lg overflow-hidden flex flex-col h-[500px] lg:h-full backdrop-blur-xl group">
      
      {/* Header */}
      <div className="bg-black/50 border-b border-white/5 p-5 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
            <h3 className="text-[11px] font-black italic uppercase tracking-[0.3em] text-white">
               Global Command Comms
            </h3>
         </div>
         <span className="text-[8px] bg-white/5 border border-white/10 text-gray-500 font-black px-2 py-1 rounded-sm uppercase tracking-widest">
            SECURE-LINK: {competitionId.slice(0, 8)}
         </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-gradient-to-b from-black/20 to-transparent">
         {messages.map((m) => (
           <div key={m.id} className={`flex flex-col gap-1.5 ${m.isSystem ? 'items-center my-6' : m.senderUid === user?.uid ? 'items-end' : 'items-start'}`}>
              {!m.isSystem && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className={`text-[9px] uppercase font-black tracking-widest ${m.senderUid === user?.uid ? 'text-accent' : 'text-gray-500'}`}>
                    {m.senderName} {m.senderUid === user?.uid && '(YOU)'}
                  </span>
                </div>
              )}
              <div className={`p-4 rounded-sm text-xs border transition-all ${
                m.isSystem 
                  ? 'bg-accent/5 border-accent/20 text-accent font-bold w-full' 
                  : m.senderUid === user?.uid 
                  ? 'max-w-[85%] bg-accent/20 border-accent/30 text-white font-bold' 
                  : 'max-w-[85%] bg-white/5 border-white/10 text-gray-300'
              }`}>
                 {m.isSystem && <div className="text-[9px] text-accent/60 font-black uppercase tracking-widest mb-3 border-b border-accent/10 pb-2 flex items-center gap-2"><Target className="w-3 h-3" /> HQ BROADCAST</div>}
                 <p className="whitespace-pre-wrap leading-relaxed">
                   {m.text}
                 </p>
              </div>
           </div>
         ))}
      </div>

      <form onSubmit={handleSend} className="bg-black/80 border-t border-white/5 p-5 shrink-0">
         <div className="flex items-center gap-3">
            <input 
              type="text" 
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Transmit technical data to sector..." 
              className="flex-1 bg-white/5 border border-white/10 focus:border-accent text-white font-bold p-4 text-xs rounded-sm outline-none transition-all placeholder-gray-700"
            />
            <button type="submit" className="bg-white hover:bg-accent text-black font-black uppercase tracking-widest p-4 rounded-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-90">
               <Send className="w-5 h-5" />
            </button>
         </div>
      </form>
    </div>
  );
}
