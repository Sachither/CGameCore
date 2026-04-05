"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ActiveMatchesRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect malformed /active requests back to the main matches dashboard
    router.replace('/dashboard/matches');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-sub font-black uppercase tracking-widest text-[10px]">Restoring Tactical Feed...</div>
    </div>
  );
}
