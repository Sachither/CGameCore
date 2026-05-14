"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getPartnerApplicationsAction, approvePartnerApplicationAction } from "@/app/actions/admin-actions";
import { Zap, ShieldCheck, ShieldX, ExternalLink, Calendar, Users, Loader2, RefreshCw } from "lucide-react";
import { useCommandModal } from "@/context/CommandModalContext";

export default function AdminPartnersPage() {
  const { user } = useAuth();
  const command = useCommandModal();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApps = async () => {
    if (!user) return;
    setLoading(true);
    const res = await getPartnerApplicationsAction(await user.getIdToken());
    if (res.success && res.applications) {
      setApps(res.applications);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApps();
  }, [user]);

  const handleAction = async (appId: string, approved: boolean) => {
    if (!user) return;
    
    command.prompt({
      title: approved ? "APPROVE PARTNER" : "REJECT APPLICATION",
      message: approved 
        ? "You are about to grant PARTNER clearance to this operative. Enter your Security PIN to generate a referral code and enable commission tracking."
        : "You are about to reject this application. Enter your Security PIN to authorize this dismissal.",
      placeholder: "Security PIN Required",
      onConfirmWithInput: async (pin: string) => {
        setProcessingId(appId);
        try {
          const res = await approvePartnerApplicationAction(await user.getIdToken(), appId, approved, pin);
          if (res.success) {
            command.alert({ title: "TACTICAL UPDATE", message: approved ? "Operative upgraded to Partner status." : "Application rejected.", variant: 'success' });
            fetchApps();
          } else {
            command.alert({ title: "COMMAND ERROR", message: res.error || "Action failed.", variant: 'danger' });
          }
        } catch (e: any) {
          command.alert({ title: "SYSTEM ERROR", message: e.message, variant: 'danger' });
        }
        setProcessingId(null);
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="mb-10">
        <p className="text-[10px] text-orange-400 font-black uppercase tracking-[0.3em] mb-2">Recruitment Pipeline</p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Partner <span className="text-orange-400">Applications</span></h1>
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mt-2 leading-none flex items-center gap-2">
          Review credentials and approve creators for the CGame Elite program.
          <button onClick={fetchApps} className="text-orange-400 hover:text-white transition-colors ml-4">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Scanning Dossiers...</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/5 p-20 rounded-sm text-center">
           <Zap className="w-12 h-12 text-gray-800 mx-auto mb-4" />
           <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No pending applications in current sector.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {apps.map((app) => (
            <div key={app.id} className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden group hover:border-orange-500/30 transition-all">
               <div className="p-8 flex flex-col lg:flex-row gap-8">
                  {/* User Profile Info */}
                  <div className="lg:w-1/3 space-y-4">
                     <div>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{app.username}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{app.email}</p>
                     </div>
                     <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-gray-600" />
                           <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                             Applied: {new Date(app.appliedAt).toLocaleDateString()}
                           </span>
                        </div>
                     </div>
                     <div className="p-4 bg-white/5 border border-white/5 rounded-sm">
                        <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Operative ID</p>
                        <p className="text-[10px] text-white font-mono">{app.uid}</p>
                     </div>
                  </div>

                  {/* Channel Credentials */}
                  <div className="flex-1 space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-black/40 border border-white/5 p-5 rounded-sm">
                           <p className="text-[9px] text-orange-400 font-black uppercase tracking-widest mb-2">Platform / Channel</p>
                           <p className="text-xl font-black text-white italic uppercase tracking-tighter">{app.channelName}</p>
                           <a 
                             href={app.channelUrl} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-2 hover:underline"
                           >
                              Inspect Channel <ExternalLink className="w-3 h-3" />
                           </a>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-5 rounded-sm">
                           <p className="text-[9px] text-orange-400 font-black uppercase tracking-widest mb-2">Audience Size</p>
                           <div className="flex items-center gap-3">
                              <Users className="w-5 h-5 text-gray-600" />
                              <p className="text-2xl font-black text-white italic tracking-tighter">{app.followerCount.toLocaleString()}</p>
                           </div>
                           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">Verified Followers</p>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 pt-4">
                        <button 
                          onClick={() => handleAction(app.id, true)}
                          disabled={!!processingId}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-black py-4 rounded-sm text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/10"
                        >
                           {processingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                           Approve Contract
                        </button>
                        <button 
                          onClick={() => handleAction(app.id, false)}
                          disabled={!!processingId}
                          className="px-8 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-gray-500 hover:text-red-500 py-4 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
                        >
                           Reject
                        </button>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
