import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
  X, Filter, ChevronDown, ChevronUp, Paperclip, Trash2, Upload, Clock,
  TrendingUp, TrendingDown, Plus, Layers, ArrowUpRight,
} from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, Area, AreaChart,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';

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
const cls = (...xs) => xs.filter(Boolean).join(' ');

const typeBadgeClass = (t) => ({
  full_refund: 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30',
  partial_refund: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  return_refund: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
  a_to_z_claim: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
  safe_t_claim: 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30',
  chargeback: 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/30',
  manual_goodwill: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30',
}[t] || 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30');

// Apple-style soft card class
const softCard =
  'bg-slate-900/80 border border-slate-800/80 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] rounded-xl';

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

export default function AmazonRefunds() {
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

  const rowH = density === 'compact' ? 'h-9 text-xs' : 'h-12 text-sm';

  return (
    <DashboardLayout title="Amazon Refunds & A-Z Claims">
      <div className="space-y-4">
        {/* Cron status banner */}
        {cronLastRun && (
          <div className={cls(softCard, 'p-3 flex items-center gap-3 text-xs text-slate-300')}>
            <Clock className={cls('w-4 h-4', cronLastRun.status === 'completed' ? 'text-emerald-400' : 'text-amber-400')} />
            <span>
              Nightly sync <b className="text-white">{cronLastRun.status}</b> on{' '}
              {new Date(cronLastRun.completed_at || cronLastRun.started_at).toLocaleString()}.
              {' '}Next run automatic at 02:00 IST.
            </span>
            <Button size="sm" variant="ghost" className="ml-auto text-slate-400 hover:text-white"
              onClick={fetchCronStatus}>
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        )}

        {/* Summary cards with sparklines */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Total refunds" value={totalCount} icon={ListChecks} accent="sky"
            sparkData={spark} sparkKey="count" />
          <SummaryCard
            label="Total amount" value={inr(totalAmount)} icon={IndianRupee} accent="amber"
            sparkData={spark} sparkKey="amount"
            delta={sparkDelta} />
          <SummaryCard
            label="Net loss" value={inr(totalNetLoss)} icon={AlertCircle} accent="rose"
            sparkData={spark} sparkKey="amount" />
          <SummaryCard
            label="Flagged FAKE" value={fakeCount} icon={Flag} accent="red"
            badge={disputeStats?.won ? `${(successRate * 100).toFixed(0)}% won` : null}
            sparkData={spark} sparkKey="fake_count" />
        </div>

        {/* Trend + Top SKUs (analytics row) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className={cls(softCard, 'p-4 lg:col-span-2')}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-slate-300 text-sm font-medium">Refund trend</div>
                <div className="text-xs text-slate-500">Last 90 days · ₹ refunded per day</div>
              </div>
              <Badge className={cls(sparkDelta >= 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300', 'ring-1 ring-current/20')}>
                {sparkDelta >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {Math.abs(sparkDelta).toFixed(1)}% vs prev 28d
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="amt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => inrPaise(v)}
                />
                <Area type="monotone" dataKey="amount" stroke="#f97316" fill="url(#amt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={cls(softCard, 'p-4')}>
            <div className="text-slate-300 text-sm font-medium mb-1">Top refunded SKUs</div>
            <div className="text-xs text-slate-500 mb-3">Product quality signal</div>
            <div className="space-y-2 max-h-[200px] overflow-auto pr-1">
              {topSkus.slice(0, 10).map((s, i) => (
                <div key={s._id || i} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-5">#{i + 1}</span>
                  <span className="text-slate-200 font-mono truncate flex-1" title={s.sku_name}>
                    {s.sku_code || s._id?.slice(0, 8) || '?'}
                  </span>
                  <span className="text-slate-400">{s.count}×</span>
                  <span className="text-amber-300 w-20 text-right">{inr(s.amount)}</span>
                </div>
              ))}
              {topSkus.length === 0 && <div className="text-slate-500 text-xs italic">No data yet</div>}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={cls(softCard, 'p-4')}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <FilterField label="Firm">
              <Select value={firmId} onValueChange={setFirmId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All firms</SelectItem>
                  {firms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Refund type">
              <Select value={refundType} onValueChange={setRefundType}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {REFUND_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Source">
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="From date">
              <Input type="date" className="bg-slate-800 border-slate-700 text-white h-9"
                value={fromDate} onChange={(e) => { setFromDate(e.target.value); setActivePreset(null); }} />
            </FilterField>
            <FilterField label="To date">
              <Input type="date" className="bg-slate-800 border-slate-700 text-white h-9"
                value={toDate} onChange={(e) => { setToDate(e.target.value); setActivePreset(null); }} />
            </FilterField>
            <div className="flex flex-wrap gap-2 items-center">
              <Toggle label="Fake" checked={fakeOnly} onChange={setFakeOnly} />
              <Toggle label="Disputed" checked={disputedOnly} onChange={setDisputedOnly} />
              <Toggle label="Orphans" checked={orphanOnly} onChange={setOrphanOnly} />
            </div>
          </div>

          {/* Date presets */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Quick:</span>
            {DATE_PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => {
                  const r = presetRange(p);
                  setFromDate(r.from); setToDate(r.to); setActivePreset(p.label);
                }}
                className={cls(
                  'px-3 py-1 rounded-full text-xs font-medium transition-all',
                  activePreset === p.label
                    ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                )}
              >{p.label}</button>
            ))}
          </div>

          {/* Active chips */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilterChips.map((c, i) => (
                <button key={i} onClick={c.clear}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-full px-3 py-1 flex items-center gap-1 transition-colors">
                  {c.label} <X className="w-3 h-3" />
                </button>
              ))}
              <button
                onClick={() => { setFirmId('all'); setRefundType('all'); setSource('all'); setFakeOnly(false); setDisputedOnly(false); setOrphanOnly(false); setFromDate(''); setToDate(''); setActivePreset(null); }}
                className="text-xs text-slate-500 hover:text-slate-300 underline">
                Clear all
              </button>
            </div>
          )}

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <Input ref={searchInputRef}
                placeholder="Search by order ID / reason  ( press / )"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white pl-9 h-9" />
            </div>
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-0.5">
              <button onClick={() => setDensity('comfortable')}
                className={cls('px-2 py-1 text-xs rounded transition-colors',
                  density === 'comfortable' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>
                Comfortable
              </button>
              <button onClick={() => setDensity('compact')}
                className={cls('px-2 py-1 text-xs rounded transition-colors',
                  density === 'compact' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300')}>
                Compact
              </button>
            </div>
            <Button onClick={() => { fetchRefunds(); fetchAnalytics(); }} variant="outline"
              className="border-slate-700 text-white hover:bg-slate-800 h-9">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => setManualOpen(true)} variant="outline"
              className="border-slate-700 text-white hover:bg-slate-800 h-9">
              <Plus className="w-4 h-4 mr-1" /> Manual
            </Button>
            <Button onClick={handleSync} disabled={syncing || firmId === 'all'}
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
              {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Sync (S)
            </Button>
            <Button onClick={handleExport} variant="outline"
              className="border-slate-700 text-white hover:bg-slate-800 h-9">
              <Download className="w-4 h-4 mr-1" /> CSV (E)
            </Button>
          </div>

          {/* Bulk-action bar */}
          {selected.size > 0 && (
            <div className="mt-3 flex items-center gap-3 bg-sky-500/10 ring-1 ring-sky-500/30 rounded-lg px-4 py-2">
              <Layers className="w-4 h-4 text-sky-300" />
              <span className="text-sky-100 text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" onClick={() => setBulkEditOpen(true)} className="bg-sky-600 hover:bg-sky-500 text-white">
                Bulk edit
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-300 hover:text-white" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className={cls(softCard, 'p-0 overflow-hidden')}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="text-white font-medium">
              {visible.length} {visible.length === 1 ? 'refund' : 'refunds'}
              {visible.length !== totalCount && <span className="text-slate-500 ml-2 text-sm">of {totalCount} total</span>}
            </div>
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            )}
          </div>
          {loading ? (
            <SkeletonTable rows={8} />
          ) : visible.length === 0 ? (
            <EmptyState onSync={firmId !== 'all' ? handleSync : null}
              onManual={() => setManualOpen(true)} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox checked={allSelectedOnPage} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Order</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide text-right">Amount</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">A-Z</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Reason</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Flags</TableHead>
                    <TableHead className="text-slate-400 text-xs uppercase tracking-wide">Links</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <React.Fragment key={r.id}>
                      <TableRow className={cls('border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors', rowH)}
                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                        </TableCell>
                        <TableCell className="text-white font-mono text-xs">{r.amazon_order_id}</TableCell>
                        <TableCell className="text-slate-300">{r.refund_date}</TableCell>
                        <TableCell>
                          <Badge className={cls(typeBadgeClass(r.refund_type), 'font-medium')}>{r.refund_type}</Badge>
                        </TableCell>
                        <TableCell className="text-white text-right font-medium tabular-nums">{inr(r.refund_amount)}</TableCell>
                        <TableCell>
                          {r.a_to_z_outcome && r.a_to_z_outcome !== 'NA' ? (
                            <Badge className={cls(
                              r.a_to_z_outcome === 'granted' ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30' :
                              r.a_to_z_outcome === 'denied' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' :
                              'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
                              'text-xs')}>
                              {r.a_to_z_outcome}
                            </Badge>
                          ) : <span className="text-slate-600">—</span>}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm max-w-xs truncate" title={r.refund_reason}>
                          {r.refund_reason || <span className="text-slate-600">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {r.is_fake && <Badge className="bg-red-500/15 text-red-300 ring-1 ring-red-500/30 text-xs"><Flag className="w-3 h-3 mr-0.5" />FAKE</Badge>}
                            {r.is_disputed && <Badge className="bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 text-xs"><Shield className="w-3 h-3 mr-0.5" />Disputed</Badge>}
                            {r.product_returned && <Badge className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30 text-xs">↩</Badge>}
                            {r.attachments?.length > 0 && (
                              <Badge className="bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30 text-xs"><Paperclip className="w-3 h-3 mr-0.5" />{r.attachments.length}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 items-center">
                            <a href={`https://sellercentral.amazon.in/orders-v3/order/${r.amazon_order_id}`}
                              target="_blank" rel="noreferrer"
                              className="text-slate-400 hover:text-sky-300 transition-colors" title="Open in Seller Central">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {r.linked_credit_note_id ? (
                              <span className="text-emerald-400" title={`CN ${r.linked_credit_note_id.slice(0, 8)}…`}>
                                <FileText className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="text-slate-700" title="No CN linked">
                                <FileText className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 w-7 p-0"
                            onClick={() => openEdit(r)}>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRow === r.id && (
                        <TableRow className="border-slate-800/60 bg-slate-900/30">
                          <TableCell colSpan={10} className="p-0">
                            <RowExpansion r={r} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <EditDialog
        editing={editing} setEditing={setEditing}
        form={editForm} setForm={setEditForm} onSave={saveEdit} saving={saving}
        onUploadAttachment={uploadAttachment} onRemoveAttachment={removeAttachment}
      />

      {/* Bulk edit dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Bulk edit {selected.size} refunds</DialogTitle>
            <DialogDescription className="text-slate-400">
              Only fields you set here will change. Empty = leave as-is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-slate-300 text-xs">Refund type</Label>
              <Select value={bulkEditForm.refund_type || ''} onValueChange={(v) => setBulkEditForm({ ...bulkEditForm, refund_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="— no change —" /></SelectTrigger>
                <SelectContent>
                  {REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 text-xs">A-Z outcome</Label>
              <Select value={bulkEditForm.a_to_z_outcome || ''} onValueChange={(v) => setBulkEditForm({ ...bulkEditForm, a_to_z_outcome: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="— no change —" /></SelectTrigger>
                <SelectContent>
                  {A_TO_Z_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <Checkbox checked={bulkEditForm.is_fake === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, is_fake: !!v })} />
                Mark FAKE
              </label>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <Checkbox checked={bulkEditForm.is_disputed === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, is_disputed: !!v })} />
                Mark Disputed
              </label>
              <label className="flex items-center gap-2 text-slate-300 text-sm">
                <Checkbox checked={bulkEditForm.product_returned === true} onCheckedChange={(v) => setBulkEditForm({ ...bulkEditForm, product_returned: !!v })} />
                Product returned
              </label>
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Dispute notes</Label>
              <Textarea className="bg-slate-800 border-slate-700 text-white"
                value={bulkEditForm.dispute_notes || ''}
                onChange={(e) => setBulkEditForm({ ...bulkEditForm, dispute_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} className="border-slate-700 text-white">Cancel</Button>
            <Button onClick={applyBulk} className="bg-sky-600 hover:bg-sky-500">Apply to {selected.size}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual entry */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Record a manual refund</DialogTitle>
            <DialogDescription className="text-slate-400">
              For refunds outside Amazon's automatic feed (goodwill gestures, off-platform settlements).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Firm</Label>
                <Select value={manualForm.firm_id} onValueChange={(v) => setManualForm({ ...manualForm, firm_id: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue placeholder="Choose firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Refund type</Label>
                <Select value={manualForm.refund_type} onValueChange={(v) => setManualForm({ ...manualForm, refund_type: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-xs">Amazon order ID</Label>
                <Input className="bg-slate-800 border-slate-700 text-white"
                  value={manualForm.amazon_order_id}
                  onChange={(e) => setManualForm({ ...manualForm, amazon_order_id: e.target.value })} />
              </div>
              <div>
                <Label className="text-slate-300 text-xs">Refund amount ₹</Label>
                <Input type="number" className="bg-slate-800 border-slate-700 text-white"
                  value={manualForm.refund_amount}
                  onChange={(e) => setManualForm({ ...manualForm, refund_amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Refund date</Label>
              <Input type="date" className="bg-slate-800 border-slate-700 text-white"
                value={manualForm.refund_date}
                onChange={(e) => setManualForm({ ...manualForm, refund_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Reason</Label>
              <Textarea className="bg-slate-800 border-slate-700 text-white"
                value={manualForm.refund_reason}
                onChange={(e) => setManualForm({ ...manualForm, refund_reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)} className="border-slate-700 text-white">Cancel</Button>
            <Button onClick={submitManual} className="bg-sky-600 hover:bg-sky-500">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Sub-components ───

function SummaryCard({ label, value, icon: Icon, accent, sparkData, sparkKey, delta, badge }) {
  const accentColors = {
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-300', stroke: '#0ea5e9' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-300', stroke: '#f59e0b' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-300', stroke: '#f43f5e' },
    red: { bg: 'bg-red-500/10', text: 'text-red-300', stroke: '#ef4444' },
  }[accent] || { bg: 'bg-slate-500/10', text: 'text-slate-300', stroke: '#94a3b8' };
  return (
    <div className={cls(softCard, 'p-4 relative overflow-hidden group')}>
      <div className="flex items-start justify-between">
        <div className="z-10">
          <div className="text-slate-400 text-xs uppercase tracking-wide">{label}</div>
          <div className="text-white text-2xl font-semibold mt-1 tabular-nums">{value}</div>
          {badge && <div className="text-emerald-300 text-xs mt-1">{badge}</div>}
          {typeof delta === 'number' && delta !== 0 && (
            <div className={cls('text-xs mt-1 flex items-center gap-0.5',
              delta > 0 ? 'text-rose-300' : 'text-emerald-300')}>
              {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(delta).toFixed(1)}% vs prev period
            </div>
          )}
        </div>
        <div className={cls(accentColors.bg, 'rounded-lg p-2')}>
          <Icon className={cls('w-4 h-4', accentColors.text)} />
        </div>
      </div>
      {sparkData?.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-12 opacity-50 group-hover:opacity-90 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey={sparkKey} stroke={accentColors.stroke} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <div>
      <Label className="text-slate-400 text-xs uppercase tracking-wide mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={cls('px-3 py-1 rounded-full text-xs font-medium transition-all',
        checked
          ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40'
          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200')}>
      {label}
    </button>
  );
}

function SkeletonTable({ rows = 8 }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ onSync, onManual }) {
  return (
    <div className="py-16 text-center">
      <AlertTriangle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
      <h3 className="text-slate-300 font-medium mb-1">No refunds match the filters</h3>
      <p className="text-slate-500 text-sm mb-5">Either nothing happened, or you've filtered too tightly.</p>
      <div className="flex gap-2 justify-center">
        {onSync && (
          <Button onClick={onSync} className="bg-emerald-600 hover:bg-emerald-500">
            <RefreshCw className="w-4 h-4 mr-1" /> Sync from Amazon
          </Button>
        )}
        <Button onClick={onManual} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-1" /> Add manual refund
        </Button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
        className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40">‹</button>
      <span className="text-slate-400 px-2">Page {page} / {totalPages}</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40">›</button>
    </div>
  );
}

function RowExpansion({ r }) {
  return (
    <div className="px-6 py-4 border-t border-slate-800/50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-slate-500 uppercase tracking-wide mb-1">Source & ids</div>
          <div className="space-y-0.5 text-slate-300">
            <div>Source: <span className="font-mono">{r.source || '—'}</span></div>
            <div>Event id: <span className="font-mono break-all">{r.refund_event_id || '—'}</span></div>
            <div>Linked dispatch: <span className="font-mono">{r.linked_dispatch_id?.slice(0, 8) || '—'}</span></div>
            <div>Linked CN: <span className="font-mono">{r.linked_credit_note_id?.slice(0, 8) || '—'}</span></div>
            <div>COGS journal: <span className="font-mono">{r.linked_journal_entry_id?.slice(0, 8) || '—'}</span></div>
          </div>
        </div>
        <div>
          <div className="text-slate-500 uppercase tracking-wide mb-1">Items</div>
          <div className="space-y-1 text-slate-300">
            {(r.items?.length > 0 ? r.items : []).slice(0, 5).map((it, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-500 w-4">{i + 1}.</span>
                <span className="font-mono truncate flex-1">{it.sku_code || it.amazon_sku || '?'}</span>
                <span className="text-slate-500">×{it.quantity || 1}</span>
              </div>
            ))}
            {!r.items?.length && <div className="text-slate-500 italic">No items recorded</div>}
          </div>
        </div>
        <div>
          <div className="text-slate-500 uppercase tracking-wide mb-1">Notes & flags</div>
          <div className="space-y-0.5 text-slate-300">
            <div>Net loss: <span className="text-rose-300 tabular-nums">{inr(r.net_loss)}</span></div>
            <div>Currency: {r.currency || 'INR'}</div>
            <div className="text-slate-400 whitespace-pre-wrap mt-2">
              {r.dispute_notes || <span className="italic text-slate-600">No dispute notes</span>}
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
      <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            <span className="font-mono">{editing.amazon_order_id}</span>
            <a href={`https://sellercentral.amazon.in/orders-v3/order/${editing.amazon_order_id}`}
              target="_blank" rel="noreferrer" className="ml-2 text-sky-400 hover:text-sky-300 inline-block">
              <ExternalLink className="w-4 h-4 inline-block" />
            </a>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {editing.refund_date} · {inrPaise(editing.refund_amount)} · {editing.source}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">Refund type</Label>
              <Select value={form.refund_type} onValueChange={(v) => setForm({ ...form, refund_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{REFUND_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400 text-xs">A-Z outcome</Label>
              <Select value={form.a_to_z_outcome} onValueChange={(v) => setForm({ ...form, a_to_z_outcome: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{A_TO_Z_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 py-2">
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <Checkbox checked={form.is_fake} onCheckedChange={(v) => setForm({ ...form, is_fake: !!v })} />
              <Flag className="w-4 h-4 text-red-400" /> Fake claim
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <Checkbox checked={form.is_disputed} onCheckedChange={(v) => setForm({ ...form, is_disputed: !!v })} />
              <Shield className="w-4 h-4 text-amber-400" /> Disputed
            </label>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <Checkbox checked={form.product_returned} onCheckedChange={(v) => setForm({ ...form, product_returned: !!v })} />
              Product returned
            </label>
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Refund reason</Label>
            <Input className="bg-slate-800 border-slate-700 text-white"
              value={form.refund_reason || ''} onChange={(e) => setForm({ ...form, refund_reason: e.target.value })} />
          </div>
          <div>
            <Label className="text-slate-400 text-xs">Dispute notes</Label>
            <Textarea className="bg-slate-800 border-slate-700 text-white min-h-20"
              value={form.dispute_notes || ''} onChange={(e) => setForm({ ...form, dispute_notes: e.target.value })} />
          </div>

          {/* Attachments */}
          <div className="border-t border-slate-800 pt-3">
            <Label className="text-slate-400 text-xs mb-2 block">Evidence attachments</Label>
            <div className="space-y-2">
              {(editing.attachments || []).map(a => (
                <div key={a.id} className="bg-slate-800/50 rounded px-3 py-2 text-xs flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-200 truncate flex-1">{a.filename}</span>
                  <span className="text-slate-500">{(a.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => onRemoveAttachment(a.id)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <input ref={fileRef} type="file" hidden onChange={(e) => {
                  if (e.target.files?.[0]) { onUploadAttachment(e.target.files[0], note); setNote(''); e.target.value = ''; }
                }} />
                <Input placeholder="Optional note for the file"
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8 flex-1"
                  value={note} onChange={(e) => setNote(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}
                  className="border-slate-700 text-white hover:bg-slate-800 h-8">
                  <Upload className="w-3.5 h-3.5 mr-1" /> Upload
                </Button>
              </div>
              <p className="text-slate-500 text-xs">PNG/JPG/PDF up to 10 MB. POD images, courier proofs, screenshots.</p>
            </div>
          </div>

          {/* Linked records */}
          <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-2 text-xs">
            {editing.linked_credit_note_id && (
              <div className="text-emerald-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> CN: {editing.linked_credit_note_id.slice(0, 8)}…
              </div>
            )}
            {editing.linked_journal_entry_id && (
              <div className="text-sky-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> COGS reversal: {editing.linked_journal_entry_id.slice(0, 8)}…
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)} className="border-slate-700 text-white">Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-sky-600 hover:bg-sky-500">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
