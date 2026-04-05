"use client";
import React from "react";
import { MatchPlayer, League } from "@/lib/match-service";
import { Trophy, ChevronUp, ChevronDown, ListOrdered } from "lucide-react";

interface LeagueStandingsProps {
  league: League;
}

export default function LeagueStandings({ league }: LeagueStandingsProps) {
  const isCODM = league.game === 'CODM';
  const themeColor = isCODM ? 'text-red-500' : 'text-accent';

  // Sort players by Points, then GD, then Wins
  const players = Object.values(league.players).sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    const aGD = (a.goalsFor || 0) - (a.goalsAgainst || 0);
    const bGD = (b.goalsFor || 0) - (b.goalsAgainst || 0);
    if (bGD !== aGD) return bGD - aGD;
    return (b.wins || 0) - (a.wins || 0);
  });

  const netPool = Math.floor((league.totalPool || 0) * 0.8);
  const isSplit = netPool >= 50000;

  return (
    <div className={`bg-surface border ${isCODM ? 'border-red-900/50' : 'border-surface-border'} rounded-sm overflow-hidden shadow-2xl relative`}>
      {isCODM && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      )}
      <div className="p-6 bg-black border-b border-surface-border flex justify-between items-center">
         <div className="flex items-center gap-3">
            <ListOrdered className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Competitive Standings</h3>
         </div>
         <div className="text-right">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Victory Grant</span>
            <span className="text-lg font-black text-accent italic tracking-tighter">{netPool} CR</span>
            {isSplit && (
              <div className="text-[9px] text-accent/60 font-bold uppercase tracking-widest mt-1 italic animate-pulse">75/25 Split Active</div>
            )}
         </div>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-gray-500 font-black border-b border-surface-border/50">
              <th className="p-4 text-center w-12">Rank</th>
              <th className="p-4">{isCODM ? 'Operator' : 'Champion'}</th>
              <th className="p-4 text-center">{isCODM ? 'GP' : 'P'}</th>
              <th className="p-4 text-center">W</th>
              {isCODM ? (
                <>
                  <th className="p-4 text-center">L</th>
                  <th className="p-4 text-center">Kills</th>
                  <th className="p-4 text-center">KD</th>
                </>
              ) : (
                <>
                  <th className="p-4 text-center">D</th>
                  <th className="p-4 text-center">L</th>
                  <th className="p-4 text-center">GD</th>
                </>
              )}
              <th className={`p-4 text-center bg-black/40 ${isCODM ? 'text-red-500' : 'text-accent'}`}>{isCODM ? 'RATING' : 'PTS'}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {players.map((p, idx) => {
              const rank = idx + 1;
              const isPrizeZone = rank <= (isSplit ? 2 : 1);
              
              // Game Specific Metrics
              const totalGames = (p.played || 0) || ((p.wins || 0) + (p.draws || 0) + (p.losses || 0));
              const gd = (p.goalsFor || 0) - (p.goalsAgainst || 0);
              const kd = p.losses ? ((p.wins || 0) * 1.5).toFixed(2) : (p.points || 0).toFixed(2); // Simulated KD until reporting active

              return (
                <tr key={p.uid} className={`border-b border-surface-border/30 hover:bg-black/60 transition-colors ${isPrizeZone ? (isCODM ? 'bg-red-500/5' : 'bg-accent/5') : ''}`}>
                  <td className="p-4 text-center">
                     <span className={`text-[11px] font-black italic ${rank === 1 ? (isCODM ? 'text-red-500' : 'text-accent') : rank === 2 && isSplit ? 'text-gray-400' : 'text-gray-600'}`}>
                        {rank.toString().padStart(2, '0')}
                     </span>
                  </td>
                  <td className="p-4">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-black border ${isCODM ? 'border-red-900/50' : 'border-surface-border'} rounded-sm flex items-center justify-center overflow-hidden rotate-45 shrink-0`}>
                           <div 
                             className="w-[200%] h-[200%] -rotate-45"
                             style={{
                               backgroundImage: `url('/avatar_collection.png')`,
                               backgroundSize: '400% 500%',
                               backgroundPosition: `${((p.avatarId || 0) % 4) * 33.33}% ${Math.floor((p.avatarId || 0) / 4) * 25}%`
                             }}
                           />
                        </div>
                        <div>
                           <div className={`font-black uppercase italic tracking-tight text-sm ${isPrizeZone ? 'text-white' : 'text-gray-400'}`}>
                             {p.username}
                           </div>
                           {rank === 1 && (
                             <div className={`flex items-center gap-1 text-[8px] ${isCODM ? 'text-red-500' : 'text-accent'} font-black uppercase tracking-widest mt-0.5`}>
                                <Trophy className="w-2 h-2" /> {isCODM ? 'Top Operative' : 'Current Leader'}
                             </div>
                           )}
                        </div>
                     </div>
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-gray-500">{totalGames}</td>
                  <td className="p-4 text-center font-mono font-bold text-gray-300">{p.wins || 0}</td>
                  
                  {isCODM ? (
                    <>
                      <td className="p-4 text-center font-mono font-bold text-gray-500">{p.losses || 0}</td>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{(p.wins || 0) * 12}</td>
                      <td className="p-4 text-center font-mono font-black text-accent">{kd}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-center font-mono font-bold text-gray-500">{p.draws || 0}</td>
                      <td className="p-4 text-center font-mono font-bold text-gray-500">{p.losses || 0}</td>
                      <td className={`p-4 text-center font-mono font-black ${gd > 0 ? 'text-accent' : gd < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {gd > 0 ? `+${gd}` : gd}
                      </td>
                    </>
                  )}

                  <td className={`p-4 text-center bg-black/40 font-black italic text-main text-base border-l ${isCODM ? 'border-red-900/50 text-red-500' : 'border-surface-border/50 text-accent'}`}>
                    {p.points || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-black/20 border-t border-surface-border flex justify-between items-center relative z-10">
         <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className={`w-3 h-3 ${isCODM ? 'text-red-500' : 'text-accent'}`} /> Neural standings synchronized with Operations Central
         </p>
         <div className="flex gap-4">
            <div className={`flex items-center gap-1.5 grayscale opacity-50 px-2 py-0.5 rounded-sm border ${isCODM ? 'border-red-900/50' : 'border-surface-border'}`}>
               <div className={`w-1.5 h-1.5 rounded-full ${isCODM ? 'bg-red-500' : 'bg-accent'}`} />
               <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Extraction Zone</span>
            </div>
         </div>
      </div>
    </div>
  );
}

// Minimal ShieldCheck stub for hydration safety
function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
