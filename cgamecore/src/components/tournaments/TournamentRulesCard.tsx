"use client";
import React, { useState } from 'react';

import { League } from '@/lib/match-service';

export default function TournamentRulesCard({ game, league }: { game: 'efootball' | 'codm', league?: League }) {
  const isCODM = game === 'codm';
  
  // Local state for CODM toggles
  const [codMode, setCodMode] = useState<'1v1' | '5v5' | 'br'>('1v1');
  const [codWeapon, setCodWeapon] = useState<'Any' | 'Sniper' | 'Shotgun'>('Any');
  
  return (
    <div className="bg-surface border border-surface-border rounded-[5px] p-6 lg:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-start gap-4 mb-6">
        <div className="w-14 h-14 bg-black border border-surface-border rounded-[5px] flex items-center justify-center shrink-0">
          <svg className="w-8 h-8 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={isCODM ? "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
             {isCODM ? "CODM Duel" : "eFootball Sprint"}
          </h1>
          <div className="flex items-center space-x-2 mt-1">
             <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
             <span className="text-accent text-xs font-bold uppercase tracking-widest">Registrations Open</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* CODM Interactive Format Selection */}
        {isCODM && (
          <div className="space-y-4 border-b border-surface-border pb-6">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">Select Game Mode</label>
              <div className="flex space-x-2">
                 {(['1v1', '5v5', 'br'] as const).map(mode => (
                   <button 
                     key={mode} 
                     onClick={() => setCodMode(mode)}
                     className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-[3px] transition-colors border ${codMode === mode ? 'bg-accent/10 text-accent border-accent' : 'bg-black text-gray-400 border-surface-border hover:border-gray-500'}`}
                   >
                     {mode === 'br' ? 'Battle Royale' : mode}
                   </button>
                 ))}
              </div>
            </div>
            
            {(codMode === '1v1' || codMode === '5v5') && (
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">Weapon Constraint</label>
                <div className="flex space-x-2">
                   {(['Any', 'Sniper', 'Shotgun'] as const).map(weapon => (
                     <button 
                       key={weapon} 
                       onClick={() => setCodWeapon(weapon)}
                       className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-[3px] transition-colors border ${codWeapon === weapon ? 'bg-white text-black border-white' : 'bg-black text-gray-500 border-surface-border hover:border-gray-500'}`}
                     >
                       {weapon} Gun
                     </button>
                   ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Matrix View based on State/Game */}
        <div>
          <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3">Tournament Info</h3>
          <div className="grid grid-cols-2 gap-4">
              <div className="bg-black border border-surface-border p-3 rounded-[5px]">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Entry Fee</div>
                <div className="text-lg font-black text-white">
                   {league ? league.challengeFee : (isCODM && codMode === 'br' ? '250' : '100')} Coins
                </div>
              </div>
              <div className="bg-black border border-surface-border p-3 rounded-[5px]">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Prize Pool</div>
                <div className="text-lg font-black text-accent">
                   {league ? (league.totalPool || 0).toLocaleString() : (isCODM && codMode === 'br' ? '24,000' : '10,000')} Coins
                </div>
              </div>
              <div className="bg-black border border-surface-border p-3 rounded-[5px]">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Format</div>
                <div className="text-sm font-bold text-white mt-1">
                  {league ? (league.format || league.title) : (isCODM ? (codMode === 'br' ? '100 Player Lobby' : `Alcatraz Siege`) : "1v1 Standard League")}
                </div>
              </div>
              <div className="bg-black border border-surface-border p-3 rounded-[5px]">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Players</div>
                <div className="text-sm font-bold text-white mt-1">
                  {league ? `${league.playerCount || 0} / ${league.quota || 40}` : (isCODM && codMode === 'br' ? '88 / 100' : '0 / 40')}
                </div>
              </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 border-t border-surface-border pt-6">Official Rules</h3>
          <ul className="space-y-4">
             {/* Dynamic Game-Specific Rules */}
             {isCODM ? (
               <>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300">
                     <strong className="text-white">Weapon Constraint:</strong> {codWeapon === 'Any' ? 'All weapons permitted' : `Strictly ${codWeapon} ONLY. Using a secondary or banned weapon yields an instant forfeit.`}
                   </span>
                 </li>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">No Killstreaks:</strong> Strictly no UAVs, Sentry Guns, or K9 Units allowed. Scorestreaks are banned.</span>
                 </li>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">Map Pool:</strong> {codMode === 'br' ? 'Isolated / Blackout Maps ONLY.' : 'Matches must take place on Killhouse, Nuketown, or Shipment.'}</span>
                 </li>
               </>
             ) : (
               <>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">Match Duration:</strong> All standard matches must be set to 10 minutes.</span>
                 </li>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">Extra Time/Penalties ON:</strong> A definitive winner must be decided to claim the prize pool.</span>
                 </li>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">Network Tampering:</strong> Intentionally lagging the game is banned. If disconnected, the stable player must upload the "Match Abandoned" screen.</span>
                 </li>
                 <li className="flex items-start">
                   <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                   <span className="text-sm text-gray-300"><strong className="text-white">No Bird-Caging:</strong> Passing strictly between defenders to waste time yields an instant platform ban.</span>
                 </li>
               </>
             )}

             {/* Platform Universal Rules */}
             <div className="w-full h-px bg-surface-border my-4 border-dashed border-t border-surface-border"></div>
             
             <li className="flex items-start">
               <svg className="w-4 h-4 text-accent mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
               <span className="text-sm text-gray-400"><strong className="text-accent text-xs">PRO-TIP: SCREEN RECORDING</strong> We highly recommend using your phone's built-in recorder during matches. In the event of a dispute, Video Evidence is required to claim a win against cheaters.</span>
             </li>
             
             <li className="flex items-start">
               <svg className="w-4 h-4 text-yellow-500 mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <span className="text-sm text-gray-400"><strong className="text-white text-xs">THE 5-MINUTE RULE:</strong> If an opponent doesn't join the private room within 5 mins, upload a screenshot of the empty lobby for a Technical Win.</span>
             </li>
             <li className="flex items-start">
               <svg className="w-4 h-4 text-yellow-500 mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
               <span className="text-sm text-gray-400"><strong className="text-white text-xs">EVIDENCE REQUIREMENT:</strong> A "Win" is ONLY valid if the uploaded screenshot shows the Final Scoreboard and both Usernames clearly.</span>
             </li>
             <li className="flex items-start">
               <svg className="w-4 h-4 text-red-500 mt-0.5 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
               <span className="text-sm text-gray-400"><strong className="text-red-400 text-xs">THE TOXIC CLAUSE:</strong> Any user found using hate speech or tribalism in chat will face an immediate ban and forfeit their Coins.</span>
             </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
