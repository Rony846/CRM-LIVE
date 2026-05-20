import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Ticket, Phone, Clock, Wrench, AlertTriangle, CheckCircle,
  Loader2, Eye, Play, Send, ArrowUpCircle, Camera, PhoneCall, FileText,
  Search, History, Shield, User, Package, List, ChevronLeft, ChevronRight, Mail,
  MessageSquare, Timer, AlarmClock, Sparkles
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

// SLA timer helper — returns countdown / breach state for a ticket
const slaInfo = (ticket) => {
  const due = ticket?.sla_due;
  if (!due) return null;
  const STOPPED = ['closed', 'closed_by_agent', 'resolved_on_call', 'resolved', 'delivered'];
  if (STOPPED.includes(ticket.status)) return null;
  const dueDate = new Date(due);
  if (isNaN(dueDate.getTime())) return null;
  const mins = (dueDate.getTime() - Date.now()) / 60000;
  if (mins < 0) {
    const hrs = Math.floor(-mins / 60);
    return { tone: 'red', label: hrs >= 1 ? `Breached ${hrs}h` : `Breached`, mins };
  }
  if (mins < 30) return { tone: 'red', label: `${Math.round(mins)}m left`, mins };
  if (mins < 120) return { tone: 'amber', label: `${Math.round(mins)}m left`, mins };
  if (mins < 1440) return { tone: 'emerald', label: `${Math.round(mins / 60)}h left`, mins };
  return { tone: 'slate', label: `${Math.round(mins / 60)}h left`, mins };
};

const SLABadge = ({ ticket, withIcon = true }) => {
  const info = slaInfo(ticket);
  if (!info) return null;
  const tones = {
    red: 'bg-red-100 text-red-700 border-red-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${tones[info.tone]}`}>
      {withIcon && <Timer className="w-3 h-3" />}
      {info.label}
    </span>
  );
};

// Days-to-expiry for warranties — returns null if no end date
const warrantyExpiryInfo = (warranty) => {
  if (!warranty?.warranty_end_date) return null;
  const end = new Date(warranty.warranty_end_date);
  if (isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: 'slate', label: `Expired ${-days}d ago`, days };
  if (days <= 7) return { tone: 'red', label: `Expires in ${days}d`, days };
  if (days <= 30) return { tone: 'amber', label: `Expires in ${days}d`, days };
  return null; // no badge for healthy warranties
};

