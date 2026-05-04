"use client";
import React from 'react';
import { Circuit, Match } from '@/lib/match-service';
import { X, Trophy, Swords, Target, Activity, ShieldCheck, ChevronRight, Users, Clock, Zap, Crown, ShieldAlert } from 'lucide-react';

interface Props {
  competition: Circuit;
  allMatches?: Match[];
  userUid?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TacticalMap({ competition, allMatches, userUid, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  // TACTICAL HELPER: Get dynamic round names based on tournament scale
  function getRoundTitle(roundKey: string, totalPlayers: number) {
    if (roundKey === 'FINAL') return "Grand Final";
    if (roundKey === 'SF') return "Semi-Finals";
    if (roundKey === 'QF') return "Quarter-Finals";
    
    const roundMapping: Record<string, number> = { 'QR1': 1, 'QR2': 2, 'QR3': 3, 'QR4': 4 };
    const idx = roundMapping[roundKey];
    if (idx) {
      const playersInRound = totalPlayers / Math.pow(2, idx - 1);
      return `Round of ${playersInRound}`;
    }
    return roundKey;
  }

  // Get all tournament matches sorted by creation time
  const tournamentMatches = allMatches?.filter(m => {
    return m.circuitId === competition.id && m.round;
  }).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)) || [];

  // Get all unique rounds present in the match data
  const availableRounds = Array.from(new Set(tournamentMatches.map(m => m.round || 'NONE')))
    .filter(r => r !== 'NONE')
    .sort((a, b) => {
       const order = ['LEAGUE', 'QR1', 'QR2', 'QR3', 'QR4', 'QF', 'SF', 'FINAL'];
       return order.indexOf(a) - order.indexOf(b);
    });

  const isLeague = competition.format?.includes('LEAGUE');
  const [activeRoundTab, setActiveRoundTab] = React.useState(isLeague ? 'LEAGUE' : (availableRounds[0] || 'QR1'));
  const [showAll, setShowAll] = React.useState(false);

