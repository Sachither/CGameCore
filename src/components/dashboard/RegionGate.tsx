"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { updateUserRegionAction } from "@/app/actions/user-actions";
import { Loader2, Globe, CheckCircle2 } from "lucide-react";

export default function RegionGate() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Only show if the profile is loaded but country is mission
  if (!profile || profile.country) return null;

  const regions = [
    { name: "Nigeria", country: "NG", currency: "NGN", flag: "🇳🇬" },
    { name: "Ghana", country: "GH", currency: "GHS", flag: "🇬🇭" },
    { name: "South Africa", country: "ZA", currency: "ZAR", flag: "🇿🇦" },
    { name: "Kenya", country: "KE", currency: "KES", flag: "🇰🇪" },
    { name: "Other (International)", country: "OTH", currency: "USD", flag: "🌐" }
  ];

  const handleSelect = async (country: string, currency: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await updateUserRegionAction(idToken, country, currency);
      if (res.success) {
        setSuccess(true);
        // Page will refresh via AuthProvider snapshot or user can dismiss
        setTimeout(() => window.location.reload(), 1500);
      } else {
        alert("Failed to save region: " + res.error);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-sm p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-accent-aware" />
        
        {success ? (
          <div className="py-12 text-center animate-in fade-in zoom-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-accent-aware mx-auto mb-6" />
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">Region Locked</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Calibrating gateways for your sector...</p>
          </div>
        ) : (
          <>
          <div className="flex items-center gap-3 mb-8">
               <Globe className={`w-6 h-6 ${success ? 'text-accent-aware animate-spin' : 'text-accent-aware'}`} />
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                  {success ? "Synchronizing" : "Select Region"}
               </h2>
            </div>

             <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6 leading-relaxed">
               {success 
                 ? "Finalizing regional financial protocols. Please wait while we calibrate your local gateways..." 
                 : "To enable local payment gateways and verified withdrawals, please select your operative region."}
             </p>

             {!success && (
               <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
                 {regions.map((reg) => (
                   <button
                     key={reg.country}
                     disabled={loading}
                     onClick={() => handleSelect(reg.country, reg.currency)}
                     className="group flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-accent-aware/50 hover:bg-accent-aware/[0.01] rounded-sm transition-all text-left disabled:opacity-50"
                   >
                     <div className="flex items-center gap-4">
                       <span className="text-2xl group-hover:scale-110 transition-transform">{reg.flag}</span>
                       <div>
                         <p className="text-white font-black italic uppercase tracking-tighter text-lg leading-none">{reg.name}</p>
                         <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Native Currency: {reg.currency}</p>
                       </div>
                     </div>
                     <div className="w-6 h-6 border border-white/10 rounded-full flex items-center justify-center group-hover:border-accent-aware group-hover:bg-accent-aware transition-all">
                        <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100" />
                     </div>
                   </button>
                 ))}
               </div>
             )}

             {success && (
                <div className="py-8 flex flex-col items-center justify-center animate-pulse">
                   <div className="w-full h-1 bg-white/5 overflow-hidden rounded-full mb-4">
                      <div className="h-full bg-accent-aware w-1/2 animate-[shimmer_2s_infinite]" style={{ background: 'linear-gradient(90deg, transparent, #23ff66, transparent)' }} />
                   </div>
                   <p className="text-[10px] text-accent-aware font-black uppercase tracking-[0.3em]">Sector Locking...</p>
                </div>
             )}

            {loading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                <Loader2 className="w-8 h-8 text-accent-aware animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
