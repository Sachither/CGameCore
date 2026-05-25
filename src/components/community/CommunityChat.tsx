"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  getCommunityMessagesAction, 
  sendCommunityMessageAction, 
  getActiveAnnouncementAction,
  adminDeleteMessageAction,
  reportCommunityMessageAction
} from '@/app/actions/community-actions';
import { markAllNotificationsAsReadAction } from '@/app/actions/notification-actions';
import { 
  MessageSquare, 
  Send, 
  Gamepad2, 
  Trophy, 
  Megaphone, 
  PlusCircle, 
  History,
  Zap,
  ChevronRight,
  Smile,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Flag,
  X,
  Heart,
  Reply
} from 'lucide-react';
import Link from 'next/link';
import { toggleLikeMessageAction } from '@/app/actions/community-actions';
import TierBadge from './TierBadge';
import { getTierFromWins } from '@/lib/tier-utils';

type Channel = 'GENERAL' | 'CODM' | 'EFOOTBALL';

interface Message {
  id: string;
  userId: string | null;
  username: string;
  avatarId: number;
  content: string;
  game: Channel;
  isGif: boolean;
  likes: string[];
  replyToId?: string;
  replyToUser?: string;
  replyToContent?: string;
  createdAt: Date | string;
  userWins?: number;
}

