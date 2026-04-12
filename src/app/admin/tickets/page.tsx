"use client";
import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAllTicketsAction } from '@/app/actions/ticket-actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Ticket {
  ticketId: string;
  uid: string;
  username: string;
  category: string;
  status: string;
  priority: string;
  messageCount: number;
  createdAt: any;
  updatedAt: any;
  lastReplyBy?: string;
}

export default function AdminTicketsPage() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('OPEN');
  const [searchQuery, setSearchQuery] = useState('');

  const statusColors: Record<string, string> = {
    'OPEN': 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
    'IN_PROGRESS': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    'RESOLVED': 'bg-green-500/20 border-green-500/40 text-green-300',
    'CLOSED': 'bg-gray-500/20 border-gray-500/40 text-gray-300',
  };

  // Fetch all tickets
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const result = await getAllTicketsAction(token);
        if (result.success) {
          setTickets(result.tickets as Ticket[]);
        } else {
          toast.error('Error', result.error || 'Failed to load tickets');
          router.push('/admin');
        }
      } catch (error) {
        console.error("Error fetching tickets:", error);
        toast.error('Error', 'Failed to load tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user]);

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesFilter = filter === 'ALL' || ticket.status === filter;
    const matchesSearch = 
      ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'OPEN').length,
    inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
    closed: tickets.filter(t => t.status === 'CLOSED').length,
  };

  return (
    <div className="min-h-screen w-full pt-6 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="text-2xl">🎫</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-main italic tracking-tighter uppercase">
                Support <span className="text-accent">Tickets</span>
              </h1>
              <p className="text-sm text-sub font-bold uppercase tracking-widest mt-1">
                Admin Dashboard
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-surface border border-surface-border rounded-lg p-4">
              <p className="text-xs font-bold text-sub uppercase tracking-widest">Total</p>
              <p className="text-2xl font-black text-main mt-1">{stats.total}</p>
            </div>
            <div className="bg-surface border border-yellow-500/20 rounded-lg p-4">
              <p className="text-xs font-bold text-yellow-300 uppercase tracking-widest">Open</p>
              <p className="text-2xl font-black text-yellow-300 mt-1">{stats.open}</p>
            </div>
            <div className="bg-surface border border-blue-500/20 rounded-lg p-4">
              <p className="text-xs font-bold text-blue-300 uppercase tracking-widest">In Progress</p>
              <p className="text-2xl font-black text-blue-300 mt-1">{stats.inProgress}</p>
            </div>
            <div className="bg-surface border border-green-500/20 rounded-lg p-4">
              <p className="text-xs font-bold text-green-300 uppercase tracking-widest">Resolved</p>
              <p className="text-2xl font-black text-green-300 mt-1">{stats.resolved}</p>
            </div>
            <div className="bg-surface border border-gray-500/20 rounded-lg p-4">
              <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Closed</p>
              <p className="text-2xl font-black text-gray-300 mt-1">{stats.closed}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm transition-all ${
                  filter === status
                    ? 'bg-accent text-background'
                    : 'bg-surface border border-surface-border text-sub hover:text-main'
                }`}
              >
                {status === 'IN_PROGRESS' ? 'In Progress' : status}
              </button>
            ))}
          </div>
          <div>
            <input
              type="text"
              placeholder="Search by Ticket ID, User, or Category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-surface border border-surface-border text-main placeholder-sub/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-surface-border border-t-accent rounded-full animate-spin" />
            <p className="text-sub mt-3">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-surface border border-surface-border rounded-lg p-12 text-center">
            <p className="text-sub text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="bg-surface border border-surface-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Ticket</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Messages</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Last Update</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-sub uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket, idx) => (
                    <tr key={ticket.ticketId} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-black/50' : ''}`}>
                      <td className="px-6 py-4">
                        <Link href={`/admin/tickets/${ticket.ticketId}`} className="font-bold text-red-400 hover:text-red-300 underline">
                          {ticket.ticketId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-main">{ticket.username}</td>
                      <td className="px-6 py-4 text-sm text-sub">{ticket.category}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${statusColors[ticket.status]}`}>
                          {ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-accent-aware font-bold">💬 {ticket.messageCount}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-sub">{formatDate(ticket.updatedAt)}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/tickets/${ticket.ticketId}`}
                          className="text-red-400 hover:text-red-300 font-bold text-sm uppercase tracking-wider transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
