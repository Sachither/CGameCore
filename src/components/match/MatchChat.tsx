"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, query, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Match } from "@/lib/match-service";
import { sanitize } from "@/lib/validation-utils";
import { Gavel, ShieldCheck, ShieldAlert, Send, Terminal } from "lucide-react";
import { useToast } from "@/context/ToastContext";

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

export default function MatchChat({ match }: { match: Match }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const matchId = match?.id;

  const [chatError, setChatError] = useState<string | null>(null);
  const isMod = profile?.role === 'MODERATOR' || profile?.role === 'ADMIN' || !!profile?.isAdmin;

  const q = useMemo(() => {
    if (!matchId) return null;
    return query(collection(db, "matches", matchId, "messages"));
  }, [matchId]);

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
            .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt));
          
          // Inject System Initial Message
          const systemInitial: Message = {
            id: 'system-intro',
            text: `MISSION PROTOCOL:
1. HOST: Create the room & share room code/Password(if needed) here immediately.
2. DISPUTE: You MUST record gameplay to provide evidence.
3. NO-SHOW: Failure to join within 5 mins = Disqualification.
4. CONDUCT: Zero tolerance for harassment or toxic behavior.
<<<CRITICAL_RED_START>>>5. SCREENSHOT REQUIRED: You MUST have a screenshot of your victory to claim/submit your win!<<<CRITICAL_RED_END>>>
Secure the objective.`,
            senderUid: 'system',
            senderName: 'COMMAND CENTER',
            isSystem: true,
            createdAt: { seconds: 0 }
          };

          setMessages([systemInitial, ...dbMsgs]);
          // Auto scroll
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
        // Permission Denied is common during the initial join-sync (millisecond lag)
        if (error.code === 'permission-denied') {
          console.warn("[MatchLink] Syncing tactical permissions...");
          setChatError("Establishing Command Link...");
        } else {
          console.error("[MatchChat] Listener error:", error);
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
       toast.error("Auth Failure", "You are not logged in to Firebase on this account!");
       setChatError("Auth Required for Comms.");
       return;
    }

    if (!matchId) {
       toast.error("Match Error", "The match ID is undefined!");
       return;
    }

    setChatError(null);
    const text = sanitize(msg);
    setMsg("");
    const senderName = profile?.username || user.displayName || 'Operator';

    const isMod = profile?.role === 'MODERATOR' || profile?.role === 'ADMIN' || !!profile?.isAdmin;

    try {
      await addDoc(collection(db, "matches", matchId, "messages"), {
        text,
        senderUid: user.uid,
        senderName,
        role: profile?.role || (profile?.isAdmin ? 'ADMIN' : 'USER'),
        isMod,
        createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      toast.error("Transmission Error", err.message);
      console.error("Chat send error: ", err);
      setChatError(`Transmission failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-surface border border-surface-border rounded-[5px] shadow-2xl overflow-hidden flex flex-col h-full">
      
      {/* Header */}
      <div className="bg-black border-b border-surface-border p-4 flex items-center justify-between shrink-0">
         <h3 className="text-sm font-black italic uppercase tracking-widest text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            {(match.format === 'league' || match.format === 'tournament') ? 'Unified Sector Comms' : 'Combat Comms'}
         </h3>
         <span className="text-[10px] bg-black border border-surface-border text-gray-300 font-bold px-2 py-0.5 rounded-[3px] uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></span>
            {(match.format === 'league' || match.format === 'tournament') ? 'RECRUITMENT FREQUENCY' : 'ENCRYPTED 1V1 LINK'}
         </span>
      </div>

      {/* Message Feed Container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-zinc-950/20 relative">
         
         <div className="sticky top-0 bg-red-500/10 border border-red-500/20 p-3 rounded-[3px] shadow-lg mb-6 backdrop-blur-md z-10 transition-all group hover:bg-red-500/20">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest leading-relaxed flex items-start gap-2">
               <svg className="w-4 h-4 shrink-0 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               Security Protocol: No-shows = Automatic Loss. Recorded proof required for disputes.
            </p>
         </div>

         {chatError && (
           <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-sm mb-4">
             <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">⚠ Comms Link Interrupted</p>
             <p className="text-[10px] text-red-300/60 mt-1 font-mono break-all">{chatError}</p>
           </div>
         )}

         {messages.length === 0 && !chatError && (
           <div className="text-center py-10 opacity-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Awaiting Comms...</p>
           </div>
         )}

         {messages.map((m) => (
           <div key={m.id} className={`flex flex-col gap-1 ${m.isSystem ? 'items-center my-4 w-full' : m.senderUid === user?.uid ? 'items-end' : 'items-start'}`}>
              {!m.isSystem && (
                <div className="flex items-center gap-1.5 mb-1">
                  {(m.isMod || m.role === 'ADMIN' || m.role === 'MODERATOR') && (
                    <span className="text-[7.5px] font-black bg-red-600 text-white px-2 py-0.5 rounded-[2px] uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(220,38,38,0.4)] flex items-center gap-1 border border-red-400/30">
                      <Gavel className="w-2 h-2" /> COMMAND ADMIN
                    </span>
                  )}
                  <span className={`text-[9px] uppercase font-black tracking-widest px-1 ${m.senderUid === user?.uid ? 'text-accent' : ((m.isMod || m.role === 'ADMIN' || m.role === 'MODERATOR') ? 'text-red-400/80' : 'text-gray-500')}`}>
                    {(m.isMod || m.role === 'ADMIN' || m.role === 'MODERATOR') ? `${m.senderName}` : m.senderName} {m.senderUid === user?.uid && '(You)'}
                  </span>
                </div>
              )}
              <div className={`p-3 rounded-[3px] text-xs shadow-md border transition-all ${
                m.isSystem 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-200 font-bold max-w-[95%] w-full shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                  : (m.isMod || m.role === 'ADMIN' || m.role === 'MODERATOR')
                  ? 'max-w-[85%] bg-red-950/20 border-red-500/50 text-white font-bold shadow-[0_0_25px_rgba(239,68,68,0.1)] ring-1 ring-red-500/20'
                  : m.senderUid === user?.uid 
                  ? 'max-w-[85%] bg-accent/10 border-accent/20 text-accent font-bold' 
                  : 'max-w-[85%] bg-surface border-surface-border text-white'
              }`}>
                 {m.isSystem && <div className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 border-b border-blue-500/20 pb-2 flex items-center gap-2"><svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ADMIN TRANSMISSION</div>}
                 <p className={`whitespace-pre-wrap ${m.text.includes('ROOM ID') || m.text.includes('ID:') ? 'font-mono uppercase tracking-widest text-sm bg-black/50 p-2 border border-accent/20 rounded-sm' : ''} ${m.isSystem ? 'leading-loose' : 'leading-relaxed'}`}>
                   {m.isSystem && m.text.includes('<<<CRITICAL_RED_START>>>') 
                     ? m.text.split('<<<CRITICAL_RED_START>>>').map((part, idx) => {
                         if (idx === 0) return part;
                         const [redPart, ...rest] = part.split('<<<CRITICAL_RED_END>>>');
                         return (
                           <span key={idx}>
                             <span className="text-red-500 font-black text-sm">{redPart}</span>
                             {rest.join('<<<CRITICAL_RED_END>>')}
                           </span>
                         );
                       })
                     : m.text
                   }
                 </p>
              </div>
           </div>
         ))}
      </div>

      <form onSubmit={handleSend} className="bg-black border-t border-surface-border p-4 shrink-0">
         <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder="Transmit tactical data... (No-shows = Loss / Toxic = Ban)" 
              className="flex-1 bg-surface border border-surface-border focus:border-accent text-white font-bold p-3 text-xs rounded-[3px] outline-none transition-all placeholder-gray-600"
              disabled={match.status === 'CLOSED' || (match.status === 'WAITING' && !isMod && match.format !== 'league' && match.format !== 'tournament')}
            />
            <button type="submit" disabled={match.status === 'CLOSED' || (match.status === 'WAITING' && !isMod && match.format !== 'league' && match.format !== 'tournament')} className="bg-accent hover:bg-accent-hover disabled:bg-surface disabled:text-gray-500 transition-colors text-black font-black uppercase tracking-widest p-3 rounded-[3px] shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,102,0.1)]">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
         </div>
      </form>
      
      {match.status === 'WAITING' && !isMod && match.format !== 'league' && match.format !== 'tournament' && (
        <div className="absolute bottom-[72px] left-4 right-4 bg-black/90 border border-accent/20 backdrop-blur-sm p-3 rounded-sm z-20 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
           <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(0,255,102,0.5)]"></div>
           <p className="text-[9px] text-accent font-black uppercase tracking-[0.2em]">Tactical Silence: Comms locked until arena is full</p>
        </div>
      )}
      
      {match.status === 'CLOSED' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-t border-surface-border">
           <svg className="w-10 h-10 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           <h3 className="text-white font-black italic uppercase tracking-widest">Network Purged</h3>
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[70%] text-center mt-2">Combat concluded. Sub-collections successfully eradicated from servers.</p>
        </div>
      )}
    </div>
  );
}
