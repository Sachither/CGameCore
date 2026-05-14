"use client";

import React from 'react';

interface HofVideoEmbedProps {
  url: string;
  type: 'DIRECT';
  autoPlay?: boolean;
  muted?: boolean;
}

export default function HofVideoEmbed({ url, type, autoPlay, muted = true }: HofVideoEmbedProps) {
  if (type !== 'DIRECT') return null;

  return (
    <div className="relative w-full bg-black/40 rounded-sm overflow-hidden group">
       <video 
          className="w-full aspect-[9/16] bg-black rounded-sm"
          src={url}
          controls
          playsInline
          loop
          muted={muted}
          autoPlay={autoPlay}
        />
       
       {/* Aesthetic Overlay */}
       <div className="absolute inset-0 pointer-events-none border border-white/5 group-hover:border-accent/20 transition-colors"></div>
    </div>
  );
}