export default function CallSupportDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [feedbackCalls, setFeedbackCalls] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ pending: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [feedbackCallOpen, setFeedbackCallOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  
  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Customer history state
  const [customerHistory, setCustomerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Outbound message state (WhatsApp / SMS from ticket)
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState('whatsapp');
  const [messageDraft, setMessageDraft] = useState('');
  const [messageSending, setMessageSending] = useState(false);

  // Missed-call queue state
  const [missedCalls, setMissedCalls] = useState([]);
  const [missedLoading, setMissedLoading] = useState(false);

  // AI suggestion + KB sidebar
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);
  const [kbSuggestions, setKbSuggestions] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [cannedResponses, setCannedResponses] = useState([]);
  
  // All tickets state
  const [allTickets, setAllTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('all');
  
  // Pagination state for All Tickets
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const [allTicketsLoading, setAllTicketsLoading] = useState(false);
  const ticketsPerPage = 100;

  // Action form state
  const [actionData, setActionData] = useState({
    status: '',
    diagnosis: '',
    issue_type: '',
    agent_notes: ''
  });

  // Create ticket form state
  const [newTicket, setNewTicket] = useState({
    device_type: '',
    order_id: '',
    issue_description: '',
    customer_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ticketsRes, feedbackRes] = await Promise.all([
        axios.get(`${API}/tickets`, { headers }),
        axios.get(`${API}/feedback-calls`, { headers }).catch(() => ({ data: { calls: [], stats: {} } }))
      ]);
      const ticketData = ticketsRes.data;
      setTickets(ticketData);
      setFeedbackCalls(feedbackRes.data.calls || []);
      setFeedbackStats(feedbackRes.data.stats || { pending: 0, completed: 0 });
      
      // Compute stats from tickets locally
      const openTickets = ticketData.filter(t => 
        t.status === 'open' || t.status === 'new_request' ||
        (t.support_type === 'phone' && t.status === 'call_support_followup')
      ).length;
      const inProgress = ticketData.filter(t => 
        t.status === 'in_progress' || t.status === 'call_support_followup'
      ).length;
      const diagnosedToday = ticketData.filter(t => t.status === 'diagnosed').length;
      const hardwareRouted = ticketData.filter(t => t.support_type === 'hardware').length;

      // SLA awareness — breached + breaching within 2h
      const slaBreached = ticketData.filter(t => {
        const i = slaInfo(t);
        return i && i.mins < 0;
      }).length;
      const slaSoon = ticketData.filter(t => {
        const i = slaInfo(t);
        return i && i.mins >= 0 && i.mins < 120;
      }).length;

      setStats({
        open_tickets: openTickets,
        in_progress: inProgress,
        diagnosed_today: diagnosedToday,
        hardware_routed: hardwareRouted,
        pending_feedback_calls: feedbackRes.data.stats?.pending || 0,
        sla_breached: slaBreached,
        sla_soon: slaSoon,
      });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch paginated all tickets
  const fetchAllTickets = async (page = 1, statusFilter = 'all') => {
    setAllTicketsLoading(true);
    try {
      // Fetch all tickets with high limit (API already gives call_support full access)
      let url = `${API}/tickets?limit=10000`;
      
      // Apply status filter server-side for single status
      if (statusFilter !== 'all' && statusFilter !== 'open') {
        url = `${API}/tickets?limit=10000&status=${statusFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let ticketData = response.data;
      
      // Client-side filter for "open" which includes multiple statuses
      if (statusFilter === 'open') {
        ticketData = ticketData.filter(t => 
          ['new_request', 'open', 'call_support_followup'].includes(t.status)
        );
      }
      
      setTotalTickets(ticketData.length);
      
      // Apply client-side pagination
      const startIndex = (page - 1) * ticketsPerPage;
      const paginatedData = ticketData.slice(startIndex, startIndex + ticketsPerPage);
      setAllTickets(paginatedData);
    } catch (error) {
      toast.error('Failed to load tickets');
    } finally {
      setAllTicketsLoading(false);
    }
  };

  // Fetch all tickets when tab changes or filter changes
  useEffect(() => {
    if (activeTab === 'all-tickets') {
      fetchAllTickets(currentPage, ticketFilter);
    }
  }, [activeTab, currentPage, ticketFilter]);

  // Fetch missed-call queue
  const fetchMissedCalls = async () => {
    setMissedLoading(true);
    try {
      const r = await axios.get(`${API}/missed-calls/queue`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { hours: 24 },
      });
      setMissedCalls(r.data?.missed_calls || []);
    } catch (e) {
      toast.error('Failed to load missed calls');
    } finally {
      setMissedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'missed') {
      fetchMissedCalls();
    }
  }, [activeTab]);

  const dismissMissedCall = async (callId, reason = 'agent_dismissed') => {
    try {
      await axios.post(
        `${API}/missed-calls/${callId}/resolve`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Removed from queue');
      fetchMissedCalls();
    } catch (e) {
      toast.error('Failed to dismiss');
    }
  };

  const viewTicketDetails = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  const openActionDialog = (ticket) => {
    setSelectedTicket(ticket);
    setActionData({
      status: '',
      diagnosis: '',
      issue_type: '',
      agent_notes: ''
    });
    setActionOpen(true);
  };

  const handleUpdateTicket = async () => {
    if (!actionData.status && !actionData.diagnosis && !actionData.agent_notes) {
      toast.error('Please enter at least one update');
      return;
    }

    setActionLoading(true);
    try {
      const updates = {};
      if (actionData.status) updates.status = actionData.status;
      if (actionData.diagnosis) updates.diagnosis = actionData.diagnosis;
      if (actionData.issue_type) updates.issue_type = actionData.issue_type;
      if (actionData.agent_notes) updates.agent_notes = actionData.agent_notes;

      await axios.patch(`${API}/tickets/${selectedTicket.id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket updated successfully');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRouteToHardware = async () => {
    if (!actionData.agent_notes || actionData.agent_notes.length < 100) {
      toast.error('Notes must be at least 100 characters');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', actionData.agent_notes);

      await axios.post(`${API}/tickets/${selectedTicket.id}/route-to-hardware`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket routed to hardware service');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to route ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateToSupervisor = async () => {
    if (!actionData.agent_notes || actionData.agent_notes.length < 100) {
      toast.error('Notes must be at least 100 characters to escalate');
      return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', actionData.agent_notes);

      await axios.post(`${API}/tickets/${selectedTicket.id}/escalate-to-supervisor`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket escalated to supervisor');
      setActionOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to escalate ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.device_type || !newTicket.issue_description) {
      toast.error('Please fill in device type and issue description');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('device_type', newTicket.device_type);
      formData.append('issue_description', newTicket.issue_description);
      if (newTicket.order_id) formData.append('order_id', newTicket.order_id);
      if (newTicket.customer_id) formData.append('customer_id', newTicket.customer_id);
      
      await axios.post(`${API}/tickets`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Ticket created successfully');
      setCreateOpen(false);
      setNewTicket({ device_type: '', order_id: '', issue_description: '', customer_id: '' });
      fetchData();
    } catch (error) {
      console.error('Create ticket error:', error);
      toast.error('Failed to create ticket: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const openTickets = tickets.filter(t => 
    t.status === 'open' || t.status === 'new_request' || 
    (t.support_type === 'phone' && t.status === 'call_support_followup')
  );
  const inProgressTickets = tickets.filter(t => 
    t.status === 'in_progress' || t.status === 'diagnosed' ||
    t.status === 'call_support_followup'
  );

  // Global search function
  const handleGlobalSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }
    
    setSearchLoading(true);
    try {
      // Determine search type based on input
      const params = {};
      if (searchQuery.includes('@')) {
        params.email = searchQuery;
      } else if (/^\d{10,}$/.test(searchQuery.replace(/[^0-9]/g, ''))) {
        params.phone = searchQuery.replace(/[^0-9]/g, '');
      } else if (searchQuery.toUpperCase().startsWith('MG')) {
        params.serial_number = searchQuery;
      } else {
        params.order_id = searchQuery;
      }
      
      const response = await axios.get(`${API}/customers/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setSearchResults(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Fetch customer history for a ticket
  const fetchCustomerHistory = async (ticketId) => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}/customer-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomerHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch customer history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  // Enhanced view ticket that also fetches history
  const viewTicketWithHistory = async (ticketId) => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedTicket(response.data);
      setDetailsOpen(true);
      // Reset AI / KB state for the new ticket
      setAiSuggestion(response.data?.ai_suggestion?.suggestion || null);
      setAiGeneratedAt(response.data?.ai_suggestion?.generated_at || null);
      // Also fetch customer history + KB suggestions
      fetchCustomerHistory(ticketId);
      fetchKbSuggestions(ticketId);
    } catch (error) {
      toast.error('Failed to load ticket');
    }
  };

  const fetchKbSuggestions = async (ticketId) => {
    setKbLoading(true);
    try {
      const r = await axios.get(`${API}/tickets/${ticketId}/kb-suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 3 },
      });
      setKbSuggestions(r.data?.suggestions || []);
    } catch (e) {
      setKbSuggestions([]);
    } finally {
      setKbLoading(false);
    }
  };

  const runAiSuggest = async (force = false) => {
    if (!selectedTicket) return;
    setAiLoading(true);
    try {
      const r = await axios.post(
        `${API}/tickets/${selectedTicket.id}/ai-suggest${force ? '?force=true' : ''}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiSuggestion(r.data?.suggestion || null);
      setAiGeneratedAt(r.data?.generated_at || (r.data?.cached ? aiGeneratedAt : new Date().toISOString()));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI suggestion failed');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchCannedResponses = async (channel) => {
    try {
      const r = await axios.get(`${API}/canned-responses`, {
        headers: { Authorization: `Bearer ${token}` },
        params: channel ? { channel } : {},
      });
      setCannedResponses(r.data?.canned_responses || []);
    } catch (e) {
      setCannedResponses([]);
    }
  };

  // Send WhatsApp / SMS to customer from the open ticket
  const handleSendMessage = async () => {
    if (!selectedTicket) return;
    if (messageChannel === 'whatsapp' && !messageDraft.trim()) {
      toast.error('Type a message before sending');
      return;
    }
    setMessageSending(true);
    try {
      const res = await axios.post(
        `${API}/tickets/${selectedTicket.id}/send-message`,
        { channel: messageChannel, message: messageDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(`${messageChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} sent`);
        setMessageOpen(false);
        setMessageDraft('');
        // Reload the ticket so the history shows the new entry
        viewTicketWithHistory(selectedTicket.id);
      } else {
        toast.error(res.data?.error || 'Send failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send');
    } finally {
      setMessageSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Call Support Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Call Support Dashboard">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" data-testid="support-stats">
        <StatCard
          title="SLA Breached"
          value={stats?.sla_breached || 0}
          icon={AlarmClock}
          className={stats?.sla_breached > 0 ? 'ring-2 ring-red-400 bg-red-50' : ''}
        />
        <StatCard
          title="Breaching in 2h"
          value={stats?.sla_soon || 0}
          icon={Timer}
          className={stats?.sla_soon > 0 ? 'ring-2 ring-amber-400 bg-amber-50' : ''}
        />
        <StatCard title="Open Tickets" value={stats?.open_tickets || 0} icon={Ticket} />
        <StatCard title="In Progress" value={stats?.in_progress || 0} icon={Clock} />
        <StatCard title="Diagnosed" value={stats?.diagnosed_today || 0} icon={CheckCircle} />
        <StatCard
          title="Pending Feedback"
          value={stats?.pending_feedback_calls || 0}
          icon={PhoneCall}
          className={stats?.pending_feedback_calls > 0 ? 'ring-2 ring-orange-400' : ''}
        />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList className="flex-wrap">
                <TabsTrigger value="queue" data-testid="queue-tab">
                  <Phone className="w-4 h-4 mr-2" />
                  Ticket Queue ({openTickets.length})
                </TabsTrigger>
                <TabsTrigger value="working" data-testid="working-tab">
                  <Clock className="w-4 h-4 mr-2" />
                  Working ({inProgressTickets.length})
                </TabsTrigger>
                <TabsTrigger value="all-tickets" data-testid="all-tickets-tab">
                  <List className="w-4 h-4 mr-2" />
                  All Tickets
                </TabsTrigger>
                <TabsTrigger value="search" data-testid="search-tab">
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </TabsTrigger>
                <TabsTrigger
                  value="feedback"
                  data-testid="feedback-tab"
                  className={feedbackCalls.filter(c => c.status === 'pending').length > 0 ? 'text-orange-500' : ''}
                >
                  <PhoneCall className="w-4 h-4 mr-2" />
                  Feedback Calls ({feedbackCalls.filter(c => c.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger value="missed" data-testid="missed-tab" className={missedCalls.length > 0 ? 'text-red-500' : ''}>
                  <AlarmClock className="w-4 h-4 mr-2" />
                  Missed Calls {missedCalls.length > 0 && `(${missedCalls.length})`}
                </TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={() => window.location.href = '/support/email-inbox'}
                  data-testid="email-inbox-btn"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email Inbox
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setCreateOpen(true)}
                  data-testid="create-ticket-btn"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  New Ticket
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <TabsContent value="queue" className="mt-0">
              {openTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>All tickets handled! Queue is empty.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...openTickets].sort((a, b) => {
                      const ai = slaInfo(a)?.mins ?? Number.POSITIVE_INFINITY;
                      const bi = slaInfo(b)?.mins ?? Number.POSITIVE_INFINITY;
                      return ai - bi;
                    }).map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{ticket.customer_phone}</span>
                            {ticket.customer_phone && (
                              <ClickToCallButton
                                phone={ticket.customer_phone}
                                customerName={ticket.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.issue_description}</TableCell>
                        <TableCell><SLABadge ticket={ticket} /></TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(ticket.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => viewTicketWithHistory(ticket.id)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              onClick={() => openActionDialog(ticket)}
                              data-testid={`work-ticket-${ticket.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Work
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="working" className="mt-0">
              {inProgressTickets.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No tickets in progress</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...inProgressTickets].sort((a, b) => {
                      const ai = slaInfo(a)?.mins ?? Number.POSITIVE_INFINITY;
                      const bi = slaInfo(b)?.mins ?? Number.POSITIVE_INFINITY;
                      return ai - bi;
                    }).map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell><SLABadge ticket={ticket} /></TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.diagnosis || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(ticket)}
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* All Tickets Tab */}
            <TabsContent value="all-tickets" className="mt-0">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  All Tickets View
                </h4>
                <p className="text-sm text-blue-700">
                  View all tickets across all departments. Click on any ticket to see customer history and details.
                </p>
              </div>
              
              <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex gap-4 items-center">
                  <Select value={ticketFilter} onValueChange={(v) => { setTicketFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="hardware_service">Hardware Service</SelectItem>
                      <SelectItem value="repair_completed">Repair Completed</SelectItem>
                      <SelectItem value="received_at_factory">At Factory</SelectItem>
                      <SelectItem value="in_repair">In Repair</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="bg-white">
                    {totalTickets} total tickets
                  </Badge>
                </div>
                
                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {Math.max(1, Math.ceil(totalTickets / ticketsPerPage))}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || allTicketsLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= Math.ceil(totalTickets / ticketsPerPage) || allTicketsLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {allTicketsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {ticket.ticket_number}
                        </TableCell>
                        <TableCell>{ticket.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{ticket.customer_phone}</span>
                            {ticket.customer_phone && (
                              <ClickToCallButton
                                phone={ticket.customer_phone}
                                customerName={ticket.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{ticket.device_type}</TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell><SLABadge ticket={ticket} /></TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => viewTicketWithHistory(ticket.id)}
                              data-testid={`view-ticket-${ticket.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedTicket(ticket);
                                fetchCustomerHistory(ticket.id);
                                setDetailsOpen(true);
                              }}
                              data-testid={`history-ticket-${ticket.id}`}
                            >
                              <History className="w-4 h-4 mr-1" />
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              {/* Bottom Pagination */}
              {allTickets.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-slate-600">
                    Showing {Math.min(ticketsPerPage, allTickets.length)} of {totalTickets} tickets
                  </span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || allTicketsLoading}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm px-3">
                      Page {currentPage}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(totalTickets / ticketsPerPage) || allTicketsLoading}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Global Search Tab */}
            <TabsContent value="search" className="mt-0">
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-1 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Customer Search
                </h4>
                <p className="text-sm text-green-700">
                  Search for any customer by phone number, email, serial number, or order ID to find their complete history.
                </p>
              </div>

              <form onSubmit={handleGlobalSearch} className="mb-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="Enter phone number, email, serial number (MG...), or order ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="global-search-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={searchLoading}
                    data-testid="global-search-btn"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Search
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Enter phone (10 digits), email, serial number starting with MG, or order ID
                </p>
              </form>

              {searchResults && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">{searchResults.total_tickets || 0}</p>
                        <p className="text-sm text-blue-600">Tickets Found</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{searchResults.total_warranties || 0}</p>
                        <p className="text-sm text-green-600">Warranties</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">{searchResults.total_dispatches || 0}</p>
                        <p className="text-sm text-purple-600">Dispatches</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tickets Results */}
                  {searchResults.tickets?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Ticket className="w-4 h-4" />
                        Tickets ({searchResults.tickets.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.tickets.map((ticket) => (
                            <TableRow key={ticket.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {ticket.ticket_number}
                              </TableCell>
                              <TableCell>{ticket.customer_name}</TableCell>
                              <TableCell className="font-mono text-sm">{ticket.customer_phone}</TableCell>
                              <TableCell>{ticket.device_type}</TableCell>
                              <TableCell><StatusBadge status={ticket.status} /></TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => viewTicketWithHistory(ticket.id)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Warranties Results */}
                  {searchResults.warranties?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Warranties ({searchResults.warranties.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Warranty #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Device</TableHead>
                            <TableHead>Order ID</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expires</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.warranties.map((warranty) => (
                            <TableRow key={warranty.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {warranty.warranty_number}
                              </TableCell>
                              <TableCell>{warranty.customer_name}</TableCell>
                              <TableCell>{warranty.device_type}</TableCell>
                              <TableCell>{warranty.order_id || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={warranty.status === 'approved' ? 'default' : 'secondary'}>
                                  {warranty.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Dispatches Results */}
                  {searchResults.dispatches?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Dispatches ({searchResults.dispatches.length})
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Dispatch #</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tracking ID</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.dispatches.map((dispatch) => (
                            <TableRow key={dispatch.id} className="data-row">
                              <TableCell className="font-mono text-sm font-medium">
                                {dispatch.dispatch_number}
                              </TableCell>
                              <TableCell>{dispatch.product_name || '-'}</TableCell>
                              <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                              <TableCell className="font-mono text-sm">{dispatch.tracking_id || '-'}</TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {new Date(dispatch.created_at).toLocaleDateString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* No Results */}
                  {searchResults.total_tickets === 0 && searchResults.total_warranties === 0 && searchResults.total_dispatches === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No results found for "{searchQuery}"</p>
                      <p className="text-sm mt-2">Try searching with a different term</p>
                    </div>
                  )}
                </div>
              )}

              {!searchResults && (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Enter a search term to find customer records</p>
                </div>
              )}
            </TabsContent>

            {/* Feedback Calls Tab */}
            <TabsContent value="feedback" className="mt-0">
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-1">Amazon Order Feedback Calls</h4>
                <p className="text-sm text-orange-700">
                  These customers received Amazon orders. Call them to collect feedback and upload a screenshot of the completed call.
                </p>
              </div>
              
              {feedbackCalls.filter(c => c.status === 'pending').length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No pending feedback calls!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackCalls.filter(c => c.status === 'pending').map((call) => (
                      <TableRow key={call.id} className="data-row">
                        <TableCell className="font-mono text-sm font-medium">
                          {call.order_id || call.dispatch_number}
                        </TableCell>
                        <TableCell>{call.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{call.phone}</span>
                            {call.phone && (
                              <ClickToCallButton 
                                phone={call.phone}
                                customerName={call.customer_name}
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{call.sku || '-'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            call.call_attempts > 2 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {call.call_attempts} attempts
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(call.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={() => {
                              setSelectedCall(call);
                              setFeedbackFile(null);
                              setFeedbackNotes('');
                              setFeedbackCallOpen(true);
                            }}
                            data-testid={`feedback-call-${call.id}`}
                          >
                            <PhoneCall className="w-4 h-4 mr-1" />
                            Complete Call
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Missed Calls Tab */}
            <TabsContent value="missed" className="mt-0">
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-red-800 mb-1 flex items-center gap-2">
                    <AlarmClock className="w-4 h-4" />
                    Missed Calls — last 24h
                  </h4>
                  <p className="text-sm text-red-700">
                    Inbound calls with no answer, no outcome, no callback dialed yet. Clear them by calling back or dismissing.
                  </p>
                </div>
                <Button onClick={fetchMissedCalls} variant="outline" size="sm">Refresh</Button>
              </div>

              {missedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : missedCalls.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No missed calls — queue is clear.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Missed Agent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missedCalls.map((mc) => (
                      <TableRow key={mc.call_id} className="data-row">
                        <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                          {new Date(mc.received_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{mc.raw_phone || mc.phone}</span>
                            <ClickToCallButton
                              phone={mc.phone}
                              customerName={mc.customer_name}
                              showLabel={false}
                              size="sm"
                            />
                          </div>
                        </TableCell>
                        <TableCell>{mc.customer_name || <span className="text-slate-400 italic text-xs">unknown</span>}</TableCell>
                        <TableCell className="text-sm text-slate-600">{mc.dept_name || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{mc.missed_agent || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => dismissMissedCall(mc.call_id, 'wrong_number')}
                              title="Mark wrong / spam"
                            >
                              Wrong
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => dismissMissedCall(mc.call_id, 'agent_dismissed')}
                              title="Already handled"
                            >
                              Dismiss
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={(open) => {
        setDetailsOpen(open);
        if (!open) setCustomerHistory(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Ticket Details - {selectedTicket?.ticket_number}
              {selectedTicket && <SLABadge ticket={selectedTicket} />}
              {customerHistory && (
                <Badge variant="outline" className="ml-2">
                  {customerHistory.total_tickets} total tickets
                </Badge>
              )}
              {selectedTicket?.customer_phone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => {
                    setMessageDraft('');
                    setMessageChannel('whatsapp');
                    fetchCannedResponses('whatsapp');
                    setMessageOpen(true);
                  }}
                  data-testid="send-message-btn"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Message
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Ticket Info - 2 columns */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-slate-500">Status</p><StatusBadge status={selectedTicket.status} /></div>
                  <div><p className="text-sm text-slate-500">Device</p><p className="font-medium">{selectedTicket.device_type}</p></div>
                  <div><p className="text-sm text-slate-500">Customer</p><p className="font-medium">{selectedTicket.customer_name}</p></div>
                  <div><p className="text-sm text-slate-500">Phone</p><p className="font-mono">{selectedTicket.customer_phone}</p></div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Issue</p>
                  <div className="bg-slate-50 p-3 rounded-lg">{selectedTicket.issue_description}</div>
                </div>
                {selectedTicket.diagnosis && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Diagnosis</p>
                    <div className="bg-blue-50 p-3 rounded-lg">{selectedTicket.diagnosis}</div>
                  </div>
                )}
                {selectedTicket.invoice_file && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Customer Invoice</p>
                    <a 
                      href={`${API.replace('/api', '')}${selectedTicket.invoice_file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 bg-blue-50 p-3 rounded-lg"
                    >
                      <FileText className="w-4 h-4" />
                      View Invoice Document
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500 mb-2">Ticket History</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedTicket.history?.map((entry, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                        <div>
                          <p>{entry.action}</p>
                          <p className="text-xs text-slate-500">{entry.by} • {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer History Panel - 1 column */}
              <div className="lg:col-span-1 border-l pl-4 space-y-4">
                {/* AI Next-Best-Action */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <h4 className="font-medium text-indigo-800 text-sm">Suggested Action</h4>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runAiSuggest(!!aiSuggestion)}
                      disabled={aiLoading}
                      className="h-7 text-indigo-700 hover:bg-indigo-100"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (aiSuggestion ? 'Re-run' : 'Get suggestion')}
                    </Button>
                  </div>
                  {aiSuggestion ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-indigo-600 text-white rounded font-mono text-[10px]">
                          {aiSuggestion.action}
                        </span>
                        <span className="ml-2 text-slate-500 text-[10px]">confidence: {aiSuggestion.confidence}</span>
                      </div>
                      <p className="text-slate-700">{aiSuggestion.rationale}</p>
                      {aiSuggestion.draft_notes && (
                        <div className="bg-white rounded border border-indigo-100 p-2">
                          <p className="text-[10px] uppercase text-slate-400 mb-1">Draft notes</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{aiSuggestion.draft_notes}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-6 text-xs"
                            onClick={() => {
                              setActionData((prev) => ({ ...prev, agent_notes: aiSuggestion.draft_notes }));
                              setActionOpen(true);
                              toast.success('Notes loaded into Update Ticket dialog');
                            }}
                          >
                            Use as agent notes
                          </Button>
                        </div>
                      )}
                      {aiSuggestion.draft_message && (
                        <div className="bg-white rounded border border-green-100 p-2">
                          <p className="text-[10px] uppercase text-slate-400 mb-1">Draft WhatsApp</p>
                          <p className="text-slate-700">{aiSuggestion.draft_message}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-6 text-xs text-green-700 border-green-300"
                            onClick={() => {
                              setMessageDraft(aiSuggestion.draft_message);
                              setMessageChannel('whatsapp');
                              fetchCannedResponses('whatsapp');
                              setMessageOpen(true);
                            }}
                          >
                            Send as WhatsApp
                          </Button>
                        </div>
                      )}
                      {aiGeneratedAt && (
                        <p className="text-[10px] text-slate-400 italic">
                          generated {new Date(aiGeneratedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Click <em>Get suggestion</em> for an AI-recommended next step.</p>
                  )}
                </div>

                {/* Knowledge Base suggestions */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-amber-700" />
                    <h4 className="font-medium text-amber-800 text-sm">Knowledge Base</h4>
                  </div>
                  {kbLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                  ) : kbSuggestions.length === 0 ? (
                    <p className="text-xs text-slate-500">No matching articles. Build the KB at <code>/admin/knowledge-base</code>.</p>
                  ) : (
                    <div className="space-y-2">
                      {kbSuggestions.map((art) => (
                        <details key={art.id} className="bg-white rounded border border-amber-100 p-2 text-xs">
                          <summary className="cursor-pointer font-medium text-slate-800">{art.title}</summary>
                          {art.problem_summary && (
                            <p className="mt-2 text-slate-600">{art.problem_summary}</p>
                          )}
                          {art.resolution_steps && (
                            <div className="mt-2 bg-slate-50 rounded p-2 whitespace-pre-wrap text-slate-700">
                              {art.resolution_steps}
                            </div>
                          )}
                        </details>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-purple-600" />
                  <h4 className="font-medium text-purple-800">Customer History</h4>
                </div>
                
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : customerHistory ? (
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="bg-purple-50 p-3 rounded-lg text-sm">
                      <p className="font-medium">{customerHistory.customer_name}</p>
                      <p className="text-slate-600">{customerHistory.customer_phone}</p>
                      {customerHistory.customer_email && (
                        <p className="text-slate-600">{customerHistory.customer_email}</p>
                      )}
                    </div>

                    {/* Related Tickets */}
                    {customerHistory.related_tickets?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Ticket className="w-3 h-3" />
                          Previous Tickets ({customerHistory.related_tickets.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.related_tickets.map((ticket) => (
                            <div key={ticket.id} className="bg-slate-50 p-2 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-medium">{ticket.ticket_number}</span>
                                <StatusBadge status={ticket.status} />
                              </div>
                              <p className="text-slate-500 mt-1 truncate">{ticket.issue_description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warranties */}
                    {customerHistory.warranties?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Warranties ({customerHistory.warranties.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.warranties.map((warranty) => {
                            const exp = warrantyExpiryInfo(warranty);
                            const expTones = {
                              red: 'bg-red-100 text-red-700 border-red-300',
                              amber: 'bg-amber-100 text-amber-700 border-amber-300',
                              slate: 'bg-slate-100 text-slate-600 border-slate-300',
                            };
                            return (
                              <div key={warranty.id} className="bg-green-50 p-2 rounded text-xs">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono">{warranty.warranty_number}</span>
                                  <div className="flex items-center gap-1 flex-wrap justify-end">
                                    {exp && (
                                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${expTones[exp.tone]}`}>
                                        <AlertTriangle className="w-2.5 h-2.5" />{exp.label}
                                      </span>
                                    )}
                                    <Badge variant={warranty.status === 'approved' ? 'default' : 'secondary'} className="text-xs">
                                      {warranty.status}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-slate-600">{warranty.device_type}</p>
                                {warranty.warranty_end_date && (
                                  <p className="text-slate-500">Expires: {new Date(warranty.warranty_end_date).toLocaleDateString()}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dispatches */}
                    {customerHistory.dispatches?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Dispatches ({customerHistory.dispatches.length})
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {customerHistory.dispatches.map((dispatch) => (
                            <div key={dispatch.id} className="bg-orange-50 p-2 rounded text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-mono">{dispatch.dispatch_number}</span>
                                <StatusBadge status={dispatch.status} />
                              </div>
                              {dispatch.product_name && (
                                <p className="text-slate-600">{dispatch.product_name}</p>
                              )}
                              {dispatch.tracking_id && (
                                <p className="text-slate-500">Tracking: {dispatch.tracking_id}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No History */}
                    {customerHistory.related_tickets?.length === 0 && 
                     customerHistory.warranties?.length === 0 && 
                     customerHistory.dispatches?.length === 0 && (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        <p>No previous history found</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fetchCustomerHistory(selectedTicket.id)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      Load History
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send WhatsApp / SMS Dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              Send to {selectedTicket?.customer_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-slate-50 p-2 rounded text-xs flex justify-between">
              <span className="text-slate-500">To</span>
              <span className="font-mono">{selectedTicket?.customer_phone}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageChannel('whatsapp')}
                className={`flex-1 px-3 py-2 rounded text-sm border ${
                  messageChannel === 'whatsapp'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setMessageChannel('sms')}
                className={`flex-1 px-3 py-2 rounded text-sm border ${
                  messageChannel === 'sms'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                SMS (template)
              </button>
            </div>
            {messageChannel === 'whatsapp' ? (
              <div className="space-y-1">
                <Label>Message</Label>
                <Textarea
                  rows={4}
                  placeholder="Type your message…"
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  data-testid="message-draft"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {cannedResponses.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No canned responses configured. Add some via admin → Canned Responses.</p>
                  ) : cannedResponses.map((cr) => (
                    <button
                      type="button"
                      key={cr.id}
                      onClick={() => setMessageDraft(cr.body)}
                      className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      title={cr.body}
                    >
                      {cr.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
                <p className="font-medium mb-1">DLT template only</p>
                <p>
                  Indian regulations restrict outbound SMS to pre-approved DLT templates.
                  This will send the registered post-call template to the customer.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSendMessage}
              disabled={messageSending || (messageChannel === 'whatsapp' && !messageDraft.trim())}
              className={messageChannel === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
              data-testid="send-message-confirm"
            >
              {messageSending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send {messageChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Ticket - {selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm text-slate-500">Customer: {selectedTicket?.customer_name}</p>
              <p className="text-sm mt-1">{selectedTicket?.issue_description}</p>
            </div>

            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={actionData.status} onValueChange={(v) => setActionData({...actionData, status: v})}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="diagnosed">Diagnosed</SelectItem>
                  <SelectItem value="software_issue">Software Issue (Resolved)</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea 
                placeholder="Enter diagnosis details..."
                value={actionData.diagnosis}
                onChange={(e) => setActionData({...actionData, diagnosis: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Agent Notes (min 100 chars for escalation/routing)</Label>
              <Textarea 
                placeholder="Notes for internal reference or for accountant if routing to hardware..."
                value={actionData.agent_notes}
                onChange={(e) => setActionData({...actionData, agent_notes: e.target.value})}
              />
              <p className={`text-xs ${actionData.agent_notes.length < 100 ? 'text-slate-500' : 'text-green-600'}`}>
                {actionData.agent_notes.length}/100 characters
              </p>
            </div>

            {/* Escalate to Supervisor */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-purple-600 mb-3">
                <ArrowUpCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Need Supervisor Help?</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={handleEscalateToSupervisor}
                disabled={actionLoading || actionData.agent_notes.length < 100}
                data-testid="escalate-supervisor-btn"
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                Escalate to Supervisor
              </Button>
              <p className="text-xs text-slate-500 mt-2">Add detailed notes (100+ chars) before escalating</p>
            </div>

            {/* Route to Hardware */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-orange-600 mb-3">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Hardware Issue?</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={handleRouteToHardware}
                disabled={actionLoading || actionData.agent_notes.length < 100}
                data-testid="route-hardware-btn"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Route to Hardware Service
              </Button>
              <p className="text-xs text-slate-500 mt-2">Add notes (100+ chars) before routing to hardware</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={handleUpdateTicket}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label>Device Type *</Label>
              <Select value={newTicket.device_type} onValueChange={(v) => setNewTicket({...newTicket, device_type: v})}>
                <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order ID</Label>
              <Input 
                placeholder="e.g., AMZ-123456"
                value={newTicket.order_id}
                onChange={(e) => setNewTicket({...newTicket, order_id: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Issue Description *</Label>
              <Textarea 
                placeholder="Describe the customer's issue..."
                value={newTicket.issue_description}
                onChange={(e) => setNewTicket({...newTicket, issue_description: e.target.value})}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Call Dialog */}
      <Dialog open={feedbackCallOpen} onOpenChange={setFeedbackCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Feedback Call</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Customer:</strong> {selectedCall.customer_name}</p>
                  <p><strong>Phone:</strong> <span className="font-mono">{selectedCall.phone}</span></p>
                  <p><strong>Order:</strong> {selectedCall.order_id || selectedCall.dispatch_number}</p>
                  <p><strong>Product:</strong> {selectedCall.sku || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Call Notes</Label>
                <Textarea
                  placeholder="Notes from the feedback call..."
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Feedback Screenshot *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFeedbackFile(e.target.files[0])}
                  data-testid="feedback-screenshot-input"
                />
                <p className="text-xs text-slate-500">Upload a screenshot of the customer feedback or completed call</p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('status', 'no_answer');
                      formData.append('notes', feedbackNotes || 'Customer did not answer');
                      await axios.patch(`${API}/feedback-calls/${selectedCall.id}`, formData, {
                        headers: { 
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data'
                        }
                      });
                      toast.info('Marked as no answer - will retry later');
                      setFeedbackCallOpen(false);
                      fetchData();
                    } catch (error) {
                      toast.error('Failed to update');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                >
                  No Answer
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    if (!feedbackFile) {
                      toast.error('Please upload a feedback screenshot');
                      return;
                    }
                    setActionLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('status', 'completed');
                      formData.append('notes', feedbackNotes);
                      formData.append('screenshot', feedbackFile);
                      await axios.patch(`${API}/feedback-calls/${selectedCall.id}`, formData, {
                        headers: { 
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data'
                        }
                      });
                      toast.success('Feedback call completed!');
                      setFeedbackCallOpen(false);
                      fetchData();
                    } catch (error) {
                      toast.error(error.response?.data?.detail || 'Failed to complete');
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading || !feedbackFile}
                  data-testid="complete-feedback-call"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                  Complete with Screenshot
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
