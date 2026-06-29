import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shimmer } from '@/components/ui/motion';
import { Truck, Package, Monitor, Loader2, CheckCircle, Clock, Edit, Upload, RefreshCw, FileText, XCircle, Download, AlertTriangle } from 'lucide-react';

// ─── Shared badge component (Obsidian Elite mono style) ──────────────────────
const SOFT_BADGE_TONES = {
  emerald: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  indigo:  'bg-primary/15 text-primary ring-primary/25',
  amber:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  violet:  'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  rose:    'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  sky:     'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  orange:  'bg-orange-400/15 text-orange-400 ring-orange-400/25',
  blue:    'bg-primary/15 text-primary ring-primary/25',
  slate:   'bg-muted text-muted-foreground ring-border',
};

const SoftBadge = ({ tone = 'slate', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap ${SOFT_BADGE_TONES[tone] || SOFT_BADGE_TONES.slate}`}>
    {children}
  </span>
);

export default function DispatcherDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [stuck, setStuck] = useState({ count: 0, stale_count: 0, shipments: [] });
  const [bigship, setBigship] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [updateCourierOpen, setUpdateCourierOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [collectedOpen, setCollectedOpen] = useState(false);
  const [collectedReceiver, setCollectedReceiver] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [courierForm, setCourierForm] = useState({
    courier: '',
    tracking_id: '',
    label_file: null,
    reason: ''
  });
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [queueRes, recentRes, stuckRes, bigshipRes] = await Promise.all([
        axios.get(`${API}/dispatcher/queue`, { headers }),
        axios.get(`${API}/dispatcher/recent`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/dispatcher/stuck-shipments`, { headers }).catch(() => ({ data: { count: 0, stale_count: 0, shipments: [] } })),
        axios.get(`${API}/courier/shipments?page_size=40`, { headers }).catch(() => ({ data: { shipments: [] } }))
      ]);
      setQueue(queueRes.data);
      setRecentDispatches(recentRes.data || []);
      setStuck(stuckRes.data || { count: 0, stale_count: 0, shipments: [] });
      setBigship(bigshipRes.data?.shipments || []);

      // Compute stats locally
      const readyToDispatch = queueRes.data.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch').length;
      const dispatchedCount = recentRes.data?.length || 0;

      setStats({
        ready_to_dispatch: readyToDispatch,
        dispatched_today: dispatchedCount
      });
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Bigship pickup status (mirrors the Courier Shipping board).
  const isNotPicked = (s) => (s || '').toUpperCase() === 'NOT PICKED';
  const isPickedUp = (s) => {
    const u = (s || '').toUpperCase();
    if (!u || u === 'NOT PICKED' || u.includes('PICKUP SCHEDULED') || u === 'MANIFESTED' || u.includes('CANCEL') || u.includes('RTO')) return false;
    return u.includes('TRANSIT') || u.includes('OUT FOR DELIVERY') || u.includes('DELIVERED');
  };

  const openConfirmDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setConfirmOpen(true);
  };

  const openUpdateCourierDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setCourierForm({
      courier: dispatch.courier || '',
      tracking_id: dispatch.tracking_id || '',
      label_file: null,
      reason: ''
    });
    setUpdateCourierOpen(true);
  };

  const handleUpdateCourier = async (e) => {
    e.preventDefault();
    if (!courierForm.courier || !courierForm.tracking_id) {
      toast.error('Please fill courier and tracking ID');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('courier', courierForm.courier);
      formData.append('tracking_id', courierForm.tracking_id);
      if (courierForm.label_file) {
        formData.append('label_file', courierForm.label_file);
      }
      if (courierForm.reason) {
        formData.append('reason', courierForm.reason);
      }

      await axios.patch(`${API}/dispatcher/dispatches/${selectedItem.id}/update-courier`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Courier details updated successfully');
      setUpdateCourierOpen(false);
      setCourierForm({ courier: '', tracking_id: '', label_file: null, reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update courier details');
    } finally {
      setActionLoading(false);
    }
  };

  const openCancelDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setCancelReason('');
    setCancelOpen(true);
  };

  const handleCancelDispatch = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('reason', cancelReason);

      await axios.put(`${API}/dispatcher/dispatches/${selectedItem.id}/cancel`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Dispatch cancelled and inventory returned to stock');
      setCancelOpen(false);
      setCancelReason('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadAllDocuments = async (dispatch) => {
    const baseUrl = API.replace('/api', '');
    const docs = [];

    // Check for shipping label
    if (dispatch.label_file) {
      docs.push({ name: 'Shipping Label', url: `${baseUrl}${dispatch.label_file}` });
    }

    // Check for invoice
    if (dispatch.invoice_url) {
      docs.push({ name: 'Invoice', url: `${baseUrl}${dispatch.invoice_url}` });
    } else if (dispatch.original_ticket_info?.invoice_file) {
      docs.push({ name: 'Invoice', url: `${baseUrl}${dispatch.original_ticket_info.invoice_file}` });
    }

    // Check for e-way bill (for orders > 50K)
    if (dispatch.eway_bill_url) {
      docs.push({ name: 'E-Way Bill', url: `${baseUrl}${dispatch.eway_bill_url}` });
    }

    if (docs.length === 0) {
      toast.info('No documents available for download');
      return;
    }

    // Open all documents in new tabs
    docs.forEach(doc => {
      window.open(doc.url, '_blank');
    });

    toast.success(`Opened ${docs.length} document(s)`);
  };


  const handleMarkDispatched = async () => {
    setActionLoading(true);
    try {
      // Call the finalize endpoint - this deducts stock and creates sales records
      await axios.post(`${API}/dispatcher/dispatches/${selectedItem.id}/finalize`,
        new URLSearchParams({ notes: 'Dispatcher approved dispatch' }),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Dispatch finalized - stock deducted and sales records created');
      setConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to finalize dispatch');
    } finally {
      setActionLoading(false);
    }
  };

  const openCollectedDialog = (dispatch) => {
    setSelectedItem(dispatch);
    setCollectedReceiver('');
    setCollectedOpen(true);
  };

  const handleMarkCollected = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const ticketId = selectedItem.ticket_id || selectedItem.id;
      const res = await axios.post(
        `${API}/tickets/${ticketId}/mark-collected`,
        new URLSearchParams({ collected_by_name: collectedReceiver.trim() }),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Marked collected — removed from dispatch queue');
      if (res.data?.missing_service_invoice) {
        toast.warning('No service invoice on this walk-in repair — raise one if charges are due.');
      }
      setCollectedOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark collected');
    } finally {
      setActionLoading(false);
    }
  };

  const isWalkin = (d) =>
    d?.is_walkin || d?.dispatch_type === 'walkin_return' || d?.original_ticket_info?.is_walkin;

  const readyToDispatch = queue.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch');
  const dispatched = queue.filter(d => d.status === 'dispatched');
  // Items that have a tracking ID but no outward gate scan — they can't be finalised
  // and otherwise pile up silently. staleScan = lingering 3+ days.
  const needsScan = queue.filter(d => d.needs_gate_scan);
  const staleScan = needsScan.filter(d => (d.queue_age_days ?? 0) >= 3);

  if (loading) {
    return (
      <DashboardLayout title="Dispatcher Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-24" />)}
          </div>
          {Array.from({ length: 8 }).map((_, i) => <Shimmer key={i} className="h-12" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dispatcher Dashboard">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Live · auto-refresh 30 s
            </span>
          </div>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
            Dispatcher Console
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Outbound queue · courier management · dispatch confirmation
          </p>
        </div>
        <Link to="/dispatcher/tv">
          <Button
            variant="outline"
            className="border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent"
            data-testid="tv-mode-btn"
          >
            <Monitor className="w-4 h-4 mr-2" />
            TV Mode
          </Button>
        </Link>
      </div>

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="dispatcher-stats">
        <StatCard title="Ready to Dispatch" value={stats?.ready_to_dispatch || 0} icon={Package} tone="amber" />
        <StatCard title="Dispatched Today"  value={stats?.dispatched_today  || 0} icon={Truck}   tone="emerald" />
        <StatCard title="Total in Queue"    value={queue.length}                  icon={Clock}   tone="indigo" />
      </div>

      {/* ── Stuck at Pickup (Bigship NOT PICKED / PICKUP SCHEDULED) ───────── */}
      {stuck.count > 0 && (
        <div className="mg-card mb-6 rounded-lg border border-amber-500/30 bg-card" data-testid="dispatcher-stuck">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/15">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </span>
                Stuck at Pickup
              </h3>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {stuck.count} label{stuck.count !== 1 ? 's' : ''} created but not picked up · {stuck.stale_count} over 24h
              </p>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {stuck.shipments.map((s, idx) => (
              <div key={s.awb || idx} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {s.customer || '—'} <span className="text-muted-foreground">· {s.courier || 'courier ?'}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">
                    AWB {s.awb || '—'}{s.order_id ? ` · ${s.order_id}` : ''}{s.city ? ` · ${s.city}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${s.status === 'NOT PICKED' ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-500'}`}>
                    {s.status}
                  </span>
                  <span className={`font-mono text-xs ${s.stale ? 'text-rose-400 font-semibold' : 'text-muted-foreground'}`}>
                    {s.age_hours != null ? (s.age_hours < 48 ? `${s.age_hours}h` : `${Math.round(s.age_hours / 24)}d`) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bigship Live Board (latest bookings; green once picked up) ─────── */}
      <div className="mg-card mb-6 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <Truck className="w-4 h-4 text-primary" />
              </span>
              Bigship Shipments — Live
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
              latest bookings · auto-refresh 30s · 🟢 picked up · 🔴 not picked
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {bigship.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No recent Bigship bookings.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Order</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">AWB</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Courier</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bigship.map((s) => {
                  const np = isNotPicked(s.status);
                  const picked = isPickedUp(s.status);
                  return (
                    <TableRow key={s.id}
                      className={np ? 'bg-red-50 dark:bg-red-950/20 border-l-2 border-l-red-500'
                        : (picked ? 'bg-green-50 dark:bg-green-950/20 border-l-2 border-l-green-500' : '')}>
                      <TableCell className="font-mono text-xs">{s.bigship_order_id || s.order_id || '-'}</TableCell>
                      <TableCell className="text-sm">{s.customer_name || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{s.awb_number || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.courier_name || '-'}</TableCell>
                      <TableCell className="text-sm">
                        <span className={np ? 'text-red-600 font-medium' : (picked ? 'text-green-600 font-medium' : 'text-muted-foreground')}>
                          {(s.status || 'unknown').toUpperCase()}{picked ? ' ✓' : ''}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Dispatch Queue ───────────────────────────────────────────────── */}
      <div className="mg-card mb-6 rounded-lg border border-border bg-card">
        {/* panel header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <Package className="w-4 h-4 text-primary" />
              </span>
              Ready to Dispatch
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
              {readyToDispatch.length} item{readyToDispatch.length !== 1 ? 's' : ''} awaiting finalisation
            </p>
          </div>
        </div>

        {needsScan.length > 0 && (
          <div className={`flex items-start gap-3 border-b px-6 py-3 ${staleScan.length > 0 ? 'border-rose-500/25 bg-rose-500/5' : 'border-amber-400/25 bg-amber-400/5'}`} data-testid="needs-gate-scan-alert">
            <Package className={`mt-0.5 h-4 w-4 flex-shrink-0 ${staleScan.length > 0 ? 'text-rose-400' : 'text-amber-400'}`} />
            <div className="text-[12px] leading-relaxed">
              <span className="font-semibold text-foreground">
                {needsScan.length} dispatch{needsScan.length !== 1 ? 'es' : ''} need a gate scan
              </span>
              {staleScan.length > 0 && (
                <span className="text-rose-400 font-semibold"> · {staleScan.length} stale (3+ days)</span>
              )}
              <span className="text-muted-foreground"> — these have a tracking ID but no outward gate scan, so they can't be finalised and won't auto-clear. Scan the package out at the gate, then finalise.</span>
            </div>
          </div>
        )}

        <div className="p-0">
          {readyToDispatch.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="mt-1 text-[12px] text-muted-foreground">All items have been dispatched.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Dispatch #</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Phone</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">SKU</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Serial #</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Docs</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Courier</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Tracking</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readyToDispatch.map((dispatch, idx) => (
                    <motion.tr
                      key={dispatch.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(idx, 15) * 0.02 }}
                      className="data-row border-b border-border/60 transition-colors hover:bg-accent/60"
                    >
                      <TableCell className="font-mono text-sm font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {dispatch.dispatch_number}
                          {dispatch.original_ticket_info?.is_walkin ? (
                            <SoftBadge tone="violet">Walk-in</SoftBadge>
                          ) : dispatch.original_ticket_info ? (
                            <SoftBadge tone="indigo">CRM</SoftBadge>
                          ) : null}
                          {dispatch.needs_gate_scan && (
                            <SoftBadge tone={dispatch.queue_age_days >= 3 ? 'rose' : 'amber'}>
                              Needs Gate Scan{dispatch.queue_age_days != null ? ` · ${dispatch.queue_age_days}d` : ''}
                            </SoftBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground capitalize text-sm">
                        {dispatch.dispatch_type?.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-foreground text-sm">{dispatch.customer_name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{dispatch.phone}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{dispatch.sku || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {dispatch.serial_number ? (
                          <SoftBadge tone="violet">{dispatch.serial_number}</SoftBadge>
                        ) : dispatch.item_serials && dispatch.item_serials.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {dispatch.item_serials.map((s, i) => (
                              <SoftBadge key={i} tone="violet">{s.serial_number}</SoftBadge>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Invoice */}
                          {(dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file) ? (
                            <a
                              href={`${API.replace('/api', '')}${dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-[10px] font-mono font-semibold bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                              title="Invoice"
                              data-testid={`view-invoice-${dispatch.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              Inv
                            </a>
                          ) : (
                            <span className="text-rose-400 text-[10px] font-mono font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded">No Inv</span>
                          )}
                          {/* Label */}
                          {(dispatch.label_file || dispatch.label_url) ? (
                            <a
                              href={`${API.replace('/api', '')}${dispatch.label_file || dispatch.label_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-mono font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded transition-colors"
                              title="Shipping Label"
                              data-testid={`view-label-${dispatch.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              Lbl
                            </a>
                          ) : (
                            <span className="text-rose-400 text-[10px] font-mono font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded">No Lbl</span>
                          )}
                          {/* E-Way Bill (only show if exists) */}
                          {dispatch.eway_bill_url && (
                            <a
                              href={`${API.replace('/api', '')}${dispatch.eway_bill_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 text-[10px] font-mono font-semibold bg-violet-500/10 px-1.5 py-0.5 rounded transition-colors"
                              title="E-Way Bill"
                              data-testid={`view-eway-${dispatch.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              EWB
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        <div className="flex items-center gap-1">
                          {dispatch.courier}
                          {dispatch.courier_update_count > 0 && (
                            <span className="font-mono text-[10px] text-amber-400">(#{dispatch.courier_update_count + 1})</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{dispatch.tracking_id}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-primary hover:border-primary/50 hover:bg-primary/10"
                            onClick={() => downloadAllDocuments(dispatch)}
                            title="Download all documents"
                            data-testid={`download-docs-${dispatch.id}`}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-amber-400 hover:border-amber-400/40 hover:bg-amber-400/10"
                            onClick={() => openUpdateCourierDialog(dispatch)}
                            data-testid={`update-courier-${dispatch.id}`}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Update
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border text-rose-400 hover:border-rose-400/40 hover:bg-rose-400/10"
                            onClick={() => openCancelDialog(dispatch)}
                            title="Cancel and return to stock"
                            data-testid={`cancel-${dispatch.id}`}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                          {isWalkin(dispatch) && (
                            <Button
                              size="sm"
                              className="bg-violet-600 hover:bg-violet-500 text-white"
                              onClick={() => openCollectedDialog(dispatch)}
                              title="Customer collected the repaired unit in person"
                              data-testid={`collected-${dispatch.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Collected
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={() => openConfirmDialog(dispatch)}
                            data-testid={`dispatch-${dispatch.id}`}
                          >
                            <Truck className="w-4 h-4 mr-1" />
                            Dispatch
                          </Button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── In-queue dispatched ──────────────────────────────────────────── */}
      <div className="mg-card mb-6 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/15">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </span>
              Recently Dispatched
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
              {dispatched.length} item{dispatched.length !== 1 ? 's' : ''} · current queue
            </p>
          </div>
        </div>
        <div className="p-0">
          {dispatched.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No dispatched items yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Dispatch #</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Serial #</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Courier</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Tracking</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatched.slice(0, 10).map((dispatch, idx) => (
                    <motion.tr
                      key={dispatch.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(idx, 12) * 0.02 }}
                      className="data-row border-b border-border/60 transition-colors hover:bg-accent/60"
                    >
                      <TableCell className="font-mono text-sm text-foreground">{dispatch.dispatch_number}</TableCell>
                      <TableCell className="text-sm text-foreground">{dispatch.customer_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {dispatch.serial_number ? (
                          <SoftBadge tone="violet">{dispatch.serial_number}</SoftBadge>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dispatch.courier}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{dispatch.tracking_id}</TableCell>
                      <TableCell><StatusBadge status={dispatch.status} /></TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Dispatches (from /dispatcher/recent) ─────────────────── */}
      {recentDispatches.length > 0 && (
        <div className="mg-card mt-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-sky-400/15">
                  <Truck className="w-4 h-4 text-sky-400" />
                </span>
                Recent Dispatches
              </h3>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                {recentDispatches.length} completed · last activity
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Dispatch #</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Serial #</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Courier</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Tracking</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Dispatched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDispatches.slice(0, 10).map((dispatch, idx) => (
                  <motion.tr
                    key={dispatch.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(idx, 12) * 0.02 }}
                    className="data-row border-b border-border/60 transition-colors hover:bg-accent/60"
                  >
                    <TableCell className="font-mono text-sm text-primary">
                      {dispatch.dispatch_number}
                    </TableCell>
                    <TableCell>
                      <SoftBadge tone={
                        dispatch.dispatch_type === 'walkin_return' ? 'violet' :
                        dispatch.dispatch_type === 'return_dispatch' ? 'orange' :
                        'indigo'
                      }>
                        {dispatch.dispatch_type === 'walkin_return' ? 'Walk-in' :
                         dispatch.dispatch_type === 'return_dispatch' ? 'Repair' :
                         dispatch.dispatch_type?.replace(/_/g, ' ')}
                      </SoftBadge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{dispatch.customer_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {dispatch.serial_number ? (
                        <SoftBadge tone="violet">{dispatch.serial_number}</SoftBadge>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{dispatch.courier || '-'}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {dispatch.tracking_id || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {dispatch.scanned_out_at ? new Date(dispatch.scanned_out_at).toLocaleString('en-IN') :
                       dispatch.dispatched_at ? new Date(dispatch.dispatched_at).toLocaleString('en-IN') : '-'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Confirm / Finalize Dialog ────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/15">
                <Truck className="w-4 h-4 text-emerald-400" />
              </span>
              Finalize Dispatch
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4 text-sm text-muted-foreground">Finalize this dispatch? This will:</p>
            <ul className="list-disc pl-5 mb-4 text-sm text-muted-foreground space-y-1">
              <li>Deduct stock from inventory</li>
              <li>Create sales order and invoice records</li>
              <li>Mark the order as shipped</li>
            </ul>
            <div className="bg-secondary/50 border border-border p-4 rounded-lg space-y-1.5 text-sm">
              <p className="text-muted-foreground">
                Dispatch #: <span className="font-mono font-semibold text-foreground">{selectedItem?.dispatch_number}</span>
              </p>
              <p className="text-muted-foreground">
                Customer: <span className="text-foreground">{selectedItem?.customer_name}</span>
              </p>
              <p className="text-muted-foreground">
                Courier: <span className="text-foreground">{selectedItem?.courier}</span>
              </p>
              <p className="text-muted-foreground">
                Tracking: <span className="font-mono text-foreground">{selectedItem?.tracking_id}</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleMarkDispatched}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Finalize & Ship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Update Courier Dialog ────────────────────────────────────────── */}
      <Dialog open={updateCourierOpen} onOpenChange={setUpdateCourierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-400/15">
                <RefreshCw className="w-4 h-4 text-amber-400" />
              </span>
              Update Courier Details
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCourier} className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Dispatch #: </span>
                <span className="font-mono font-semibold">{selectedItem?.dispatch_number}</span>
              </p>
              <p className="text-sm text-foreground mt-0.5">
                <span className="text-muted-foreground">Customer: </span>
                {selectedItem?.customer_name}
              </p>
              {selectedItem?.courier && (
                <div className="mt-2 p-2 bg-amber-400/10 border border-amber-400/25 rounded">
                  <p className="text-sm text-amber-400 font-mono font-medium">
                    Current: {selectedItem?.courier} — {selectedItem?.tracking_id}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reason for Update</Label>
              <Input
                placeholder="e.g., Courier didn't arrive, wrong tracking ID..."
                value={courierForm.reason}
                onChange={(e) => setCourierForm({...courierForm, reason: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Courier *</Label>
                <Input
                  placeholder="e.g., Delhivery, BlueDart"
                  value={courierForm.courier}
                  onChange={(e) => setCourierForm({...courierForm, courier: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>New Tracking ID *</Label>
                <Input
                  placeholder="e.g., DEL123456"
                  value={courierForm.tracking_id}
                  onChange={(e) => setCourierForm({...courierForm, tracking_id: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Shipping Label (Optional)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setCourierForm({...courierForm, label_file: e.target.files?.[0] || null})}
              />
              <p className="text-xs text-muted-foreground">Upload new label if available</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUpdateCourierOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Update Courier
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dispatch Dialog ───────────────────────────────────────── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-rose-500/15">
                <XCircle className="w-4 h-4 text-rose-400" />
              </span>
              Cancel Dispatch
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-lg">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Dispatch #: </span>
                <span className="font-mono font-semibold">{selectedItem?.dispatch_number}</span>
              </p>
              <p className="text-sm text-foreground mt-0.5">
                <span className="text-muted-foreground">Customer: </span>
                {selectedItem?.customer_name}
              </p>
              {selectedItem?.serial_number && (
                <p className="text-sm text-foreground mt-0.5">
                  <span className="text-muted-foreground">Serial #: </span>
                  <span className="font-mono">{selectedItem?.serial_number}</span>
                </p>
              )}
              <p className="font-mono text-[11px] text-rose-400 mt-2 uppercase tracking-wide">
                This will cancel the dispatch and return inventory to stock.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reason for Cancellation *</Label>
              <Input
                placeholder="e.g., Customer cancelled order, wrong address, duplicate order..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>Close</Button>
            <Button
              onClick={handleCancelDispatch}
              className="bg-rose-600 hover:bg-rose-500 text-white"
              disabled={actionLoading || !cancelReason.trim()}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Cancel Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Collected (in-person handover) Dialog ────────────────────────── */}
      <Dialog open={collectedOpen} onOpenChange={setCollectedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-violet-500/15">
                <CheckCircle className="w-4 h-4 text-violet-400" />
              </span>
              Mark Collected (in person)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-violet-500/5 border border-violet-500/20 p-3 rounded-lg">
              <p className="text-sm text-foreground">
                <span className="text-muted-foreground">Ticket #: </span>
                <span className="font-mono font-semibold">{selectedItem?.dispatch_number}</span>
              </p>
              <p className="text-sm text-foreground mt-0.5">
                <span className="text-muted-foreground">Customer: </span>
                {selectedItem?.customer_name}
              </p>
              <p className="font-mono text-[11px] text-violet-400 mt-2 uppercase tracking-wide">
                Confirms the customer collected the repaired unit over the counter.
                Closes the ticket and removes it from the dispatch queue — no courier needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Received by (optional)</Label>
              <Input
                placeholder="Name of the person who collected it, if not the customer"
                value={collectedReceiver}
                onChange={(e) => setCollectedReceiver(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCollectedOpen(false)}>Close</Button>
            <Button
              onClick={handleMarkCollected}
              className="bg-violet-600 hover:bg-violet-500 text-white"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirm Collected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
