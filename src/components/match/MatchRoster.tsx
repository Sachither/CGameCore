import { Match } from "@/lib/match-service";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export default function MatchRoster({ 
  match, 
  currentUserUid 
}: { 
  match: Match, 
  currentUserUid?: string 
}) {
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  if (!match) return null;

  const handleCopy = (uid: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };
  
  // Gathering lobbies have format='league' or 'tournament' and maxPlayers > 2.
  // Standard duels spawned from them will evaluate to maxPlayers=2.
  const isGatheringLobby = (match.format === 'league' || match.format === 'tournament') && (match.maxPlayers || 2) > 2;
  const is1v1 = !isGatheringLobby;
  const players = match.players || {};
  const playerList = Object.values(players);
  
  // Sort so current user is always p1, otherwise just take indexes
  const sortedPlayers = [...playerList].sort((a, b) => {
    if (a.uid === currentUserUid) return -1;
    if (b.uid === currentUserUid) return 1;
    return 0;
  });

  const p1 = sortedPlayers[0];
  const p2 = sortedPlayers[1];

  // Helper to render avatar sprite
  const renderAvatar = (avatarId: number, isMe: boolean) => {
    const x = (avatarId % 4) * 33.33;
    const y = Math.floor(avatarId / 4) * 25;
    return (
      <div className={`w-16 h-16 bg-surface-hover border ${isMe ? 'border-accent' : 'border-surface-border'} rounded-[3px] mb-3 rotate-45 flex items-center justify-center mt-2 group-hover:scale-110 transition-transform overflow-hidden`}>
         <div 
           className="w-[200%] h-[200%] -rotate-45"
           style={{
             backgroundImage: `url('/avatar_collection.png')`,
             backgroundSize: '400% 500%',
             backgroundPosition: `${x}% ${y}%`
           }}
         />
      </div>
    );
  };

  return (
    <div className="bg-surface border border-surface-border rounded-[5px] shadow-2xl overflow-hidden flex flex-col h-full max-h-[600px] lg:max-h-full">
      <div className="bg-black border-b border-surface-border p-4 flex items-center justify-between shrink-0">
         <h3 className="text-sm font-black italic uppercase tracking-widest text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Active Roster
         </h3>
         <span className="text-[10px] bg-surface-hover border border-surface-border text-gray-400 font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest">
            {match.format}
         </span>
      </div>

      <div className="p-8 overflow-y-auto custom-scrollbar flex-1 relative">
         
         {/* 1v1 View */}
         {is1v1 && (
           <div className="space-y-12 max-w-sm mx-auto">
               {/* P1 (Me or Host) */}
               <div className="relative group">
                  <div className="absolute inset-0 bg-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-full"></div>
                  <div className="bg-black border border-accent/50 p-6 rounded-[3px] flex flex-col items-center text-center relative z-10 shadow-[0_0_15px_rgba(0,255,102,0.1)]">
                     <span className="text-[10px] text-accent font-black uppercase tracking-widest absolute top-3 left-3 italic">Player A</span>
                     {p1 ? renderAvatar(p1.avatarId, p1.uid === currentUserUid) : <div className="w-16 h-16 bg-surface-hover border border-surface-border rounded-[3px] mb-3 rotate-45" />}
                     <div className="text-white font-black italic uppercase tracking-tighter text-xl mt-2">{p1?.username || "Awaiting..."}</div>
                     {p1?.inGameName && (
                        <div className="flex items-center gap-2 mt-1 bg-white/5 border border-white/10 px-2 py-1 rounded-[2px] hover:bg-white/10 transition-colors cursor-pointer group/copy" onClick={() => handleCopy(p1.uid, p1.inGameName!)}>
                           <span className="text-[10px] text-gray-400 font-mono tracking-widest">{p1.inGameName}</span>
                           {copiedUid === p1.uid ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3 text-gray-500 group-hover/copy:text-white" />}
                        </div>
                     )}
                     {p1 ? (
                        <div className={`text-[10px] font-black uppercase tracking-widest mt-2 px-3 py-1 rounded-sm border ${p1.ready ? 'bg-accent/10 text-accent border-accent/20' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                           {p1.ready ? 'READY' : 'WAITING'}
                        </div>
                     ) : (
                        <div className="text-[10px] font-black uppercase tracking-widest mt-2 px-3 py-1 rounded-sm border bg-white/5 text-gray-600 border-white/10">EMPTY</div>
                     )}
                  </div>
               </div>

              <div className="flex justify-center -my-6 relative z-20">
                 <div className="bg-surface border border-surface-border px-5 py-2 rounded-[3px] text-sm font-black uppercase text-gray-400 italic tracking-widest shadow-2xl -rotate-12">VS</div>
              </div>

               {/* P2 (Opponent) */}
               <div className="relative group">
                  <div className="absolute inset-0 bg-red-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-full"></div>
                  <div className="bg-black border border-surface-border hover:border-red-500/30 p-6 rounded-[3px] flex flex-col items-center text-center relative z-10 transition-colors">
                     <span className="text-[10px] text-red-500/50 font-black uppercase tracking-widest absolute top-3 right-3 italic">Player B</span>
                     {p2 ? (
                       <>
                         {renderAvatar(p2.avatarId, p2.uid === currentUserUid)}
                         <div className="text-white font-black italic uppercase tracking-tighter text-xl mt-2">{p2.username}</div>
                         {p2.inGameName && (
                            <div className="flex items-center gap-2 mt-1 bg-white/5 border border-white/10 px-2 py-1 rounded-[2px] hover:bg-white/10 transition-colors cursor-pointer group/copy" onClick={() => handleCopy(p2.uid, p2.inGameName!)}>
                               <span className="text-[10px] text-gray-400 font-mono tracking-widest">{p2.inGameName}</span>
                               {copiedUid === p2.uid ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3 text-gray-500 group-hover/copy:text-white" />}
                            </div>
                         )}
                         <div className={`text-[10px] font-black uppercase tracking-widest mt-2 px-3 py-1 rounded-sm border ${p2.ready ? 'bg-accent/10 text-accent border-accent/20' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                           {p2.ready ? 'READY' : 'WAITING'}
                        </div>
                       </>
                     ) : (
                       <div className="py-10 animate-pulse">
                          <div className="w-16 h-16 bg-surface-hover border border-surface-border border-dashed rounded-[3px] mb-3 rotate-45 flex items-center justify-center mx-auto" />
                          <div className="text-gray-600 font-bold uppercase tracking-widest text-[10px]">Awaiting Join...</div>
                       </div>
                     )}
                  </div>
               </div>
           </div>
         )}

         {/* Multi-Player List (FFA / 5v5 / BR) */}
         {!is1v1 && (
            <div className="grid grid-cols-1 gap-3">
               {playerList.map((p, idx) => {
                 const isMe = p.uid === currentUserUid;
                 return (
                  <div 
                    key={p.uid} 
                    className={`bg-black border ${isMe ? 'border-accent shadow-[0_0_15px_rgba(0,255,102,0.1)]' : 'border-surface-border'} p-4 rounded-[3px] flex items-center gap-4 relative group hover:border-accent/30 transition-all`}
                  >
                    <div className="absolute top-2 right-2 text-[8px] font-black italic text-sub opacity-30">#{idx + 1}</div>
                    
                    {/* Compact Avatar */}
                    <div className={`w-10 h-10 bg-surface-hover border ${isMe ? 'border-accent' : 'border-surface-border'} rounded-[3px] rotate-45 flex items-center justify-center shrink-0 overflow-hidden`}>
                       <div 
                         className="w-[200%] h-[200%] -rotate-45"
                         style={{
                           backgroundImage: `url('/avatar_collection.png')`,
                           backgroundSize: '400% 500%',
                           backgroundPosition: `${(p.avatarId % 4) * 33.33}% ${Math.floor(p.avatarId / 4) * 25}%`
                         }}
                       />
                    </div>

                    <div className="flex-1 min-w-0">
                       <div className="text-white font-black italic uppercase tracking-tighter text-sm truncate group-hover:text-accent transition-colors">
                          {p.username}
                          {isMe && <span className="ml-2 text-accent text-[8px] not-italic">(YOU)</span>}
                       </div>
                       {p.inGameName && (
                           <div className="flex items-center gap-2 mt-1 mb-1 w-fit bg-white/5 border border-white/10 px-2 py-0.5 rounded-[2px] hover:bg-white/10 transition-colors cursor-pointer group/copy" onClick={() => handleCopy(p.uid, p.inGameName!)}>
                              <span className="text-[9px] text-gray-400 font-mono tracking-widest">{p.inGameName}</span>
                              {copiedUid === p.uid ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3 text-gray-500 group-hover/copy:text-white" />}
                           </div>
                       )}
                       <div className={`text-[8px] font-black uppercase tracking-widest mt-1 w-fit px-2 py-0.5 rounded-[1px] border ${p.ready ? 'bg-accent/10 text-accent border-accent/20' : 'bg-white/5 text-gray-500 border-white/10'}`}>
                          {p.ready ? 'READY' : 'WAITING'}
                       </div>
                    </div>
                  </div>
                 );
               })}

               {/* Empty Slots Placeholder for FFA */}
               {match.format === 'FFA' && playerList.length < (match.maxPlayers || 8) && (
                 Array.from({ length: (match.maxPlayers || 8) - playerList.length }).map((_, i) => (
                   <div key={`empty-${i}`} className="bg-black/20 border border-surface-border border-dashed p-4 rounded-[3px] flex items-center gap-4 opacity-40">
                      <div className="w-10 h-10 border border-surface-border border-dashed rounded-[3px] rotate-45 shrink-0" />
                      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 italic">Scanning for Operative...</div>
                   </div>
                 ))
               )}
            </div>
         )}
      </div>
    </div>
  );
}
