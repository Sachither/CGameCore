"use client";
import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { 
  createSupportTicketAction, 
  getUserTicketsAction 
} from '@/app/actions/ticket-actions';
import Link from 'next/link';

interface Ticket {
  ticketId: string;
  category: string;
  status: string;
  messageCount: number;
  createdAt: any;
  updatedAt: any;
  lastReplyBy?: string;
  username: string;
}

export default function SupportPage() {
  const toast = useToast();
  const { user, profile } = useAuth();
  
  const [category, setCategory] = useState('BUG_REPORT');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { value: 'BUG_REPORT', label: '🐛 Report a Bug' },
    { value: 'MATCH_DISPUTE', label: '⚖️ Match Dispute' },
    { value: 'PAYMENT_ISSUE', label: '💳 Payment Issue' },
    { value: 'ACCOUNT_ISSUE', label: '👤 Account Issue' },
    { value: 'FEATURE_REQUEST', label: '💡 Feature Request' },
    { value: 'OTHER', label: '📝 Other' },
  ];

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    'IN_PROGRESS': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'RESOLVED': 'bg-green-500/20 border-green-500/40 text-green-300',
    'CLOSED': 'bg-gray-500/20 border-gray-500/40 text-gray-300',
  };

  // Fetch user's tickets
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await getUserTicketsAction(token);
        if (result.success) {
          setTickets(result.tickets as Ticket[]);
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) {
      toast.error('Empty Report', 'Please provide details about your issue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const result = await createSupportTicketAction(token, category, message);

      if (result.success) {
        toast.success('Ticket Created', `Your ticket ${result.ticketId} has been submitted. Admin will respond soon.`);
        setMessage('');
        setCategory('BUG_REPORT');
        setShowForm(false);
        
        // Refresh tickets list
        const ticketsResult = await getUserTicketsAction(token);
        if (ticketsResult.success) {
          setTickets(ticketsResult.tickets as Ticket[]);
        }
      } else {
        toast.error('Submission Failed', result.error || 'Unknown error');
      }
    } catch (error: any) {
      toast.error('Submission Failed', error.message || 'Error creating ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen w-full pt-6 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <span className="text-2xl">🎫</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-main italic tracking-tighter uppercase">
                  Support <span className="text-accent">Tickets</span>
                </h1>
                <p className="text-sm text-sub font-bold uppercase tracking-widest mt-1">
                  Track & Resolve Issues
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="hidden sm:flex bg-accent hover:bg-accent/90 text-background font-black uppercase tracking-widest px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 items-center gap-2"
            >
              <span>+</span> New Ticket
            </button>
          </div>
        </div>

        {/* Create Ticket Form */}
        {showForm && (
          <div className="bg-surface border border-surface-border rounded-lg p-8 mb-8 animate-in fade-in">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-main uppercase tracking-wide">Create New Ticket</h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-sub hover:text-main transition-colors"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-main uppercase tracking-widest mb-3">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-surface-border text-main focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-main uppercase tracking-widest mb-3">
                  Details
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-surface-border text-main placeholder-sub/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-medium resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 rounded-lg border border-surface-border text-sub hover:text-main font-bold uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="bg-accent hover:bg-accent/90 disabled:bg-surface-border disabled:cursor-not-allowed text-background font-black uppercase tracking-widest px-6 py-2 rounded-lg transition-all flex items-center gap-2"
                >
                  {isSubmitting ? '...' : '✓'} Submit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* New Ticket Button (Mobile) */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="sm:hidden w-full bg-accent hover:bg-accent/90 text-background font-black uppercase tracking-widest py-3 rounded-lg transition-all mb-8 flex items-center justify-center gap-2"
          >
            <span>+</span> New Ticket
          </button>
        )}

        {/* Tickets List */}
        <div>
          <h2 className="text-xl font-black text-main uppercase tracking-wider mb-4">
            Your Tickets {tickets.length > 0 && `(${tickets.length})`}
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-surface-border border-t-accent rounded-full animate-spin" />
              <p className="text-sub mt-3">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="bg-surface border border-surface-border rounded-lg p-12 text-center">
              <p className="text-sub text-sm">No support tickets yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.ticketId}
                  href={`/dashboard/support/${ticket.ticketId}`}
                  className="block bg-surface border border-surface-border rounded-lg p-4 hover:border-accent/40 transition-all hover:bg-surface-hover group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-main uppercase truncate group-hover:text-accent transition-colors">
                          {ticket.ticketId}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusColors[ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-sub mb-2">{ticket.category}</p>
                      <p className="text-xs text-sub/70">{formatDate(ticket.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-accent-aware">
                        💬 {ticket.messageCount} {ticket.messageCount === 1 ? 'reply' : 'replies'}
                      </p>
                      {ticket.lastReplyBy === 'ADMIN' && (
                        <p className="text-xs text-accent mt-1">Admin replied</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
