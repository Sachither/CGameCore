"use client";
import React, { useState } from 'react';
import { X, BookOpen } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  game?: string;
  format?: string;
}

export default function RulesModal({ isOpen, onClose, game = 'EFOOTBALL', format = 'tournament' }: RulesModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'disconnect' | 'scoring'>('general');

  if (!isOpen) return null;

  const generalRules = [
    { label: 'Match Duration', value: 'All matches are 10 minutes per side. Excellent condition applies to both players.' },
    { label: 'Tournament Format', value: 'Single elimination bracket. Winners advance to the next round. Bye players automatically advance without playing.' },
    { label: 'Extra Time & Penalties', value: `${format === 'tournament' ? 'Extra time and penalties are ENABLED for tournaments.' : 'Extra time and penalties are DISABLED for leagues.'}` },
    { label: 'Room Access', value: 'Both players must confirm ready status before the match begins. If opponent does not ready within 23 hours 30 minutes, you may claim a technical win.' },
    { label: 'Result Submission', value: 'The winning player must upload match proof (screenshot or video) within 30 minutes of match completion.' },
    { label: 'Fair Play', value: 'All matches must be played fairly. Exploits, cheats, or unsporting conduct will result in disqualification and account suspension.' },
  ];

  const disconnectRules = [
    { title: 'Scenario 1: Player Winning, Network Disconnect', description: 'If you are winning and your internet disconnects during the match, you are entitled to a REPLAY of the entire match.' },
    { title: 'Scenario 2: Player Losing, Network Disconnect (Second Half)', description: 'If you are losing and disconnect during the SECOND HALF of the match, there is NO REPLAY. The win goes to your opponent.' },
    { title: 'Scenario 3: Any Player, Network Disconnect (First Half)', description: 'If either player disconnects during the FIRST HALF, the match is REPLAYED. However, the score from the first match carries over to the replay (e.g., if Player A was winning 1-0, they start the replay already 1-0 up).' },
    { title: 'Scenario 4: Deliberate Disconnect', description: 'Deliberately disconnecting to avoid a loss is considered unsporting conduct and may result in account penalties.' },
  ];

  const scoringRules = [
    { label: 'Goals', value: '1 goal = 1 point. All goals must be legitimate and scored within regulation time (or extra time in tournaments).' },
    { label: 'Penalties', value: 'Penalties are part of the match result if the match goes to a draw and extra time is enabled (tournament only).' },
    { label: 'Draw Results', value: `In tournaments: A draw will proceed to extra time and penalties. In leagues: A draw is a draw, and both players receive points accordingly.` },
    { label: 'Own Goals', value: 'Own goals count as 1 goal for the opposing team.' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-4">
            {generalRules.map((rule, idx) => (
              <div key={idx} className="border-l-4 border-accent bg-black/40 p-4 rounded-sm">
                <h4 className="text-accent font-black uppercase tracking-widest text-sm mb-2">{rule.label}</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{rule.value}</p>
              </div>
            ))}
          </div>
        );
      case 'disconnect':
        return (
          <div className="space-y-4">
            {disconnectRules.map((rule, idx) => (
              <div key={idx} className="border-l-4 border-red-500 bg-red-950/20 p-4 rounded-sm">
                <h4 className="text-red-400 font-black uppercase tracking-widest text-sm mb-2">{rule.title}</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{rule.description}</p>
              </div>
            ))}
          </div>
        );
      case 'scoring':
        return (
          <div className="space-y-4">
            {scoringRules.map((rule, idx) => (
              <div key={idx} className="border-l-4 border-blue-500 bg-blue-950/20 p-4 rounded-sm">
                <h4 className="text-blue-400 font-black uppercase tracking-widest text-sm mb-2">{rule.label}</h4>
                <p className="text-gray-300 text-sm leading-relaxed">{rule.value}</p>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 md:pt-24 p-4 pb-4 animate-in fade-in overflow-y-auto">
      <div className="bg-black border-2 border-accent/30 rounded-sm w-full max-w-2xl max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-7rem)] flex flex-col shadow-[0_0_50px_rgba(0,255,102,0.2)] animate-in zoom-in duration-300 my-auto">
        {/* Header */}
        <div className="border-b border-accent/30 px-4 py-3 md:p-6 flex items-center justify-between sticky top-0 bg-black z-10">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-accent" />
            <h2 className="text-lg md:text-2xl font-black uppercase tracking-widest text-accent italic">Match Rules</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/10 rounded-sm transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6 text-accent" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-accent/30 px-3 py-3 md:p-4 flex gap-1 md:gap-2 bg-black/50">
          {[
            { id: 'general', label: 'General Rules', icon: '⚙️' },
            { id: 'disconnect', label: 'Disconnect', icon: '🌐' },
            { id: 'scoring', label: 'Scoring', icon: '⚽' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-2 py-2 md:px-4 md:py-2 rounded-sm font-black uppercase tracking-wider md:tracking-widest text-xs md:text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-accent text-black'
                  : 'bg-black border border-accent/30 text-accent hover:border-accent'
              }`}
            >
              <span className="block md:hidden">{tab.icon}</span>
              <span className="hidden md:inline">{tab.icon} </span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="block md:hidden text-[10px] leading-tight mt-0.5 truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:p-6 space-y-3 md:space-y-4">
          {renderTab()}
        </div>

        {/* Footer */}
        <div className="border-t border-accent/30 px-4 py-3 md:p-4 bg-black/50 flex justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-accent text-black font-black uppercase tracking-widest rounded-sm hover:bg-accent-hover transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
