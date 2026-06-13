"use client";
import React, { useState } from 'react';
import { X, ShieldAlert, Swords, Clock, AlertTriangle, Info } from 'lucide-react';

interface MatchChatRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: 'CODM' | 'EFOOTBALL';
}

export default function MatchChatRulesModal({ isOpen, onClose, game }: MatchChatRulesModalProps) {
  if (!isOpen) return null;

  const isCODM = game === 'CODM';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 md:pt-24 p-4 pb-4 overflow-y-auto">
      <div className="bg-black border-2 border-accent/30 rounded-sm w-full max-w-2xl max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-7rem)] flex flex-col shadow-[0_0_50px_rgba(0,255,102,0.2)]">
        {/* Header */}
        <div className="border-b border-accent/30 px-4 py-3 md:p-6 flex items-center justify-between sticky top-0 bg-black z-10">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-accent" />
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-widest text-accent italic">Match Rules</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/10 rounded-sm transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6 text-accent" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:p-6 space-y-3 md:space-y-4">
          {/* Rule 1 */}
          <div className="space-y-2 pb-4 border-b border-accent/30">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Weapon Protocols & Fair Play</h3>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {isCODM
                ? "Restrict gear to designated weapon class. Any use of restricted equipment results in immediate disqualification. No exploits or glitches allowed."
                : "Standard Competitive Teams only. No scripted or experimental mods. Tactical fair play strictly enforced. Play to win legitimately."}
            </p>
          </div>

          {/* Rule 2 */}
          <div className="space-y-2 pb-4 border-b border-accent/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Room Join & Response Time</h3>
            </div>
            <ul className="text-[11px] text-gray-300 leading-relaxed space-y-1 list-inside">
              <li>• Host creates room and shares room code/password here immediately</li>
              <li>• You must join the in-game room within 5 minutes of host sharing details</li>
              <li>• Failure to deploy = Automatic Disqualification & Credit Forfeiture</li>
            </ul>
          </div>

          {/* Rule 3 */}
          <div className="space-y-2 pb-4 border-b border-accent/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Recording & Dispute Evidence</h3>
            </div>
            <ul className="text-[11px] text-gray-300 leading-relaxed space-y-1 list-inside">
              <li>• <span className="text-red-400 font-bold">MANDATORY: Record the full match AND final scoreboard</span></li>
              <li>• No video proof = No victory claim accepted on disputes</li>
              <li>• Screenshot your victory to claim/submit your win</li>
            </ul>
          </div>

          {/* Rule 4 */}
          <div className="space-y-2 pb-4 border-b border-accent/30">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Conduct & Behavior</h3>
            </div>
            <ul className="text-[11px] text-gray-300 leading-relaxed space-y-1 list-inside">
              <li>• <span className="text-red-400 font-bold">Zero tolerance for harassment or toxic behavior</span></li>
              <li>• Respect opponents at all times</li>
              <li>• Toxic conduct = Ban from platform</li>
            </ul>
          </div>

          {/* Rule 5 */}
          <div className="space-y-2 pb-4 border-b border-accent/30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-widest text-accent">Result Confirmation</h3>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Both players MUST confirm the result within 10 minutes of match completion. Delays may result in forfeit.
            </p>
          </div>

          {/* Rule 6 - eFootball Specific Scoring */}
          {!isCODM && (
            <div className="space-y-2 pb-4 border-b border-blue-500/30">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">Scoring & Goals</h3>
              </div>
              <ul className="text-[11px] text-gray-300 leading-relaxed space-y-1 list-inside">
                <li>• <span className="text-blue-400 font-bold">1 goal = 1 point</span> - All goals must be legitimate and scored within regulation time</li>
                <li>• Own goals count as 1 goal for the opposing team</li>
                <li>• <span className="text-blue-400 font-bold">Extra time & penalties are ENABLED</span> if match goes to a draw</li>
                <li>• If match ends in a draw after extra time and penalties, both players receive points accordingly</li>
              </ul>
            </div>
          )}

          {/* Rule 7 - Network Disconnect Protocol */}
          {!isCODM && (
            <div className="space-y-2 pb-4 border-b border-red-500/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-black uppercase tracking-widest text-red-400">Network Disconnect Protocol</h3>
              </div>
              <ul className="text-[11px] text-gray-300 leading-relaxed space-y-2 list-inside">
                <li>• <span className="text-red-400 font-bold">If Winning & Disconnect:</span> You are entitled to a REPLAY of the entire match</li>
                <li>• <span className="text-red-400 font-bold">If Losing & Disconnect - NO REPLAY:</span> Trailing by 3+ goals OR in the second half = No replay, opponent wins</li>
                <li>• <span className="text-red-400 font-bold">If Losing & Disconnect - Replay Eligible:</span> Trailing by less than 3 goals AND first half only = Replay granted with score carried over</li>
                <li>• <span className="text-red-400 font-bold">Deliberate Disconnect:</span> Will result in account penalties and potential suspension</li>
              </ul>
            </div>
          )}

          {/* Rule 6 (CODM) / Rule 7 (eFootball) */}
          <div className={`mt-6 p-4 border rounded-sm flex items-center justify-between ${isCODM ? 'bg-red-500/5 border-red-500/20' : 'bg-accent/5 border-accent/20'}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isCODM ? 'text-red-500' : 'text-accent'}`}>
              By entering this match, you agree to these tactical engagement rules
            </p>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
          </div>
        </div>

        {/* Close Button */}
        <div className="sticky bottom-0 bg-black border-t border-accent/30 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest py-3 rounded-[3px] transition-colors"
          >
            Understood, Enter Combat
          </button>
        </div>
      </div>
    </div>
  );
}
