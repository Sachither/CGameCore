"use client";
import React from 'react';
import { X, Trophy, Target, Crown } from 'lucide-react';

interface Props {
  title: string;
  standings: Record<string, any>;
  isOpen: boolean;
  onClose: () => void;
}

export default function LeagueStandingsModal({ title, standings, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const sortedStandings = Object.values(standings || {}).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return (b.gf - b.ga) - (a.gf - a.ga);
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-white/10 w-full max-w-2xl rounded-sm shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-accent/20 border border-accent/40 rotate-45 flex items-center justify-center">
                <Target className="w-5 h-5 text-accent -rotate-45" />
             </div>
             <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Final Standings</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">{title}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Table Body */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
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
               {sortedStandings.length > 0 ? sortedStandings.map((p, idx) => (
               <tr key={p.uid} className={`text-[11px] font-bold uppercase transition-colors hover:bg-white/5 ${idx === 0 ? 'text-accent bg-accent/5' : 'text-gray-400'}`}>
                  <td className="px-6 py-4 tabular-nums flex items-center gap-2">
                    #{idx + 1}
                    {idx === 0 && <Crown className="w-3 h-3 text-accent" />}
                  </td>
                  <td className="px-6 py-4">{p.username}</td>
                  <td className="px-6 py-4 text-center tabular-nums">{p.played}</td>
                  <td className="px-6 py-4 text-center tabular-nums">{p.wins}</td>
                  <td className="px-6 py-4 text-center tabular-nums">{p.draws}</td>
                  <td className="px-6 py-4 text-center tabular-nums">{p.losses}</td>
                  <td className="px-6 py-4 text-center tabular-nums">{p.gf - p.ga}</td>
                  <td className="px-6 py-4 text-center tabular-nums text-accent font-black">{p.pts}</td>
               </tr>
               )) : (
                <tr>
                   <td colSpan={6} className="px-6 py-20 text-center text-gray-500 text-[10px] font-black uppercase tracking-widest italic opacity-50">
                      No group or league standings recorded for this mission phase.
                   </td>
                </tr>
               )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/5 flex justify-between items-center">
           <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Archived Mission Data</span>
           </div>
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-[10px] rounded-sm transition-all"
           >
             CLOSE SNAPSHOT
           </button>
        </div>
      </div>
    </div>
  );
}
