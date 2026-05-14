"use client";
import React, { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { submitContactMessageAction } from '@/app/actions/contact-actions';

export default function ContactUs() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState('Match Dispute');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Empty Transmission', 'Please provide details before transmitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitContactMessageAction(
        subject, 
        message, 
        user?.uid, 
        profile?.username || user?.displayName || undefined
      );

      if (result.success) {
        toast.success('Transmission Sent', 'Command Center has received your message.');
        setMessage('');
      } else {
        toast.error('Transmission Failed', result.error || 'Unknown Error');
      }
    } catch (error: any) {
      toast.error('Transmission Failed', error.message || 'Error sending message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 animate-in fade-in duration-700">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-4">
          Contact <span className="text-accent">Us</span>
        </h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Command Center Uplink</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-surface border border-surface-border p-6 rounded-sm">
            <h3 className="text-white font-black uppercase tracking-widest mb-2 italic">Support Channels</h3>
            <p className="text-gray-400 text-sm mb-6">
              For rapid response regarding match disputes, deposit/withdrawal issues, or account security, please reach out through our official channels.
            </p>
            
            <div className="space-y-4">
              <a href="mailto:support@cgamecore.online" className="flex items-center gap-4 group p-3 bg-surface-hover border border-surface-border rounded-sm hover:border-accent transition-all">
                <div className="w-10 h-10 bg-accent/10 flex items-center justify-center rounded-sm">
                   <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                   <h4 className="text-white font-bold text-sm">Direct Email</h4>
                   <p className="text-xs text-accent">support@cgamecore.online</p>
                </div>
              </a>

              <a href="#" className="flex items-center gap-4 group p-3 bg-surface-hover border border-surface-border rounded-sm hover:border-accent transition-all">
                <div className="w-10 h-10 bg-[#5865F2]/10 flex items-center justify-center rounded-sm">
                   <svg className="w-5 h-5 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6081 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                </div>
                <div>
                   <h4 className="text-white font-bold text-sm">Discord Server</h4>
                   <p className="text-xs text-gray-500 opacity-60">Join community</p>
                </div>
              </a>

              <a href="https://x.com/cgamecore123?s=21" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group p-3 bg-surface-hover border border-surface-border rounded-sm hover:border-accent transition-all">
                <div className="w-10 h-10 bg-white/5 flex items-center justify-center rounded-sm">
                   <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </div>
                <div>
                   <h4 className="text-white font-bold text-sm">X (Twitter)</h4>
                   <p className="text-xs text-gray-400">@cgamecore123</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-surface-border p-6 rounded-sm">
          <h3 className="text-white font-black uppercase tracking-widest mb-4 italic">Direct Uplink</h3>
          <form className="space-y-4" onSubmit={handleSubmit}>
             <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Subject</label>
                <select 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-black border border-surface-border text-white text-sm p-3 rounded-[3px] focus:border-accent outline-none"
                >
                   <option>Match Dispute</option>
                   <option>Deposit/Withdrawal Issue</option>
                   <option>Report Cheating/Toxicity</option>
                   <option>General Inquiry</option>
                </select>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Message</label>
                <textarea 
                  rows={4} 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-black border border-surface-border text-white text-sm p-3 rounded-[3px] focus:border-accent outline-none resize-none"
                  placeholder="Detail your issue. Include Match IDs where necessary..."
                ></textarea>
             </div>
             <button 
               type="submit" 
               disabled={isSubmitting}
               className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-sm py-3 rounded-sm transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSubmitting ? 'Transmitting...' : 'Transmit Message'}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
}
