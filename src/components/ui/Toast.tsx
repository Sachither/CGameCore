"use client";
import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  XSquare, 
  AlertTriangle, 
  Info, 
  X,
  Loader2
} from "lucide-react";

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  onClose: () => void;
}

export function Toast({ title, message, type, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 4500); // Start exit animation slightly before the context removes it
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-accent" />,
    error: <XSquare className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const ringColors = {
    success: 'border-accent/30 shadow-accent/10',
    error: 'border-red-500/30 shadow-red-500/10',
    warning: 'border-yellow-500/30 shadow-yellow-500/10',
    info: 'border-blue-500/30 shadow-blue-500/10',
  };

  return (
    <div 
      className={`
        pointer-events-auto
        flex flex-col min-w-[320px] max-w-md
        bg-[#0a0a0a]/90 backdrop-blur-xl
        border-2 ${ringColors[type]}
        rounded-sm shadow-2xl p-4
        transition-all duration-300 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100 animate-in slide-in-from-right-4'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
           <div className={`p-2 rounded-full bg-white/5`}>
              {icons[type]}
           </div>
           <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-0.5">{title}</h4>
              <p className="text-white font-black italic uppercase tracking-tighter text-sm leading-tight">
                {message}
              </p>
           </div>
        </div>
        <button 
          onClick={handleClose}
          className="text-gray-600 hover:text-white transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Dynamic Progress Bar */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-white/10 w-full overflow-hidden">
         <div className={`h-full ${type === 'success' ? 'bg-accent' : type === 'error' ? 'bg-red-500' : 'bg-white'} animate-progress`} />
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress {
          animation: progress 4.8s linear forwards;
        }
      `}</style>
    </div>
  );
}
