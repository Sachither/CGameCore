"use client";

import Link from 'next/link';

interface RestrictedDashboardPromptProps {
  callback: string;
  title?: string;
  description?: string;
}

export default function RestrictedDashboardPrompt({
  callback,
  title = 'Identification Required',
  description = 'Enlist to access your tactical financial records, personal match history, and elite rank progression.',
}: RestrictedDashboardPromptProps) {
  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl border border-white/10 bg-black/30 p-10 text-center">
      <h1 className="text-4xl font-black text-main italic uppercase tracking-tighter mb-4">{title}</h1>
      <p className="text-[10px] text-sub font-bold uppercase tracking-[0.2em] mb-8 leading-relaxed">
        {description}
      </p>
      <Link
        href={`/login?callback=${encodeURIComponent(callback)}`}
        className="inline-flex items-center justify-center bg-accent text-black px-10 py-4 rounded-sm font-black uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:bg-accent-hover transition-all"
      >
        Enlist Now
      </Link>
    </div>
  );
}
