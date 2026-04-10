"use client";
import React from "react";
import { Match, MatchPlayer } from "@/lib/match-service";
import { Swords, Map, ShieldAlert, Target, Zap, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface MyCombatScheduleProps {
  leagueId: string;
  game: 'CODM' | 'EFOOTBALL';
  matches: Match[];
  currentUid: string;
}

export default function MyCombatSchedule({ leagueId, game, matches, currentUid }: MyCombatScheduleProps) {
  const router = useRouter();
  const isCODM = game === 'CODM';

  // Find the next active match for this specific user
  const myNextMatch = matches.find(m => 
    m.playerIds?.includes(currentUid) && 
    (m.status === 'WAITING' || m.status === 'READY' || m.status === 'IN_PROGRESS')
  );

  if (!myNextMatch) {
    return (
      <div className="bg-surface border border-dashed border-surface-border p-10 rounded-sm text-center">
         <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
            <Zap className="w-5 h-5 text-gray-500" />
         </div>
         <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1 italic">No Active Directives</h4>
         <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Awaiting match assignment from Command Central.</p>
      </div>
    );
  }

  // Identify the opponent
  const opponentUid = myNextMatch.playerIds?.find(id => id !== currentUid);
  const opponent: MatchPlayer | undefined = opponentUid ? myNextMatch.players[opponentUid] : undefined;
  
  const statusColors = {
    'WAITING': 'text-gray-500 border-gray-500/20 bg-gray-500/5',
    'READY': 'text-accent border-accent/20 bg-accent/5 animate-pulse',
    'IN_PROGRESS': 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5',
    'RESOLVING': 'text-blue-500 border-blue-500/20 bg-blue-500/5'
  };

  return (
    <div className={`group relative bg-surface border ${isCODM ? 'border-red-900/50' : 'border-surface-border'} rounded-sm overflow-hidden shadow-2xl`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${isCODM ? 'bg-red-600' : 'bg-accent'}`} />
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-8">
           <div>
              <div className="flex items-center gap-2 mb-1">
                 <ShieldAlert className={`w-3.5 h-3.5 ${isCODM ? 'text-red-500' : 'text-accent'}`} />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Active Mission Directive</span>
              </div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Immediate Combat Requirement</p>
           </div>
           <div className={`px-2 py-0.5 rounded-sm border text-[8px] font-black uppercase tracking-widest ${statusColors[myNextMatch.status as keyof typeof statusColors] || statusColors['WAITING']}`}>
              {myNextMatch.status}
           </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-8 bg-black/40 p-6 rounded-sm border border-surface-border/50 mb-8">
           {/* Current User */}
           <div className="text-center">
              <div className="w-16 h-16 bg-surface border border-surface-border rounded-sm rotate-45 flex items-center justify-center overflow-hidden mx-auto mb-4">
                 <div className="w-[160%] h-[160%] -rotate-45 bg-[url('/avatar_collection.png')] bg-[length:400%_500%]" />
              </div>
              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">You</div>
           </div>

           <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-black text-accent-aware opacity-20 uppercase tracking-[0.5em] italic">VS</div>
              <Swords className={`w-6 h-6 ${isCODM ? 'text-red-500' : 'text-accent'} opacity-40`} />
           </div>

           {/* Opponent */}
           <div className="text-center">
              <div className={`w-16 h-16 bg-black border ${isCODM ? 'border-red-600/40' : 'border-accent/40'} rounded-sm rotate-45 flex items-center justify-center overflow-hidden mx-auto mb-4 animate-in fade-in duration-1000`}>
                 {opponent ? (
                    <div 
                      className="w-[160%] h-[160%] -rotate-45"
                      style={{
                        backgroundImage: `url('/avatar_collection.png')`,
                        backgroundSize: '400% 500%',
                        backgroundPosition: `${((opponent.avatarId || 0) % 4) * 33.33}% ${Math.floor((opponent.avatarId || 0) / 4) * 25}%`
                      }}
                    />
                 ) : (
                    <div className="w-full h-full -rotate-45 flex items-center justify-center text-gray-800">?</div>
                 )}
              </div>
              <div className={`text-[10px] font-black ${opponent ? 'text-white' : 'text-gray-700'} uppercase tracking-widest`}>
                {opponent?.username || "Scanning..."}
              </div>
           </div>
        </div>

        {/* Intelligence Data Points */}
        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-black/20 p-3 rounded-sm border border-surface-border/30">
              <div className="flex items-center gap-2 mb-1 opacity-60">
                 {isCODM ? <Map className="w-3 h-3" /> : <Target className="w-3 h-3" />}
                 <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{isCODM ? 'Battleground' : 'Match Rules'}</span>
              </div>
              <div className="text-[10px] font-black text-white uppercase italic">
                 {isCODM ? 'Crash - S&D' : 'Standard 1v1'}
              </div>
           </div>
           <div className="bg-black/20 p-3 rounded-sm border border-surface-border/30">
              <div className="flex items-center gap-2 mb-1 opacity-60">
                 <Zap className="w-3 h-3" />
                 <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Authorized Stakes</span>
              </div>
              <div className="text-[10px] font-black text-accent italic uppercase">
                 League Credit Entry
              </div>
           </div>
        </div>

        <button 
           onClick={() => router.push(`/match/${myNextMatch.id}`)}
           className={`w-full py-4 ${isCODM ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 'bg-accent hover:bg-accent-hover shadow-accent/20'} text-black font-black uppercase tracking-[0.3em] text-[10px] italic rounded-sm transition-all shadow-xl active:scale-95 group flex items-center justify-center gap-2`}
        >
           Deploy to Combat Zone
           <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
