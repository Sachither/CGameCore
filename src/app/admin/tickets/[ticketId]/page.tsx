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
import Link from 'next/link';

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
  username: string;
  uid: string;
}

export default function AdminTicketDetailPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ticketId = params?.ticketId as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
        setTimeout(() => router.push('/admin/tickets'), 2000);
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
          setTimeout(() => router.push('/admin/tickets'), 2000);
        }
      } catch (error: any) {
        console.error("Error fetching ticket:", error);
        toast.error('Error', error.message || 'Failed to load ticket');
        setTimeout(() => router.push('/admin/tickets'), 2000);
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

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user) return;
    
    setDeleteConfirmOpen(false);
    setStatusChangeLoading(true);
    try {
      const token = await user.getIdToken();
      const result = await deleteTicketAction(token, ticketId);
      if (result.success) {
        toast.success('Ticket Deleted', 'Ticket has been permanently deleted');
        setTimeout(() => router.push('/admin/tickets'), 1500);
      } else {
        toast.error('Error', result.error || 'Failed to delete ticket');
      }
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to delete ticket');
    } finally {
      setStatusChangeLoading(false);
    }
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
          <div className="inline-block w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin mb-4" />
          <p className="text-red-400">Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen w-full pt-6 pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <Link href="/admin/tickets" className="text-red-400 hover:text-red-300 flex items-center gap-2 mb-6">
            ← Back to Tickets
          </Link>
          <p className="text-gray-400 text-center">Ticket not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/tickets" className="text-red-400 hover:text-red-300 flex items-center gap-2 mb-6 text-sm font-bold uppercase">
          ← Back to All Tickets
        </Link>

        <div className="bg-[#0a0a0a] border border-red-500/10 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
                {ticket.ticketId}
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                From: <span className="text-white font-bold">{ticket.username}</span>
              </p>
              <p className="text-gray-500 text-xs mt-1">{ticket.category}</p>
            </div>
            <span className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider border ${statusColors[ticket.status]}`}>
              {ticket.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-6 pt-6 border-t border-red-500/10">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Created</p>
              <p className="text-white font-bold">{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Priority</p>
              <p className="text-white font-bold">{ticket.priority || 'NORMAL'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Messages</p>
              <p className="text-white font-bold">{ticket.messageCount}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Last Updated</p>
              <p className="text-white font-bold">{formatDate(ticket.updatedAt)}</p>
            </div>
          </div>

          {/* Admin Status Change Buttons */}
          {ticket.status !== 'CLOSED' && (
            <div className="mt-6 pt-6 border-t border-red-500/10 space-y-3">
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Admin Actions:</p>
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

          {/* Delete Button - Always Available */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDeleteClick}
              disabled={statusChangeLoading}
              className="px-3 py-1 text-sm font-bold bg-red-600/20 border border-red-600/40 text-red-300 rounded hover:bg-red-600/30 transition-all disabled:opacity-50"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-4 mb-8 max-h-[500px] overflow-y-auto">
        {messages.map((msg, idx) => (
          <div
            key={msg.messageId}
            className={`rounded-lg p-4 border ${
              msg.isSystemMessage
                ? 'bg-[#0a0a0a] border-gray-500/20'
                : msg.authorRole === 'ADMIN'
                ? 'bg-red-500/5 border-red-500/20'
                : 'bg-[#0a0a0a] border-gray-500/20'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="font-bold text-sm uppercase tracking-wide">
                  {msg.isSystemMessage ? '⚙️ System' : msg.authorRole === 'ADMIN' ? '👨‍💼 Admin' : '👤 User'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formatDate(msg.createdAt)}</p>
              </div>
            </div>
            <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
              {msg.message}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Form */}
      {ticket.status !== 'CLOSED' && (
        <form onSubmit={handleReply} className="bg-[#0a0a0a] border border-red-500/10 rounded-lg p-6">
          <h2 className="font-bold text-white uppercase tracking-wide mb-4">Add Admin Reply</h2>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your response to the user..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-black border border-red-500/20 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all font-medium resize-none mb-4"
          />
          <button
            type="submit"
            disabled={submitting || !reply.trim()}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest px-6 py-2 rounded-lg transition-all flex items-center gap-2"
          >
            {submitting ? '...' : '💬'} Send Reply
          </button>
        </form>
      )}

      {ticket.status === 'CLOSED' && (
        <div className="bg-gray-500/10 border border-gray-500/40 rounded-lg p-6 text-center">
          <p className="text-gray-400 font-bold uppercase tracking-wide">This ticket is closed</p>
          <p className="text-sm text-gray-500 mt-2">No further replies can be added</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-red-500/30 rounded-lg p-8 max-w-sm w-full shadow-2xl">
            <h2 className="text-xl font-black text-red-400 uppercase mb-3 tracking-wider">Delete Ticket?</h2>
            <p className="text-sm text-gray-400 mb-6 font-bold">This action cannot be undone. The ticket and all messages will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 px-4 py-2 rounded bg-gray-500/10 border border-gray-500/40 text-gray-300 font-bold hover:bg-gray-500/20 transition-all uppercase text-sm tracking-wide"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={statusChangeLoading}
                className="flex-1 px-4 py-2 rounded bg-red-600/20 border border-red-600/40 text-red-300 font-bold hover:bg-red-600/30 transition-all disabled:opacity-50 uppercase text-sm tracking-wide"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
