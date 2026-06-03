import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Phone, Mail, Search, Plus, Edit2, Trash2, MessageSquare,
  TrendingUp, Users, UserCheck, UserX, PhoneCall, ArrowLeft,
  LayoutGrid, List, GripVertical, Clock,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Pipeline stages — `dot` drives the column marker, `badge` the Obsidian opacity-tint chip.
const LEAD_STATUSES = [
  { value: 'new',           label: 'New',           dot: '#8a8794', badge: 'bg-muted text-muted-foreground ring-border' },
  { value: 'contacted',     label: 'Contacted',     dot: '#38bdf8', badge: 'bg-sky-400/15 text-sky-400 ring-sky-400/25' },
  { value: 'qualified',     label: 'Qualified',     dot: '#c3c0ff', badge: 'bg-violet-400/15 text-violet-400 ring-violet-400/25' },
  { value: 'proposal_sent', label: 'Proposal Sent', dot: '#4f46e5', badge: 'bg-primary/15 text-primary ring-primary/25' },
  { value: 'negotiation',   label: 'Negotiation',   dot: '#ffb695', badge: 'bg-orange-400/15 text-orange-400 ring-orange-400/25' },
  { value: 'converted',     label: 'Converted',     dot: '#a4d64c', badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  { value: 'lost',          label: 'Lost',          dot: '#ffb4ab', badge: 'bg-rose-500/15 text-rose-400 ring-rose-500/25' },
];

const LEAD_SOURCES = [
  { value: 'voice_agent', label: 'Voice Agent' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'advertisement', label: 'Advertisement' },
  { value: 'shopify_pending_payment', label: 'Shopify – Pending Payment' },
  { value: 'kommo', label: 'Kommo (WhatsApp)' },
  { value: 'kommo_lead', label: 'Kommo Deal' },
  { value: 'other', label: 'Other' },
];

const statusOf = (v) => LEAD_STATUSES.find((s) => s.value === v);

// Compact relative time — "3d ago".
const timeAgo = (dateStr) => {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60000);
  return m > 0 ? `${m}m ago` : 'just now';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// --- Glass stat tile -------------------------------------------------------
const STAT_TONES = {
  indigo:  'bg-primary/15 text-primary',
  amber:   'bg-amber-400/15 text-amber-400',
  violet:  'bg-violet-400/15 text-violet-400',
  emerald: 'bg-emerald-500/15 text-emerald-400',
  rose:    'bg-rose-500/15 text-rose-400',
};
function StatTile({ icon: Icon, label, value, tone = 'indigo' }) {
  return (
    <div className="mg-card rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// --- Draggable lead card ---------------------------------------------------
function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onNote, onDelete, canDelete, dragging }) {
  const src = LEAD_SOURCES.find((s) => s.value === lead.source);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      data-testid={`lead-card-${lead.id}`}
      className={`mg-card group rounded-lg border border-border bg-card p-3 transition-all ${
        dragging ? 'opacity-40' : 'cursor-grab hover:border-primary/40 active:cursor-grabbing'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
          {src?.label || lead.source || 'Other'}
        </span>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-foreground">{lead.name || 'Unnamed lead'}</p>
      {lead.product_interest && (
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{lead.product_interest}</p>
      )}

      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <Phone className="h-3 w-3 flex-shrink-0" /> {lead.phone || '-'}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[9px] font-bold text-primary">
            {(lead.assigned_to_name || 'U')[0].toUpperCase()}
          </div>
          <span className="truncate text-[11px] text-muted-foreground">{lead.assigned_to_name || 'Unassigned'}</span>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground/70">
          <Clock className="h-3 w-3" /> {timeAgo(lead.created_at)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          onClick={() => onEdit(lead)}
          className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent"
          data-testid={`edit-lead-${lead.id}`}
        >
          <Edit2 className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={() => onNote(lead)}
          className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent"
          data-testid={`note-lead-${lead.id}`}
        >
          <MessageSquare className="h-3 w-3" /> Note
        </button>
        {canDelete && (
          <button
            onClick={() => onDelete(lead.id)}
            className="ml-auto flex items-center gap-1 rounded bg-rose-500/15 px-2 py-1 text-[10px] font-medium text-rose-400 hover:bg-rose-500/25"
            data-testid={`delete-lead-${lead.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [limit, setLimit] = useState(300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [users, setUsers] = useState([]);
  const [view, setView] = useState('board');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      params.append('limit', String(limit));

      const res = await fetch(`${API}/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter, sourceFilter, limit]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.filter((u) => ['admin', 'call_support'].includes(u.role)));
      }
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, [fetchLeads]);

  const handleCreateLead = async (formData) => {
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) form.append(key, value);
      });

      const res = await fetch(`${API}/api/leads/manual`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (res.ok) {
        toast.success('Lead created successfully');
        setShowAddModal(false);
        fetchLeads();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create lead');
      }
    } catch (err) {
      toast.error('Failed to create lead');
    }
  };

  const handleUpdateLead = async (leadId, updateData) => {
    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        toast.success('Lead updated');
        setShowEditModal(false);
        setSelectedLead(null);
        fetchLeads();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to update lead');
      }
    } catch (err) {
      toast.error('Failed to update lead');
    }
  };

  const handleAddNote = async (leadId, note) => {
    try {
      const form = new FormData();
      form.append('note', note);

      const res = await fetch(`${API}/api/leads/${leadId}/add-note`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (res.ok) {
        toast.success('Note added');
        setShowNoteModal(false);
        setSelectedLead(null);
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to add note');
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;

    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Lead deleted');
        fetchLeads();
      }
    } catch (err) {
      toast.error('Failed to delete lead');
    }
  };

  // Drag a card to another column → PATCH its status (optimistic).
  const moveLead = async (leadId, newStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('move failed');
      toast.success(`Moved to ${statusOf(newStatus)?.label || newStatus}`);
      fetchLeads();
    } catch (err) {
      toast.error('Failed to move lead');
      fetchLeads();
    }
  };

  const onDragStart = (e, lead) => {
    setDraggingId(lead.id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', lead.id); } catch (err) { /* noop */ }
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverCol(null); };
  const onColDrop = (statusValue) => {
    if (draggingId) moveLead(draggingId, statusValue);
    setDraggingId(null);
    setDragOverCol(null);
  };

  const getStatusBadge = (status) => {
    const cfg = statusOf(status);
    return (
      <span className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide ring-1 ${cfg?.badge || 'bg-muted text-muted-foreground ring-border'}`}>
        {cfg?.label || status}
      </span>
    );
  };

  const inputCls = 'px-3.5 py-2 bg-card border border-border rounded text-sm text-foreground focus:outline-none';

  return (
    <div className="min-h-screen p-6 space-y-6" data-testid="leads-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded border border-border bg-card p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            data-testid="back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sales pipeline · Live
              </span>
            </div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Sales Pipeline</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Drag leads across stages to update their status</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border bg-card p-0.5">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            data-testid="add-lead-btn"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile icon={Users} label="Total Leads" value={stats.total || 0} tone="indigo" />
        <StatTile icon={PhoneCall} label="New" value={stats.new || 0} tone="amber" />
        <StatTile icon={TrendingUp} label="Qualified" value={stats.qualified || 0} tone="violet" />
        <StatTile icon={UserCheck} label="Converted" value={stats.converted || 0} tone="emerald" />
        <StatTile icon={UserX} label="Lost" value={stats.lost || 0} tone="rose" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 ${inputCls}`}
            data-testid="lead-search"
          />
        </div>
        {view === 'list' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputCls}
            data-testid="status-filter"
          >
            <option value="">All Statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className={inputCls}
          data-testid="source-filter"
        >
          <option value="">All Sources</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Count + load more */}
      {!loading && (stats.total ?? 0) > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Showing <span className="text-foreground font-medium">{leads.length}</span> of {stats.total} leads</span>
          {leads.length < (stats.total ?? 0) && (
            <button
              onClick={() => setLimit((l) => l + 500)}
              className="px-3 py-1 rounded border border-border bg-card text-foreground hover:bg-muted/50"
              data-testid="leads-load-more"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading leads...
        </div>
      ) : view === 'board' ? (
        /* ---------------- Kanban board ---------------- */
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {LEAD_STATUSES.map((stage) => {
            const items = leads.filter((l) => l.status === stage.value);
            const isTarget = dragOverCol === stage.value;
            return (
              <div key={stage.value} className="flex w-[290px] flex-shrink-0 flex-col">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: stage.dot }} />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    {stage.label}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(stage.value); }}
                  onDrop={() => onColDrop(stage.value)}
                  className={`flex min-h-[240px] flex-1 flex-col gap-2.5 rounded-lg border border-dashed p-2.5 transition-colors ${
                    isTarget ? 'border-primary/60 bg-primary/[0.05]' : 'border-border/60 bg-card/30'
                  }`}
                >
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={draggingId === lead.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onEdit={(l) => { setSelectedLead(l); setShowEditModal(true); }}
                      onNote={(l) => { setSelectedLead(l); setShowNoteModal(true); }}
                      onDelete={handleDeleteLead}
                      canDelete={user?.role === 'admin'}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="py-6 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground/40">
                      Drop leads here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---------------- List view ---------------- */
        <div className="mg-card overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="leads-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left">Lead</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Interest</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Assigned To</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center">
                      <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">No leads found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Create your first lead to get started</p>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-accent/40" data-testid={`lead-row-${lead.id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary">
                            {(lead.name || 'L')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{lead.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">ID: {lead.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-mono">{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{lead.product_interest || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                          {(lead.source || 'other').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(lead.status)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{lead.assigned_to_name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setSelectedLead(lead); setShowEditModal(true); }}
                            className="rounded p-2 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                            title="Edit"
                            data-testid={`edit-lead-${lead.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowNoteModal(true); }}
                            className="rounded p-2 text-muted-foreground transition-colors hover:bg-emerald-500/15 hover:text-emerald-400"
                            title="Add Note"
                            data-testid={`note-lead-${lead.id}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="rounded p-2 text-muted-foreground transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                              title="Delete"
                              data-testid={`delete-lead-${lead.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <LeadFormModal
          title="Add New Lead"
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreateLead}
          users={users}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <LeadFormModal
          title="Edit Lead"
          lead={selectedLead}
          onClose={() => { setShowEditModal(false); setSelectedLead(null); }}
          onSubmit={(data) => handleUpdateLead(selectedLead.id, data)}
          users={users}
          isEdit
        />
      )}

      {/* Add Note Modal */}
      {showNoteModal && selectedLead && (
        <AddNoteModal
          lead={selectedLead}
          onClose={() => { setShowNoteModal(false); setSelectedLead(null); }}
          onSubmit={(note) => handleAddNote(selectedLead.id, note)}
        />
      )}
    </div>
  );
}

// --- Lead Form Modal -------------------------------------------------------
function LeadFormModal({ title, lead, onClose, onSubmit, users, isEdit }) {
  const [formData, setFormData] = useState({
    phone: lead?.phone || '',
    name: lead?.name || '',
    email: lead?.email || '',
    product_interest: lead?.product_interest || '',
    source: lead?.source || 'walk_in',
    status: lead?.status || 'new',
    notes: lead?.notes || '',
    assigned_to: lead?.assigned_to || '',
    follow_up_date: lead?.follow_up_date || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const fieldLabel = 'mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="mg-card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-popover">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={fieldLabel}>Phone *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full"
                required
                disabled={isEdit}
                data-testid="lead-phone-input"
              />
            </div>
            <div>
              <label className={fieldLabel}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full"
                data-testid="lead-name-input"
              />
            </div>
          </div>

          <div>
            <label className={fieldLabel}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full"
              data-testid="lead-email-input"
            />
          </div>

          <div>
            <label className={fieldLabel}>Product Interest</label>
            <input
              type="text"
              value={formData.product_interest}
              onChange={(e) => setFormData({ ...formData, product_interest: e.target.value })}
              placeholder="e.g., Solar Inverter, Battery, Stabilizer"
              className="w-full"
              data-testid="lead-product-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={fieldLabel}>Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full"
                data-testid="lead-source-select"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className={fieldLabel}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full"
                  data-testid="lead-status-select"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className={fieldLabel}>Assign To</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full"
              data-testid="lead-assign-select"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={fieldLabel}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full resize-none"
              data-testid="lead-notes-input"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              data-testid="submit-lead-btn"
            >
              {isEdit ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Note Modal --------------------------------------------------------
function AddNoteModal({ lead, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (note.trim()) {
      onSubmit(note);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="mg-card w-full max-w-md overflow-hidden rounded-lg border border-border bg-popover">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold text-foreground">Add Note · {lead.name}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Enter your note about this lead..."
              className="w-full resize-none"
              required
              data-testid="add-note-input"
            />
          </div>

          {lead.interactions && lead.interactions.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent Activity</p>
              <div className="max-h-32 space-y-2 overflow-y-auto custom-scrollbar">
                {lead.interactions.slice(-3).reverse().map((interaction, idx) => (
                  <div key={idx} className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{interaction.type}</span>
                    {interaction.notes && <span> — {interaction.notes.slice(0, 50)}...</span>}
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground/60">
                      {new Date(interaction.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              data-testid="submit-note-btn"
            >
              Add Note
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
