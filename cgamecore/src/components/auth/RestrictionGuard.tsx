"use client";
import React from "react";
import { useAuth } from "./AuthProvider";
import { ShieldAlert, LogOut, Clock, Landmark } from "lucide-react";
import { auth } from "@/lib/firebase";

export function RestrictionGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) return children;
  if (!profile) return children;

  // Check Restrictions
  const isPermanentlyBanned = profile.isBanned && !profile.suspendedUntil;
  const suspensionEnd = profile.suspendedUntil ? (profile.suspendedUntil.toDate ? profile.suspendedUntil.toDate() : new Date(profile.suspendedUntil)) : null;
  const isCurrentlySuspended = suspensionEnd && suspensionEnd > new Date();

  if (!isPermanentlyBanned && !isCurrentlySuspended) {
    return children;
  }

  const handleLogout = () => auth.signOut();

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent)]" />
      
      <div className="relative max-w-sm w-full">
         <div className="w-24 h-24 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.1)]">
            <ShieldAlert className="w-12 h-12 text-red-500" />
         </div>

         <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">Platform <span className="text-red-500">Lockdown</span></h1>
         <p className="text-[10px] text-red-500/60 font-black uppercase tracking-[0.3em] mb-8">Security Protocol Active</p>

         <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-sm mb-8 text-left">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-3">Restriction Notice</p>
            <p className="text-sm font-bold text-gray-300 leading-relaxed mb-6">
               Your operative account has been restricted due to a protocol violation: <br/>
               <span className="text-red-400">"{profile.banReason || "Undisclosed security breach."}"</span>
            </p>

            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest p-3 bg-red-500/5 border border-red-500/10 rounded-sm">
               {isPermanentlyBanned ? (
                  <>
                     <ShieldAlert className="w-4 h-4 text-red-500" />
                     <span className="text-red-500">Permanent Lockdown</span>
                  </>
               ) : (
                  <>
                     <Clock className="w-4 h-4 text-yellow-500" />
                     <span className="text-yellow-500">Suspension Expires: {suspensionEnd?.toLocaleString()}</span>
                  </>
               )}
            </div>

            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest p-3 mt-2 bg-yellow-500/5 border border-yellow-500/10 rounded-sm">
                <Landmark className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-500">Financial Vault: LOCKED</span>
            </div>
         </div>

         <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-10 leading-relaxed">
            If you believe this is a tactical error, please contact Command via the official Discord channel.
         </p>

         <button 
           onClick={handleLogout}
           className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-white/10 transition-all font-mono"
         >
            <LogOut className="w-4 h-4" />
            Exit Command Center
         </button>
      </div>
    </div>
  );
}
