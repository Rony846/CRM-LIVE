import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { openAuthedFile } from '@/lib/openFile';
import { toast } from 'sonner';
import {
  Search, Eye, AlertTriangle, FileText, Inbox, ChevronLeft, ChevronRight,
  Download, FilterX, Upload, Loader2,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, ticketPill, fmtDateTime } from '@/components/iron/IronKit';

const STORAGE_KEY = 'admin_tickets_filters';
const EMPTY = { search: '', status: '', support_type: '', sla_breached: '', from_date: '', to_date: '' };
const STATUS_OPTS = [
  ['', 'All Statuses'], ['new_request', 'New Request'], ['call_support_followup', 'Call Support Followup'],
  ['resolved_on_call', 'Resolved on Call'], ['closed_by_agent', 'Closed by Agent'], ['hardware_service', 'Hardware Service'],
  ['awaiting_label', 'Awaiting Label'], ['received_at_factory', 'Received at Factory'], ['in_repair', 'In Repair'],
  ['repair_completed', 'Repair Completed'], ['ready_for_dispatch', 'Ready for Dispatch'], ['dispatched', 'Dispatched'],
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const SlaBar = ({ ticket }) => {
  if (ticket.closed_at) return ticket.sla_breached
    ? <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: T.orangeDeep, marginTop: 5 }}><AlertTriangle size={11} /> BREACHED</span> : null;
  if (!ticket.sla_due || !ticket.created_at) return null;
  const start = new Date(ticket.created_at).getTime(), due = new Date(ticket.sla_due).getTime();
  if (!start || !due || due <= start) return null;
  const pct = Math.max(0, Math.min(100, ((Date.now() - start) / (due - start)) * 100));
  const breached = ticket.sla_breached || pct >= 100;
  const c = breached ? T.orangeDeep : pct > 75 ? T.voltageText : T.green;
  return (
    <div style={{ width: 120, marginTop: 6 }}>
      <div style={{ height: 4, background: T.iron100, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${breached ? 100 : pct}%`, background: c, borderRadius: 4 }} />
      </div>
      <Caps size={8.5} color={c} ls=".05em" style={{ marginTop: 3, display: 'block' }}>{breached ? 'SLA breached' : `${Math.round(pct)}% elapsed`}</Caps>
    </div>
  );
};

export default function AdminTickets1a() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const saved = sessionStorage.getItem(STORAGE_KEY);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attachingId, setAttachingId] = useState(null);
  const [filters, setFilters] = useState(saved ? JSON.parse(saved) : { ...EMPTY });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.search) p.append('search', filters.search);
      if (filters.status) p.append('status', filters.status);
      if (filters.support_type) p.append('support_type', filters.support_type);
      if (filters.sla_breached) p.append('sla_breached', filters.sla_breached === 'true');
      if (filters.from_date) p.append('from_date', filters.from_date);
      if (filters.to_date) p.append('to_date', filters.to_date);
      p.append('page', page); p.append('limit', pageSize);
      const r = await axios.get(`${API}/admin/tickets?${p.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.tickets) { setTickets(r.data.tickets); setTotalCount(r.data.total); setTotalPages(r.data.total_pages); }
      else { setTickets(r.data); setTotalCount(r.data.length); setTotalPages(1); }
    } catch (e) { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); }, [filters]);

  const setF = (k, v) => setFilters((prev) => ({ ...prev, [k]: v }));
  const applyFilters = () => { if (page !== 1) setPage(1); else fetchTickets(); };
  const clearFilters = () => { setFilters({ ...EMPTY }); sessionStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY)); if (page !== 1) setPage(1); else setTimeout(fetchTickets, 50); };

  const range = () => {
    const r = []; let s = Math.max(1, page - 2); let e = Math.min(totalPages, s + 4);
    if (e - s < 4) s = Math.max(1, e - 4);
    for (let i = s; i <= e; i++) r.push(i);
    return r;
  };

  const exportCsv = () => {
    if (!tickets.length) { toast.error('No tickets on this page to export'); return; }
    const cols = ['ticket_number', 'customer_name', 'customer_phone', 'customer_email', 'product_name', 'serial_number', 'status', 'support_type', 'assigned_to_name', 'created_at', 'sla_due', 'closed_at'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...tickets.map((t) => cols.map((c) => esc(t[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `tickets_page${page}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${tickets.length} tickets`);
  };

  const openInvoice = async (t) => { if (!(await openAuthedFile(t.invoice_file, token, API))) toast.error('Could not open the invoice'); };
  const attachInvoice = async (ticketId, file) => {
    if (!file) return;
    setAttachingId(ticketId);
    try {
      const fd = new FormData(); fd.append('invoice_file', file);
      await axios.post(`${API}/tickets/${ticketId}/attach-invoice`, fd, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Invoice attached'); fetchTickets();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to attach invoice'); }
    finally { setAttachingId(null); }
  };

  const headers = ['TICKET', 'CUSTOMER', 'PRODUCT / ISSUE', 'STATUS', 'INVOICE', 'ASSIGNED', 'DATES', ''];

  return (
    <IronShell title="Ticket Pipeline" subtitle={`${totalCount.toLocaleString('en-IN')} TICKETS · ALL CHANNELS`} onRefresh={fetchTickets}
      headerRight={<button onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron700 }}><Download size={14} /> Export CSV</button>}>

      {/* Filter bar */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input value={filters.search} onChange={(e) => setF('search', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Ticket / Customer / Phone / Product" style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Support Type</Caps>
            <select value={filters.support_type} onChange={(e) => setF('support_type', e.target.value)} style={selectStyle}>
              <option value="">All Types</option><option value="phone">Phone</option><option value="hardware">Hardware</option>
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
            <select value={filters.status} onChange={(e) => setF('status', e.target.value)} style={selectStyle}>
              {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>SLA</Caps>
            <select value={filters.sla_breached} onChange={(e) => setF('sla_breached', e.target.value)} style={selectStyle}>
              <option value="">All SLA</option><option value="false">Within SLA</option><option value="true">Breached</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={applyFilters} style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>Apply</button>
            <button onClick={clearFilters} title="Clear filters" style={{ border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '8px', cursor: 'pointer', color: T.iron500, display: 'grid', placeItems: 'center' }}><FilterX size={15} /></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <div><Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>From Date</Caps><input type="date" value={filters.from_date} onChange={(e) => setF('from_date', e.target.value)} style={{ ...inputStyle, width: 160 }} /></div>
          <div><Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>To Date</Caps><input type="date" value={filters.to_date} onChange={(e) => setF('to_date', e.target.value)} style={{ ...inputStyle, width: 160 }} /></div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No tickets found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting or clearing your filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{tickets.map((t) => {
                const pill = ticketPill(t.status);
                return (
                  <tr key={t.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: t.sla_breached ? '#FEF6F1' : 'transparent' }}>
                    <td style={tdCell}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{t.ticket_number}</div>
                      {t.source === 'voltdoctor' && <span style={{ ...badgeStyle('violet'), marginTop: 4 }}>VoltDoctor</span>}
                      <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 3 }}>{t.customer_city || '-'}</div>
                    </td>
                    <td style={{ ...tdCell, maxWidth: 170 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{t.customer_name || '-'}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{t.customer_phone || '-'}</div>
                      <div style={{ fontSize: 10.5, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{t.customer_email || '-'}</div>
                    </td>
                    <td style={{ ...tdCell, maxWidth: 220 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron900 }}>{t.product_name || t.device_type || '-'}</div>
                      <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>S/N: {t.serial_number || '-'}</div>
                      {t.issue_description && <div style={{ fontSize: 10.5, color: T.iron500, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210, marginTop: 2 }}>"{t.issue_description}"</div>}
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        {t.support_type && <span style={badgeStyle(t.support_type === 'hardware' ? 'bad' : 'slate')}>{t.support_type === 'hardware' ? 'Hardware' : 'Phone'}</span>}
                        <span style={pill.style}>{pill.label}</span>
                      </div>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {t.invoice_file
                          ? <button onClick={() => openInvoice(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'transparent', color: T.orange, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}><FileText size={13} /> View</button>
                          : <span style={{ fontSize: 10.5, color: T.iron400, fontStyle: 'italic' }}>No invoice</span>}
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: T.iron400, cursor: 'pointer' }}>
                          <Upload size={11} />{attachingId === t.id ? 'Uploading…' : (t.invoice_file ? 'Replace' : 'Attach')}
                          <input type="file" style={{ display: 'none' }} accept="image/*,.pdf" disabled={attachingId === t.id} onChange={(e) => attachInvoice(t.id, e.target.files[0])} />
                        </label>
                      </div>
                    </td>
                    <td style={tdCell}>{t.assigned_to_name ? <span style={{ fontSize: 12, color: T.iron900 }}>{t.assigned_to_name}</span> : <span style={{ fontSize: 11, color: T.iron400, fontStyle: 'italic' }}>Unassigned</span>}</td>
                    <td style={tdCell}>
                      <div style={{ ...mono, fontSize: 9.5, lineHeight: 1.7, color: T.iron500 }}>
                        <div><span style={{ color: T.iron400 }}>CREATED </span>{fmtDateTime(t.created_at)}</div>
                        <div style={{ color: t.sla_breached ? T.orangeDeep : T.iron500 }}><span style={{ color: t.sla_breached ? T.orangeDeep : T.iron400 }}>SLA DUE </span>{fmtDateTime(t.sla_due)}</div>
                        <div><span style={{ color: T.iron400 }}>CLOSED </span>{t.closed_at ? fmtDateTime(t.closed_at) : '-'}</div>
                      </div>
                      <SlaBar ticket={t} />
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <button onClick={() => navigate(`/admin/tickets/${t.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}><Eye size={13} /> View</button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}

        {!loading && tickets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9} color={T.iron400}>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString('en-IN')}</Caps>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <button onClick={() => page > 1 && setPage(page - 1)} disabled={page === 1} style={{ border: 'none', background: 'transparent', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}><ChevronLeft size={16} /></button>
                {range().map((n) => (
                  <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                    background: n === page ? T.iron900 : 'transparent', color: n === page ? '#fff' : T.iron500 }}>{n}</button>
                ))}
                <button onClick={() => page < totalPages && setPage(page + 1)} disabled={page === totalPages} style={{ border: 'none', background: 'transparent', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}
