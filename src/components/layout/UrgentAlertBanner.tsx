"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";
import { Match } from "@/lib/match-service";

export default function UrgentAlertBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!user) return;

    // Listen for matches where user is a participant and needs attention
    const matchesRef = collection(db, "matches");
    const q = query(
      matchesRef,
      where("playerIds", "array-contains", user.uid),
      where("status", "in", ["WAITING_FOR_OPPONENT", "DISPUTED"])
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const matches: any[] = [];
      snapshot.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() });
      });
      setPendingMatches(matches);
    }, (err) => {
      console.error("[UrgentAlertBanner] Sync Error:", err);
    });

    return () => unsub();
  }, [user]);

  if (!user || pendingMatches.length === 0) return null;

  // 1. Check for Admin Presence Alert (High Priority)
  const adminAlertMatch = pendingMatches.find(m => m.adminAlert === true && m.status === 'DISPUTED');

  // 2. Check for Opponent Claimed Victory (Medium Priority)
  const opponentClaimMatch = pendingMatches.find((match) => {
    const myPlayer = match.players[user.uid];
    return match.status === 'WAITING_FOR_OPPONENT' && (!myPlayer || !myPlayer.claim);
  });

  const displayedMatch = adminAlertMatch || opponentClaimMatch;

  if (!displayedMatch) return null;
  
  // HIDE IF ALREADY ON THIS MATCH PAGE: Avoid covering the form!
  if (pathname === `/match/${displayedMatch.id}`) return null;
  if (pathname === `/dashboard/matches/${displayedMatch.id}`) return null;

  const isAdminAlert = displayedMatch.id === adminAlertMatch?.id;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-8 md:max-w-xl z-[70] pointer-events-auto">
      <div className={`${isAdminAlert ? 'bg-orange-600 border-orange-400 ring-orange-900' : 'bg-red-600 border-red-400 ring-red-900'} border rounded-[5px] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(0,0,0,0.2)] animate-in slide-in-from-top-10 duration-500 overflow-hidden ring-2 group`}>
        
        {/* Rapid Intensity Progress Bar */}
        <div className={`h-1 ${isAdminAlert ? 'bg-orange-900' : 'bg-red-900'} w-full overflow-hidden`}>
          <div className="h-full bg-white animate-pulse-fast w-full origin-left" style={{ animationDuration: '1s' }}></div>
        </div>

        <div className="p-4 md:p-6 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-black/20 p-2 rounded-full shrink-0">
              <svg className="w-8 h-8 md:w-10 md:h-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isAdminAlert ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm md:text-base uppercase tracking-[0.15em] text-white leading-tight mb-1">
                {isAdminAlert ? "ADMIN ATTENTION REQUIRED" : "COMBAT ALERT: Opponent Claimed Victory"}
              </h3>
              <p className="text-[11px] md:text-xs font-bold text-white/90 uppercase tracking-widest leading-relaxed">
                {isAdminAlert 
                  ? "An administrator has entered the match room to resolve a conflict. Your presence is mandatory." 
                  : "Operative reported success. You must respond immediately or face automatic combat forfeiture."}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => router.push(`/match/${displayedMatch.id}`)}
            className={`w-full bg-white ${isAdminAlert ? 'text-orange-700' : 'text-red-700'} hover:bg-black hover:text-white font-black uppercase text-[10px] md:text-xs tracking-[0.2em] py-4 rounded-[3px] transition-all shadow-xl flex items-center justify-center gap-2 border-b-4 ${isAdminAlert ? 'border-orange-200' : 'border-red-200'} hover:border-black active:translate-y-1 active:border-b-0`}
          >
            {isAdminAlert ? "Secure Arena Headquarters" : "Tactical Response Required"}
          </button>
        </div>
      </div>
    </div>
  );
}
