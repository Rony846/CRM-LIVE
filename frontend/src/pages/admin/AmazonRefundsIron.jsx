import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  RefreshCw, AlertTriangle, Shield, IndianRupee, ListChecks,
  AlertCircle, Flag, Search, Download, Loader2, ExternalLink, FileText,
  X, Paperclip, Trash2, Upload, Clock,
  TrendingUp, TrendingDown, Plus, Layers, ArrowUpRight,
} from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Area, AreaChart,
  CartesianGrid,
} from 'recharts';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const REFUND_TYPES = [
  'full_refund', 'partial_refund', 'return_refund',
  'a_to_z_claim', 'safe_t_claim', 'chargeback', 'manual_goodwill',
];
const A_TO_Z_OUTCOMES = ['granted', 'denied', 'pending', 'NA'];
const SOURCES = ['financial_events_api', 'amazon_settlement', 'manual'];

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const inrPaise = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);

// refund_type -> Iron pill tone
const typeTone = (t) => ({
  full_refund: 'bad', partial_refund: 'warn', return_refund: 'info',
  a_to_z_claim: 'bad', safe_t_claim: 'violet', chargeback: 'violet', manual_goodwill: 'slate',
}[t] || 'slate');

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer', width: '100%' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

const DATE_PRESETS = [
  { label: 'Last 7d', days: 7 },
  { label: 'Last 30d', days: 30 },
  { label: 'MTD', mtd: true },
  { label: 'Last month', lastMonth: true },
  { label: 'FYTD', fytd: true },
];

const yyyyMmDd = (d) => d.toISOString().slice(0, 10);

const presetRange = (preset) => {
  const today = new Date();
  if (preset.days) {
    const from = new Date(); from.setDate(today.getDate() - preset.days);
    return { from: yyyyMmDd(from), to: yyyyMmDd(today) };
  }
  if (preset.mtd) {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: yyyyMmDd(from), to: yyyyMmDd(today) };
  }
  if (preset.lastMonth) {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: yyyyMmDd(first), to: yyyyMmDd(last) };
  }
  if (preset.fytd) {
    const y = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
    return { from: `${y}-04-01`, to: yyyyMmDd(today) };
  }
  return { from: '', to: '' };
};

