"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  getTicketDetailAction,
  addTicketReplyAction,
  updateTicketStatusAction,
  deleteTicketAction,
} from '@/app/actions/ticket-actions';
import { useRouter, useParams } from 'next/navigation';
import { useCommandModal } from '@/context/CommandModalContext';

interface Message {
  messageId: string;
  authorUid: string;
  authorName: string;
  authorRole: 'USER' | 'ADMIN' | 'SYSTEM';
  message: string;
  createdAt: any;
  isSystemMessage: boolean;
}

interface Ticket {
  ticketId: string;
  category: string;
  status: string;
  priority: string;
  messageCount: number;
  createdAt: any;
  updatedAt: any;
  adminAssigned?: string;
}

export default function TicketDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const command = useCommandModal();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ticketId = params?.ticketId as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    'IN_PROGRESS': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'RESOLVED': 'bg-green-500/20 border-green-500/40 text-green-300',
    'CLOSED': 'bg-gray-500/20 border-gray-500/40 text-gray-300',
  };

  // Fetch ticket details
  useEffect(() => {
    const fetchTicket = async () => {
      if (!user) return;
      if (!ticketId) {
        console.error("No ticketId in params:", params);
        toast.error('Error', 'Invalid ticket ID');
        return;
      }
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await getTicketDetailAction(token, ticketId);
        if (result.success) {
          setTicket(result.ticket as Ticket);
          setMessages(result.messages as Message[]);
        } else {
          console.error("Ticket load failed:", result.error);
          toast.error('Error', result.error || 'Failed to load ticket');
          setTimeout(() => router.push('/dashboard/support'), 2000);
        }
      } catch (error: any) {
        console.error("Error fetching ticket:", error);
        toast.error('Error', error.message || 'Failed to load ticket');
        setTimeout(() => router.push('/dashboard/support'), 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [user, ticketId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !user) {
      toast.error('Empty Reply', 'Please provide a message');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const result = await addTicketReplyAction(token, ticketId, reply);
      if (result.success) {
        setReply('');
        // Refresh ticket
        const detailResult = await getTicketDetailAction(token, ticketId);
        if (detailResult.success) {
          setTicket(detailResult.ticket as Ticket);
          setMessages(detailResult.messages as Message[]);
        }
        toast.success('Reply Sent', 'Your message has been added to the ticket');
      } else {
        toast.error('Error', result.error || 'Failed to send reply');
      }
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!user) return;
    setStatusChangeLoading(true);
    try {
      const token = await user.getIdToken();
      const result = await updateTicketStatusAction(
        token,
        ticketId,
        newStatus as any
      );
      if (result.success) {
        const detailResult = await getTicketDetailAction(token, ticketId);
        if (detailResult.success) {
          setTicket(detailResult.ticket as Ticket);
          setMessages(detailResult.messages as Message[]);
        }
        toast.success('Status Updated', `Ticket marked as ${newStatus}`);
      } else {
        toast.error('Error', result.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to update status');
    } finally {
      setStatusChangeLoading(false);
    }
  };

  const handleDelete = async () => {
    command.confirm({
      title: "PERMANENT ERASURE",
      message: "Are you sure you want to permanently delete this ticket? This action cannot be undone and will be logged in the system audit.",
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setStatusChangeLoading(true);
        try {
          const token = await user.getIdToken();
          const result = await deleteTicketAction(token, ticketId);
          if (result.success) {
            toast.success('Ticket Deleted', 'Ticket has been permanently deleted');
            setTimeout(() => router.push('/dashboard/support'), 1500);
          } else {
            toast.error('Error', result.error || 'Failed to delete ticket');
          }
        } catch (error: any) {
          toast.error('Error', error.message || 'Failed to delete ticket');
        } finally {
          setStatusChangeLoading(false);
        }
      }
    });
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full pt-6 pb-12 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-surface-border border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-sub">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen w-full pt-6 pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sub text-center">Ticket not found</p>
        </div>
      </div>
    );
  }

  const isAdmin = user?.email?.includes('admin') || false; // Basic check

  return (
    <div className="min-h-screen w-full pt-6 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <button
              onClick={() => router.push('/dashboard/support')}
              className="text-sub hover:text-main transition-colors flex items-center gap-2 text-sm font-bold uppercase"
            >
              ← Back to Tickets
            </button>
          </div>

          <div className="bg-surface border border-surface-border rounded-lg p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-black text-main uppercase tracking-tighter">
                  {ticket.ticketId}
                </h1>
                <p className="text-sub text-sm mt-1">{ticket.category}</p>
              </div>
              <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider border ${statusColors[ticket.status]}`}>
                {ticket.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-sub text-xs uppercase tracking-widest mb-1">Created</p>
                <p className="text-main font-bold">{formatDate(ticket.createdAt)}</p>
              </div>
              <div>
                <p className="text-sub text-xs uppercase tracking-widest mb-1">Priority</p>
                <p className="text-main font-bold">{ticket.priority || 'NORMAL'}</p>
              </div>
              <div>
                <p className="text-sub text-xs uppercase tracking-widest mb-1">Messages</p>
                <p className="text-main font-bold">{ticket.messageCount}</p>
              </div>
              <div>
                <p className="text-sub text-xs uppercase tracking-widest mb-1">Last Updated</p>
                <p className="text-main font-bold">{formatDate(ticket.updatedAt)}</p>
              </div>
            </div>

            {/* Status Change Buttons (Admin Only) */}
            {isAdmin && ticket.status !== 'CLOSED' && (
              <div className="mt-6 pt-6 border-t border-surface-border space-y-3">
                <p className="text-xs font-bold text-accent-aware uppercase tracking-widest">Admin Actions:</p>
                <div className="flex gap-2 flex-wrap">
                  {ticket.status !== 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleStatusChange('IN_PROGRESS')}
                      disabled={statusChangeLoading}
                      className="px-3 py-1 text-sm font-bold bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded hover:bg-blue-500/30 transition-all disabled:opacity-50"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {ticket.status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleStatusChange('RESOLVED')}
                      disabled={statusChangeLoading}
                      className="px-3 py-1 text-sm font-bold bg-green-500/20 border border-green-500/40 text-green-300 rounded hover:bg-green-500/30 transition-all disabled:opacity-50"
                    >
                      Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange('CLOSED')}
                    disabled={statusChangeLoading}
                    className="px-3 py-1 text-sm font-bold bg-gray-500/20 border border-gray-500/40 text-gray-300 rounded hover:bg-gray-500/30 transition-all disabled:opacity-50"
                  >
                    Close Ticket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages Thread */}
        <div className="space-y-4 mb-8 max-h-[500px] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={msg.messageId}
              className={`rounded-lg p-4 border ${
                msg.isSystemMessage
                  ? 'bg-background border-surface-border'
                  : msg.authorRole === 'ADMIN'
                  ? 'bg-accent/5 border-accent/20'
                  : 'bg-surface border-surface-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="font-bold text-sm uppercase tracking-wide">
                    {msg.isSystemMessage ? '⚙️ System' : msg.authorRole === 'ADMIN' ? '👨‍💼 Admin' : '👤 You'}
                  </p>
                  <p className="text-xs text-sub mt-0.5">{formatDate(msg.createdAt)}</p>
                </div>
              </div>
              <p className="text-main text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.message}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Form */}
        {ticket.status !== 'CLOSED' && (
          <form onSubmit={handleReply} className="bg-surface border border-surface-border rounded-lg p-6">
            <h2 className="font-bold text-main uppercase tracking-wide mb-4">Add Reply</h2>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-background border border-surface-border text-main placeholder-sub/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-medium resize-none mb-4"
            />
            <button
              type="submit"
              disabled={submitting || !reply.trim()}
              className="bg-accent hover:bg-accent/90 disabled:bg-surface-border disabled:cursor-not-allowed text-background font-black uppercase tracking-widest px-6 py-2 rounded-lg transition-all flex items-center gap-2"
            >
              {submitting ? '...' : '💬'} Send Reply
            </button>
          </form>
        )}

        {ticket.status === 'CLOSED' && (
          <div className="bg-gray-500/10 border border-gray-500/40 rounded-lg p-6 text-center">
            <p className="text-sub font-bold uppercase tracking-wide">This ticket is closed</p>
            <p className="text-sm text-sub/70 mt-2">Create a new ticket if you need further assistance</p>
          </div>
        )}
      </div>
    </div>
  );
}