// Helper to highlight @mentions
const renderContentWithMentions = (content: string, isOwnMessage: boolean) => {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span 
          key={index} 
          className={`px-1 py-0.5 rounded-sm font-bold ${isOwnMessage ? 'bg-black/20 text-white' : 'bg-accent/20 text-accent'}`}
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

interface Announcement {
  id: string;
  content: string;
  game: Channel;
}

interface CommunityChatProps {
  initialMessages?: Message[];
  initialAnnouncement?: Announcement | null;
}

export default function CommunityChat({ initialMessages = [], initialAnnouncement = null }: CommunityChatProps) {
  const { user, profile } = useAuth();
  const [activeChannel, setActiveChannel] = useState<Channel>('GENERAL');

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [announcement, setAnnouncement] = useState<Announcement | null>(initialAnnouncement);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(initialMessages.length === 0);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const activeChannelRef = useRef<Channel>(activeChannel);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const orderedMessages = [...messages].reverse();

  // --- AUTO-CLEAR NOTIFICATIONS ---
  useEffect(() => {
    if (user) {
      markAllNotificationsAsReadAction(user.uid);
    }
  }, [user, activeChannel]);

  // 🛡️ MODAL STATE
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning';
  } | null>(null);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);

  const emojis = ['🔥', '🎮', '🏆', '🎯', '👑', '💪', '💀', '💯', '🚀', '⭐', '🤝', '😤', '👏', '🙌', '👀', '🤫'];
  
  const curatedGifs = [
    { name: 'Victory', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocXN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/l0HlHFRbmaZtBRhXG/giphy.gif' },
    { name: 'GG', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocXN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/26u4b45b8KlgAB7iM/giphy.gif' },
    { name: 'Clutch', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocXN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpx4BdcxH5D2/giphy.gif' },
    { name: 'Lobby', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocXN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7TKMGpx4BdcxH5D2/giphy.gif' },
    { name: 'Boom', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJocXN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6N3Z6amN6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/26u4b45b8KlgAB7iM/giphy.gif' }
  ];

  const [replyingTo, setReplyingTo] = useState<{ id: string; user: string; content: string } | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToMessage = (messageId: string) => {
    const ref = messageRefs.current[messageId];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref.classList.add('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-black');
      window.setTimeout(() => ref.classList.remove('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-black'), 1800);
    }
  };

  const handleSendGif = async (url: string) => {
    if (!user || isSending) return;
    setIsSending(true);
    setShowGif(false);
    try {
      const idToken = await user.getIdToken();
      const res = await sendCommunityMessageAction(idToken, url, activeChannel, true, replyingTo || undefined);
      if (res.success) {
        setReplyingTo(null);
        fetchMessages();
      }
      else setError(res.error || "GIF delivery failed.");
    } catch (err) {
      setError("Uplink unstable.");
    } finally {
      setIsSending(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmoji(false);
  };

  // Poll for messages every 5 seconds - but only if the tab is focused
  useEffect(() => {
    setIsLoading(true);
    setAnnouncement(null);

    // Initial fetch for the new channel
    fetchMessages();
    fetchAnnouncement();
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
        fetchAnnouncement();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  const fetchMessages = async () => {
    const channelAtRequest = activeChannel;
    const res = await getCommunityMessagesAction(channelAtRequest);
    if (activeChannelRef.current !== channelAtRequest) return;

    if (res.success && res.messages) {
      setMessages(res.messages as any);
    }
    setIsLoading(false);
  };

  const fetchAnnouncement = async () => {
    const channelAtRequest = activeChannel;
    const res = await getActiveAnnouncementAction(channelAtRequest);
    if (activeChannelRef.current !== channelAtRequest) return;

    if (res.success && res.announcement) {
      setAnnouncement(res.announcement as any);
    } else {
      setAnnouncement(null);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    if (!user || !profile) {
      setError("REGISTRATION_REQUIRED: Join the Arena to participate.");
      return;
    }

    const content = inputText.trim();
    setInputText('');
    setIsSending(true);
    setError(null);
    
    // ⚡ OPTIMISTIC UI: Show the message immediately
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      userId: user.uid,
      username: profile.username || "Operative",
      avatarId: profile.avatarId || 0,
      content: content,
      game: activeChannel,
      isGif: false,
      likes: [],
      replyToId: replyingTo?.id,
      replyToUser: replyingTo?.user,
      replyToContent: replyingTo?.content,
      createdAt: new Date(),
      userWins: profile.totalWins || 0
    };

    setMessages(prev => [optimisticMsg, ...prev]);
    setReplyingTo(null);

    try {
      const idToken = await user.getIdToken();
      const res = await sendCommunityMessageAction(idToken, content, activeChannel, false, replyingTo || undefined);
      
      if (!res.success) {
        // Rollback on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setError(res.error || "Transmission failed.");
        setInputText(content); // Restore text
      } else {
        // Refresh to get the real ID and timestamp from server
        fetchMessages();
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setError("Neural link unstable. Try again.");
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = async (msgId: string) => {
    if (!user) return;
    
    // ⚡ OPTIMISTIC LIKE: Update UI instantly
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const hasLiked = m.likes.includes(user.uid);
        return {
          ...m,
          likes: hasLiked ? m.likes.filter(id => id !== user.uid) : [...m.likes, user.uid]
        };
      }
      return m;
    }));

    try {
      const idToken = await user.getIdToken();
      const res = await toggleLikeMessageAction(idToken, msgId);
      if (!res.success) {
        // Rollback or refresh on failure
        fetchMessages();
      }
    } catch (err) {
      fetchMessages();
    }
  };

  const handleDelete = (msgId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "PURGE TRANSMISSION",
      message: "Are you sure you want to permanently erase this operational intelligence from the war room?",
      variant: 'danger',
      onConfirm: async () => {
        setIsSending(true);
        try {
          const idToken = await user?.getIdToken();
          if (!idToken) {
            setError("Unauthorized: Admin credentials required.");
            return;
          }
          const res = await adminDeleteMessageAction(idToken, msgId);
          if (res.success) {
            setMessages(prev => prev.filter(m => m.id !== msgId));
            await fetchMessages();
          } else {
            setError(res.error || "Delete failed.");
          }
        } catch (err: any) {
          setError(err?.message || "Delete failed.");
        } finally {
          setIsSending(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleReport = (msgId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "REPORT VIOLATION",
      message: "Flag this transmission for HQ review? False reporting is a violation of platform protocols.",
      variant: 'warning',
      onConfirm: async () => {
        const idToken = await user?.getIdToken();
        if (idToken) {
          const res = await reportCommunityMessageAction(idToken, msgId);
          if (res.success) setError("Transmission flagged for HQ review.");
        }
        setConfirmModal(null);
      }
    });
  };

  const formatTime = (date: Date | string) => {
    if (!mounted) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col relative pb-32">
      
      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-xs p-6 rounded-sm shadow-2xl scale-in-center">
              <div className="flex items-center gap-3 mb-4">
                 <div className={`p-2 rounded-sm ${confirmModal.variant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    <AlertTriangle className="w-5 h-5" />
                 </div>
                 <h3 className="text-sm font-black uppercase tracking-tighter text-white">{confirmModal.title}</h3>
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed mb-6">
                 {confirmModal.message}
              </p>
              <div className="flex gap-2">
                 <button 
                   type="button"
                   onClick={() => setConfirmModal(null)}
                   className="flex-1 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                 >
                   Abstain
                 </button>
                 <button 
                   type="button"
                   onClick={confirmModal.onConfirm}
                   className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${confirmModal.variant === 'danger' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]'}`}
                 >
                   Execute
                 </button>
              </div>
           </div>
        </div>
      )}
      
      {/* Community Header & Channels */}
      <div className="w-full border-b border-white/10 px-4 py-4 shrink-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">War Room Chat</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Live Operational Intel</p>
            </div>
          </div>

          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-accent text-black px-4 py-2 rounded-sm transition-all hover:bg-accent-hover"
          >
            <Trophy className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Host Match</span>
          </Link>
        </div>

        <div className="flex gap-2">
          {(['GENERAL', 'CODM', 'EFOOTBALL'] as Channel[]).map((channel) => (
            <button
              type="button"
              key={channel}
              onClick={() => setActiveChannel(channel)}
              className={`flex-1 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
                activeChannel === channel 
                  ? 'bg-accent text-black shadow-[0_0_15px_rgba(0,255,102,0.4)]' 
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {channel === 'GENERAL' && 'General Lobby'}
              {channel === 'CODM' && 'CODM Arena'}
              {channel === 'EFOOTBALL' && 'eFootball'}
            </button>
          ))}
        </div>
      </div>

      {/* Announcement Banner */}
      {announcement && mounted && (
        <div className="bg-accent/10 border-b border-accent/20 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-in slide-in-from-top duration-500">
          <div className="shrink-0 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/30">
            <Megaphone className="w-4 h-4 text-accent animate-bounce" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-0.5">HQ BROADCAST</p>
            <p className="text-xs text-white/90 font-bold break-words whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div 
        className="p-6 space-y-4 bg-[radial-gradient(circle_at_50%_50%,rgba(20,20,20,1)_0%,rgba(0,0,0,1)_100%)]"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
            <Zap className="w-8 h-8 text-accent animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Establishing Uplink...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-30">
            <History className="w-12 h-12 text-gray-600" />
            <p className="text-sm font-black italic uppercase tracking-tighter text-gray-400">Radio Silence</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Be the first to break the silence</p>
          </div>
        ) : (
          orderedMessages.map((msg, idx) => (
            <div
              key={msg.id}
              ref={(el) => {
                if (el) {
                  messageRefs.current[msg.id] = el;
                } else {
                  delete messageRefs.current[msg.id];
                }
              }}
              className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-end gap-2 max-w-[85%] ${msg.userId === user?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="shrink-0 w-8 h-8 rounded-sm bg-surface-hover border border-surface-border overflow-hidden shadow-lg flex items-center justify-center">
                  <div 
                    className="w-[400%] h-[500%]"
                    style={{
                      backgroundImage: `url('/avatar_collection.png')`,
                      backgroundSize: '400% 500%',
                      backgroundPosition: `${(msg.avatarId || 0) % 4 * 33.33}% ${Math.floor((msg.avatarId || 0) / 4) * 25}%`
                    }}
                  />
                </div>

                {/* Bubble */}
                <div className="flex flex-col group/msg relative">
                  <div className={`flex items-center gap-2 mb-1 ${msg.userId === user?.uid ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      {msg.username}
                    </span>
                    <TierBadge tier={getTierFromWins(msg.userWins || 0)} />
                    <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      {msg.userId !== user?.uid && user && (
                        <button 
                          type="button"
                          onClick={() => handleReport(msg.id)}
                          className="p-1 text-gray-700 hover:text-yellow-500 transition-colors"
                          title="Report Violation"
                        >
                          <Flag className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quoted Message */}
                  {msg.replyToId && (
                    <div
                      onClick={() => scrollToMessage(msg.replyToId!)}
                      title="Go to original message"
                      className={`mb-1 p-2 rounded-lg border-l-2 border-accent/50 bg-white/5 text-[10px] max-w-xs truncate ${msg.userId === user?.uid ? 'mr-1' : 'ml-1'} cursor-pointer hover:bg-white/10 transition-colors`}
                    >
                      <p className="text-accent font-black uppercase tracking-tighter mb-0.5">@{msg.replyToUser}</p>
                      <p className="text-gray-400 italic truncate">{msg.replyToContent}</p>
                    </div>
                  )}

                  <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm font-medium relative group/bubble ${
                    msg.userId === user?.uid 
                      ? 'bg-accent text-black rounded-tr-none' 
                      : 'bg-surface-hover text-white border border-surface-border rounded-tl-none'
                  }`}>
                    {msg.isGif ? (
                      <img src={msg.content} alt="GIF" className="max-w-full rounded-md" />
                    ) : (
                      renderContentWithMentions(msg.content, msg.userId === user?.uid)
                    )}

                    {/* Like/Reply Toolbar (Floating) */}
                    <div className={`absolute -bottom-5 flex items-center gap-2 z-10 ${msg.userId === user?.uid ? 'right-0' : 'left-0'}`}>
                       <button 
                         type="button"
                         onClick={() => handleLike(msg.id)}
                         className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase transition-all hover:scale-110 active:scale-95 ${
                           msg.likes?.includes(user?.uid || '')
                             ? 'bg-red-500/10 border-red-500/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                             : 'bg-black border-white/10 text-gray-500 hover:text-white'
                         }`}
                       >
                         <Heart className={`w-2.5 h-2.5 ${msg.likes?.includes(user?.uid || '') ? 'fill-current' : ''}`} />
                         {msg.likes?.length || 0}
                       </button>

                       <button 
                         type="button"
                         onClick={() => setReplyingTo({ id: msg.id, user: msg.username, content: msg.isGif ? '[Visual Intel]' : msg.content })}
                         className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/10 bg-black text-gray-500 text-[9px] font-black uppercase hover:text-accent hover:border-accent/50 transition-all hover:scale-110 active:scale-95"
                       >
                         <Reply className="w-2.5 h-2.5" />
                         Reply
                       </button>
                    </div>

                    {/* Admin Delete Button */}
                    {(profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.isAdmin) && (
                      <button 
                        type="button"
                        onClick={() => handleDelete(msg.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/bubble:opacity-100 transition-opacity shadow-lg z-10 hover:scale-110"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <span className={`text-[8px] font-bold text-gray-600 mt-6 uppercase ${msg.userId === user?.uid ? 'text-right mr-1' : 'ml-1'}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Input Area */}
      <div 
        className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width)] z-50 flex justify-center p-4 bg-[#090909]/95 border-t border-white/10 backdrop-blur-md shadow-[0_-10px_30px_rgba(0,0,0,0.6)] transition-all duration-300"
      >
        <div className="w-full max-w-5xl">
        
        {/* Emoji Picker Popover */}
        {showEmoji && (
          <div className="absolute bottom-full right-4 mb-2 p-3 bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
             {emojis.map(e => (
               <button 
                 type="button"
                 key={e} 
                 onClick={() => addEmoji(e)}
                 className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/5 rounded-sm transition-colors"
               >
                 {e}
               </button>
             ))}
          </div>
        )}

        {/* GIF Picker Popover */}
        {showGif && (
          <div className="absolute bottom-full right-4 mb-2 w-64 p-3 bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
             <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-3">Tactical Visuals</p>
             <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                {curatedGifs.map((gif, i) => (
                  <button 
                    type="button"
                    key={i} 
                    onClick={() => handleSendGif(gif.url)}
                    className="relative aspect-video bg-white/5 rounded-sm overflow-hidden group"
                  >
                    <img src={gif.url} alt={gif.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black uppercase tracking-widest text-white bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      {gif.name}
                    </span>
                  </button>
                ))}
             </div>
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-3 p-3 bg-accent/5 border-l-2 border-accent rounded-sm flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300">
            <div className="overflow-hidden">
               <p className="text-[8px] font-black uppercase tracking-tighter text-accent mb-0.5">Replying to @{replyingTo.user}</p>
               <p className="text-[10px] text-gray-400 truncate italic">{replyingTo.content}</p>
            </div>
            <button 
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {error}
          </div>
        )}

        {user ? (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={activeChannel === 'GENERAL' ? "Send intel..." : `Strategy for ${activeChannel}...`}
                className="w-full bg-black border border-white/10 focus:border-accent/50 text-white text-sm px-4 py-3 rounded-xl outline-none transition-all pr-24"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button" 
                  onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
                  className={`p-2 transition-colors ${showEmoji ? 'text-accent' : 'text-gray-500 hover:text-accent'}`}
                >
                  <Smile className="w-4 h-4" />
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
                  className={`p-2 transition-colors ${showGif ? 'text-accent' : 'text-gray-500 hover:text-accent'}`}
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="bg-accent disabled:bg-surface-hover text-black p-3 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,255,102,0.3)] disabled:shadow-none"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between bg-black/40 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-5 h-5 text-gray-600" />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Login to join the transmission</p>
            </div>
            <Link 
              href="/login" 
              className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-1"
            >
              Sign In <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
