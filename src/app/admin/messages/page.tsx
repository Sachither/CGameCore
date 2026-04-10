"use client";
import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MessageSquare, LayoutList, GripVertical, Loader2, Check, Trash2, MailOpen, Mail } from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface ContactMessage {
  id: string;
  subject: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'RESOLVED';
  createdAt: any;
}

export default function AdminMessages() {
  const toast = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "contact_messages"), orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContactMessage));
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast.error("Sync Error", "Failed to load communications");
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "contact_messages", id), { status: newStatus });
      toast.success("Status Updated", `Message marked as ${newStatus}`);
    } catch (err) {
      toast.error("Update Failed", "Could not change status");
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this transmission?")) return;
    try {
      await deleteDoc(doc(db, "contact_messages", id));
      toast.success("Purged", "Message deleted from servers");
    } catch (err) {
      toast.error("Purge Failed", "Could not delete message");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
            Command <span className="text-accent">Comms Link</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            Direct Transmissions from Operatives
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-surface border border-surface-border px-4 py-2 rounded-sm flex items-center gap-3">
             <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white">
               {messages.filter(m => m.status === 'UNREAD').length} Unread
             </span>
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="border border-surface-border border-dashed p-12 text-center rounded-sm bg-surface/20">
          <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">No incoming transmissions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {messages.map(msg => {
            const isUnread = msg.status === 'UNREAD';
            const isResolved = msg.status === 'RESOLVED';
            return (
               <div key={msg.id} className={`bg-surface border p-4 flex flex-col md:flex-row gap-6 transition-all rounded-sm ${isUnread ? 'border-accent/40 shadow-[0_0_15px_rgba(0,255,102,0.05)]' : 'border-surface-border opacity-70'}`}>
                 <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                       {isUnread ? <Mail className="w-4 h-4 text-accent" /> : isResolved ? <Check className="w-4 h-4 text-green-500" /> : <MailOpen className="w-4 h-4 text-gray-500" />}
                       <h3 className={`text-sm font-black uppercase tracking-widest ${isUnread ? 'text-white' : 'text-gray-400'}`}>{msg.subject}</h3>
                       <span className="text-[8px] text-gray-600 font-mono">
                          {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleString() : 'Just now'}
                       </span>
                    </div>
                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isUnread ? 'text-gray-300' : 'text-gray-500'}`}>
                       {msg.message}
                    </p>
                 </div>
                 
                 <div className="flex items-center gap-2 md:flex-col md:justify-start shrink-0 border-t md:border-t-0 md:border-l border-surface-border/50 pt-4 md:pt-0 md:pl-4">
                    {isUnread && (
                      <button 
                         onClick={() => updateStatus(msg.id, 'READ')}
                         className="flex-1 md:w-full bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest py-2 px-3 rounded-sm transition-colors text-center"
                      >
                         Mark Read
                      </button>
                    )}
                    {!isResolved && (
                      <button 
                         onClick={() => updateStatus(msg.id, 'RESOLVED')}
                         className="flex-1 md:w-full bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 text-[9px] font-black uppercase tracking-widest py-2 px-3 rounded-sm transition-colors text-center"
                      >
                         Resolve
                      </button>
                    )}
                    <button 
                       onClick={() => deleteMessage(msg.id)}
                       className="w-10 md:w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-2 px-3 flex items-center justify-center rounded-sm transition-colors"
                       title="Delete Transmission"
                    >
                       <Trash2 className="w-3.5 h-3.5" />
                    </button>
                 </div>
               </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
