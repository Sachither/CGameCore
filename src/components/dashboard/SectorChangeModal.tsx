"use client";
import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface SectorChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentSector: string;
}

export default function SectorChangeModal({ isOpen, onClose, onConfirm, currentSector }: SectorChangeModalProps) {
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setIsResetting(true);
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#080808] border border-white/10 rounded-sm shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden">
        {/* Top Glow bar */}
        <div className="h-1 bg-gradient-to-r from-yellow-500/0 via-yellow-500 to-yellow-500/0 w-full" />
        
        <div className="p-8">
           <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                 <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors p-1"
                disabled={isResetting}
              >
                 <X className="w-5 h-5" />
              </button>
           </div>

           <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">Sector Migration</h2>
           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-6">Current Authorization: <span className="text-yellow-500">{currentSector}</span></p>

           <div className="bg-white/5 border border-white/5 p-4 rounded-sm space-y-4 mb-8">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide leading-relaxed">
                 You are about to initiate a <span className="text-white">Regional Reset</span>. This process will:
              </p>
              <ul className="space-y-2">
                 <li className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-red-400/80">
                    <div className="w-1 h-1 bg-red-400 rounded-full" />
                    Wipe local bank configurations
                 </li>
                 <li className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-red-400/80">
                    <div className="w-1 h-1 bg-red-400 rounded-full" />
                    Reset payout eligibility gates
                 </li>
                 <li className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-white/50">
                    <div className="w-1 h-1 bg-white/20 rounded-full" />
                    Force re-selection of operative region
                 </li>
              </ul>
           </div>

           <div className="flex flex-col gap-3">
              <button
                onClick={handleConfirm}
                disabled={isResetting}
                className="w-full bg-white hover:bg-gray-200 text-black py-4 font-black uppercase tracking-widest text-xs rounded-sm transition-all flex items-center justify-center gap-3"
              >
                {isResetting ? (
                   <>
                     <RefreshCw className="w-4 h-4 animate-spin" />
                     Reconfiguring...
                   </>
                ) : (
                   "Confirm Migration"
                )}
              </button>
              <button
                disabled={isResetting}
                onClick={onClose}
                className="w-full text-gray-500 hover:text-white font-black uppercase tracking-widest text-[10px] py-4 transition-colors"
              >
                Cancel Protocol
              </button>
           </div>
        </div>

        {/* Bottom aesthetic footer */}
        <div className="bg-white/[0.02] p-4 text-center border-t border-white/5">
           <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.3em]">CGame Global Financial Infrastructure v2.1</p>
        </div>
      </div>
    </div>
  );
}
