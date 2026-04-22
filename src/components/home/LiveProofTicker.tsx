"use client";

import React, { useEffect, useState } from 'react';
import { getLiveProofAction, PublicOperation } from '@/app/actions/public-stats';
import { Trophy, ArrowUpRight, ShieldCheck, Timer } from 'lucide-react';

export default function LiveProofTicker() {
  const [items, setItems] = useState<PublicOperation[]>([]);

  useEffect(() => {
    const fetchProof = async () => {
      const data = await getLiveProofAction();
      setItems(data);
    };
    fetchProof();
    const interval = setInterval(fetchProof, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="w-full bg-black border-b border-surface-border overflow-hidden h-9 fixed top-0 left-0 z-[60]">
      <div className="flex animate-marquee h-full whitespace-nowrap items-center">
        {/* Render twice for seamless loop */}
        {[...items, ...items].map((item, i) => (
          <div 
            key={`${item.id}-${i}`} 
            className="inline-flex items-center gap-2 px-8 border-r border-surface-border/50"
          >
            <div className={`p-1 rounded-full ${item.type === 'WIN' ? 'bg-accent/10' : 'bg-yellow-500/10'}`}>
              {item.type === 'WIN' ? (
                <Trophy className="w-3 h-3 text-accent" />
              ) : (
                <ArrowUpRight className="w-3 h-3 text-yellow-500" />
              )}
            </div>
            
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {item.username}
            </span>
            
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-tighter">
              {item.type === 'WIN' ? `SECURED ${item.amount} COINS IN ${item.game}` : `SUCCESSFULLY WITHDREW ${item.amount} COINS`}
            </span>

            <div className="flex items-center gap-1 opacity-40">
              <Timer className="w-2.5 h-2.5" />
              <span className="text-[8px] font-bold uppercase tracking-widest">
                {formatTimeAgo(item.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .animate-marquee {
          display: inline-flex;
          animation: marquee 40s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'Just Now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m Ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h Ago`;
  return 'Recently';
}
