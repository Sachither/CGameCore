import React from "react";
import { ShieldAlert, Info, Swords, Clock, AlertTriangle } from "lucide-react";

interface MatchRulesProps {
   game: 'CODM' | 'EFOOTBALL';
   weaponClass?: string;
}

export default function MatchRules({ game, weaponClass }: MatchRulesProps) {
   const isCODM = game === 'CODM';

   return (
      <div className="mt-6 md:mt-10 bg-surface border border-surface-border p-4 md:p-8 rounded-sm relative overflow-hidden group">
         {isCODM && (
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
         )}

         <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4 md:mb-8 border-b border-surface-border pb-4 md:pb-6">
               <div className={`p-2.5 md:p-3 rounded-full ${isCODM ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
                  <ShieldAlert className="w-5.5 h-5.5 md:w-6 md:h-6" />
               </div>
               <div>
                  <h2 className="text-lg md:text-xl font-black text-white italic uppercase tracking-tighter">Tactical Briefing & Rules</h2>
                  <p className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-0.5 md:mt-1">Official High-Stakes Combat Regulations</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-8">
               {/* General Rule 1 */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-white italic">
                     <Swords className="w-4 h-4 text-gray-600" /> Weapon Protocols
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                     {isCODM
                        ? `Restrict gear to ${weaponClass || 'ALL GUNS'}. Any use of restricted equipment results in immediate disqualification.`
                        : "Standard Competitive Teams. No scripted or experimental mods allowed. Tactical fair play strictly enforced."
                     }
                  </p>
               </div>

               {/* General Rule 2 */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-white italic">
                     <Clock className="w-4 h-4 text-gray-600" /> Response Time
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                     Operatives must join the in-game room within 5 minutes of host sharing details. Failure to deploy results in credit forfeiture.
                  </p>
               </div>

               {/* General Rule 3 */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-white italic">
                     <AlertTriangle className="w-4 h-4 text-gray-600" /> Dispute Evidence
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                     Recording the full match and the scoreboard is MANDATORY. No video proof = No victory claim on disputes.
                  </p>
               </div>

               {/* General Rule 4 */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-white italic">
                     <Info className="w-4 h-4 text-gray-600" /> Result Confirmation
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed font-bold uppercase tracking-tight">
                     Both players MUST confirm the result in the mission console within 10 minutes of match completion.
                  </p>
               </div>
            </div>

            <div className={`mt-10 p-4 border rounded-sm flex items-center justify-between ${isCODM ? 'bg-red-500/5 border-red-500/20' : 'bg-accent/5 border-accent/20'}`}>
               <p className={`text-[9px] font-black uppercase tracking-widest ${isCODM ? 'text-red-500' : 'text-accent'}`}>
                  By participating, you agree to these tactical engagement rules.
               </p>
               <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                  <div className="w-2 h-2 rounded-full bg-white/20"></div>
               </div>
            </div>
         </div>
      </div>
   );
}
