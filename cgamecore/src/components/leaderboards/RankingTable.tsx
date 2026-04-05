export default function RankingTable({ users, searchQuery, activeFilter }: { users: any[], searchQuery: string, activeFilter: string }) {
  const filteredPlayers = users.map(p => {
    // Map categorical stats based on active filter
    let displayWins = p.totalWins || 0;
    let displayMatches = p.totalMatches || 0;
    
    if (activeFilter === 'CODM') {
      displayWins = p.stats?.CODM?.wins || 0;
      displayMatches = p.stats?.CODM?.matches || 0;
    } else if (activeFilter === 'eFootball') {
      displayWins = p.stats?.EFOOTBALL?.wins || 0;
      displayMatches = p.stats?.EFOOTBALL?.matches || 0;
    }
    
    return { ...p, displayWins, displayMatches };
  }).filter(p => {
    const term = (searchQuery || '').trim().toLowerCase();
    const name = (p.username || '').toLowerCase();
    return name.includes(term);
  }).sort((a, b) => b.displayWins - a.displayWins);

  return (
    <div className="mt-20 overflow-hidden">
      <div className="bg-surface border border-surface-border rounded-[5px] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px] md:min-w-full">
            <thead>
              <tr className="bg-surface-hover border-b border-surface-border text-[10px] uppercase tracking-widest text-sub transition-colors">
                <th className="p-6 font-bold w-16 text-center">Rank</th>
                <th className="p-6 font-bold">Player Name</th>
                <th className="p-6 font-bold text-center">
                   {activeFilter === 'All-Time' ? 'Total Wins' : `${activeFilter} Wins`}
                </th>
                <th className="p-6 font-bold text-center">
                   {activeFilter === 'CODM' ? 'KD/Rating' : activeFilter === 'eFootball' ? 'Goal Diff' : 'Win Rate'}
                </th>
                <th className="p-6 font-bold text-center">
                   {activeFilter === 'CODM' ? 'Total Kills' : activeFilter === 'eFootball' ? 'Total Goals' : 'Combat Engagement'}
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPlayers.map((p, index) => {
                const winRate = p.displayMatches ? Math.round((p.displayWins / p.displayMatches) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors group">
                    <td className="p-6 text-center font-black italic text-sub text-sm">
                      #{index + 1}
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                         <div 
                            className="w-8 h-8 rounded-full border border-surface-border bg-black grayscale group-hover:grayscale-0 transition-all opacity-60 group-hover:opacity-100"
                            style={{
                              backgroundImage: `url('/avatar_collection.png')`,
                              backgroundSize: '400% 500%',
                              backgroundPosition: `${((p.avatarId || 0) % 4) * 33.33}% ${Math.floor((p.avatarId || 0) / 4) * 25}%`
                            }}
                         />
                         <div className="font-bold text-main uppercase tracking-tight">{p.username}</div>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-black text-main italic">{p.displayWins}</span>
                          <span className="text-[8px] text-accent font-black uppercase tracking-widest">Wins</span>
                       </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="inline-flex items-center">
                         <span className={`text-xs font-mono font-bold ${activeFilter === 'CODM' ? 'text-accent' : (activeFilter === 'eFootball' && (p.stats?.EFOOTBALL?.goalsFor > p.stats?.EFOOTBALL?.goalsAgainst)) ? 'text-accent' : 'text-sub'}`}>
                            {activeFilter === 'CODM' 
                              ? (p.displayMatches ? ((p.displayWins * 12.5) / (p.displayMatches || 1)).toFixed(2) : '0.00') 
                              : activeFilter === 'eFootball' 
                                ? (p.stats?.EFOOTBALL?.goalsFor || 0) - (p.stats?.EFOOTBALL?.goalsAgainst || 0)
                                : `${winRate}%`
                            }
                         </span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                       <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-black text-main italic">
                            {activeFilter === 'CODM' 
                              ? (p.displayWins * 12) 
                              : activeFilter === 'eFootball' 
                                ? (p.stats?.EFOOTBALL?.goalsFor || 0)
                                : (p.displayMatches !== undefined ? p.displayMatches : '--')
                            }
                          </span>
                          <span className="text-[8px] text-accent font-black uppercase tracking-widest whitespace-nowrap">
                            {activeFilter === 'CODM' ? 'Kills' : activeFilter === 'eFootball' ? 'Goals' : 'Engagements'}
                          </span>
                       </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPlayers.length === 0 && (
                <tr>
                   <td colSpan={5} className="p-10 text-center text-sub text-xs font-bold uppercase tracking-widest">
                      {searchQuery ? `No players found matching "${searchQuery}"` : "No champions dominate this category yet."}
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination / View All */}
        {filteredPlayers.length > 3 && (
          <div className="border-t border-surface-border bg-surface-hover/30 p-6 flex justify-center">
             <div className="text-[10px] font-black uppercase tracking-widest text-sub italic">
                Scanning Top 100 Global Operatives
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
