"use client";
import React from 'react';
import { Circuit } from '@/lib/match-service';
import { Trophy, Users, Star } from 'lucide-react';

interface Props {
  circuit: Circuit;
}

export default function CircuitGroups({ circuit }: Props) {
  if (!circuit.groups) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Object.entries(circuit.groups).map(([gKey, group]) => (
        <div key={gKey} className="bg-surface border border-surface-border rounded-sm overflow-hidden group hover:border-accent/40 transition-all">
          <div className="bg-accent/5 px-4 py-3 border-b border-surface-border flex justify-between items-center">
            <h3 className="text-xs font-black text-accent uppercase tracking-widest italic flex items-center gap-2">
              <Users className="w-3 h-3" /> Group {gKey}
            </h3>
            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Top 2 Qualify</span>
          </div>

          <div className="p-4">
             <table className="w-full">
                <thead>
                   <tr className="text-[8px] text-gray-600 font-black uppercase tracking-widest border-b border-surface-border/50 text-left">
                      <th className="py-2">Operative</th>
                      <th className="py-2 text-center">P</th>
                      <th className="py-2 text-center">GD</th>
                      <th className="py-2 text-right">PTS</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/30">
                   {Object.entries(group.standings)
                    .sort((a: any, b: any) => (b[1].pts - a[1].pts) || ((b[1].gf - b[1].ga) - (a[1].gf - a[1].ga)))
                    .map(([uid, stats], idx) => {
                      const player = circuit.players[uid];
                      const gd = stats.gf - stats.ga;
                      const isQualifying = idx < 2;

                      return (
                        <tr key={uid} className={`text-[10px] ${isQualifying ? 'text-white' : 'text-gray-500'} font-bold`}>
                           <td className="py-3 flex items-center gap-2">
                              <span className={`w-1 h-1 rounded-full ${isQualifying ? 'bg-accent shadow-[0_0_5px_rgba(0,255,102,0.5)]' : 'bg-gray-700'}`} />
                              <span className="truncate max-w-[80px]">{player?.username || "Unknown"}</span>
                              {idx === 0 && <Star className="w-2 h-2 text-accent" />}
                           </td>
                           <td className="py-3 text-center opacity-60 tabular-nums">{stats.played}</td>
                           <td className="py-3 text-center opacity-60 tabular-nums">{gd > 0 ? `+${gd}` : gd}</td>
                           <td className={`py-3 text-right tabular-nums ${isQualifying ? 'text-accent' : ''}`}>{stats.pts}</td>
                        </tr>
                      );
                    })}
                </tbody>
             </table>
          </div>
        </div>
      ))}
    </div>
  );
}
