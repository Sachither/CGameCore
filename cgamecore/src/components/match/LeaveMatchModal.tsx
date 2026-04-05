"use client";
import React from 'react';
import Link from 'next/link';

interface LeaveMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LeaveMatchModal({ isOpen, onClose, onConfirm }: LeaveMatchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-surface border border-surface-border rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-4">Exit Match Lobby?</h2>
          
          <div className="bg-black/40 border border-surface-border p-4 rounded-sm text-left mb-8">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
              Your <span className="text-accent">Escrow Coins</span> are NOT forfeited if you leave. The match is still active in the background.
            </p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-3 pt-3 border-t border-surface-border border-dashed">
              You can re-enter this lobby at any time from the <span className="text-white">"My Matches"</span> dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={onClose}
              className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest py-4 rounded-sm transition-all shadow-[0_0_20px_rgba(0,255,102,0.2)]"
            >
              Stay & Play
            </button>
            <button 
              onClick={onConfirm}
              className="w-full bg-transparent hover:bg-surface-hover text-gray-400 hover:text-white font-bold uppercase tracking-widest py-3 rounded-sm transition-all"
            >
              Confirm Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
