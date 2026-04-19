"use client";
import React from "react";
import { AlertTriangle, ShieldAlert, X, Check } from "lucide-react";

interface TacticalConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export default function TacticalConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Authorize",
  cancelText = "Abort",
  isDanger = false
}: TacticalConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-0">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-[#0a0a0a] border border-white/5 w-full max-w-md rounded-sm relative overflow-hidden animate-in zoom-in-95 duration-200 shadow-[0_0_80px_rgba(255,0,0,0.1)]">
        {/* Accent Bar */}
        <div className={`absolute top-0 inset-x-0 h-1 ${isDanger ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-accent shadow-[0_0_15px_rgba(0,255,102,0.5)]'}`} />
        
        {/* Header */}
        <div className="p-6 pb-2">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-sm ${isDanger ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-accent/10 border border-accent/20 text-accent'}`}>
                 {isDanger ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6 animate-pulse" />}
              </div>
              <div>
                 <h3 className="text-sm font-black text-white uppercase italic tracking-tighter leading-none mb-1">{title}</h3>
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Security Protocol 00-X // Audit Enabled</p>
              </div>
           </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
           <p className="text-xs text-gray-400 font-bold uppercase leading-relaxed tracking-tight italic">
              {message}
           </p>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white border border-white/5 hover:bg-white/5 transition-all rounded-sm flex items-center justify-center gap-2"
           >
             <X className="w-3.5 h-3.5" />
             {cancelText}
           </button>
           <button 
             onClick={() => {
                onConfirm();
                onClose();
             }}
             className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-black transition-all rounded-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 ${isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-accent hover:bg-accent-aware shadow-accent/20'}`}
           >
             <Check className="w-3.5 h-3.5" />
             {confirmText}
           </button>
        </div>

        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none overflow-hidden">
           <div className="absolute top-0 right-0 p-4">
              <AlertTriangle className="w-40 h-40" />
           </div>
        </div>
      </div>
    </div>
  );
}