export default function AmazonRefunds({ embedded }) {
  const { token } = useAuth();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ===== state =====
  const [firms, setFirms] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topSkus, setTopSkus] = useState([]);
  const [disputeStats, setDisputeStats] = useState(null);
  const [reasonDist, setReasonDist] = useState([]);
  const [cronLastRun, setCronLastRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [firmId, setFirmId] = useState('all');
  const [refundType, setRefundType] = useState('all');
  const [source, setSource] = useState('all');
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [fakeOnly, setFakeOnly] = useState(false);
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  // Selection + density
  const [selected, setSelected] = useState(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({});
  const [density, setDensity] = useState('comfortable'); // 'compact' | 'comfortable'

  // Pagination
  const PAGE = 50;
  const [page, setPage] = useState(1);

  // Edit + manual + expand
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    amazon_order_id: '', firm_id: '', refund_amount: '',
    refund_date: '', refund_type: 'manual_goodwill', refund_reason: '',
  });
  const searchInputRef = useRef(null);

  // ===== fetchers =====
  const fetchFirms = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/firms`, { headers, params: { is_active: true } });
      setFirms(r.data || []);
    } catch (e) { console.error('firms:', e); }
  }, [headers]);

  const refundParams = useCallback(() => {
    const p = { limit: 1000 };
    if (firmId !== 'all') p.firm_id = firmId;
    if (refundType !== 'all') p.refund_type = refundType;
    if (fakeOnly) p.is_fake = true;
    if (disputedOnly) p.is_disputed = true;
    if (fromDate) p.from_date = fromDate;
    if (toDate) p.to_date = toDate;
    return p;
  }, [firmId, refundType, fakeOnly, disputedOnly, fromDate, toDate]);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/amazon/refunds`, { headers, params: refundParams() });
      setRefunds(r.data || []);
      setSelected(new Set());
      setPage(1);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load refunds');
    } finally { setLoading(false); }
  }, [headers, refundParams]);

  const fetchAnalytics = useCallback(async () => {
    const baseParams = {};
    if (firmId !== 'all') baseParams.firm_id = firmId;
    if (fromDate) baseParams.from_date = fromDate;
    if (toDate) baseParams.to_date = toDate;
    try {
      const [s, t, sku, d, r] = await Promise.all([
        axios.get(`${API}/amazon/refunds/summary`, { headers, params: baseParams }),
        axios.get(`${API}/amazon/refunds/trend`, { headers, params: { ...baseParams, days: 90, bucket: 'day' } }),
        axios.get(`${API}/amazon/refunds/top-skus`, { headers, params: { ...baseParams, limit: 10 } }),
        axios.get(`${API}/amazon/refunds/dispute-stats`, { headers, params: baseParams }),
        axios.get(`${API}/amazon/refunds/reason-distribution`, { headers, params: baseParams }),
      ]);
      setSummary(s.data); setTrend(t.data || []); setTopSkus(sku.data || []);
      setDisputeStats(d.data); setReasonDist(r.data || []);
    } catch (e) { console.error('analytics:', e); }
  }, [headers, firmId, fromDate, toDate]);

  const fetchCronStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/cron-runs`,
        { headers, params: { job: 'amazon_nightly_sync', limit: 1 } });
      setCronLastRun((r.data || [])[0] || null);
    } catch (e) { /* admin-only — ignore for accountant */ }
  }, [headers]);

  useEffect(() => { fetchFirms(); fetchCronStatus(); }, [fetchFirms, fetchCronStatus]);
  useEffect(() => { fetchRefunds(); fetchAnalytics(); }, [fetchRefunds, fetchAnalytics]);

  // ===== keyboard shortcuts =====
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 's' && (e.metaKey || e.ctrlKey) === false) handleSync();
      if (e.key === 'e' && (e.metaKey || e.ctrlKey) === false) handleExport();
      if (e.key === 'Escape') { setEditing(null); setBulkEditOpen(false); setManualOpen(false); setExpandedRow(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmId]);

  // ===== sync / export =====
  const handleSync = async () => {
    if (firmId === 'all') { toast.error('Pick a firm first'); return; }
    setSyncing(true);
    try {
      const r = await axios.post(`${API}/amazon/refunds/sync-financial-events/${firmId}?days_back=30`, {}, { headers });
      const d = r.data || {};
      toast.success(`Synced ${d.refunds_created || 0} new${d.refunds_skipped_existing ? ` (${d.refunds_skipped_existing} already on file)` : ''}`);
      fetchRefunds(); fetchAnalytics(); fetchCronStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(refundParams()).forEach(([k, v]) => params.set(k, String(v)));
      const resp = await axios.get(`${API}/amazon/refunds/export?${params}`,
        { headers, responseType: 'blob' });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `amazon-refunds-${fromDate || 'all'}-${toDate || 'now'}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('CSV downloaded');
    } catch (e) { toast.error('Export failed'); }
  };

  // ===== edit row =====
  const openEdit = (r) => {
    setEditing(r);
    setEditForm({
      is_fake: !!r.is_fake, is_disputed: !!r.is_disputed,
      product_returned: !!r.product_returned, refund_type: r.refund_type,
      a_to_z_outcome: r.a_to_z_outcome || 'NA',
      refund_reason: r.refund_reason || '', dispute_notes: r.dispute_notes || '',
    });
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await axios.patch(`${API}/amazon/refunds/${editing.id}`, editForm, { headers });
      toast.success('Refund updated');
      setEditing(null); fetchRefunds(); fetchAnalytics();
    } catch (e) { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  // ===== bulk =====
  const visible = useMemo(() => {
    let list = refunds;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.amazon_order_id || '').toLowerCase().includes(q) ||
        (r.refund_reason || '').toLowerCase().includes(q));
    }
    if (orphanOnly) list = list.filter(r => !r.linked_credit_note_id);
    if (source !== 'all') list = list.filter(r => r.source === source);
    return list;
  }, [refunds, search, orphanOnly, source]);
  const paged = useMemo(() => visible.slice((page - 1) * PAGE, page * PAGE), [visible, page]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE));

  const allSelectedOnPage = paged.length > 0 && paged.every(r => selected.has(r.id));
  const toggleAll = () => {
    const ns = new Set(selected);
    if (allSelectedOnPage) paged.forEach(r => ns.delete(r.id));
    else paged.forEach(r => ns.add(r.id));
    setSelected(ns);
  };
  const toggleOne = (id) => {
    const ns = new Set(selected);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelected(ns);
  };

  const applyBulk = async () => {
    if (selected.size === 0) return;
    const updates = Object.fromEntries(Object.entries(bulkEditForm).filter(([_, v]) => v !== '' && v !== undefined));
    if (!Object.keys(updates).length) { toast.error('Nothing to change'); return; }
    try {
      const r = await axios.post(`${API}/amazon/refunds/bulk-update`,
        { ids: [...selected], updates }, { headers });
      toast.success(`Updated ${r.data.modified} refunds`);
      setBulkEditOpen(false); setBulkEditForm({});
      fetchRefunds(); fetchAnalytics();
    } catch (e) { toast.error('Bulk update failed'); }
  };

  // ===== attachments =====
  const uploadAttachment = async (file, note) => {
    if (!editing) return;
    const fd = new FormData(); fd.append('file', file); if (note) fd.append('note', note);
    try {
      const r = await axios.post(`${API}/amazon/refunds/${editing.id}/attachments`,
        fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      toast.success('Attached');
      setEditing({ ...editing, attachments: [...(editing.attachments || []), r.data] });
    } catch (e) { toast.error('Upload failed'); }
  };
  const removeAttachment = async (att_id) => {
    if (!editing) return;
    try {
      await axios.delete(`${API}/amazon/refunds/${editing.id}/attachments/${att_id}`, { headers });
      setEditing({ ...editing, attachments: (editing.attachments || []).filter(a => a.id !== att_id) });
    } catch (e) { toast.error('Remove failed'); }
  };

  // ===== manual entry =====
  const submitManual = async () => {
    if (!manualForm.amazon_order_id || !manualForm.firm_id || !manualForm.refund_amount) {
      toast.error('Order ID, firm and amount required'); return;
    }
    try {
      await axios.post(`${API}/amazon/refunds/manual`,
        { ...manualForm, refund_amount: Number(manualForm.refund_amount) },
        { headers });
      toast.success('Manual refund recorded');
      setManualOpen(false);
      setManualForm({ amazon_order_id: '', firm_id: '', refund_amount: '',
        refund_date: '', refund_type: 'manual_goodwill', refund_reason: '' });
      fetchRefunds(); fetchAnalytics();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  // ===== chips =====
  const activeFilterChips = useMemo(() => {
    const c = [];
    if (firmId !== 'all') c.push({ label: `Firm: ${(firms.find(f => f.id === firmId) || {}).name || firmId.slice(0, 6)}`, clear: () => setFirmId('all') });
    if (refundType !== 'all') c.push({ label: `Type: ${refundType}`, clear: () => setRefundType('all') });
    if (source !== 'all') c.push({ label: `Source: ${source}`, clear: () => setSource('all') });
    if (fakeOnly) c.push({ label: 'Fake only', clear: () => setFakeOnly(false) });
    if (disputedOnly) c.push({ label: 'Disputed only', clear: () => setDisputedOnly(false) });
    if (orphanOnly) c.push({ label: 'Orphans only', clear: () => setOrphanOnly(false) });
    if (fromDate) c.push({ label: `From ${fromDate}`, clear: () => { setFromDate(''); setActivePreset(null); } });
    if (toDate) c.push({ label: `To ${toDate}`, clear: () => { setToDate(''); setActivePreset(null); } });
    return c;
  }, [firmId, refundType, source, fakeOnly, disputedOnly, orphanOnly, fromDate, toDate, firms]);

  // ===== derived stats =====
  const totalCount = summary?.total?.n ?? refunds.length;
  const totalAmount = summary?.total?.amount ?? refunds.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const totalNetLoss = summary?.total?.net_loss ?? totalAmount;
  const fakeCount = summary?.total?.fake_count ?? refunds.filter((r) => r.is_fake).length;
  const successRate = disputeStats?.success_rate || 0;

  // Sparkline mini-data for cards (last 28 days from trend)
  const spark = trend.slice(-28);
  const sparkAmt = spark.reduce((s, x) => s + (x.amount || 0), 0);
  const sparkPrev = trend.slice(-56, -28).reduce((s, x) => s + (x.amount || 0), 0);
  const sparkDelta = sparkPrev > 0 ? ((sparkAmt - sparkPrev) / sparkPrev) * 100 : 0;

  const rowPad = density === 'compact' ? '6px 12px' : '10px 12px';

  const clearAllFilters = () => { setFirmId('all'); setRefundType('all'); setSource('all'); setFakeOnly(false); setDisputedOnly(false); setOrphanOnly(false); setFromDate(''); setToDate(''); setActivePreset(null); };

  const shell = (kids) => embedded ? kids : (
    <IronShell
      title="Amazon Refunds"
      subtitle="REFUNDS & A-Z CLAIMS · LOSS DEFENSE"
      onRefresh={() => { fetchRefunds(); fetchAnalytics(); }}
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setManualOpen(true)} style={outlineBtn}><Plus size={14} /> Manual</button>
          <button onClick={handleSync} disabled={syncing || firmId === 'all'}
            style={{ ...primaryBtn, background: T.green, opacity: (syncing || firmId === 'all') ? 0.55 : 1, cursor: (syncing || firmId === 'all') ? 'default' : 'pointer' }}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync (S)
          </button>
          <button onClick={handleExport} style={outlineBtn}><Download size={14} /> CSV (E)</button>
        </div>
      }>{kids}</IronShell>
  );
  return shell(<>

      {/* Cron status banner */}
      {cronLastRun && (
        <IronCard pad={12} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={16} color={cronLastRun.status === 'completed' ? T.green : T.voltageText} />
          <span style={{ fontSize: 12, color: T.iron700 }}>
            Nightly sync <b style={{ color: T.iron900 }}>{cronLastRun.status}</b> on{' '}
            {new Date(cronLastRun.completed_at || cronLastRun.started_at).toLocaleString()}.
            {' '}Next run automatic at 02:00 IST.
          </span>
          <button onClick={fetchCronStatus} style={{ ...outlineBtn, marginLeft: 'auto', padding: '5px 10px' }}>
            <RefreshCw size={12} /> Refresh
          </button>
        </IronCard>
      )}

      {/* Summary cards with sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <SummaryCard label="Total refunds" value={totalCount} icon={ListChecks} tone={T.blue}
          sparkData={spark} sparkKey="count" />
        <SummaryCard label="Total amount" value={inr(totalAmount)} icon={IndianRupee} tone={T.voltageText}
          sparkData={spark} sparkKey="amount" delta={sparkDelta} />
        <SummaryCard label="Net loss" value={inr(totalNetLoss)} icon={AlertCircle} tone={T.rose}
          sparkData={spark} sparkKey="amount" />
        <SummaryCard label="Flagged FAKE" value={fakeCount} icon={Flag} tone={T.orangeDeep}
          badge={disputeStats?.won ? `${(successRate * 100).toFixed(0)}% won` : null}
          sparkData={spark} sparkKey="fake_count" />
      </div>

      {/* Trend + Top SKUs (analytics row) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <IronCard pad={16}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Refund trend</div>
              <div style={{ fontSize: 11, color: T.iron400, marginTop: 2 }}>Last 90 days · ₹ refunded per day</div>
            </div>
            <span style={{ ...badgeStyle(sparkDelta >= 0 ? 'bad' : 'ok'), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {sparkDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(sparkDelta).toFixed(1)}% vs prev 28d
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ironAmt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.orange} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={T.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={T.iron200} />
              <XAxis dataKey="_id" tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.iron400, fontFamily: T.mono }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, fontSize: 12, fontFamily: T.body, color: T.iron900 }}
                cursor={{ stroke: T.orange, strokeOpacity: 0.3, strokeWidth: 1 }}
                formatter={(v) => inrPaise(v)}
              />
              <Area type="monotone" dataKey="amount" stroke={T.orange} fill="url(#ironAmt)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </IronCard>

        <IronCard pad={16}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Top refunded SKUs</div>
          <div style={{ fontSize: 11, color: T.iron400, marginTop: 2, marginBottom: 10 }}>Product quality signal</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 200, overflow: 'auto', paddingRight: 4 }}>
            {topSkus.slice(0, 10).map((s, i) => (
              <div key={s._id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                <span style={{ color: T.iron400, width: 20 }}>#{i + 1}</span>
                <span style={{ ...mono, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={s.sku_name}>
                  {s.sku_code || s._id?.slice(0, 8) || '?'}
                </span>
                <span style={{ color: T.iron500 }}>{s.count}×</span>
                <span style={{ ...mono, color: T.voltageText, width: 80, textAlign: 'right' }}>{inr(s.amount)}</span>
              </div>
            ))}
            {topSkus.length === 0 && <div style={{ color: T.iron400, fontSize: 11.5, fontStyle: 'italic' }}>No data yet</div>}
          </div>
        </IronCard>
      </div>

      {/* Filters */}
      <IronCard pad={14} style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, alignItems: 'end' }}>
          <FilterField label="Firm">
            <select value={firmId} onChange={(e) => setFirmId(e.target.value)} style={selectStyle}>
              <option value="all">All firms</option>
              {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Refund type">
            <select value={refundType} onChange={(e) => setRefundType(e.target.value)} style={selectStyle}>
              <option value="all">All types</option>
              {REFUND_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterField>
          <FilterField label="Source">
            <select value={source} onChange={(e) => setSource(e.target.value)} style={selectStyle}>
              <option value="all">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FilterField>
          <FilterField label="From date">
            <input type="date" style={selectStyle}
              value={fromDate} onChange={(e) => { setFromDate(e.target.value); setActivePreset(null); }} />
          </FilterField>
          <FilterField label="To date">
            <input type="date" style={selectStyle}
              value={toDate} onChange={(e) => { setToDate(e.target.value); setActivePreset(null); }} />
          </FilterField>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Toggle label="Fake" checked={fakeOnly} onChange={setFakeOnly} />
            <Toggle label="Disputed" checked={disputedOnly} onChange={setDisputedOnly} />
            <Toggle label="Orphans" checked={orphanOnly} onChange={setOrphanOnly} />
          </div>
        </div>

        {/* Date presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Caps size={9} color={T.iron400}>Quick:</Caps>
          {DATE_PRESETS.map((p) => {
            const active = activePreset === p.label;
            return (
              <button key={p.label}
                onClick={() => {
                  const r = presetRange(p);
                  setFromDate(r.from); setToDate(r.to); setActivePreset(p.label);
                }}
                style={{ padding: '4px 12px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? '#FDEEE6' : T.white, color: active ? T.orangeDeep : T.iron500 }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Active chips */}
        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {activeFilterChips.map((c, i) => (
              <button key={i} onClick={c.clear}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.iron100, color: T.iron700, fontSize: 11, borderRadius: 999, padding: '3px 10px', border: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
                {c.label} <X size={12} />
              </button>
            ))}
            <button onClick={clearAllFilters}
              style={{ fontSize: 11, color: T.iron500, textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: 10 }} />
            <input ref={searchInputRef}
              placeholder="Search by order ID / reason  ( press / )"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: T.iron100, borderRadius: 6, padding: 2 }}>
            {['comfortable', 'compact'].map((d) => (
              <button key={d} onClick={() => setDensity(d)}
                style={{ padding: '5px 10px', fontSize: 11, borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600,
                  background: density === d ? T.white : 'transparent', color: density === d ? T.iron900 : T.iron500, boxShadow: density === d ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
                {d === 'comfortable' ? 'Comfortable' : 'Compact'}
              </button>
            ))}
          </div>
          <button onClick={() => { fetchRefunds(); fetchAnalytics(); }} style={{ ...outlineBtn, padding: '8px' }} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setManualOpen(true)} style={outlineBtn}><Plus size={14} /> Manual</button>
          <button onClick={handleSync} disabled={syncing || firmId === 'all'}
            style={{ ...primaryBtn, background: T.green, opacity: (syncing || firmId === 'all') ? 0.55 : 1, cursor: (syncing || firmId === 'all') ? 'default' : 'pointer' }}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync (S)
          </button>
          <button onClick={handleExport} style={outlineBtn}><Download size={14} /> CSV (E)</button>
        </div>

        {/* Bulk-action bar */}
        {selected.size > 0 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8, padding: '8px 14px' }}>
            <Layers size={16} color={T.orangeDeep} />
            <span style={{ color: T.orangeDeep, fontSize: 13, fontFamily: T.headline, fontWeight: 700 }}>{selected.size} selected</span>
            <button onClick={() => setBulkEditOpen(true)} style={{ ...primaryBtn, padding: '6px 12px' }}>Bulk edit</button>
            <button onClick={() => setSelected(new Set())} style={{ ...outlineBtn, padding: '6px 12px' }}>Clear</button>
          </div>
        )}
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
            {visible.length} {visible.length === 1 ? 'refund' : 'refunds'}
            {visible.length !== totalCount && <span style={{ color: T.iron400, marginLeft: 8, fontWeight: 400, fontSize: 12 }}>of {totalCount} total</span>}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </div>
        {loading ? (
          <SkeletonTable rows={8} />
        ) : visible.length === 0 ? (
          <EmptyState onSync={firmId !== 'all' ? handleSync : null} onManual={() => setManualOpen(true)} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <th style={{ ...thCell, width: 36 }}>
                    <Checkbox checked={allSelectedOnPage} onCheckedChange={toggleAll} />
                  </th>
                  {['Order', 'Date', 'Type'].map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                  {['A-Z', 'Reason', 'Flags', 'Links'].map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                  <th style={{ ...thCell, width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}
                      onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                      <td style={{ ...tdCell, padding: rowPad }} onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                      </td>
                      <td style={{ ...tdCell, padding: rowPad, ...mono, fontSize: 11.5, color: T.iron900 }}>{r.amazon_order_id}</td>
                      <td style={{ ...tdCell, padding: rowPad, color: T.iron700 }}>{r.refund_date}</td>
                      <td style={{ ...tdCell, padding: rowPad }}>
                        <span style={badgeStyle(typeTone(r.refund_type))}>{r.refund_type}</span>
                      </td>
                      <td style={{ ...tdCell, padding: rowPad, textAlign: 'right', ...mono, fontWeight: 700, color: T.iron900 }}>{inr(r.refund_amount)}</td>
                      <td style={{ ...tdCell, padding: rowPad }}>
                        {r.a_to_z_outcome && r.a_to_z_outcome !== 'NA' ? (
                          <span style={badgeStyle(r.a_to_z_outcome === 'granted' ? 'bad' : r.a_to_z_outcome === 'denied' ? 'ok' : 'warn')}>
                            {r.a_to_z_outcome}
                          </span>
                        ) : <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={{ ...tdCell, padding: rowPad, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron700 }} title={r.refund_reason}>
                        {r.refund_reason || <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={{ ...tdCell, padding: rowPad }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {r.is_fake && <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 2 }}><Flag size={10} />FAKE</span>}
                          {r.is_disputed && <span style={{ ...badgeStyle('warn'), display: 'inline-flex', alignItems: 'center', gap: 2 }}><Shield size={10} />Disputed</span>}
                          {r.product_returned && <span style={badgeStyle('info')}>↩</span>}
                          {r.attachments?.length > 0 && (
                            <span style={{ ...badgeStyle('slate'), display: 'inline-flex', alignItems: 'center', gap: 2 }}><Paperclip size={10} />{r.attachments.length}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdCell, padding: rowPad }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <a href={`https://sellercentral.amazon.in/orders-v3/order/${r.amazon_order_id}`}
                            target="_blank" rel="noreferrer" title="Open in Seller Central"
                            style={{ color: T.iron500, display: 'inline-flex' }}>
                            <ExternalLink size={14} />
                          </a>
                          {r.linked_credit_note_id ? (
                            <span style={{ color: T.green, display: 'inline-flex' }} title={`CN ${r.linked_credit_note_id.slice(0, 8)}…`}><FileText size={14} /></span>
                          ) : (
                            <span style={{ color: T.iron200, display: 'inline-flex' }} title="No CN linked"><FileText size={14} /></span>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdCell, padding: rowPad, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(r)} title="Edit"
                          style={{ border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, width: 28, height: 28, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                    {expandedRow === r.id && (
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <RowExpansion r={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Edit dialog */}
      <EditDialog
        editing={editing} setEditing={setEditing}
        form={editForm} setForm={setEditForm} onSave={saveEdit} saving={saving}
        onUploadAttachment={uploadAttachment} onRemoveAttachment={removeAttachment}
      />

      {/* Bulk edit dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk edit {selected.size} refunds</DialogTitle>
            <DialogDescription>
              Only fields you set here will change. Empty = leave as-is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Refund type</Label>
              <Select value={bulkEditForm.refund_type || ''} onValueChange={(v) => setBulkEditForm({ ...bulkEditForm, refund_type: v })}>
                <SelectTrigger><SelectValue placeholder="— no change —" /></SelectTrigger>
                <SelectContent>
                  {REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">A-Z outcome</Label>
              <Select value={bulkEditForm.a_to_z_outcome || ''} onValueChange={(v) => setBulkEditForm({ ...bulkEditForm, a_to_z_outcome: v })}>
                <SelectTrigger><SelectValue placeholder="— no change —" /></SelectTrigger>
                <SelectContent>
                  {A_TO_Z_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={bulkEditForm.is_fake === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, is_fake: !!v })} />
                Mark FAKE
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={bulkEditForm.is_disputed === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, is_disputed: !!v })} />
                Mark Disputed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={bulkEditForm.product_returned === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, product_returned: !!v })} />
                Product returned
              </label>
            </div>
            <div>
              <Label className="text-xs">Dispute notes</Label>
              <Textarea
                value={bulkEditForm.dispute_notes || ''}
                onChange={(e) => setBulkEditForm({ ...bulkEditForm, dispute_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)}>Cancel</Button>
            <Button onClick={applyBulk} style={{ background: T.orange }}>Apply to {selected.size}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual entry */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a manual refund</DialogTitle>
            <DialogDescription>
              For refunds outside Amazon's automatic feed (goodwill gestures, off-platform settlements).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Firm</Label>
                <Select value={manualForm.firm_id} onValueChange={(v) => setManualForm({ ...manualForm, firm_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Refund type</Label>
                <Select value={manualForm.refund_type} onValueChange={(v) => setManualForm({ ...manualForm, refund_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amazon order ID</Label>
                <Input
                  value={manualForm.amazon_order_id}
                  onChange={(e) => setManualForm({ ...manualForm, amazon_order_id: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Refund amount ₹</Label>
                <Input type="number"
                  value={manualForm.refund_amount}
                  onChange={(e) => setManualForm({ ...manualForm, refund_amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Refund date</Label>
              <Input type="date"
                value={manualForm.refund_date}
                onChange={(e) => setManualForm({ ...manualForm, refund_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={manualForm.refund_reason}
                onChange={(e) => setManualForm({ ...manualForm, refund_reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={submitManual} style={{ background: T.orange }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </>);
}

// ─── Sub-components ───

function SummaryCard({ label, value, icon: Icon, tone, sparkData, sparkKey, delta, badge }) {
  return (
    <IronCard pad={14} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Caps size={9} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, marginTop: 4, lineHeight: 1 }}>{value}</div>
          {badge && <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 10.5, color: T.green, marginTop: 4 }}>{badge}</div>}
          {typeof delta === 'number' && delta !== 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, marginTop: 4, color: delta > 0 ? T.orangeDeep : T.green }}>
              {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta).toFixed(1)}% vs prev period
            </div>
          )}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
          <Icon size={16} color={tone} strokeWidth={1.9} />
        </div>
      </div>
      {sparkData?.length > 1 && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 34, opacity: 0.55 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey={sparkKey} stroke={tone} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </IronCard>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>{label}</Caps>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{ padding: '4px 12px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer',
        border: `1px solid ${checked ? T.orange : T.iron200}`, background: checked ? '#FDEEE6' : T.white, color: checked ? T.orangeDeep : T.iron500 }}>
      {label}
    </button>
  );
}

function SkeletonTable({ rows = 8 }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ height: 40, background: T.iron100, borderRadius: 6 }} />
      ))}
    </div>
  );
}

function EmptyState({ onSync, onManual }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <AlertTriangle size={44} color={T.iron200} style={{ margin: '0 auto 14px' }} />
      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700, marginBottom: 3 }}>No refunds match the filters</div>
      <div style={{ fontSize: 12, color: T.iron400, marginBottom: 18 }}>Either nothing happened, or you've filtered too tightly.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {onSync && (
          <button onClick={onSync} style={{ ...primaryBtn, background: T.green }}>
            <RefreshCw size={14} /> Sync from Amazon
          </button>
        )}
        <button onClick={onManual} style={outlineBtn}>
          <Plus size={14} /> Add manual refund
        </button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
        style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>‹</button>
      <Caps size={9} color={T.iron500}>Page {page} / {totalPages}</Caps>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>›</button>
    </div>
  );
}

function RowExpansion({ r }) {
  const cell = { fontSize: 11.5, color: T.iron700 };
  return (
    <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.iron200}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div>
          <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Source & ids</Caps>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={cell}>Source: <span style={mono}>{r.source || '—'}</span></div>
            <div style={cell}>Event id: <span style={{ ...mono, wordBreak: 'break-all' }}>{r.refund_event_id || '—'}</span></div>
            <div style={cell}>Linked dispatch: <span style={mono}>{r.linked_dispatch_id?.slice(0, 8) || '—'}</span></div>
            <div style={cell}>Linked CN: <span style={mono}>{r.linked_credit_note_id?.slice(0, 8) || '—'}</span></div>
            <div style={cell}>COGS journal: <span style={mono}>{r.linked_journal_entry_id?.slice(0, 8) || '—'}</span></div>
          </div>
        </div>
        <div>
          <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Items</Caps>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(r.items?.length > 0 ? r.items : []).slice(0, 5).map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, ...cell }}>
                <span style={{ color: T.iron400, width: 16 }}>{i + 1}.</span>
                <span style={{ ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.sku_code || it.amazon_sku || '?'}</span>
                <span style={{ color: T.iron400 }}>×{it.quantity || 1}</span>
              </div>
            ))}
            {!r.items?.length && <div style={{ ...cell, color: T.iron400, fontStyle: 'italic' }}>No items recorded</div>}
          </div>
        </div>
        <div>
          <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Notes & flags</Caps>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={cell}>Net loss: <span style={{ ...mono, color: T.rose }}>{inr(r.net_loss)}</span></div>
            <div style={cell}>Currency: {r.currency || 'INR'}</div>
            <div style={{ ...cell, color: T.iron500, whiteSpace: 'pre-wrap', marginTop: 6 }}>
              {r.dispute_notes || <span style={{ fontStyle: 'italic', color: T.iron400 }}>No dispute notes</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDialog({ editing, setEditing, form, setForm, onSave, saving, onUploadAttachment, onRemoveAttachment }) {
  const fileRef = useRef(null);
  const [note, setNote] = useState('');
  if (!editing) return null;
  return (
    <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono">{editing.amazon_order_id}</span>
            <a href={`https://sellercentral.amazon.in/orders-v3/order/${editing.amazon_order_id}`}
              target="_blank" rel="noreferrer" className="ml-2 inline-block" style={{ color: T.orange }}>
              <ExternalLink className="w-4 h-4 inline-block" />
            </a>
          </DialogTitle>
          <DialogDescription>
            {editing.refund_date} · {inrPaise(editing.refund_amount)} · {editing.source}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Refund type</Label>
              <Select value={form.refund_type} onValueChange={(v) => setForm({ ...form, refund_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">A-Z outcome</Label>
              <Select value={form.a_to_z_outcome} onValueChange={(v) => setForm({ ...form, a_to_z_outcome: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{A_TO_Z_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 py-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_fake} onCheckedChange={(v) => setForm({ ...form, is_fake: !!v })} />
              <Flag className="w-4 h-4" style={{ color: T.orangeDeep }} /> Fake claim
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_disputed} onCheckedChange={(v) => setForm({ ...form, is_disputed: !!v })} />
              <Shield className="w-4 h-4" style={{ color: T.voltageText }} /> Disputed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.product_returned} onCheckedChange={(v) => setForm({ ...form, product_returned: !!v })} />
              Product returned
            </label>
          </div>
          <div>
            <Label className="text-xs">Refund reason</Label>
            <Input
              value={form.refund_reason || ''} onChange={(e) => setForm({ ...form, refund_reason: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Dispute notes</Label>
            <Textarea className="min-h-20"
              value={form.dispute_notes || ''} onChange={(e) => setForm({ ...form, dispute_notes: e.target.value })} />
          </div>

          {/* Attachments */}
          <div className="border-t pt-3" style={{ borderColor: T.iron200 }}>
            <Label className="text-xs mb-2 block">Evidence attachments</Label>
            <div className="space-y-2">
              {(editing.attachments || []).map(a => (
                <div key={a.id} className="rounded px-3 py-2 text-xs flex items-center gap-2" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <Paperclip className="w-3.5 h-3.5" style={{ color: T.iron500 }} />
                  <span className="truncate flex-1" style={{ color: T.iron900 }}>{a.filename}</span>
                  <span style={{ color: T.iron400 }}>{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => onRemoveAttachment(a.id)} style={{ color: T.rose }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <input ref={fileRef} type="file" hidden onChange={(e) => {
                  if (e.target.files?.[0]) { onUploadAttachment(e.target.files[0], note); setNote(''); e.target.value = ''; }
                }} />
                <Input placeholder="Optional note for the file"
                  className="text-xs h-8 flex-1"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="h-8">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                </Button>
              </div>
              <p className="text-xs" style={{ color: T.iron400 }}>PNG/JPG/PDF up to 10 MB. POD images, courier proofs, screenshots.</p>
            </div>
          </div>

          {/* Linked records */}
          <div className="border-t pt-3 grid grid-cols-2 gap-2 text-xs" style={{ borderColor: T.iron200 }}>
            {editing.linked_credit_note_id && (
              <div className="flex items-center gap-1.5" style={{ color: T.green }}>
                <FileText className="w-3.5 h-3.5" /> CN: {editing.linked_credit_note_id.slice(0, 8)}…
              </div>
            )}
            {editing.linked_journal_entry_id && (
              <div className="flex items-center gap-1.5" style={{ color: T.blue }}>
                <FileText className="w-3.5 h-3.5" /> COGS reversal: {editing.linked_journal_entry_id.slice(0, 8)}…
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} style={{ background: T.orange }}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
