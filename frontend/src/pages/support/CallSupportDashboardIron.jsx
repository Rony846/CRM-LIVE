import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { openAuthedFile } from '@/lib/openFile';
import {
  Ticket, Phone, Clock, Wrench, AlertTriangle, CheckCircle,
  Loader2, Eye, Play, Send, ArrowUpCircle, Camera, PhoneCall, FileText,
  Search, History, Shield, User, Package, List, ChevronLeft, ChevronRight, Mail,
  MessageSquare, Timer, AlarmClock, Sparkles
} from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, ticketPill } from '@/components/iron/IronKit';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

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

const SLA_TONE = { red: 'bad', amber: 'warn', emerald: 'ok', slate: 'slate' };
const SLABadge = ({ ticket }) => {
  const info = slaInfo(ticket);
  if (!info) return null;
  return <span style={badgeStyle(SLA_TONE[info.tone] || 'slate')}>{info.label}</span>;
};

const StatusPill = ({ status }) => {
  const p = ticketPill(status);
  return <span style={p.style}>{p.label}</span>;
};

// Days-to-expiry for warranties — returns null if no end date
const warrantyExpiryInfo = (warranty) => {
  if (!warranty?.warranty_end_date) return null;
  const end = new Date(warranty.warranty_end_date);
  if (isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: 'slate', label: `Expired ${-days}d ago`, days };
  if (days <= 7) return { tone: 'bad', label: `Expires in ${days}d`, days };
  if (days <= 30) return { tone: 'warn', label: `Expires in ${days}d`, days };
  return null; // no badge for healthy warranties
};