  // Group matches by round for easy navigation
  const matchesByRound: Record<string, Match[]> = {};
  availableRounds.forEach(r => {
    matchesByRound[r] = tournamentMatches.filter(m => m.round === r);
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300 overflow-hidden">

      {/* Header Bar */}
      <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface/20">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent/20 border border-accent/40 rotate-45 flex items-center justify-center">
               <Target className="w-5 h-5 text-accent -rotate-45" />
            </div>
            <div>
               <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                  Full Tactical <span className="text-accent">Map</span>
               </h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] italic mt-1">
                  Sector: {competition.title} // Ops Status: {competition.status}
               </p>
            </div>
         </div>

         {/* PHASE NAVIGATOR: Essential for 128-player large-scale ops */}
         <div className="hidden lg:flex items-center bg-white/5 border border-white/10 p-1 rounded-sm gap-1">
            {availableRounds.map(r => (
               <button
                 key={r}
                 onClick={() => setActiveRoundTab(r)}
                 className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm ${
                   activeRoundTab === r ? 'bg-accent text-black' : 'text-gray-500 hover:text-white hover:bg-white/5'
                 }`}
               >
                 {getRoundTitle(r, competition.playerIds?.length || 16)}
               </button>
            ))}
         </div>

         <button
           onClick={onClose}
           className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-full transition-all group"
         >
            <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
         </button>
      </div>

      {/* Main Map Viewport - REMOVED FIXED WIDTH for Ultra-Wide Support */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-12 custom-scrollbar bg-[url('/img/tactical-grid.png')] bg-repeat">
         <div className="w-full space-y-24">

            {/* Mobile Phase Navigator */}
            <div className="lg:hidden flex overflow-x-auto pb-4 gap-2 no-scrollbar">
                {availableRounds.map(r => (
                  <button
                    key={r}
                    onClick={() => setActiveRoundTab(r)}
                    className={`shrink-0 px-6 py-3 text-[10px] font-black uppercase tracking-widest border rounded-sm ${
                      activeRoundTab === r ? 'bg-accent border-accent text-black' : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    {getRoundTitle(r, competition.playerIds?.length || 16)}
                  </button>
                ))}
            </div>

            {/* Dynamic Bracket Visualization */}
            <section className="space-y-12">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-xl font-black text-white italic uppercase tracking-widest flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                     {getRoundTitle(activeRoundTab, competition.playerIds?.length || 16)} Bracket
                  </h3>
                  
                  <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-sm">
                     <button 
                        onClick={() => setShowAll(false)}
                        className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-sm ${!showAll ? 'bg-accent text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                     >
                        My Missions
                     </button>
                     <button 
                        onClick={() => setShowAll(true)}
                        className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-sm ${showAll ? 'bg-accent text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                     >
                        All Sectors
                     </button>
                  </div>
               </div>

               <DynamicRoundGrid
                 roundKey={activeRoundTab}
                 matches={matchesByRound[activeRoundTab] || []}
                 competition={competition}
                 totalPlayers={competition.playerIds?.length || 16}
                 getRoundTitle={getRoundTitle}
                 showAll={showAll}
                 userUid={userUid}
               />

               {isLeague && activeRoundTab === 'LEAGUE' && (
                  <section className="space-y-8 animate-in fade-in duration-700">
                     <div className="flex items-center gap-6">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-widest shrink-0 flex items-center gap-3">
                           <Crown className="w-5 h-5 text-accent" />
                           Live League Standings
                        </h3>
                        <div className="h-px bg-white/5 flex-1" />
                     </div>
                     
                     <div className="bg-black border border-white/10 rounded-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                           <thead>
                              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                                 <th className="px-6 py-4">Rank</th>
                                 <th className="px-6 py-4">Operative</th>
                                 <th className="px-6 py-4 text-center">P</th>
                                 <th className="px-6 py-4 text-center">W</th>
                                 <th className="px-6 py-4 text-center">D</th>
                                 <th className="px-6 py-4 text-center">L</th>
                                 <th className="px-6 py-4 text-center">GD</th>
                                 <th className="px-6 py-4 text-center text-accent">PTS</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5">
                              {(Object.values((competition as any).standings || {}) as any[])
                                 .sort((a, b) => {
                                    if (b.pts !== a.pts) return b.pts - a.pts;
                                    return (b.gf - b.ga) - (a.gf - a.ga);
                                 })
                                 .map((p, idx) => (
                                 <tr key={p.uid} className={`text-xs font-bold uppercase transition-colors hover:bg-white/5 ${idx === 0 ? 'text-accent bg-accent/5' : 'text-gray-400'}`}>
                                    <td className="px-6 py-4 tabular-nums">#{idx + 1}</td>
                                    <td className="px-6 py-4 flex items-center gap-3">
                                       <div className="w-2 h-2 rounded-full bg-current" />
                                       {p.username}
                                    </td>
                                    <td className="px-6 py-4 text-center tabular-nums">{p.played}</td>
                                    <td className="px-6 py-4 text-center tabular-nums">{p.wins}</td>
                                    <td className="px-6 py-4 text-center tabular-nums">{p.draws}</td>
                                    <td className="px-6 py-4 text-center tabular-nums">{p.losses}</td>
                                    <td className="px-6 py-4 text-center tabular-nums">{p.gf - p.ga}</td>
                                    <td className="px-6 py-4 text-center tabular-nums text-accent font-black">{p.pts}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </section>
               )}
            </section>

            {/* Footer Branding */}
            <div className="flex justify-center pb-24">
               <div className="flex items-center gap-8 opacity-20">
                  <Swords className="w-8 h-8 text-white" />
                  <div className="w-px h-12 bg-white/20" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[1em] italic">High Stakes EFootball // Tactical Interface</h4>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
}

// Dynamic Round Grid Component
function DynamicRoundGrid({ 
   roundKey, 
   matches, 
   competition, 
   totalPlayers, 
   getRoundTitle,
   showAll,
   userUid
}: { 
   roundKey: string, 
   matches: Match[], 
   competition: Circuit, 
   totalPlayers: number,
   getRoundTitle: (r: string, t: number) => string,
   showAll: boolean,
   userUid?: string
}) {
   const isFinal = roundKey === 'FINAL';
   
   // TACTICAL FILTER: Filter matches by current user participation if not showing all
   const displayedMatches = showAll 
     ? matches 
     : matches.filter(m => m.playerIds?.includes(userUid || ''));

   return (
    <div className="space-y-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <StatusCard 
            title={showAll ? "Operational Progress" : "My Campaign Progress"}
            completed={displayedMatches.filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED').length}
            total={displayedMatches.length}
            icon={<Activity className="w-5 h-5" />}
            color="accent"
         />
         <div className="md:col-span-2 p-6 bg-white/5 border border-white/10 rounded-sm flex items-center justify-between">
            <div>
               <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 italic">Tactical Objective</h4>
               <p className="text-sm font-bold text-white uppercase italic">{getRoundTitle(roundKey, totalPlayers)}</p>
            </div>
            <div className="text-right">
               <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 italic">Arena Count</h4>
               <p className="text-sm font-bold text-accent uppercase italic">{displayedMatches.length} Sectors {showAll ? 'Active' : 'Assigned'}</p>
            </div>
         </div>
      </div>

      {displayedMatches.length === 0 ? (
         <div className="py-20 text-center bg-white/5 border border-white/5 border-dashed rounded-sm">
            <ShieldAlert className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">No active missions assigned in this sector.</p>
            <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-2">Toggle "All Sectors" to observe global operations.</p>
         </div>
      ) : (
         <div className={`grid gap-4 ${
           displayedMatches.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' :
           displayedMatches.length <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
           'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-8'
         }`}>
           {displayedMatches.map((m, i) => (
             <MatchCard 
               key={m.id || i}
               match={m}
               competition={competition}
               matchNumber={showAll ? (matches.findIndex(original => original.id === m.id) + 1) : (i + 1)}
               isFinal={isFinal}
             />
           ))}
         </div>
      )}
    </div>
   );
}

// Individual Match Card (Redesigned for Premium High-Density Screens)
function MatchCard({ match, competition, matchNumber, isFinal }: { match: Match; competition: Circuit; matchNumber: number; isFinal?: boolean }) {
  if (!match) {
    return (
      <div className="bg-black/40 border border-white/5 rounded-sm p-6 text-center min-h-[160px] flex flex-col items-center justify-center">
        <Clock className="w-6 h-6 text-gray-700 mb-2" />
        <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest leading-none">Arena #{matchNumber}</p>
        <p className="text-[8px] text-gray-700 font-bold uppercase italic mt-1">Awaiting Intel</p>
      </div>
    );
  }

  const players = Object.values(match.players || {});
  const p1 = players[0];
  const p2 = players[1];
  const isCompleted = match.status === 'CLOSED' || match.status === 'COMPLETED';
  const isActive = match.status === 'IN_PROGRESS' || match.status === 'READY';

  let winner: any = null;
  if (isCompleted && p1 && p2) {
    const s1 = p1.scoreFor || 0;
    const s2 = p2.scoreFor || 0;
    winner = s1 > s2 ? p1 : (s2 > s1 ? p2 : null);
  }

  return (
    <div className={`group relative p-5 bg-black border rounded-sm transition-all duration-300 ${
      isFinal ? 'border-accent/40 shadow-[0_0_30px_rgba(0,255,102,0.1)]' : 
      isCompleted ? 'border-white/5 opacity-80' : 
      isActive ? 'border-accent/60 animate-pulse' : 'border-white/10'
    } hover:border-accent/40`}>
      
      <div className="flex items-center justify-between mb-5">
         <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Arena #{matchNumber}</span>
         <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-sm ${
           isActive ? 'bg-accent text-black' : isCompleted ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
         }`}>
           {match.status}
         </span>
      </div>

      <div className="space-y-3">
        {[p1, p2].map((p, idx) => {
          const isWinner = winner?.uid === p?.uid;
          return (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-sm border transition-all ${
              isWinner ? 'bg-accent/10 border-accent/20' : 'bg-white/5 border-white/5'
            }`}>
               <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${isWinner ? 'bg-accent shadow-[0_0_8px_#00ff66]' : 'bg-gray-700'}`} />
                  <span className={`text-[10px] font-black italic uppercase truncate max-w-[120px] ${isWinner ? 'text-accent' : 'text-gray-300'}`}>
                    {p?.username || 'TBD'}
                  </span>
               </div>
               <span className={`text-[11px] font-black italic tabular-nums ${isWinner ? 'text-accent' : 'text-gray-500'}`}>
                 {p?.scoreFor || 0}
               </span>
            </div>
          );
        })}
      </div>


      {isCompleted && winner && (
        <div className="mt-4 flex items-center justify-center gap-2 opacity-40">
           <Trophy className="w-3 h-3 text-accent" />
           <span className="text-[8px] font-black text-accent uppercase tracking-widest">Victory Authenticated</span>
        </div>
      )}

      {isCompleted && !winner && (
        <div className="mt-4 flex items-center justify-center gap-2 opacity-50">
           <ShieldAlert className="w-3 h-3 text-yellow-500" />
           <span className="text-[8px] font-black text-yellow-500 uppercase tracking-widest">Tie Detected</span>
        </div>
      )}
    </div>
  );
}

function StatusCard({ title, completed, total, icon, color }: { title: string; completed: number; total: number; icon: any; color: string }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
     <div className="p-6 bg-white/5 border border-white/10 rounded-sm">
        <div className="flex items-center justify-between mb-4">
           <div className="p-2 bg-white/5 rounded-sm text-accent">{icon}</div>
           <span className="text-xl font-black text-white italic tabular-nums tracking-tighter">{completed}/{total}</span>
        </div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 italic">{title}</p>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
           <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
     </div>
  );
}
