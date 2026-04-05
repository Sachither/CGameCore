const MatchNode = ({ player1, player2, p1Score, p2Score, isLive }: { player1: string, player2: string, p1Score?: number, p2Score?: number, isLive?: boolean }) => (
  <div className={`relative w-48 bg-black border ${isLive ? 'border-accent shadow-[0_0_10px_rgba(0,255,102,0.3)]' : 'border-surface-border'} rounded-[5px] overflow-hidden`}>
    {isLive && <div className="absolute top-0 left-0 w-full h-0.5 bg-accent"></div>}
    
    <div className="flex justify-between items-center p-2.5 border-b border-surface-border/50">
       <span className="text-xs font-bold text-gray-300 truncate pr-2">{player1}</span>
       <span className={`text-xs font-mono font-bold ${p1Score !== undefined && p1Score > (p2Score || 0) ? 'text-accent' : 'text-gray-500'}`}>{p1Score ?? '-'}</span>
    </div>
    
    <div className="flex justify-between items-center p-2.5">
       <span className="text-xs font-bold text-gray-300 truncate pr-2">{player2}</span>
       <span className={`text-xs font-mono font-bold ${p2Score !== undefined && p2Score > (p1Score || 0) ? 'text-accent' : 'text-gray-500'}`}>{p2Score ?? '-'}</span>
    </div>
  </div>
);

export default function TournamentBracket() {
  return (
    <div className="bg-surface border border-surface-border rounded-[5px] p-6 lg:p-8 shadow-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Live Bracket (Quarterfinals)</h2>
        <div className="bg-black border border-surface-border px-3 py-1.5 rounded-[5px] text-xs font-mono text-gray-500">
           Updated: <span className="text-white">Just now</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="min-w-max flex items-center h-full py-4 space-x-12 relative">
           
           {/* Quarter Finals */}
           <div className="flex flex-col space-y-8 relative z-10">
              <MatchNode player1="GhostRider99" player2="TrexSnipe" p1Score={2} p2Score={0} />
              <MatchNode player1="Sampaio" player2="LagosBoy" p1Score={1} p2Score={3} />
              <MatchNode player1="KanoKing" player2="AbujaPro" />
              <MatchNode player1="TBD" player2="TBD" />
           </div>

           {/* Connector Lines for Semis */}
           <div className="absolute left-[12rem] top-0 bottom-0 w-12 hidden md:block z-0 pointer-events-none">
              {/* Path 1 */}
              <div className="absolute top-[4.5rem] left-0 w-6 border-t-2 border-r-2 border-surface-border rounded-tr-md h-[4rem]"></div>
              <div className="absolute top-[8.5rem] left-0 w-6 border-b-2 border-r-2 border-surface-border rounded-br-md h-[4rem]"></div>
              <div className="absolute top-[8.5rem] left-6 w-6 border-t-2 border-surface-border"></div>
              
              {/* Path 2 */}
              <div className="absolute top-[18.2rem] left-0 w-6 border-t-2 border-r-2 border-surface-border rounded-tr-md h-[4rem]"></div>
              <div className="absolute top-[22.2rem] left-0 w-6 border-b-2 border-r-2 border-surface-border rounded-br-md h-[4rem]"></div>
              <div className="absolute top-[22.2rem] left-6 w-6 border-t-2 border-surface-border"></div>
           </div>

           {/* Semi Finals */}
           <div className="flex flex-col space-y-[6rem] relative z-10">
              <MatchNode player1="GhostRider99" player2="LagosBoy" isLive />
              <MatchNode player1="TBD" player2="TBD" />
           </div>

           {/* Connector Lines for Finals */}
           <div className="absolute left-[27rem] top-0 bottom-0 w-12 hidden lg:block z-0 pointer-events-none">
              <div className="absolute top-[8.5rem] left-0 w-6 border-t-2 border-r-2 border-surface-border rounded-tr-md h-[6.8rem]"></div>
              <div className="absolute top-[15.3rem] left-0 w-6 border-b-2 border-r-2 border-surface-border rounded-br-md h-[7rem]"></div>
              <div className="absolute top-[15.3rem] left-6 w-6 border-t-2 border-surface-border"></div>
           </div>

           {/* Finals */}
           <div className="flex flex-col justify-center relative z-10">
              <div className="mb-2 text-center text-[10px] text-accent font-bold uppercase tracking-widest animate-pulse">Grand Final • 1,400 Coins</div>
              <MatchNode player1="TBD" player2="TBD" />
           </div>
           
        </div>
      </div>
    </div>
  );
}
