"use client";
import React from 'react';
import { AlertTriangle, ShieldAlert, X, Check, Loader2 } from 'lucide-react';

interface AdminConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function AdminConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm Action",
  cancelText = "Cancel",
  variant = 'danger',
  isLoading = false
}: AdminConfirmModalProps) {
  if (!isOpen) return null;

  const themes = {
    danger: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-500',
      btn: 'bg-red-500 hover:bg-red-600 text-black',
      shadow: 'shadow-[0_0_50px_rgba(239,68,68,0.15)]'
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-500',
      btn: 'bg-yellow-500 hover:bg-yellow-600 text-black',
      shadow: 'shadow-[0_0_50px_rgba(234,179,8,0.1)]'
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
      btn: 'bg-blue-500 hover:bg-blue-600 text-black',
      shadow: 'shadow-[0_0_50px_rgba(59,130,246,0.1)]'
    }
  };

  const theme = themes[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className={`relative w-full max-w-md bg-[#0a0a0a] border ${theme.border} rounded-sm overflow-hidden ${theme.shadow} animate-in zoom-in-95 fade-in duration-300`}>
        {/* Header Bar */}
        <div className={`h-1 w-full ${theme.btn.split(' ')[0]}`} />
        
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-sm ${theme.bg}`}>
              {variant === 'danger' && <ShieldAlert className={`w-8 h-8 ${theme.icon}`} />}
              {variant === 'warning' && <AlertTriangle className={`w-8 h-8 ${theme.icon}`} />}
              {variant === 'info' && <Check className={`w-8 h-8 ${theme.icon}`} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">
                {title}
              </h2>
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme.icon}`}>
                Tactical Authorization Required
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-400 font-medium leading-relaxed mb-8 uppercase tracking-wide border-l-2 border-white/5 pl-4 py-1">
            {message}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-[1.5] py-4 ${theme.btn} text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>

        {/* Decorative corner element */}
        <div className={`absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-20`}>
           <div className={`absolute top-0 right-0 w-[2px] h-full ${theme.btn.split(' ')[0]}`} />
           <div className={`absolute top-0 right-0 w-full h-[2px] ${theme.btn.split(' ')[0]}`} />
        </div>
      </div>
    </div>
  );
}
