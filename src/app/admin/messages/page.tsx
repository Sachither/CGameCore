"use client";
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db as firebaseDb } from "@/lib/firebase";
import { MessageSquare, LayoutList, GripVertical, Loader2, Check, Trash2, MailOpen, Mail, Megaphone, ShieldAlert, Send, RefreshCw, Flag, UserX } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { adminUpdateAnnouncementAction, adminPurgeMessagesAction, getReportedMessagesAction, adminDeleteMessageAction, adminSeedCommunityMessagesAction, adminDeleteSeedMessagesAction } from "@/app/actions/community-actions";
import { adminToggleChatSuspensionAction } from "@/app/actions/admin-actions";
import { useCommandModal } from "@/context/CommandModalContext";
import { Database, Zap, Ghost } from "lucide-react";

interface ContactMessage {
  id: string;
  subject: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'RESOLVED';
  createdAt: any;
}

export default function AdminMessages() {
  const toast = useToast();
  const command = useCommandModal();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [reportedMessages, setReportedMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'support' | 'community'>('support');
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(firebaseDb, "contact_messages"), orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactMessage));
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Sync Error", "Failed to load communications");
      setLoading(false);
    });

    fetchReported();
    return () => unsub();
  }, []);

  const fetchReported = async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await getReportedMessagesAction(idToken);
      if (res.success) setReportedMessages(res.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(firebaseDb, "contact_messages", id), { status: newStatus });
      toast.success("Status Updated", `Message marked as ${newStatus}`);
    } catch (err) {
      toast.error("Update Failed", "Could not change status");
    }
  };

  const deleteMessage = async (id: string) => {
    command.confirm({
      title: "ERASE TRANSMISSION",
      message: "Are you sure you want to permanently delete this support transmission? This action is irreversible.",
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(firebaseDb, "contact_messages", id));
          toast.success("Purged", "Message deleted from servers");
        } catch (err) {
          toast.error("Purge Failed", "Could not delete message");
        }
      }
    });
  };

  const deleteReportedMessage = async (msgId: string) => {
    command.confirm({
      title: "EXECUTE PURGE",
      message: "Permanently erase this reported community transmission? Operational logs will reflect this removal.",
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminDeleteMessageAction(idToken, msgId);
          if (res.success) {
            toast.success("PURGED", "The flagged intel has been erased.");
            fetchReported();
          } else {
            toast.error("FAILED", res.error);
          }
        } catch (err) {
          toast.error("COMM_ERROR", "Neural link unstable.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const suspendUser = async (uid: string, username: string) => {
    command.confirm({
      title: "REVOKE ACCESS",
      message: `Authorize indefinite suspension of chat privileges for ${username}? This operative will be disconnected immediately.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminToggleChatSuspensionAction(idToken, uid, true, 0);
          if (res.success) {
            toast.success("ACCESS REVOKED", `${username} has been disconnected from the war room.`);
          } else {
            toast.error("ACTION FAILED", res.error);
          }
        } catch (err) {
          toast.error("COMM_ERROR", "Neural link unstable.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleBroadcast = async (game: 'CODM' | 'EFOOTBALL' | 'GENERAL') => {
    if (!user) return;
    const input = (document.getElementById('admin-broadcast-input') as HTMLTextAreaElement)?.value || '';
    
    setIsActionLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await adminUpdateAnnouncementAction(idToken, input, game);
      if (res.success) {
        toast.success("BROADCAST SYNCED", `Directives updated for ${game} sector.`);
        (document.getElementById('admin-broadcast-input') as HTMLTextAreaElement).value = '';
      } else {
        toast.error("SYNC FAILED", res.error);
      }
    } catch (err) {
      toast.error("COMM_ERROR", "Neural link unstable.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePurge = async (days: number) => {
    command.confirm({
      title: "TACTICAL MEMORY WIPE",
      message: `Authorize permanent erasure of all community messages older than ${days} days? This protocol cannot be reversed.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminPurgeMessagesAction(idToken, days);
          if (res.success) {
            toast.success("MEMORY WIPED", `Data older than ${days} days has been erased.`);
          } else {
            toast.error("WIPE FAILED", res.error);
          }
        } catch (err) {
          toast.error("COMM_ERROR", "Neural link unstable.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handleSeed = async () => {
    command.confirm({
      title: "INJECT TACTICAL INTEL",
      message: "Authorize injection of 25 synthetic transmissions into community sectors? This will simulate organic activity across CODM, eFootball, and General sectors.",
      variant: 'info',
      confirmText: "Initialize Seeding",
      onConfirm: async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminSeedCommunityMessagesAction(idToken);
          if (res.success) {
            toast.success("SEEDED", `Injected ${res.count} transmissions. Total in sector: ${res.totalInDb}`);
          } else {
            toast.error("SEED FAILED", res.error);
          }
        } catch (err) {
          toast.error("COMM_ERROR", "Neural link unstable.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  const handlePurgeSeeds = async () => {
    command.confirm({
      title: "PURGE SYNTHETIC INTEL",
      message: "Permanently erase ALL system-generated seed transmissions? Real user data will remain untouched.",
      variant: 'danger',
      confirmText: "Execute Purge",
      onConfirm: async () => {
        if (!user) return;
        setIsActionLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminDeleteSeedMessagesAction(idToken);
          if (res.success) {
            toast.success("PURGED", "All synthetic intelligence has been erased.");
          } else {
            toast.error("PURGE FAILED", res.error);
          }
        } catch (err) {
          toast.error("COMM_ERROR", "Neural link unstable.");
        } finally {
          setIsActionLoading(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            Command <span className="text-red-500">Comms Link</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">
            Tactical Intelligence & Community Management
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-white/5 p-1 bg-white/[0.02] rounded-sm">
        <button
          onClick={() => setActiveTab('support')}
          className={`flex-1 flex items-center justify-center gap-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'support' ? 'bg-red-500 text-black shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-gray-500 hover:text-white'}`}
        >
          <Mail className="w-4 h-4" />
          Support Transmissions
          {messages.filter(m => m.status === 'UNREAD').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse ml-1" />
          )}
        </button>
        <button
          onClick={() => { setActiveTab('community'); fetchReported(); }}
          className={`flex-1 flex items-center justify-center gap-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'community' ? 'bg-red-500 text-black shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-gray-500 hover:text-white'}`}
        >
          <MessageSquare className="w-4 h-4" />
          Community Operations
        </button>
      </div>

      {activeTab === 'support' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {messages.length === 0 ? (
            <div className="border border-white/5 border-dashed p-12 text-center rounded-sm bg-white/[0.02]">
              <MessageSquare className="w-8 h-8 text-gray-800 mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 italic">No incoming transmissions</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {messages.map(msg => {
                const isUnread = msg.status === 'UNREAD';
                const isResolved = msg.status === 'RESOLVED';
                return (
                   <div key={msg.id} className={`bg-[#0a0a0a] border p-6 flex flex-col md:flex-row gap-8 transition-all rounded-sm ${isUnread ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : 'border-white/5 opacity-60'}`}>
                     <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-sm flex items-center justify-center border ${isUnread ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-gray-600'}`}>
                              {isUnread ? <Mail className="w-5 h-5" /> : <MailOpen className="w-5 h-5" />}
                           </div>
                           <div>
                              <h3 className={`text-sm font-black uppercase tracking-widest ${isUnread ? 'text-white' : 'text-gray-500'}`}>{msg.subject}</h3>
                              <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mt-1">
                                 Timestamp: {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleString() : 'Just now'}
                              </p>
                           </div>
                        </div>
                        <p className={`text-xs leading-relaxed whitespace-pre-wrap font-medium p-4 bg-black/40 rounded-sm border border-white/[0.03] ${isUnread ? 'text-gray-200' : 'text-gray-600'}`}>
                           {msg.message}
                        </p>
                     </div>
                     
                     <div className="flex items-center gap-2 md:flex-col md:w-32 shrink-0">
                        {isUnread && (
                          <button 
                             onClick={() => updateStatus(msg.id, 'READ')}
                             className="flex-1 md:w-full bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest py-3 rounded-sm transition-all"
                          >
                             Acknowledge
                          </button>
                        )}
                        {!isResolved && (
                          <button 
                             onClick={() => updateStatus(msg.id, 'RESOLVED')}
                             className="flex-1 md:w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest py-3 rounded-sm transition-all"
                          >
                             Resolve
                          </button>
                        )}
                        <button 
                           onClick={() => deleteMessage(msg.id)}
                           className="w-12 md:w-full bg-red-500/5 hover:bg-red-500/10 text-red-800 border border-red-500/5 py-3 flex items-center justify-center rounded-sm transition-all"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                   </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
           {/* Announcement Block */}
           <div className="bg-[#0a0a0a] border border-white/5 p-8 rounded-sm">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 rounded-sm bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                    <Megaphone className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Global HQ Broadcast</h2>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Inject Tactical Directives into User Feeds</p>
                 </div>
              </div>

              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] text-gray-600 font-black uppercase tracking-widest block mb-3">Broadcast Transmission</label>
                    <textarea 
                      id="admin-broadcast-input"
                      className="w-full bg-black border border-white/10 focus:border-red-500 text-white p-5 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-800 h-32 resize-none"
                      placeholder="Enter the directive operatives will see..."
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={() => handleBroadcast('GENERAL')}
                      disabled={isActionLoading}
                      className="py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white hover:text-red-500 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                    >
                      {isActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Sync to General
                    </button>
                    <button
                      onClick={() => handleBroadcast('CODM')}
                      disabled={isActionLoading}
                      className="py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white hover:text-red-500 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                    >
                      {isActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Sync to CODM
                    </button>
                    <button
                      onClick={() => handleBroadcast('EFOOTBALL')}
                      disabled={isActionLoading}
                      className="py-4 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 text-white hover:text-red-500 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                    >
                      {isActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Sync to eFootball
                    </button>
                 </div>
                 <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest italic text-center">
                    Sending an empty message will clear the active broadcast for that sector.
                 </p>
              </div>
           </div>

            {/* Reported Intel Block */}
            <div className="bg-[#0a0a0a] border border-yellow-500/10 p-8 rounded-sm">
               <div className="flex items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-sm bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
                       <Flag className="w-6 h-6" />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Reported Intelligence</h2>
                       <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Messages Flagged by the Community for HQ Review</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={fetchReported}
                    className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh Intel
                  </button>
               </div>

               {reportedMessages.length === 0 ? (
                 <div className="border border-white/5 border-dashed p-10 text-center rounded-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-700 italic">No violations reported in current sector</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                    {reportedMessages.map(msg => (
                      <div key={msg.id} className="bg-black/40 border border-white/5 p-4 rounded-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded-sm">
                                  {msg.reportCount} Reports
                               </span>
                               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                  User: {msg.username} ({msg.game})
                               </span>
                            </div>
                            <p className="text-xs text-white font-medium italic border-l-2 border-yellow-500/30 pl-3 py-1">
                               "{msg.content}"
                            </p>
                         </div>
                         <div className="flex gap-2 shrink-0">
                            <button 
                              onClick={() => deleteReportedMessage(msg.id)}
                              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-2"
                            >
                               <Trash2 className="w-3.5 h-3.5" />
                               Purge
                            </button>
                            <button 
                              onClick={() => suspendUser(msg.userId, msg.username)}
                              className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-2"
                            >
                               <UserX className="w-3.5 h-3.5" />
                               Suspend
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Purge Block */}
            <div className="bg-[#0a0a0a] border border-red-500/10 p-8 rounded-sm">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-sm bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-500">
                     <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                     <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Tactical Memory Wipe</h2>
                     <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Purge Legacy Data to Maintain Operational Lean</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '24 Hours', days: 1 },
                    { label: '48 Hours', days: 2 },
                    { label: '7 Days', days: 7 },
                    { label: '30 Days', days: 30 }
                  ].map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => handlePurge(opt.days)}
                      disabled={isActionLoading}
                      className="py-6 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex flex-col items-center gap-2 group"
                    >
                      <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Purge Older Than</span>
                      <span className="text-white opacity-60 font-black">{opt.label}</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* Tactical Intelligence Seeding Block */}
            <div className="bg-[#0a0a0a] border border-blue-500/10 p-8 rounded-sm">
               <div className="flex items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-sm bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Ghost className="w-6 h-6" />
                     </div>
                     <div>
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Community Seeder</h2>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Simulate Organic Operational Activity</p>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleSeed}
                    disabled={isActionLoading}
                    className="group relative overflow-hidden py-8 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 rounded-sm transition-all text-left px-8"
                  >
                     <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="w-16 h-16 text-blue-500" />
                     </div>
                     <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Inject Synthetic Intel</h3>
                     <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Deploy 25 tactical transmissions across all sectors</p>
                  </button>

                  <button
                    onClick={handlePurgeSeeds}
                    disabled={isActionLoading}
                    className="group relative overflow-hidden py-8 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-sm transition-all text-left px-8"
                  >
                     <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Database className="w-16 h-16 text-red-500" />
                     </div>
                     <h3 className="text-sm font-black text-red-500 uppercase tracking-widest mb-1">Purge Tactical Seeds</h3>
                     <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Permanently erase all synthetic intelligence data</p>
                  </button>
               </div>
            </div>
        </div>
      )}
    </div>
  );
}

