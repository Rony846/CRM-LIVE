import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Phone, Mail, Search, Plus, Edit2, Trash2, MessageSquare,
  TrendingUp, Users, UserCheck, UserX, PhoneCall, ArrowLeft,
  LayoutGrid, List, GripVertical, Clock, Loader2,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const API = process.env.REACT_APP_BACKEND_URL;

// Pipeline stages — `dot` drives the column marker, `tone` the Iron pill.
const LEAD_STATUSES = [
  { value: 'new',           label: 'New',           dot: T.iron400,  tone: 'slate' },
  { value: 'contacted',     label: 'Contacted',     dot: T.blue,     tone: 'info' },
  { value: 'qualified',     label: 'Qualified',     dot: '#6D4AB0',  tone: 'violet' },
  { value: 'proposal_sent', label: 'Proposal Sent', dot: T.orange,   tone: 'info' },
  { value: 'negotiation',   label: 'Negotiation',   dot: T.voltageText, tone: 'warn' },
  { value: 'converted',     label: 'Converted',     dot: T.green,    tone: 'ok' },
  { value: 'lost',          label: 'Lost',          dot: T.orangeDeep, tone: 'bad' },
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

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const modalInput = { ...inputStyle, width: '100%' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const fieldLabelStyle = { display: 'block', marginBottom: 5 };

const getStatusBadge = (status) => {
  const cfg = statusOf(status);
  return <span style={badgeStyle(cfg?.tone || 'slate')}>{cfg?.label || status}</span>;
};

// --- Draggable lead card (Iron) --------------------------------------------
function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onNote, onDelete, canDelete, dragging }) {
  const src = LEAD_SOURCES.find((s) => s.value === lead.source);
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onDragEnd={onDragEnd}
      data-testid={`lead-card-${lead.id}`}
      style={{
        background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 11,
        boxShadow: '0 1px 2px rgba(15,15,15,.05)', cursor: dragging ? 'grabbing' : 'grab',
        opacity: dragging ? 0.4 : 1, transition: 'opacity .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={badgeStyle('slate')}>{src?.label || lead.source || 'Other'}</span>
        <GripVertical size={13} color={T.iron400} style={{ flexShrink: 0 }} />
      </div>

      <p style={{ marginTop: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.name || 'Unnamed lead'}</p>
      {lead.product_interest && (
        <p style={{ marginTop: 1, fontSize: 11.5, color: T.iron500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.product_interest}</p>
      )}

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, ...mono, fontSize: 11, color: T.iron500 }}>
        <Phone size={12} style={{ flexShrink: 0 }} /> {lead.phone || '-'}
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${T.iron200}`, paddingTop: 8 }}>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 20, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 999, background: T.iron100, ...mono, fontSize: 9, fontWeight: 700, color: T.orangeDeep }}>
            {(lead.assigned_to_name || 'U')[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: T.iron500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.assigned_to_name || 'Unassigned'}</span>
        </div>
        <span style={{ display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: 4, ...mono, fontSize: 10, color: T.iron400 }}>
          <Clock size={11} /> {timeAgo(lead.created_at)}
        </span>
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onEdit(lead)} data-testid={`edit-lead-${lead.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...outlineBtn, padding: '4px 8px', fontSize: 10.5 }}>
          <Edit2 size={12} /> Edit
        </button>
        <button onClick={() => onNote(lead)} data-testid={`note-lead-${lead.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...outlineBtn, padding: '4px 8px', fontSize: 10.5 }}>
          <MessageSquare size={12} /> Note
        </button>
        {canDelete && (
          <button onClick={() => onDelete(lead.id)} data-testid={`delete-lead-${lead.id}`}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: '#FDEEE6', color: T.orangeDeep, borderRadius: 6, padding: '4px 8px', fontSize: 10.5, fontFamily: T.headline, fontWeight: 700, cursor: 'pointer' }}>
            <Trash2 size={12} />
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

  const statCards = [
    { label: 'Total Leads', value: stats.total || 0, icon: Users, tone: T.blue },
    { label: 'New', value: stats.new || 0, icon: PhoneCall, tone: T.voltageText },
    { label: 'Qualified', value: stats.qualified || 0, icon: TrendingUp, tone: '#6D4AB0' },
    { label: 'Converted', value: stats.converted || 0, icon: UserCheck, tone: T.green },
    { label: 'Lost', value: stats.lost || 0, icon: UserX, tone: T.orangeDeep },
  ];

  const viewBtn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
    background: active ? T.orange : 'transparent', color: active ? '#fff' : T.iron700, borderRadius: 6,
    padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
  });

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => navigate(-1)} data-testid="back-btn" title="Back"
        style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 34, width: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 }}>
        <ArrowLeft size={15} />
      </button>
      <div style={{ display: 'flex', gap: 4, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 3, background: T.white }}>
        <button onClick={() => setView('board')} style={viewBtn(view === 'board')}>
          <LayoutGrid size={14} /> Board
        </button>
        <button onClick={() => setView('list')} style={viewBtn(view === 'list')}>
          <List size={14} /> List
        </button>
      </div>
      <button onClick={() => setShowAddModal(true)} data-testid="add-lead-btn"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...primaryBtn }}>
        <Plus size={15} /> Add Lead
      </button>
    </div>
  );

  const tableHeaders = ['LEAD', 'CONTACT', 'INTEREST', 'SOURCE', 'STATUS', 'ASSIGNED TO', 'CREATED', ''];

  return (
    <IronShell title="Sales Leads" subtitle="SALES PIPELINE · LIVE" onRefresh={fetchLeads} headerRight={headerRight}>
      <div data-testid="leads-page">
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <IronCard key={s.label} pad={14}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                    <Icon size={18} color={s.tone} strokeWidth={1.9} />
                  </div>
                  <div>
                    <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value).toLocaleString('en-IN')}</div>
                    <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                  </div>
                </div>
              </IronCard>
            );
          })}
        </div>

        {/* Filters */}
        <IronCard pad={12} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input type="text" placeholder="Search by name, phone, email..." value={search}
                onChange={(e) => setSearch(e.target.value)} data-testid="lead-search"
                style={{ ...inputStyle, width: '100%', paddingLeft: 30 }} />
            </div>
            {view === 'list' && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="status-filter" style={selectStyle}>
                <option value="">All Statuses</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} data-testid="source-filter" style={selectStyle}>
              <option value="">All Sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </IronCard>

        {/* Count + load more */}
        {!loading && (stats.total ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, fontSize: 12, color: T.iron500 }}>
            <span>Showing <span style={{ color: T.iron900, fontWeight: 600 }}>{leads.length}</span> of {(stats.total).toLocaleString('en-IN')} leads</span>
            {leads.length < (stats.total ?? 0) && (
              <button onClick={() => setLimit((l) => l + 500)} data-testid="leads-load-more" style={{ ...outlineBtn, padding: '6px 12px' }}>
                Load more
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron400, fontSize: 13 }}>
              <Loader2 className="animate-spin" size={22} color={T.iron400} /> Loading leads...
            </div>
          </div>
        ) : view === 'board' ? (
          /* ---------------- Kanban board ---------------- */
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16 }}>
            {LEAD_STATUSES.map((stage) => {
              const items = leads.filter((l) => l.status === stage.value);
              const isTarget = dragOverCol === stage.value;
              return (
                <div key={stage.value} style={{ display: 'flex', width: 290, flexShrink: 0, flexDirection: 'column' }}>
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                    <span style={{ height: 8, width: 8, borderRadius: 999, background: stage.dot }} />
                    <Caps size={10.5} color={T.iron700} ls=".08em">{stage.label}</Caps>
                    <span style={{ borderRadius: 999, background: T.iron100, padding: '1px 7px', ...mono, fontSize: 10, fontWeight: 700, color: T.iron500 }}>
                      {items.length}
                    </span>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(stage.value); }}
                    onDrop={() => onColDrop(stage.value)}
                    style={{
                      display: 'flex', minHeight: 240, flex: 1, flexDirection: 'column', gap: 10, borderRadius: 8,
                      border: `1px dashed ${isTarget ? T.orange : T.iron200}`, padding: 10,
                      background: isTarget ? '#FEF6F1' : T.iron50, transition: 'background .15s, border-color .15s',
                    }}
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
                      <p style={{ padding: '24px 0', textAlign: 'center', ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: T.iron400 }}>
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
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="leads-table">
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {tableHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === tableHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                </tr></thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                        <Users size={44} style={{ margin: '0 auto 10px', opacity: 0.35 }} />
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No leads found</div>
                        <div style={{ fontSize: 12, marginTop: 3 }}>Create your first lead to get started</div>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`lead-row-${lead.id}`}>
                        <td style={tdCell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 999, background: T.iron100, ...mono, fontSize: 13, fontWeight: 700, color: T.orangeDeep }}>
                              {(lead.name || 'L')[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{lead.name}</div>
                              <div style={{ ...mono, fontSize: 10, color: T.iron400 }}>ID: {lead.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={tdCell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.iron900 }}>
                            <Phone size={13} color={T.iron400} />
                            <span style={mono}>{lead.phone}</span>
                          </div>
                          {lead.email && (
                            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.iron500 }}>
                              <Mail size={13} color={T.iron400} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{lead.email}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron900 }}>{lead.product_interest || '-'}</td>
                        <td style={tdCell}><span style={badgeStyle('slate')}>{(lead.source || 'other').replace('_', ' ')}</span></td>
                        <td style={tdCell}>{getStatusBadge(lead.status)}</td>
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron500 }}>{lead.assigned_to_name || '-'}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{formatDate(lead.created_at)}</td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setSelectedLead(lead); setShowEditModal(true); }} title="Edit" data-testid={`edit-lead-${lead.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => { setSelectedLead(lead); setShowNoteModal(true); }} title="Add Note" data-testid={`note-lead-${lead.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.iron200}`, background: T.white, color: T.green, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
                              <MessageSquare size={13} />
                            </button>
                            {user?.role === 'admin' && (
                              <button onClick={() => handleDeleteLead(lead.id)} title="Delete" data-testid={`delete-lead-${lead.id}`}
                                style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>
                                <Trash2 size={13} />
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
          </IronCard>
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
    </IronShell>
  );
}

// --- Lead Form Modal (Iron) ------------------------------------------------
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,15,.55)', padding: 16 }}>
      <div style={{ display: 'flex', maxHeight: '90vh', width: '100%', maxWidth: 520, flexDirection: 'column', overflow: 'hidden', borderRadius: 10, border: `1px solid ${T.iron200}`, background: T.white, boxShadow: '0 12px 40px rgba(15,15,15,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.iron200}`, padding: '14px 20px', background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, fontSize: 20, lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Caps size={9} style={fieldLabelStyle}>Phone *</Caps>
              <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required disabled={isEdit} data-testid="lead-phone-input" style={{ ...modalInput, opacity: isEdit ? 0.6 : 1 }} />
            </div>
            <div>
              <Caps size={9} style={fieldLabelStyle}>Name</Caps>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} data-testid="lead-name-input" style={modalInput} />
            </div>
          </div>

          <div>
            <Caps size={9} style={fieldLabelStyle}>Email</Caps>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} data-testid="lead-email-input" style={modalInput} />
          </div>

          <div>
            <Caps size={9} style={fieldLabelStyle}>Product Interest</Caps>
            <input type="text" value={formData.product_interest} onChange={(e) => setFormData({ ...formData, product_interest: e.target.value })}
              placeholder="e.g., Solar Inverter, Battery, Stabilizer" data-testid="lead-product-input" style={modalInput} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Caps size={9} style={fieldLabelStyle}>Source</Caps>
              <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} data-testid="lead-source-select" style={{ ...selectStyle, width: '100%' }}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <Caps size={9} style={fieldLabelStyle}>Status</Caps>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} data-testid="lead-status-select" style={{ ...selectStyle, width: '100%' }}>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <Caps size={9} style={fieldLabelStyle}>Assign To</Caps>
            <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} data-testid="lead-assign-select" style={{ ...selectStyle, width: '100%' }}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <Caps size={9} style={fieldLabelStyle}>Notes</Caps>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} data-testid="lead-notes-input" style={{ ...modalInput, resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${T.iron200}`, paddingTop: 14 }}>
            <button type="button" onClick={onClose} style={outlineBtn}>Cancel</button>
            <button type="submit" data-testid="submit-lead-btn" style={primaryBtn}>{isEdit ? 'Update Lead' : 'Create Lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Note Modal (Iron) -------------------------------------------------
function AddNoteModal({ lead, onClose, onSubmit }) {
  const [note, setNote] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (note.trim()) {
      onSubmit(note);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,15,.55)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440, overflow: 'hidden', borderRadius: 10, border: `1px solid ${T.iron200}`, background: T.white, boxShadow: '0 12px 40px rgba(15,15,15,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.iron200}`, padding: '14px 20px', background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Add Note · {lead.name}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron500, fontSize: 20, lineHeight: 1 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div>
            <Caps size={9} style={fieldLabelStyle}>Note</Caps>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
              placeholder="Enter your note about this lead..." required data-testid="add-note-input" style={{ ...modalInput, resize: 'none' }} />
          </div>

          {lead.interactions && lead.interactions.length > 0 && (
            <div>
              <Caps size={9} style={{ display: 'block', marginBottom: 8 }}>Recent Activity</Caps>
              <div style={{ maxHeight: 128, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {lead.interactions.slice(-3).reverse().map((interaction, idx) => (
                  <div key={idx} style={{ borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 8, fontSize: 11.5, color: T.iron500 }}>
                    <span style={{ fontWeight: 600, color: T.iron900 }}>{interaction.type}</span>
                    {interaction.notes && <span> — {interaction.notes.slice(0, 50)}...</span>}
                    <span style={{ marginTop: 4, display: 'block', ...mono, fontSize: 10, color: T.iron400 }}>
                      {new Date(interaction.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={outlineBtn}>Cancel</button>
            <button type="submit" data-testid="submit-note-btn" style={primaryBtn}>Add Note</button>
          </div>
        </form>
      </div>
    </div>
  );
}
