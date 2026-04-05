"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Match } from "@/lib/match-service";

export default function UrgentAlertBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!user) return;

    // Listen for matches where user is a participant and status is WAITING_FOR_OPPONENT
    const matchesRef = collection(db, "matches");
    const q = query(
      matchesRef,
      where("playerIds", "array-contains", user.uid),
      where("status", "==", "WAITING_FOR_OPPONENT")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const matches: Match[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Match;
        data.id = doc.id;
        matches.push(data);
      });
      setPendingMatches(matches);
    });

    return () => unsub();
  }, [user]);

  if (!user || pendingMatches.length === 0) return null;

  // Find a match where the user specifically HAS NOT submitted their claim yet
  const urgentMatch = pendingMatches.find((match) => {
    const myPlayer = match.players[user.uid];
    return !myPlayer?.claim; // If I haven't claimed, I need to take action!
  });

  if (!urgentMatch) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-red-600 border-b-4 border-red-900 shadow-[0_0_50px_rgba(220,38,38,0.8)] animate-pulse-fast pointer-events-auto">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-white">
          <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold text-lg md:text-xl uppercase tracking-wider drop-shadow-md">
              Target Acquired: Opponent Submitted Result
            </h3>
            <p className="text-sm md:text-base font-semibold text-red-100">
              Your opponent claims victory. You must submit your result immediately or automatically forfeit this match!
            </p>
          </div>
        </div>
        
        <button
          onClick={() => router.push(`/match/${urgentMatch.id}`)}
          className="bg-black text-white hover:bg-white hover:text-red-700 font-bold uppercase px-8 py-3 rounded border border-red-500 whitespace-nowrap transition-all shadow-lg"
        >
          Dispute / Accept
        </button>
      </div>
    </div>
  );
}
