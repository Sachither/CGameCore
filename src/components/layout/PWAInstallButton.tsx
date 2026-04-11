"use client";
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function PWAInstallButton() {
  const { canInstall, triggerInstall } = usePWAInstall();

  if (!canInstall) {
    return null;
  }

  return (
    <button 
      onClick={triggerInstall}
      className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-accent hover:text-white hover:bg-accent/10 rounded-sm transition-colors uppercase tracking-wide"
      title="Install CGame App"
    >
      <Download className="w-4 h-4" />
      <span className="hidden sm:inline">Install</span>
    </button>
  );
}
