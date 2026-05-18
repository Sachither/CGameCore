"use client";
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const PWA_DISMISS_KEY = 'pwa_dismiss_time';
const PWA_DISABLED_KEY = 'pwa_disabled_permanently';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export default function PWAInstallPrompt() {
  const { canInstall, isInstalled, triggerInstall } = usePWAInstall();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    // Check if user permanently disabled the prompt
    const isDisabledPermanently = localStorage.getItem(PWA_DISABLED_KEY);
    if (isDisabledPermanently) {
      return;
    }

    // Check if recently dismissed (within 7 days)
    const lastDismissTime = localStorage.getItem(PWA_DISMISS_KEY);
    if (lastDismissTime) {
      const timeSinceDismiss = Date.now() - parseInt(lastDismissTime);
      if (timeSinceDismiss < DISMISS_DURATION) {
        return; // Don't show if dismissed recently
      }
    }

    // Check for iOS
    const isIOSDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOSDevice) {
      setIsIOS(true);
      // Show iOS instructions if not dismissed recently
      if (!lastDismissTime || (Date.now() - parseInt(lastDismissTime)) >= DISMISS_DURATION) {
        setShowPrompt(true);
      }
    }

    // Show Android/Web PWA prompt if available and not recently dismissed
    if (canInstall && (!lastDismissTime || (Date.now() - parseInt(lastDismissTime)) >= DISMISS_DURATION)) {
      setShowPrompt(true);
    }
  }, [canInstall]);

  const handleInstall = async () => {
    await triggerInstall();
    setShowPrompt(false);
    localStorage.removeItem(PWA_DISMISS_KEY);
  };

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setShowPrompt(false);
    
    if (dontAskAgain) {
      localStorage.setItem(PWA_DISABLED_KEY, 'true');
    } else {
      localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
    }
  };

  // Early return if not needed
  if (isInstalled || !showPrompt) {
    return null;
  }

  // Render iOS-specific manual instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 lg:w-96 lg:left-auto z-[85] bg-surface border border-accent/30 rounded-sm p-4 shadow-[0_0_30px_rgba(0,255,102,0.1)] animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-accent/10 shrink-0">
            <Download className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">Install CGame App</h3>
            <p className="text-[9px] text-gray-400 font-bold leading-relaxed mb-4">
              Tap <span className="text-white font-black">Share</span>, then add to Home Screen for offline access and launcher icon.
            </p>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input 
                type="checkbox" 
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="mt-1 w-4 h-4 accent-accent cursor-pointer"
              />
              <span className="text-[8px] text-gray-400 hover:text-gray-300 font-bold">Don't ask me again</span>
            </label>
            <div className="flex gap-2">
              <button 
                onClick={handleDismiss}
                className="min-h-10 px-4 py-2 bg-accent hover:bg-accent/90 active:bg-accent text-black font-black text-[8px] uppercase tracking-widest rounded-sm transition-colors duration-200 flex items-center justify-center"
              >
                Got It
              </button>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="min-w-10 min-h-10 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors duration-200 rounded-sm shrink-0"
            aria-label="Close install prompt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Render Web/Android prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 lg:w-96 lg:left-auto z-[85] bg-surface border border-accent/30 rounded-sm p-4 shadow-[0_0_30px_rgba(0,255,102,0.1)] animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-accent/10 shrink-0">
          <Download className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white mb-2">Install CGame App</h3>
          <p className="text-[9px] text-gray-400 font-bold leading-relaxed mb-4">
            Add to your device for faster access, offline support, and a native app experience.
          </p>
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input 
              type="checkbox" 
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="mt-1 w-4 h-4 accent-accent cursor-pointer"
            />
            <span className="text-[8px] text-gray-400 hover:text-gray-300 font-bold">Don't ask me again</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={handleInstall}
              className="min-h-10 px-4 py-2 bg-accent hover:bg-accent/90 active:bg-accent text-black font-black text-[8px] uppercase tracking-widest rounded-sm transition-colors duration-200 flex items-center justify-center"
            >
              Install
            </button>
            <button 
              onClick={handleDismiss}
              className="min-h-10 px-4 py-2 bg-black border border-surface-border hover:border-white/30 hover:bg-white/5 active:bg-white/10 text-gray-400 hover:text-white font-bold text-[8px] uppercase tracking-widest rounded-sm transition-colors duration-200 flex items-center justify-center"
            >
              Later
            </button>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="min-w-10 min-h-10 flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors duration-200 rounded-sm shrink-0"
          aria-label="Close install prompt"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
