"use client";
import React from 'react';
import { Circuit, CircuitTie, MatchPlayer, Match } from '@/lib/match-service';
import { Trophy, Swords, Zap, Activity, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Props {
  circuit: Circuit;
  allMatches?: Match[];
}

export default function CircuitBracket({ circuit, allMatches }: Props) {
  if (!circuit.bracket) return (
    <div className="bg-surface/50 border border-surface-border p-12 text-center rounded-sm italic text-gray-600 text-[10px] uppercase tracking-widest">
      Awaiting Tactical Progress (Qualifiers Ongoing)
    </div>
  );

  const quarters = circuit.bracket.quarters || [];
  const semis = circuit.bracket.semis || [];
  const final = circuit.bracket.final || {};

  return (
    <div className="space-y-12">
      {/* 2-Legged Duel Logic Notification */}
      <div className="bg-accent/5 border border-accent/20 p-4 rounded-sm flex items-center gap-4">
        <Zap className="w-5 h-5 text-accent animate-pulse" />
        <div className="flex-1">
           <h4 className="text-[10px] font-black text-accent uppercase tracking-widest italic">Absolute Victory Protocol</h4>
           <p className="text-[9px] text-gray-500 uppercase leading-relaxed tracking-tighter">Each bracket is a Home & Away series. If the total aggregate score is level after two legs, a Tie-Breaker match is mandatory. No Draws permitted.</p>
        </div>
      </div>

      {/* TACTICAL DEBUG PANEL - INJECTED CHANNELS */}
      <div className="p-4 bg-black/60 border border-red-500/10 rounded-sm">
         <div className="flex items-center justify-between mb-4">
            <h5 className="text-[9px] font-black text-red-500 uppercase tracking-widest italic">Neural Link Diagnostic // Metadata Feed</h5>
            <span className="text-[8px] font-mono text-gray-500">M-FEED: {allMatches?.length || 0} SECTORS DETECTED</span>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {allMatches?.slice(0, 4).map(m => (
               <div key={m.id} className="p-2 border border-white/5 bg-white/5 rounded-sm">
                  <p className="text-[8px] font-mono text-gray-400 truncate">ID: {m.id?.slice(-8)}</p>
                  <p className="text-[8px] font-mono text-white italic">{m.round || 'NONE'} / L:{m.leg || '-'}</p>
                  <p className={m.status === 'CLOSED' ? 'text-accent text-[7px] font-bold' : 'text-gray-600 text-[7px]'}>{m.status}</p>
               </div>
            ))}
            {(!allMatches || allMatches.length === 0) && (
               <div className="col-span-4 py-8 text-center border border-dashed border-red-500/20 bg-red-500/5 rounded-sm">
                  <ShieldAlert className="w-6 h-6 text-red-500 mx-auto mb-2 opacity-50" />
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest animate-pulse">Neural Blindness Detected: 0 matches found in feed.</p>
               </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        {/* Quarter-Finals (Legs) */}
        <div className="space-y-4">
           <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Quarter-Finals
           </h3>
           {quarters.map((tie, idx) => (
              <TieNode key={idx} tie={tie} players={circuit.players} allMatches={allMatches} round="QF" />
           ))}
        </div>

        {/* Semi-Finals */}
        <div className="space-y-4 pt-12 md:pt-0">
           <h3 className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <Swords className="w-3 h-3" /> Semi-Finals
           </h3>
           {semis.map((tie, idx) => (
              <TieNode key={idx} tie={tie} players={circuit.players} allMatches={allMatches} round="SF" />
           ))}
           {semis.length === 0 && <BracketEmptyState count={2} />}
        </div>

        {/* Grand Final */}
        <div className="space-y-4 pt-12 md:pt-0">
           <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <Trophy className="w-3 h-3" /> Grand Final
           </h3>
           <FinalNode final={final} players={circuit.players} allMatches={allMatches} />
        </div>
      </div>
    </div>
  );
}

function TieNode({ tie, players, allMatches, round }: { tie: CircuitTie, players: { [uid: string]: MatchPlayer }, allMatches?: Match[], round: 'QF' | 'SF' }) {
  const p1 = players[tie.p1];
  const p2 = players[tie.p2];
  
  // REAL-TIME RECONCILIATION: Pull from individual match docs if bracket stats are stagnant
  // FALLBACK: If MatchID lookup fails, search by Round + Leg + Player Pair
  // FALLBACK: If MatchID lookup fails, search by Round + Leg + Player Pair
  const syncFromMatch = (mId: string | undefined, leg: number, roundVal: string): { p1: number | undefined, p2: number | undefined, active: boolean, closed: boolean, submitted: boolean } => {
     if (!allMatches) return { p1: undefined, p2: undefined, active: false, closed: false, submitted: false };
     
     let found = allMatches.find(m => m.id === mId);
     
     // Neural Fallback (UID + Round + Leg scan)
     if (!found) {
        found = allMatches.find(m => 
          (m.round === roundVal || m.round === `${roundVal} TIE-BREAKER`) && 
          m.leg === leg && 
          m.playerIds?.includes(tie.p1) && 
          m.playerIds?.includes(tie.p2)
        );
     }

     if (!found) return { p1: undefined, p2: undefined, active: false, closed: false, submitted: false };
     
     const mP1 = found.players[tie.p1]?.scoreFor ?? (found.players[tie.p1] as any)?.kills;
     const mP2 = found.players[tie.p2]?.scoreFor ?? (found.players[tie.p2] as any)?.kills;
     return { 
       p1: mP1, 
       p2: mP2, 
       active: found.status === 'IN_PROGRESS' || found.status === 'READY' || found.status === 'WAITING_FOR_OPPONENT',
       closed: found.status === 'CLOSED' || found.status === 'COMPLETED' || found.status === 'RESOLVING',
       submitted: mP1 !== undefined || mP2 !== undefined
     };
  };

  const L1 = syncFromMatch(tie.matchId1, 1, round);
  const L2 = syncFromMatch(tie.matchId2, 2, round);
  const L3 = syncFromMatch((tie as any).matchId3, 3, round);

  // REAL-TIME OVERRIDE: Prioritize live match feed data to bypass corrupted backend variables
  const p1_L1 = (L1.p1 ?? 0) > 0 || L1.closed ? (L1.p1 ?? 0) : ((tie as any).leg1Finished ? ((tie as any).p1Goals_leg1 ?? 0) : 0);
  const p2_L1 = (L1.p2 ?? 0) > 0 || L1.closed ? (L1.p2 ?? 0) : ((tie as any).leg1Finished ? ((tie as any).p2Goals_leg1 ?? 0) : 0);
  const p1_L2 = (L2.p1 ?? 0) > 0 || L2.closed ? (L2.p1 ?? 0) : ((tie as any).leg2Finished ? ((tie as any).p1Goals_leg2 ?? 0) : 0);
  const p2_L2 = (L2.p2 ?? 0) > 0 || L2.closed ? (L2.p2 ?? 0) : ((tie as any).leg2Finished ? ((tie as any).p2Goals_leg2 ?? 0) : 0);

  const agg1 = (p1_L1 ?? 0) + (p1_L2 ?? 0) + (L3.p1 ?? 0);
  const agg2 = (p2_L1 ?? 0) + (p2_L2 ?? 0) + (L3.p2 ?? 0);
  
  const isTied = (tie.matchId1 && tie.matchId2 && agg1 === agg2) || !!(tie as any).matchId3;

  return (
    <div className="bg-surface border border-surface-border rounded-sm overflow-hidden group hover:border-accent/40 transition-all shadow-xl">
       <div className="divide-y divide-surface-border">
          <PlayerSlot 
            player={p1} 
            score1={p1_L1} 
            score2={p1_L2} 
            total={agg1} 
            isWinner={tie.winner === tie.p1}
            l1Status={L1}
            l2Status={L2}
          />
          <PlayerSlot 
            player={p2} 
            score1={p2_L1} 
            score2={p2_L2} 
            total={agg2} 
            isWinner={tie.winner === tie.p2}
            l1Status={L1}
            l2Status={L2}
          />
       </div>
       {isTied && !tie.winner && (
          <div className="bg-red-500/10 px-3 py-2 text-center animate-pulse flex items-center justify-center gap-2 border-t border-red-500/20">
             <Activity className="w-3 h-3 text-red-500" />
             <span className="text-[8px] font-black text-red-500 uppercase italic">Deadlock: Tie-Breaker (Leg 3) Required</span>
          </div>
       )}
    </div>
  );
}

function PlayerSlot({ player, score1, score2, total, isWinner, l1Status, l2Status }: { player: MatchPlayer, score1?: number, score2?: number, total: number, isWinner: boolean, l1Status?: any, l2Status?: any }) {
  const showL1Active = l1Status?.active;
  const showL2Active = l2Status?.active;
  const showL1Done = l1Status?.closed || l1Status?.submitted;
  const showL2Done = l2Status?.closed || l2Status?.submitted;

  return (
    <div className={`p-4 flex items-center justify-between transition-all ${isWinner ? 'bg-accent/5 border-l-2 border-accent' : ''}`}>
       <div className="flex items-center gap-3">
          <div className={`w-1 h-1 rounded-full ${isWinner ? 'bg-accent' : 'bg-gray-700'}`} />
          <span className={`text-[10px] font-black uppercase ${isWinner ? 'text-white' : 'text-gray-500'}`}>{player?.username || "TBD"}</span>
       </div>
       <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded-sm border border-white/5 relative">
             <div className="flex items-center gap-1">
                <span className={`text-[9px] font-bold tabular-nums ${showL1Done ? 'text-white' : 'text-gray-600'}`}>
                   {score1 !== undefined ? score1 : (showL1Active ? <div className="w-1 h-1 bg-accent animate-pulse rounded-full"/> : '-')}
                </span>
                <div className="w-1 h-px bg-gray-700" />
                <span className={`text-[9px] font-bold tabular-nums ${showL2Done ? 'text-white' : 'text-gray-600'}`}>
                   {score2 !== undefined ? score2 : (showL2Active ? <div className="w-1 h-1 bg-accent animate-pulse rounded-full"/> : '-')}
                </span>
             </div>
          </div>
          <span className={`text-xs font-black italic tabular-nums w-4 text-right ${isWinner ? 'text-accent' : 'text-gray-300'}`}>{total}</span>
       </div>
    </div>
  );
}

function FinalNode({ final, players, allMatches }: { final: any, players: { [uid: string]: MatchPlayer }, allMatches?: Match[] }) {
   const winner = final.winner ? players[final.winner] : null;
   const p1 = players[final.p1];
   const p2 = players[final.p2];

   // Reconciliation for Finals
   const syncFromMatch = (mId: string | undefined, leg: number, round: string): { p1: number | undefined, p2: number | undefined, active: boolean, closed: boolean, submitted: boolean } => {
      if (!allMatches) return { p1: undefined, p2: undefined, active: false, closed: false, submitted: false };
      
      let found = allMatches.find(m => m.id === mId);

      // Neural Fallback
      if (!found) {
         found = allMatches.find(m => 
           m.round === round && 
           m.leg === leg && 
           m.playerIds?.includes(final.p1) && 
           m.playerIds?.includes(final.p2)
         );
      }

      if (!found) return { p1: undefined, p2: undefined, active: false, closed: false, submitted: false };
      
      const mP1 = found.players[final.p1]?.scoreFor ?? (found.players[final.p1] as any)?.kills;
      const mP2 = found.players[final.p2]?.scoreFor ?? (found.players[final.p2] as any)?.kills;
      
      return { 
        p1: mP1, 
        p2: mP2, 
        active: found.status === 'IN_PROGRESS' || found.status === 'READY' || found.status === 'WAITING_FOR_OPPONENT',
        closed: found.status === 'CLOSED' || found.status === 'COMPLETED' || found.status === 'RESOLVING',
        submitted: mP1 !== undefined || mP2 !== undefined
      };
   };

   const L1 = syncFromMatch(final.matchId1, 1, 'FINAL');
   const L2 = syncFromMatch(final.matchId2, 2, 'FINAL');

   const p1_L1 = L1.p1 !== undefined ? L1.p1 : (final.p1Goals_leg1 ?? 0);
   const p2_L1 = L1.p2 !== undefined ? L1.p2 : (final.p2Goals_leg1 ?? 0);
   const p1_L2 = L2.p1 !== undefined ? L2.p1 : (final.p1Goals_leg2 ?? 0);
   const p2_L2 = L2.p2 !== undefined ? L2.p2 : (final.p2Goals_leg2 ?? 0);
   
   const agg1 = (p1_L1 ?? 0) + (p1_L2 ?? 0);
   const agg2 = (p2_L1 ?? 0) + (p2_L2 ?? 0);

   return (
      <div className="bg-accent/5 border-2 border-accent shadow-[0_0_40px_rgba(0,255,102,0.1)] rounded-sm overflow-hidden group hover:scale-[1.01] transition-all">
         {winner ? (
            <div className="p-8 text-center animate-in zoom-in duration-700">
               <Trophy className="w-16 h-16 text-accent mx-auto mb-6 drop-shadow-[0_0_15px_rgba(0,255,102,0.5)]" />
               <h4 className="text-2xl font-black text-white uppercase italic mb-2 tracking-tighter">Champion Crowned</h4>
               <p className="text-accent font-black uppercase text-xs tracking-[0.4em]">{winner.username}</p>
            </div>
         ) : p1 && p2 ? (
            <div className="divide-y divide-white/10">
               <PlayerSlot player={p1} score1={p1_L1} score2={p1_L2} total={agg1} isWinner={false} l1Status={L1} l2Status={L2} />
               <PlayerSlot player={p2} score1={p2_L1} score2={p2_L2} total={agg2} isWinner={false} l1Status={L1} l2Status={L2} />
               <div className="bg-accent/10 px-3 py-2 text-center flex items-center justify-center gap-2">
                  <Activity className="w-3 h-3 text-accent animate-pulse" />
                  <span className="text-[8px] font-black text-accent uppercase italic">Grand Final: Aggregate Series Underway</span>
               </div>
            </div>
         ) : (
            <div className="p-8 opacity-30 flex flex-col items-center">
               <Swords className="w-12 h-12 text-gray-500 mb-4" />
               <p className="text-[10px] font-black uppercase tracking-[0.4em]">Final Staged</p>
            </div>
         )}
      </div>
   );
}

function BracketEmptyState({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="bg-surface/30 border border-dashed border-surface-border p-8 rounded-sm text-center">
           <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest italic">Awaiting Seeding</span>
        </div>
      ))}
    </div>
  );
}