// Iron KPI tile
function KpiTile({ title, value, icon: Icon, tone = T.iron700, alert = false }) {
  return (
    <IronCard pad={14} style={alert ? { borderColor: T.orange, boxShadow: '0 0 0 1px ' + T.orange } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
          {Icon ? <Icon size={18} color={tone} strokeWidth={1.9} /> : null}
        </div>
        <div>
          <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{value}</div>
          <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{title}</Caps>
        </div>
      </div>
    </IronCard>
  );
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const q = searchQuery.trim();
    // A TICKET NUMBER (MG-R-/MG-W-YYYYMMDD-...) → search tickets and open the match directly.
    // (Previously this fell into the serial_number branch on /customers/search and never matched.)
    if (/^mg-?[rw]-?\d{4,}/i.test(q.replace(/\s+/g, ''))) {
      try {
        const res = await axios.get(`${API}/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { search: q, limit: 10 },
        });
        const list = res.data?.tickets || res.data || [];
        if (list.length) {
          setSearchResults(null);
          await viewTicketDetails(list[0].id);
        } else {
          toast.error(`No ticket found for "${q}"`);
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Ticket search failed');
      } finally {
        setSearchLoading(false);
      }
      return;
    }
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

  const pendingFeedback = feedbackCalls.filter(c => c.status === 'pending');
  const totalPages = Math.max(1, Math.ceil(totalTickets / ticketsPerPage));

  const tabs = [
    { key: 'queue', label: 'Ticket Queue', count: openTickets.length, icon: Phone },
    { key: 'working', label: 'Working', count: inProgressTickets.length, icon: Clock },
    { key: 'all-tickets', label: 'All Tickets', count: null, icon: List },
    { key: 'search', label: 'Search', count: null, icon: Search },
    { key: 'feedback', label: 'Feedback Calls', count: pendingFeedback.length, icon: PhoneCall },
    { key: 'missed', label: 'Missed Calls', count: missedCalls.length || null, icon: AlarmClock },
  ];

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button style={{ ...outlineBtn, borderColor: '#DDD3EF', color: '#6D4AB0' }} onClick={() => window.location.href = '/support/email-inbox'} data-testid="email-inbox-btn">
        <Mail size={14} /> Email Inbox
      </button>
      <button style={primaryBtn} onClick={() => setCreateOpen(true)} data-testid="create-ticket-btn">
        <Phone size={14} /> New Ticket
      </button>
    </div>
  );

  const emptyState = (Icon, title, sub, color = T.green) => (
    <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
      <Icon size={44} color={color} style={{ margin: '0 auto 12px' }} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  const sortBySla = (list) => [...list].sort((a, b) => {
    const ai = slaInfo(a)?.mins ?? Number.POSITIVE_INFINITY;
    const bi = slaInfo(b)?.mins ?? Number.POSITIVE_INFINITY;
    return ai - bi;
  });

  const Th = ({ children, right }) => <th style={{ ...thCell, textAlign: right ? 'right' : 'left' }}><Caps size={8.5}>{children}</Caps></th>;

  const tableWrap = { overflowX: 'auto' };
  const tableStyle = { width: '100%', borderCollapse: 'collapse' };
  const theadRow = { borderBottom: `1px solid ${T.iron200}`, background: T.iron50 };
  const bodyRow = { borderBottom: `1px solid ${T.iron200}` };

  if (loading) {
    return (
      <IronShell title="Call Support" subtitle="SUPPORT OPS · TICKET QUEUE">
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Call Support" subtitle="SUPPORT OPS · TICKET QUEUE · SLA WATCH" onRefresh={fetchData} headerRight={headerRight}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }} data-testid="support-stats">
        <KpiTile title="SLA Breached" value={stats?.sla_breached || 0} icon={AlarmClock} tone={T.orangeDeep} alert={stats?.sla_breached > 0} />
        <KpiTile title="Breaching in 2h" value={stats?.sla_soon || 0} icon={Timer} tone={T.voltageText} alert={stats?.sla_soon > 0} />
        <KpiTile title="Open Tickets" value={stats?.open_tickets || 0} icon={Ticket} tone={T.blue} />
        <KpiTile title="In Progress" value={stats?.in_progress || 0} icon={Clock} tone={T.iron700} />
        <KpiTile title="Diagnosed" value={stats?.diagnosed_today || 0} icon={CheckCircle} tone={T.green} />
        <KpiTile title="Pending Feedback" value={stats?.pending_feedback_calls || 0} icon={PhoneCall} tone={T.voltageText} alert={stats?.pending_feedback_calls > 0} />
      </div>

      {/* Tabs card */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          {tabs.map((tb) => {
            const Icon = tb.icon;
            const active = activeTab === tb.key;
            return (
              <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                <Icon size={14} strokeWidth={2} />{tb.label}
                {tb.count != null && <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>
          {/* Ticket Queue */}
          {activeTab === 'queue' && (
            openTickets.length === 0 ? emptyState(CheckCircle, 'All tickets handled! Queue is empty.', null) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead><tr style={theadRow}>
                    <Th>Ticket #</Th><Th>Customer</Th><Th>Phone</Th><Th>Device</Th><Th>Issue</Th><Th>SLA</Th><Th>Created</Th><Th right>Actions</Th>
                  </tr></thead>
                  <tbody>
                    {sortBySla(openTickets).map((ticket) => (
                      <tr key={ticket.id} className="iron-row" style={bodyRow}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{ticket.ticket_number}</td>
                        <td style={tdCell}>{ticket.customer_name}</td>
                        <td style={tdCell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={mono}>{ticket.customer_phone}</span>
                            {ticket.customer_phone && <ClickToCallButton phone={ticket.customer_phone} customerName={ticket.customer_name} showLabel={false} size="sm" />}
                          </div>
                        </td>
                        <td style={tdCell}>{ticket.device_type}</td>
                        <td style={{ ...tdCell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.issue_description}</td>
                        <td style={tdCell}><SLABadge ticket={ticket} /></td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(ticket.created_at).toLocaleString()}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button style={outlineBtn} onClick={() => viewTicketWithHistory(ticket.id)}><Eye size={14} /></button>
                            <button style={primaryBtn} onClick={() => openActionDialog(ticket)} data-testid={`work-ticket-${ticket.id}`}><Play size={13} /> Work</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Working */}
          {activeTab === 'working' && (
            inProgressTickets.length === 0 ? emptyState(Clock, 'No tickets in progress', null, T.iron400) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead><tr style={theadRow}>
                    <Th>Ticket #</Th><Th>Customer</Th><Th>Device</Th><Th>Status</Th><Th>SLA</Th><Th>Diagnosis</Th><Th right>Actions</Th>
                  </tr></thead>
                  <tbody>
                    {sortBySla(inProgressTickets).map((ticket) => (
                      <tr key={ticket.id} className="iron-row" style={bodyRow}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{ticket.ticket_number}</td>
                        <td style={tdCell}>{ticket.customer_name}</td>
                        <td style={tdCell}>{ticket.device_type}</td>
                        <td style={tdCell}><StatusPill status={ticket.status} /></td>
                        <td style={tdCell}><SLABadge ticket={ticket} /></td>
                        <td style={{ ...tdCell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.diagnosis || '-'}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button style={outlineBtn} onClick={() => openActionDialog(ticket)}>Update</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* All Tickets */}
          {activeTab === 'all-tickets' && (
            <>
              <div style={{ marginBottom: 14, padding: 12, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={15} color={T.orangeDeep} />
                  <Caps size={10} color={T.orangeDeep}>All Tickets View</Caps>
                </div>
                <p style={{ fontSize: 12.5, color: T.iron500, margin: '6px 0 0' }}>View all tickets across all departments. Click on any ticket to see customer history and details.</p>
              </div>

              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <select value={ticketFilter} onChange={(e) => { setTicketFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, cursor: 'pointer', width: 180 }}>
                    <option value="all">All Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="hardware_service">Hardware Service</option>
                    <option value="repair_completed">Repair Completed</option>
                    <option value="received_at_factory">At Factory</option>
                    <option value="in_repair">In Repair</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <span style={badgeStyle('slate')}>{totalTickets} total tickets</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...mono, fontSize: 12, color: T.iron500 }}>Page {currentPage} of {totalPages}</span>
                  <button style={outlineBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || allTicketsLoading}><ChevronLeft size={14} /></button>
                  <button style={outlineBtn} onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || allTicketsLoading}><ChevronRight size={14} /></button>
                </div>
              </div>

              {allTicketsLoading ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
              ) : (
                <div style={tableWrap}>
                  <table style={tableStyle}>
                    <thead><tr style={theadRow}>
                      <Th>Ticket #</Th><Th>Customer</Th><Th>Phone</Th><Th>Device</Th><Th>Status</Th><Th>SLA</Th><Th>Created</Th><Th right>Actions</Th>
                    </tr></thead>
                    <tbody>
                      {allTickets.map((ticket) => (
                        <tr key={ticket.id} className="iron-row" style={bodyRow}>
                          <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{ticket.ticket_number}</td>
                          <td style={tdCell}>{ticket.customer_name}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={mono}>{ticket.customer_phone}</span>
                              {ticket.customer_phone && <ClickToCallButton phone={ticket.customer_phone} customerName={ticket.customer_name} showLabel={false} size="sm" />}
                            </div>
                          </td>
                          <td style={tdCell}>{ticket.device_type}</td>
                          <td style={tdCell}><StatusPill status={ticket.status} /></td>
                          <td style={tdCell}><SLABadge ticket={ticket} /></td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button style={outlineBtn} onClick={() => viewTicketWithHistory(ticket.id)} data-testid={`view-ticket-${ticket.id}`}><Eye size={14} /></button>
                              <button style={outlineBtn} onClick={() => { setSelectedTicket(ticket); fetchCustomerHistory(ticket.id); setDetailsOpen(true); }} data-testid={`history-ticket-${ticket.id}`}><History size={14} /> History</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {allTickets.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${T.iron200}`, paddingTop: 14 }}>
                  <span style={{ ...mono, fontSize: 12, color: T.iron500 }}>Showing {Math.min(ticketsPerPage, allTickets.length)} of {totalTickets} tickets</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={outlineBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || allTicketsLoading}><ChevronLeft size={14} /> Previous</button>
                    <span style={{ ...mono, fontSize: 12, color: T.iron500, padding: '0 8px' }}>Page {currentPage}</span>
                    <button style={outlineBtn} onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || allTicketsLoading}>Next <ChevronRight size={14} /></button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Search */}
          {activeTab === 'search' && (
            <>
              <div style={{ marginBottom: 14, padding: 12, background: T.greenTint, border: `1px solid #CBE5D6`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search size={15} color={T.green} />
                  <Caps size={10} color={T.green}>Customer Search</Caps>
                </div>
                <p style={{ fontSize: 12.5, color: T.iron500, margin: '6px 0 0' }}>Search for any customer by phone number, email, serial number, or order ID to find their complete history.</p>
              </div>

              <form onSubmit={handleGlobalSearch} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 10, top: 9 }} />
                    <input placeholder="Enter phone number, email, serial number (MG...), or order ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle, width: '100%', paddingLeft: 32 }} data-testid="global-search-input" />
                  </div>
                  <button type="submit" style={{ ...primaryBtn, background: T.green }} disabled={searchLoading} data-testid="global-search-btn">
                    {searchLoading ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />} Search
                  </button>
                </div>
                <p style={{ fontSize: 11, color: T.iron400, marginTop: 8 }}>Tip: Enter phone (10 digits), email, serial number starting with MG, or order ID</p>
              </form>

              {searchResults && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <IronCard pad={14} style={{ textAlign: 'center' }}>
                      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.orangeDeep }}>{searchResults.total_tickets || 0}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>Tickets Found</Caps>
                    </IronCard>
                    <IronCard pad={14} style={{ textAlign: 'center' }}>
                      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.green }}>{searchResults.total_warranties || 0}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>Warranties</Caps>
                    </IronCard>
                    <IronCard pad={14} style={{ textAlign: 'center' }}>
                      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: '#6D4AB0' }}>{searchResults.total_dispatches || 0}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>Dispatches</Caps>
                    </IronCard>
                  </div>

                  {searchResults.tickets?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}><Ticket size={15} /> Tickets ({searchResults.tickets.length})</div>
                      <div style={tableWrap}>
                        <table style={tableStyle}>
                          <thead><tr style={theadRow}>
                            <Th>Ticket #</Th><Th>Customer</Th><Th>Phone</Th><Th>Device</Th><Th>Status</Th><Th>Created</Th><Th right>Actions</Th>
                          </tr></thead>
                          <tbody>
                            {searchResults.tickets.map((ticket) => (
                              <tr key={ticket.id} className="iron-row" style={bodyRow}>
                                <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{ticket.ticket_number}</td>
                                <td style={tdCell}>{ticket.customer_name}</td>
                                <td style={{ ...tdCell, ...mono }}>{ticket.customer_phone}</td>
                                <td style={tdCell}>{ticket.device_type}</td>
                                <td style={tdCell}><StatusPill status={ticket.status} /></td>
                                <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                                <td style={{ ...tdCell, textAlign: 'right' }}>
                                  <button style={outlineBtn} onClick={() => viewTicketWithHistory(ticket.id)}><Eye size={14} /> View</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {searchResults.warranties?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}><Shield size={15} /> Warranties ({searchResults.warranties.length})</div>
                      <div style={tableWrap}>
                        <table style={tableStyle}>
                          <thead><tr style={theadRow}>
                            <Th>Warranty #</Th><Th>Customer</Th><Th>Device</Th><Th>Order ID</Th><Th>Status</Th><Th>Expires</Th>
                          </tr></thead>
                          <tbody>
                            {searchResults.warranties.map((warranty) => (
                              <tr key={warranty.id} className="iron-row" style={bodyRow}>
                                <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{warranty.warranty_number}</td>
                                <td style={tdCell}>{warranty.customer_name}</td>
                                <td style={tdCell}>{warranty.device_type}</td>
                                <td style={tdCell}>{warranty.order_id || '-'}</td>
                                <td style={tdCell}><span style={badgeStyle(warranty.status === 'approved' ? 'ok' : 'slate')}>{warranty.status}</span></td>
                                <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{warranty.warranty_end_date ? new Date(warranty.warranty_end_date).toLocaleDateString() : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {searchResults.dispatches?.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}><Package size={15} /> Dispatches ({searchResults.dispatches.length})</div>
                      <div style={tableWrap}>
                        <table style={tableStyle}>
                          <thead><tr style={theadRow}>
                            <Th>Dispatch #</Th><Th>Product</Th><Th>Status</Th><Th>Tracking ID</Th><Th>Created</Th>
                          </tr></thead>
                          <tbody>
                            {searchResults.dispatches.map((dispatch) => (
                              <tr key={dispatch.id} className="iron-row" style={bodyRow}>
                                <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{dispatch.dispatch_number}</td>
                                <td style={tdCell}>{dispatch.product_name || '-'}</td>
                                <td style={tdCell}><StatusPill status={dispatch.status} /></td>
                                <td style={{ ...tdCell, ...mono }}>{dispatch.tracking_id || '-'}</td>
                                <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(dispatch.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {searchResults.total_tickets === 0 && searchResults.total_warranties === 0 && searchResults.total_dispatches === 0 && (
                    emptyState(Search, `No results found for "${searchQuery}"`, 'Try searching with a different term', T.iron400)
                  )}
                </div>
              )}

              {!searchResults && emptyState(User, 'Enter a search term to find customer records', null, T.iron400)}
            </>
          )}

          {/* Feedback Calls */}
          {activeTab === 'feedback' && (
            <>
              <div style={{ marginBottom: 14, padding: 12, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8 }}>
                <Caps size={10} color={T.voltageText}>Amazon Order Feedback Calls</Caps>
                <p style={{ fontSize: 12.5, color: T.iron500, margin: '6px 0 0' }}>These customers received Amazon orders. Call them to collect feedback and upload a screenshot of the completed call.</p>
              </div>

              {pendingFeedback.length === 0 ? emptyState(CheckCircle, 'No pending feedback calls!', null) : (
                <div style={tableWrap}>
                  <table style={tableStyle}>
                    <thead><tr style={theadRow}>
                      <Th>Order ID</Th><Th>Customer</Th><Th>Phone</Th><Th>Product</Th><Th>Attempts</Th><Th>Created</Th><Th right>Action</Th>
                    </tr></thead>
                    <tbody>
                      {pendingFeedback.map((call) => (
                        <tr key={call.id} className="iron-row" style={bodyRow}>
                          <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{call.order_id || call.dispatch_number}</td>
                          <td style={tdCell}>{call.customer_name}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={mono}>{call.phone}</span>
                              {call.phone && <ClickToCallButton phone={call.phone} customerName={call.customer_name} showLabel={false} size="sm" />}
                            </div>
                          </td>
                          <td style={tdCell}>{call.sku || '-'}</td>
                          <td style={tdCell}><span style={badgeStyle(call.call_attempts > 2 ? 'bad' : 'slate')}>{call.call_attempts} attempts</span></td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(call.created_at).toLocaleDateString()}</td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <button style={{ ...primaryBtn, background: T.voltage, color: T.iron900 }} onClick={() => { setSelectedCall(call); setFeedbackFile(null); setFeedbackNotes(''); setFeedbackCallOpen(true); }} data-testid={`feedback-call-${call.id}`}>
                              <PhoneCall size={13} /> Complete Call
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Missed Calls */}
          {activeTab === 'missed' && (
            <>
              <div style={{ marginBottom: 14, padding: 12, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlarmClock size={15} color={T.orangeDeep} /><Caps size={10} color={T.orangeDeep}>Missed Calls — last 24h</Caps></div>
                  <p style={{ fontSize: 12.5, color: T.iron500, margin: '6px 0 0' }}>Inbound calls with no answer, no outcome, no callback dialed yet. Clear them by calling back or dismissing.</p>
                </div>
                <button style={outlineBtn} onClick={fetchMissedCalls}>Refresh</button>
              </div>

              {missedLoading ? (
                <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}><Loader2 className="animate-spin" size={28} color={T.orangeDeep} /></div>
              ) : missedCalls.length === 0 ? emptyState(CheckCircle, 'No missed calls — queue is clear.', null) : (
                <div style={tableWrap}>
                  <table style={tableStyle}>
                    <thead><tr style={theadRow}>
                      <Th>Time</Th><Th>Phone</Th><Th>Customer</Th><Th>Dept</Th><Th>Missed Agent</Th><Th right>Actions</Th>
                    </tr></thead>
                    <tbody>
                      {missedCalls.map((mc) => (
                        <tr key={mc.call_id} className="iron-row" style={bodyRow}>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, whiteSpace: 'nowrap' }}>{new Date(mc.received_at).toLocaleString()}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={mono}>{mc.raw_phone || mc.phone}</span>
                              <ClickToCallButton phone={mc.phone} customerName={mc.customer_name} showLabel={false} size="sm" />
                            </div>
                          </td>
                          <td style={tdCell}>{mc.customer_name || <span style={{ color: T.iron400, fontStyle: 'italic', fontSize: 11 }}>unknown</span>}</td>
                          <td style={{ ...tdCell, color: T.iron500 }}>{mc.dept_name || '-'}</td>
                          <td style={{ ...tdCell, color: T.iron500 }}>{mc.missed_agent || '-'}</td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button style={outlineBtn} onClick={() => dismissMissedCall(mc.call_id, 'wrong_number')} title="Mark wrong / spam">Wrong</button>
                              <button style={outlineBtn} onClick={() => dismissMissedCall(mc.call_id, 'agent_dismissed')} title="Already handled">Dismiss</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </IronCard>

      {/* Ticket Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setCustomerHistory(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Ticket Details - {selectedTicket?.ticket_number}
              {selectedTicket && <SLABadge ticket={selectedTicket} />}
              {customerHistory && <span style={badgeStyle('slate')}>{customerHistory.total_tickets} total tickets</span>}
              {selectedTicket?.customer_phone && (
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setMessageDraft(''); setMessageChannel('whatsapp'); fetchCannedResponses('whatsapp'); setMessageOpen(true); }} data-testid="send-message-btn">
                  <MessageSquare className="w-4 h-4 mr-1" /> Message
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Ticket Info */}
              <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><Caps size={9}>Status</Caps><div style={{ marginTop: 4 }}><StatusPill status={selectedTicket.status} /></div></div>
                  <div><Caps size={9}>Device</Caps><div style={{ fontWeight: 600, marginTop: 4 }}>{selectedTicket.device_type}</div></div>
                  <div><Caps size={9}>Customer</Caps><div style={{ fontWeight: 600, marginTop: 4 }}>{selectedTicket.customer_name}</div></div>
                  <div><Caps size={9}>Phone</Caps><div style={{ ...mono, marginTop: 4 }}>{selectedTicket.customer_phone}</div></div>
                </div>
                <div>
                  <Caps size={9}>Issue</Caps>
                  <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 12, borderRadius: 8, marginTop: 4, fontSize: 13 }}>{selectedTicket.issue_description}</div>
                </div>
                {selectedTicket.diagnosis && (
                  <div>
                    <Caps size={9}>Diagnosis</Caps>
                    <div style={{ background: '#FDEEE6', border: `1px solid #F6D8BA`, padding: 12, borderRadius: 8, marginTop: 4, fontSize: 13 }}>{selectedTicket.diagnosis}</div>
                  </div>
                )}
                {selectedTicket.invoice_file && (
                  <div>
                    <Caps size={9}>Customer Invoice</Caps>
                    <button
                      onClick={async () => { if (!(await openAuthedFile(selectedTicket.invoice_file, token, API))) toast.error('Could not open the invoice'); }}
                      style={{ ...outlineBtn, marginTop: 4, borderColor: '#F6D8BA', color: T.orangeDeep, background: '#FDEEE6' }}
                    >
                      <FileText size={14} /> View Invoice Document
                    </button>
                  </div>
                )}
                <div>
                  <Caps size={9}>Ticket History</Caps>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 192, overflowY: 'auto', marginTop: 6 }}>
                    {selectedTicket.history?.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 8, height: 8, marginTop: 5, borderRadius: 999, background: T.orange, flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0 }}>{entry.action}</p>
                          <p style={{ margin: 0, ...mono, fontSize: 10.5, color: T.iron400 }}>{entry.by} • {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar: AI + KB + Customer History */}
              <div className="lg:col-span-1" style={{ borderLeft: `1px solid ${T.iron200}`, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* AI Suggested Action */}
                <div style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 24, width: 24, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#FDEEE6', color: T.orangeDeep }}><Sparkles size={14} /></div>
                      <Caps size={10}>AI Suggested Action</Caps>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => runAiSuggest(!!aiSuggestion)} disabled={aiLoading} className="h-7 text-xs">
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : (aiSuggestion ? 'Re-run' : 'Get suggestion')}
                    </Button>
                  </div>
                  {aiSuggestion ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...badgeStyle('bad') }}>{aiSuggestion.action}</span>
                        <span style={{ ...mono, fontSize: 10, color: T.iron400 }}>confidence: <span style={{ color: T.iron900, fontWeight: 700 }}>{aiSuggestion.confidence}</span></span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{aiSuggestion.rationale}</p>
                      {aiSuggestion.draft_notes && (
                        <div style={{ border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 6, padding: 8 }}>
                          <Caps size={9}>Draft notes</Caps>
                          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '4px 0 0' }}>{aiSuggestion.draft_notes}</p>
                          <Button size="sm" variant="outline" className="mt-2 h-6 text-xs" onClick={() => { setActionData((prev) => ({ ...prev, agent_notes: aiSuggestion.draft_notes })); setActionOpen(true); toast.success('Notes loaded into Update Ticket dialog'); }}>
                            Use as agent notes
                          </Button>
                        </div>
                      )}
                      {aiSuggestion.draft_message && (
                        <div style={{ border: `1px solid #CBE5D6`, background: T.greenTint, borderRadius: 6, padding: 8 }}>
                          <Caps size={9} color={T.green}>Draft WhatsApp</Caps>
                          <p style={{ fontSize: 13, margin: '4px 0 0' }}>{aiSuggestion.draft_message}</p>
                          <Button size="sm" variant="outline" className="mt-2 h-6 text-xs" onClick={() => { setMessageDraft(aiSuggestion.draft_message); setMessageChannel('whatsapp'); fetchCannedResponses('whatsapp'); setMessageOpen(true); }}>
                            Send as WhatsApp
                          </Button>
                        </div>
                      )}
                      {aiGeneratedAt && <p style={{ ...mono, fontSize: 10, fontStyle: 'italic', color: T.iron400, margin: 0 }}>generated {new Date(aiGeneratedAt).toLocaleString()}</p>}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: T.iron500, margin: 0 }}>Click <em style={{ fontStyle: 'normal', fontWeight: 700, color: T.orangeDeep }}>Get suggestion</em> for an AI-recommended next step.</p>
                  )}
                </div>

                {/* Knowledge Base */}
                <div style={{ background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><FileText size={15} color={T.voltageText} /><Caps size={10} color={T.voltageText}>Knowledge Base</Caps></div>
                  {kbLoading ? <Loader2 className="animate-spin" size={16} color={T.voltageText} /> : kbSuggestions.length === 0 ? (
                    <p style={{ fontSize: 12, color: T.iron500, margin: 0 }}>No matching articles. Build the KB at <code>/admin/knowledge-base</code>.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {kbSuggestions.map((art) => (
                        <details key={art.id} style={{ background: T.white, borderRadius: 6, border: `1px solid ${T.iron200}`, padding: 8, fontSize: 12 }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{art.title}</summary>
                          {art.problem_summary && <p style={{ marginTop: 8, color: T.iron500 }}>{art.problem_summary}</p>}
                          {art.resolution_steps && <div style={{ marginTop: 8, background: T.iron50, borderRadius: 6, padding: 8, whiteSpace: 'pre-wrap' }}>{art.resolution_steps}</div>}
                        </details>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><History size={15} color="#6D4AB0" /><Caps size={10} color="#6D4AB0">Customer History</Caps></div>

                {historyLoading ? (
                  <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}><Loader2 className="animate-spin" size={22} color="#6D4AB0" /></div>
                ) : customerHistory ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#EEE9F7', border: `1px solid #DDD3EF`, padding: 12, borderRadius: 8, fontSize: 13 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{customerHistory.customer_name}</p>
                      <p style={{ margin: 0, color: T.iron500 }}>{customerHistory.customer_phone}</p>
                      {customerHistory.customer_email && <p style={{ margin: 0, color: T.iron500 }}>{customerHistory.customer_email}</p>}
                    </div>

                    {customerHistory.related_tickets?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Ticket size={13} /> Previous Tickets ({customerHistory.related_tickets.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 128, overflowY: 'auto' }}>
                          {customerHistory.related_tickets.map((ticket) => (
                            <div key={ticket.id} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 8, borderRadius: 6, fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ ...mono, fontWeight: 600 }}>{ticket.ticket_number}</span>
                                <StatusPill status={ticket.status} />
                              </div>
                              <p style={{ margin: '4px 0 0', color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.issue_description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {customerHistory.warranties?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Shield size={13} /> Warranties ({customerHistory.warranties.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 128, overflowY: 'auto' }}>
                          {customerHistory.warranties.map((warranty) => {
                            const exp = warrantyExpiryInfo(warranty);
                            return (
                              <div key={warranty.id} style={{ background: T.greenTint, border: `1px solid #CBE5D6`, padding: 8, borderRadius: 6, fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                  <span style={mono}>{warranty.warranty_number}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {exp && <span style={{ ...badgeStyle(exp.tone), display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={10} />{exp.label}</span>}
                                    <span style={badgeStyle(warranty.status === 'approved' ? 'ok' : 'slate')}>{warranty.status}</span>
                                  </div>
                                </div>
                                <p style={{ margin: '2px 0 0', color: T.iron500 }}>{warranty.device_type}</p>
                                {warranty.warranty_end_date && <p style={{ margin: 0, color: T.iron500 }}>Expires: {new Date(warranty.warranty_end_date).toLocaleDateString()}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {customerHistory.dispatches?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, marginBottom: 8 }}><Package size={13} /> Dispatches ({customerHistory.dispatches.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 128, overflowY: 'auto' }}>
                          {customerHistory.dispatches.map((dispatch) => (
                            <div key={dispatch.id} style={{ background: '#FDEEE6', border: `1px solid #F6D8BA`, padding: 8, borderRadius: 6, fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={mono}>{dispatch.dispatch_number}</span>
                                <StatusPill status={dispatch.status} />
                              </div>
                              {dispatch.product_name && <p style={{ margin: '2px 0 0', color: T.iron500 }}>{dispatch.product_name}</p>}
                              {dispatch.tracking_id && <p style={{ margin: 0, color: T.iron500 }}>Tracking: {dispatch.tracking_id}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {customerHistory.related_tickets?.length === 0 && customerHistory.warranties?.length === 0 && customerHistory.dispatches?.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 16, color: T.iron400, fontSize: 13 }}>No previous history found</div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <Button variant="outline" size="sm" onClick={() => fetchCustomerHistory(selectedTicket.id)}>
                      <History className="w-4 h-4 mr-1" /> Load History
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
              <MessageSquare className="w-4 h-4" style={{ color: T.green }} />
              Send to {selectedTicket?.customer_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 8, borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: T.iron500 }}>To</span>
              <span style={mono}>{selectedTicket?.customer_phone}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMessageChannel('whatsapp')} style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: `1px solid ${messageChannel === 'whatsapp' ? T.green : T.iron200}`, background: messageChannel === 'whatsapp' ? T.green : T.white, color: messageChannel === 'whatsapp' ? '#fff' : T.iron700 }}>WhatsApp</button>
              <button type="button" onClick={() => setMessageChannel('sms')} style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: `1px solid ${messageChannel === 'sms' ? T.orange : T.iron200}`, background: messageChannel === 'sms' ? T.orange : T.white, color: messageChannel === 'sms' ? '#fff' : T.iron700 }}>SMS (template)</button>
            </div>
            {messageChannel === 'whatsapp' ? (
              <div className="space-y-1">
                <Label>Message</Label>
                <Textarea rows={4} placeholder="Type your message…" value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} data-testid="message-draft" autoFocus />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 4 }}>
                  {cannedResponses.length === 0 ? (
                    <p style={{ fontSize: 11, color: T.iron400, fontStyle: 'italic', margin: 0 }}>No canned responses configured. Add some via admin → Canned Responses.</p>
                  ) : cannedResponses.map((cr) => (
                    <button type="button" key={cr.id} onClick={() => setMessageDraft(cr.body)} title={cr.body} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron500, cursor: 'pointer' }}>{cr.title}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 6, padding: 12, fontSize: 12, color: T.voltageText }}>
                <p style={{ fontWeight: 700, margin: '0 0 4px' }}>DLT template only</p>
                <p style={{ margin: 0 }}>Indian regulations restrict outbound SMS to pre-approved DLT templates. This will send the registered post-call template to the customer.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={messageSending || (messageChannel === 'whatsapp' && !messageDraft.trim())} style={{ background: messageChannel === 'whatsapp' ? T.green : T.orange }} data-testid="send-message-confirm">
              {messageSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
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
            <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 12, borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: T.iron500 }}>Customer: {selectedTicket?.customer_name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13 }}>{selectedTicket?.issue_description}</p>
            </div>

            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={actionData.status} onValueChange={(v) => setActionData({ ...actionData, status: v })}>
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
              <Textarea placeholder="Enter diagnosis details..." value={actionData.diagnosis} onChange={(e) => setActionData({ ...actionData, diagnosis: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Agent Notes (min 100 chars for escalation/routing)</Label>
              <Textarea placeholder="Notes for internal reference or for accountant if routing to hardware..." value={actionData.agent_notes} onChange={(e) => setActionData({ ...actionData, agent_notes: e.target.value })} />
              <p style={{ fontSize: 11, margin: 0, color: actionData.agent_notes.length < 100 ? T.iron400 : T.green }}>{actionData.agent_notes.length}/100 characters</p>
            </div>

            {/* Escalate to Supervisor */}
            <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6D4AB0', marginBottom: 12 }}><ArrowUpCircle size={15} /><span style={{ fontSize: 13, fontWeight: 600 }}>Need Supervisor Help?</span></div>
              <Button variant="outline" className="w-full" onClick={handleEscalateToSupervisor} disabled={actionLoading || actionData.agent_notes.length < 100} data-testid="escalate-supervisor-btn">
                <ArrowUpCircle className="w-4 h-4 mr-2" /> Escalate to Supervisor
              </Button>
              <p style={{ fontSize: 11, color: T.iron400, marginTop: 8 }}>Add detailed notes (100+ chars) before escalating</p>
            </div>

            {/* Route to Hardware */}
            <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.orangeDeep, marginBottom: 12 }}><AlertTriangle size={15} /><span style={{ fontSize: 13, fontWeight: 600 }}>Hardware Issue?</span></div>
              <Button variant="outline" className="w-full" onClick={handleRouteToHardware} disabled={actionLoading || actionData.agent_notes.length < 100} data-testid="route-hardware-btn">
                <Wrench className="w-4 h-4 mr-2" /> Route to Hardware Service
              </Button>
              <p style={{ fontSize: 11, color: T.iron400, marginTop: 8 }}>Add notes (100+ chars) before routing to hardware</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button style={{ background: T.orange }} onClick={handleUpdateTicket} disabled={actionLoading}>
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
              <Select value={newTicket.device_type} onValueChange={(v) => setNewTicket({ ...newTicket, device_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order ID</Label>
              <Input placeholder="e.g., AMZ-123456" value={newTicket.order_id} onChange={(e) => setNewTicket({ ...newTicket, order_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Issue Description *</Label>
              <Textarea placeholder="Describe the customer's issue..." value={newTicket.issue_description} onChange={(e) => setNewTicket({ ...newTicket, issue_description: e.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" style={{ background: T.orange }} disabled={actionLoading}>
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
              <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: T.iron500 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: T.iron900 }}>Customer:</strong> {selectedCall.customer_name}</p>
                  <p style={{ margin: 0 }}><strong style={{ color: T.iron900 }}>Phone:</strong> <span style={mono}>{selectedCall.phone}</span></p>
                  <p style={{ margin: 0 }}><strong style={{ color: T.iron900 }}>Order:</strong> {selectedCall.order_id || selectedCall.dispatch_number}</p>
                  <p style={{ margin: 0 }}><strong style={{ color: T.iron900 }}>Product:</strong> {selectedCall.sku || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Call Notes</Label>
                <Textarea placeholder="Notes from the feedback call..." value={feedbackNotes} onChange={(e) => setFeedbackNotes(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Feedback Screenshot *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setFeedbackFile(e.target.files[0])} data-testid="feedback-screenshot-input" />
                <p style={{ fontSize: 11, color: T.iron400, margin: 0 }}>Upload a screenshot of the customer feedback or completed call</p>
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
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
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
                  style={{ background: T.green }}
                  onClick={async () => {
                    if (!feedbackFile) { toast.error('Please upload a feedback screenshot'); return; }
                    setActionLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('status', 'completed');
                      formData.append('notes', feedbackNotes);
                      formData.append('screenshot', feedbackFile);
                      await axios.patch(`${API}/feedback-calls/${selectedCall.id}`, formData, {
                        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
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
    </IronShell>
  );
}
