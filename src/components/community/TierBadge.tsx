import React, { useState, useRef } from 'react';
import { Info } from 'lucide-react';
import { TierInfo, TIER_RULES } from '@/lib/tier-utils';
import { createPortal } from 'react-dom';

interface TierBadgeProps {
  tier: TierInfo;
}

export default function TierBadge({ tier }: TierBadgeProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // If there's less than 200px above, pop down. Otherwise pop up.
      const isSpaceAbove = spaceAbove > 200;
      
      setCoords({
        x: rect.left,
        y: isSpaceAbove ? rect.top - 8 : rect.bottom + 8,
      });
      setShowInfo(true);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1 group/tier z-20" ref={triggerRef}>
      <div 
        className="flex items-center gap-1 px-1.5 py-0.5 rounded border shadow-sm cursor-help"
        style={{ 
          backgroundColor: `${tier.color}15`, 
          borderColor: `${tier.color}40`,
          color: tier.color 
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowInfo(false)}
      >
        <span className="text-[8px] font-black uppercase tracking-widest">{tier.label.split(':')[0]}</span>
        <Info className="w-2.5 h-2.5 opacity-70" />
      </div>

      {showInfo && typeof window !== 'undefined' && createPortal(
        <div 
          className={`fixed z-[9999] w-64 bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl p-4 animate-in fade-in duration-200 pointer-events-none ${coords.y < triggerRef.current!.getBoundingClientRect().top ? 'slide-in-from-bottom-2 -translate-y-full' : 'slide-in-from-top-2'}`}
          style={{ 
            left: Math.min(coords.x, window.innerWidth - 270), 
            top: coords.y 
          }}
        >
           <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3">Tactical Clearance Levels</h4>
           <div className="space-y-2">
              {TIER_RULES.map((rule, idx) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-sm ${rule.rank === tier.label.split(':')[0] ? 'bg-white/10 border border-white/20' : 'bg-black/50 border border-transparent'}`}>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: idx === 0 ? '#94a3b8' : idx === 1 ? '#3b82f6' : '#f59e0b' }}>
                      {rule.rank}
                    </p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{rule.status}</p>
                  </div>
                  <div className="text-[9px] font-black text-white bg-white/5 px-2 py-1 rounded-sm">
                    {rule.range || rule.rankLabel}
                  </div>
                </div>
              ))}
           </div>
        </div>,
        document.body
      )}
    </div>
  );
}
