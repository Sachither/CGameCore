export default function ChampionPodium({ topUsers }: { topUsers: any[] }) {
  const PodiumCard = ({ rank, user, height, colorClass, highlight }: any) => {
    if (!user) {
      return (
        <div className={`flex flex-col items-center justify-end ${height} w-[32%] md:w-1/3 opacity-30 px-1 grayscale blur-[0.5px]`}>
           <div className="absolute -top-10 flex flex-col items-center">
              <span className="text-[10px] font-black text-sub uppercase tracking-[0.3em]">{rank === '2' ? '2ND' : '3RD'}</span>
           </div>
           <div className={`w-14 h-14 bg-black border border-surface-border rotate-45 mb-10 flex items-center justify-center opacity-60 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
              <div className="-rotate-45 relative z-10 text-lg font-black italic text-accent shadow-[0_0_10px_rgba(0,255,102,0.3)]">#{rank}</div>
           </div>
           <div className={`w-full bg-gradient-to-t ${colorClass} border border-surface-border rounded-t-sm p-4 h-full flex flex-col items-center justify-center`}>
              <div className="text-[10px] font-black text-sub uppercase tracking-[0.2em] animate-pulse">Recruiting...</div>
           </div>
        </div>
      );
    }

    const winRate = user.totalMatches ? Math.round((user.totalWins / user.totalMatches) * 100) : 0;
    const formattedWon = (user.balanceCoins || 0).toLocaleString();

    return (
      <div className={`flex flex-col items-center justify-end ${height} w-[32%] md:w-1/3 relative group px-0.5 md:px-1`}>
        {/* Animated Ambient Light for Rank 1 */}
        {highlight ? (
          <div className="absolute top-0 w-48 h-48 bg-accent/10 blur-[80px] rounded-full pointer-events-none animate-pulse" />
        ) : (
          <div className="absolute -top-10 flex flex-col items-center opacity-60">
             <span className="text-[10px] font-black text-sub uppercase tracking-[0.3em]">{rank === '2' ? '2ND' : '3RD'}</span>
          </div>
        )}

        {/* Rank 1 Crown */}
        {highlight && (
          <div className="absolute -top-12 z-30 animate-bounce">
            <svg className="w-10 h-10 text-accent filter drop-shadow-[0_0_10px_rgba(0,255,102,0.8)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
            </svg>
          </div>
        )}

        {/* Diagonal Geometric Avatar */}
        <div className={`w-16 h-16 md:w-20 md:h-20 bg-black border-2 ${highlight ? 'border-accent shadow-[0_0_20px_rgba(0,255,102,0.4)] scale-110' : 'border-surface-border'} rotate-45 mb-10 flex items-center justify-center group-hover:-translate-y-4 transition-transform z-20 overflow-hidden`}>
          <div className="-rotate-45 relative w-full h-full flex items-center justify-center">
             <div 
                className="absolute inset-0 scale-150 grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100"
                style={{
                  backgroundImage: `url('/avatar_collection.png')`,
                  backgroundSize: '400% 500%',
                  backgroundPosition: `${((user.avatarId || 0) % 4) * 33.33}% ${Math.floor((user.avatarId || 0) / 4) * 25}%`
                }}
             />
             <div className="relative z-10 text-xl font-black italic text-white drop-shadow-md">{rank}</div>
          </div>
        </div>

        {/* Structured Geometric Block */}
        <div className={`w-full bg-gradient-to-t ${colorClass} border border-surface-border rounded-t-sm p-2 md:p-4 relative z-10 flex flex-col items-center pb-8 pt-6 md:pt-10 shadow-2xl transition-all h-full`}>
          <div className="text-xs md:text-2xl font-black text-main italic tracking-tight uppercase mb-2 text-center truncate w-full px-1">{user.username}</div>

          <div className="bg-surface-hover border border-surface-border px-3 py-1.5 rounded-[3px] flex items-center gap-2 mb-4">
            <span className={`w-1.5 h-1.5 rounded-full ${winRate > 60 ? 'bg-accent animate-pulse' : 'bg-sub'}`}></span>
            <span className="text-[10px] font-mono text-sub font-bold uppercase tracking-widest">{winRate}% WR</span>
          </div>

          <div className="text-main font-black tracking-wider text-2xl font-mono mt-auto pt-4 border-t border-surface-border/50 w-full text-center">
            {user.totalWins || 0} <span className="text-[10px] text-accent uppercase font-sans tracking-widest mb-1 block mt-1">Total Wins</span>
          </div>
        </div>
      </div>
    );
  };

  const rank1 = topUsers[0];
  const rank2 = topUsers[1];
  const rank3 = topUsers[2];

  return (
    <div className="w-full flex items-end justify-center h-[34rem] mt-16 md:mt-24 border-b border-surface-border px-2 md:px-0 relative overflow-hidden">
      {/* Background Graphic Grid */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Rank 2 */}
      <PodiumCard
        rank="2"
        user={rank2}
        height="h-[60%]"
        colorClass="from-surface via-surface-hover to-surface"
      />

      {/* Rank 1 */}
      <PodiumCard
        rank="1"
        user={rank1}
        height="h-[90%]"
        colorClass="from-surface via-accent/5 to-surface border-t-accent"
        highlight={true}
      />

      {/* Rank 3 */}
      <PodiumCard
        rank="3"
        user={rank3}
        height="h-[60%]"
        colorClass="from-surface via-surface-hover to-surface"
      />
    </div>
  );
}
