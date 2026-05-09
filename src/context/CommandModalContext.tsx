"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ShieldAlert, Zap, X, Check, AlertTriangle, Trash2, Info } from 'lucide-react';

interface ModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm?: () => void;
  onConfirmWithInput?: (input: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  defaultValue?: string;
}

interface CommandModalContextType {
  confirm: (options: ModalOptions) => void;
  alert: (options: Omit<ModalOptions, 'onCancel' | 'cancelText'>) => void;
  prompt: (options: ModalOptions) => void;
}

const CommandModalContext = createContext<CommandModalContextType | undefined>(undefined);

export function CommandModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<(ModalOptions & { isOpen: boolean; type: 'confirm' | 'alert' | 'prompt' }) | null>(null);
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((options: ModalOptions) => {
    setModal({ ...options, isOpen: true, type: 'confirm' });
  }, []);

  const alert = useCallback((options: Omit<ModalOptions, 'onCancel' | 'cancelText'>) => {
    setModal({ ...options, isOpen: true, type: 'alert' });
  }, []);

  const prompt = useCallback((options: ModalOptions) => {
    setInputValue(options.defaultValue || '');
    setModal({ ...options, isOpen: true, type: 'prompt' });
  }, []);

  const close = () => {
    setModal(null);
    setInputValue('');
  };

  const handleConfirm = () => {
    if (modal?.type === 'prompt') {
      if (modal.onConfirmWithInput) modal.onConfirmWithInput(inputValue);
      else if (modal.onConfirm) modal.onConfirm();
    } else {
      if (modal?.onConfirm) modal.onConfirm();
    }
    close();
  };

  const handleCancel = () => {
    if (modal?.onCancel) modal.onCancel();
    close();
  };

  return (
    <CommandModalContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      
      {modal?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 overflow-hidden">
          {/* Backdrop with Glitch Blur */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={modal.type === 'alert' ? handleConfirm : handleCancel}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-sm shadow-[0_20px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            {/* Top Tactical Bar */}
            <div className={`h-1 w-full ${
              modal.variant === 'danger' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' :
              modal.variant === 'warning' ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' :
              modal.variant === 'success' ? 'bg-accent shadow-[0_0_15px_rgba(0,255,102,0.5)]' :
              'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
            } animate-pulse`} />

            <div className="p-8">
               <div className="flex items-start gap-6">
                  {/* Tactical Icon */}
                  <div className={`p-4 rounded-sm border shrink-0 ${
                    modal.variant === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                    modal.variant === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                    modal.variant === 'success' ? 'bg-accent/10 border-accent/20 text-accent' :
                    'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    {modal.variant === 'danger' ? <Trash2 className="w-8 h-8" /> :
                     modal.variant === 'warning' ? <AlertTriangle className="w-8 h-8" /> :
                     modal.variant === 'success' ? <Check className="w-8 h-8" /> :
                     <ShieldAlert className="w-8 h-8" />}
                  </div>

                  <div className="flex-1">
                     <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2 flex items-center gap-3">
                        <Zap className={`w-5 h-5 ${
                          modal.variant === 'danger' ? 'text-red-500' :
                          modal.variant === 'warning' ? 'text-yellow-500' :
                          modal.variant === 'success' ? 'text-accent' :
                          'text-blue-500'
                        }`} />
                        {modal.title}
                     </h2>
                     <p className="text-gray-400 text-sm leading-relaxed font-medium uppercase tracking-tight opacity-80">
                        {modal.message}
                     </p>

                     {modal.type === 'prompt' && (
                       <div className="mt-6">
                         <input
                           autoFocus
                           type="text"
                           value={inputValue}
                           onChange={(e) => setInputValue(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                           placeholder={modal.placeholder || "Enter intel..."}
                           className="w-full bg-black border border-white/10 focus:border-accent text-white px-4 py-3 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-700"
                         />
                       </div>
                     )}
                  </div>
               </div>

               {/* Action Area */}
               <div className="mt-10 flex flex-col sm:flex-row gap-3">
                  {(modal.type === 'confirm' || modal.type === 'prompt') && (
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm transition-all border border-white/5"
                    >
                      {modal.cancelText || 'Abort Command'}
                    </button>
                  )}
                  <button
                    onClick={handleConfirm}
                    disabled={modal.type === 'prompt' && !inputValue.trim()}
                    className={`flex-1 px-6 py-4 text-black text-[10px] font-black uppercase tracking-[0.3em] rounded-sm transition-all shadow-lg disabled:opacity-50 ${
                      modal.variant === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                      modal.variant === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20' :
                      modal.variant === 'success' ? 'bg-accent hover:bg-accent-hover shadow-accent/20' :
                      'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                    }`}
                  >
                    {modal.confirmText || (modal.type === 'confirm' || modal.type === 'prompt' ? 'Execute Directive' : 'Acknowledge')}
                  </button>
               </div>
            </div>

            {/* Bottom ID Bar */}
            <div className="px-8 py-3 bg-black border-t border-white/5 flex justify-between items-center opacity-30">
               <span className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-500">Directive ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
               <span className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-500">Secure Protocol v1.0</span>
            </div>
          </div>
        </div>
      )}
    </CommandModalContext.Provider>
  );
}

export function useCommandModal() {
  const context = useContext(CommandModalContext);
  if (context === undefined) {
    throw new Error('useCommandModal must be used within a CommandModalProvider');
  }
  return context;
}
