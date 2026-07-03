import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Truck, Package, Monitor, Loader2, CheckCircle, Clock, RefreshCw,
  FileText, XCircle, Download, AlertTriangle
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

/* Dispatcher Console — Iron Console redesign. Drop-in replacement for the legacy
   DispatcherDashboard: every axios endpoint, action, modal, filter and export preserved. */

// Iron button styles ────────────────────────────────────────────────────────
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnIcon = { border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 30, minWidth: 30, padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11, color: T.iron700 };

// Map legacy SoftBadge tones -> Iron badgeStyle tones.
const TONE_MAP = {
  emerald: 'ok', indigo: 'info', amber: 'warn', violet: 'violet',
  rose: 'bad', sky: 'info', orange: 'bad', blue: 'info', slate: 'slate',
};
const IronBadge = ({ tone = 'slate', children }) => (
  <span style={{ ...badgeStyle(TONE_MAP[tone] || 'slate'), fontFamily: T.mono, fontSize: 9.5 }}>{children}</span>
);

// Panel header shared across the console sections.
const PanelHeader = ({ icon: Icon, iconTone, title, sub }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {Icon && (
        <span style={{ width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center', background: (iconTone || T.orange) + '22' }}>
          <Icon size={15} color={iconTone || T.orange} />
        </span>
      )}
      <div>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{title}</div>
        {sub && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 1, textTransform: 'uppercase', letterSpacing: '.04em' }}>{sub}</div>}
      </div>
    </div>
  </div>
);

const statusPill = (status) => {
  const map = { dispatched: 'ok', ready_for_dispatch: 'info', ready_to_dispatch: 'info', cancelled: 'bad' };
  return { label: (status || '-').replace(/_/g, ' '), tone: map[status] || 'slate' };
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const baseUrl = API.replace('/api', '');

  // Header actions (TV mode) + live subtitle.
  const headerRight = (
    <Link to="/dispatcher/tv" style={{ textDecoration: 'none' }}>
      <button style={btnOutline} data-testid="tv-mode-btn">
        <Monitor size={14} />
        TV Mode
      </button>
    </Link>
  );

  if (loading) {
    return (
      <IronShell title="Dispatcher" subtitle="LIVE · AUTO-REFRESH 30S" onRefresh={fetchData} headerRight={headerRight}>
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Dispatcher" subtitle="LIVE · AUTO-REFRESH 30S" onRefresh={fetchData} headerRight={headerRight}>

      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: T.green, opacity: 0.5 }} className="animate-ping" />
          <span style={{ position: 'relative', width: 8, height: 8, borderRadius: 999, background: T.green }} />
        </span>
        <Caps size={9} color={T.iron400}>Outbound queue · courier management · dispatch confirmation</Caps>
      </div>

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }} data-testid="dispatcher-stats">
        {[
          { label: 'Ready to Dispatch', value: stats?.ready_to_dispatch || 0, icon: Package, accent: T.voltageText },
          { label: 'Dispatched Today', value: stats?.dispatched_today || 0, icon: Truck, accent: T.green },
          { label: 'Total in Queue', value: queue.length, icon: Clock, accent: T.blue },
        ].map((s, i) => (
          <IronCard key={i} pad="13px 14px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <s.icon size={18} color={s.accent} />
              </div>
              <div>
                <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: s.accent, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
              </div>
            </div>
          </IronCard>
        ))}
      </div>

      {/* ── Stuck at Pickup (Bigship NOT PICKED / PICKUP SCHEDULED) ───────── */}
      {stuck.count > 0 && (
        <IronCard pad={0} style={{ marginBottom: 16, borderColor: T.voltage, overflow: 'hidden' }} data-testid="dispatcher-stuck">
          <PanelHeader
            icon={AlertTriangle}
            iconTone={T.voltageText}
            title="Stuck at Pickup"
            sub={`${stuck.count} label${stuck.count !== 1 ? 's' : ''} created but not picked up · ${stuck.stale_count} over 24h`}
          />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {stuck.shipments.map((s, idx) => (
              <div key={s.awb || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.iron200}`, fontSize: 13 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 600, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.customer || '—'} <span style={{ color: T.iron400 }}>· {s.courier || 'courier ?'}</span>
                  </div>
                  <div style={{ ...mono, fontSize: 10.5, color: T.iron400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    AWB {s.awb || '—'}{s.order_id ? ` · ${s.order_id}` : ''}{s.city ? ` · ${s.city}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={badgeStyle(s.status === 'NOT PICKED' ? 'bad' : 'warn')}>{s.status}</span>
                  <span style={{ ...mono, fontSize: 12, color: s.stale ? T.orangeDeep : T.iron400, fontWeight: s.stale ? 700 : 400 }}>
                    {s.age_hours != null ? (s.age_hours < 48 ? `${s.age_hours}h` : `${Math.round(s.age_hours / 24)}d`) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </IronCard>
      )}

      {/* ── Bigship Live Board (latest bookings; green once picked up) ─────── */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <PanelHeader
          icon={Truck}
          iconTone={T.orange}
          title="Bigship Shipments — Live"
          sub="latest bookings · auto-refresh 30s · 🟢 picked up · 🔴 not picked"
        />
        <div style={{ overflowX: 'auto' }}>
          {bigship.length === 0 ? (
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: T.iron400 }}>No recent Bigship bookings.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Order', 'Customer', 'AWB', 'Courier', 'Status'].map((h) => (
                    <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bigship.map((s) => {
                  const np = isNotPicked(s.status);
                  const picked = isPickedUp(s.status);
                  const rowBg = np ? '#FDEEE6' : (picked ? T.greenTint : 'transparent');
                  const rowBorder = np ? T.orangeDeep : (picked ? T.green : 'transparent');
                  return (
                    <tr key={s.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: rowBg, boxShadow: `inset 2px 0 0 ${rowBorder}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 11 }}>{s.bigship_order_id || s.order_id || '-'}</td>
                      <td style={{ ...tdCell, fontSize: 12.5 }}>{s.customer_name || '-'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11 }}>{s.awb_number || '-'}</td>
                      <td style={{ ...tdCell, color: T.iron500 }}>{s.courier_name || '-'}</td>
                      <td style={tdCell}>
                        <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: np ? T.orangeDeep : (picked ? T.green : T.iron500) }}>
                          {(s.status || 'unknown').toUpperCase()}{picked ? ' ✓' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </IronCard>

      {/* ── Dispatch Queue (Ready to Dispatch) ───────────────────────────── */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <PanelHeader
          icon={Package}
          iconTone={T.orange}
          title="Ready to Dispatch"
          sub={`${readyToDispatch.length} item${readyToDispatch.length !== 1 ? 's' : ''} awaiting finalisation`}
        />

        {needsScan.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.iron200}`, background: staleScan.length > 0 ? '#FDEEE6' : T.voltageTint }} data-testid="needs-gate-scan-alert">
            <Package size={15} style={{ marginTop: 2, flexShrink: 0, color: staleScan.length > 0 ? T.orangeDeep : T.voltageText }} />
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: T.iron900 }}>
                {needsScan.length} dispatch{needsScan.length !== 1 ? 'es' : ''} need a gate scan
              </span>
              {staleScan.length > 0 && (
                <span style={{ color: T.orangeDeep, fontWeight: 700 }}> · {staleScan.length} stale (3+ days)</span>
              )}
              <span style={{ color: T.iron500 }}> — these have a tracking ID but no outward gate scan, so they can't be finalised and won't auto-clear. Scan the package out at the gate, then finalise.</span>
            </div>
          </div>
        )}

        {readyToDispatch.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 0', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 999, display: 'grid', placeItems: 'center', background: T.greenTint, marginBottom: 12 }}>
              <CheckCircle size={24} color={T.green} />
            </div>
            <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>All clear</p>
            <p style={{ marginTop: 4, fontSize: 12, color: T.iron400 }}>All items have been dispatched.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Dispatch #', 'Type', 'Customer', 'Phone', 'SKU', 'Serial #', 'Docs', 'Courier', 'Tracking', 'Actions'].map((h, i, arr) => (
                    <th key={h} style={{ ...thCell, textAlign: i === arr.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readyToDispatch.map((dispatch) => (
                  <tr key={dispatch.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>{dispatch.dispatch_number}</span>
                        {dispatch.original_ticket_info?.is_walkin ? (
                          <IronBadge tone="violet">Walk-in</IronBadge>
                        ) : dispatch.original_ticket_info ? (
                          <IronBadge tone="indigo">CRM</IronBadge>
                        ) : null}
                        {dispatch.needs_gate_scan && (
                          <IronBadge tone={dispatch.queue_age_days >= 3 ? 'rose' : 'amber'}>
                            Needs Gate Scan{dispatch.queue_age_days != null ? ` · ${dispatch.queue_age_days}d` : ''}
                          </IronBadge>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdCell, color: T.iron500, textTransform: 'capitalize' }}>
                      {dispatch.dispatch_type?.replace('_', ' ')}
                    </td>
                    <td style={{ ...tdCell, color: T.iron900, fontSize: 12.5 }}>{dispatch.customer_name}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{dispatch.phone}</td>
                    <td style={{ ...tdCell, color: T.iron500 }}>{dispatch.sku || '-'}</td>
                    <td style={tdCell}>
                      {dispatch.serial_number ? (
                        <IronBadge tone="violet">{dispatch.serial_number}</IronBadge>
                      ) : dispatch.item_serials && dispatch.item_serials.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {dispatch.item_serials.map((s, i) => (
                            <IronBadge key={i} tone="violet">{s.serial_number}</IronBadge>
                          ))}
                        </div>
                      ) : <span style={{ color: T.iron400 }}>—</span>}
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Invoice */}
                        {(dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file) ? (
                          <a
                            href={`${baseUrl}${dispatch.invoice_url || dispatch.original_ticket_info?.invoice_file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none', ...badgeStyle('info'), fontFamily: T.mono, fontSize: 10 }}
                            title="Invoice"
                            data-testid={`view-invoice-${dispatch.id}`}
                          >
                            <FileText size={11} /> Inv
                          </a>
                        ) : (
                          <span style={{ ...badgeStyle('bad'), fontFamily: T.mono, fontSize: 10 }}>No Inv</span>
                        )}
                        {/* Label */}
                        {(dispatch.label_file || dispatch.label_url) ? (
                          <a
                            href={`${baseUrl}${dispatch.label_file || dispatch.label_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none', ...badgeStyle('ok'), fontFamily: T.mono, fontSize: 10 }}
                            title="Shipping Label"
                            data-testid={`view-label-${dispatch.id}`}
                          >
                            <FileText size={11} /> Lbl
                          </a>
                        ) : (
                          <span style={{ ...badgeStyle('bad'), fontFamily: T.mono, fontSize: 10 }}>No Lbl</span>
                        )}
                        {/* E-Way Bill (only show if exists) */}
                        {dispatch.eway_bill_url && (
                          <a
                            href={`${baseUrl}${dispatch.eway_bill_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none', ...badgeStyle('violet'), fontFamily: T.mono, fontSize: 10 }}
                            title="E-Way Bill"
                            data-testid={`view-eway-${dispatch.id}`}
                          >
                            <FileText size={11} /> EWB
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdCell, color: T.iron900 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {dispatch.courier}
                        {dispatch.courier_update_count > 0 && (
                          <span style={{ ...mono, fontSize: 10, color: T.voltageText }}>(#{dispatch.courier_update_count + 1})</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{dispatch.tracking_id}</td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          style={{ ...btnIcon, color: T.blue }}
                          onClick={() => downloadAllDocuments(dispatch)}
                          title="Download all documents"
                          data-testid={`download-docs-${dispatch.id}`}
                        >
                          <Download size={13} />
                        </button>
                        <button
                          style={{ ...btnIcon, color: T.voltageText }}
                          onClick={() => openUpdateCourierDialog(dispatch)}
                          data-testid={`update-courier-${dispatch.id}`}
                        >
                          <RefreshCw size={13} /> Update
                        </button>
                        <button
                          style={{ ...btnIcon, color: T.orangeDeep }}
                          onClick={() => openCancelDialog(dispatch)}
                          title="Cancel and return to stock"
                          data-testid={`cancel-${dispatch.id}`}
                        >
                          <XCircle size={13} />
                        </button>
                        {isWalkin(dispatch) && (
                          <button
                            style={{ ...btnPrimary, background: '#6D4AB0', padding: '6px 12px', fontSize: 11 }}
                            onClick={() => openCollectedDialog(dispatch)}
                            title="Customer collected the repaired unit in person"
                            data-testid={`collected-${dispatch.id}`}
                          >
                            <CheckCircle size={14} /> Collected
                          </button>
                        )}
                        <button
                          style={{ ...btnPrimary, background: T.green, padding: '6px 12px', fontSize: 11 }}
                          onClick={() => openConfirmDialog(dispatch)}
                          data-testid={`dispatch-${dispatch.id}`}
                        >
                          <Truck size={14} /> Dispatch
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* ── In-queue dispatched ──────────────────────────────────────────── */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <PanelHeader
          icon={CheckCircle}
          iconTone={T.green}
          title="Recently Dispatched"
          sub={`${dispatched.length} item${dispatched.length !== 1 ? 's' : ''} · current queue`}
        />
        {dispatched.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.iron400 }}>No dispatched items yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Dispatch #', 'Customer', 'Serial #', 'Courier', 'Tracking', 'Status'].map((h) => (
                    <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dispatched.slice(0, 10).map((dispatch) => {
                  const sp = statusPill(dispatch.status);
                  return (
                    <tr key={dispatch.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 12, color: T.iron900 }}>{dispatch.dispatch_number}</td>
                      <td style={{ ...tdCell, color: T.iron900 }}>{dispatch.customer_name}</td>
                      <td style={tdCell}>
                        {dispatch.serial_number ? (
                          <IronBadge tone="violet">{dispatch.serial_number}</IronBadge>
                        ) : <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={{ ...tdCell, color: T.iron500 }}>{dispatch.courier}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{dispatch.tracking_id}</td>
                      <td style={tdCell}><span style={badgeStyle(sp.tone)}>{sp.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* ── Recent Dispatches (from /dispatcher/recent) ─────────────────── */}
      {recentDispatches.length > 0 && (
        <IronCard pad={0} style={{ marginBottom: 8, overflow: 'hidden' }}>
          <PanelHeader
            icon={Truck}
            iconTone={T.blue}
            title="Recent Dispatches"
            sub={`${recentDispatches.length} completed · last activity`}
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Dispatch #', 'Type', 'Customer', 'Serial #', 'Courier', 'Tracking', 'Dispatched'].map((h) => (
                    <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDispatches.slice(0, 10).map((dispatch) => (
                  <tr key={dispatch.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 12, color: T.orangeDeep }}>{dispatch.dispatch_number}</td>
                    <td style={tdCell}>
                      <IronBadge tone={
                        dispatch.dispatch_type === 'walkin_return' ? 'violet' :
                        dispatch.dispatch_type === 'return_dispatch' ? 'orange' :
                        'indigo'
                      }>
                        {dispatch.dispatch_type === 'walkin_return' ? 'Walk-in' :
                         dispatch.dispatch_type === 'return_dispatch' ? 'Repair' :
                         dispatch.dispatch_type?.replace(/_/g, ' ')}
                      </IronBadge>
                    </td>
                    <td style={{ ...tdCell, color: T.iron900 }}>{dispatch.customer_name}</td>
                    <td style={tdCell}>
                      {dispatch.serial_number ? (
                        <IronBadge tone="violet">{dispatch.serial_number}</IronBadge>
                      ) : <span style={{ color: T.iron400 }}>—</span>}
                    </td>
                    <td style={{ ...tdCell, color: T.iron500 }}>{dispatch.courier || '-'}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{dispatch.tracking_id || '-'}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 10.5, color: T.iron500 }}>
                      {dispatch.scanned_out_at ? new Date(dispatch.scanned_out_at).toLocaleString('en-IN') :
                       dispatch.dispatched_at ? new Date(dispatch.dispatched_at).toLocaleString('en-IN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </IronCard>
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
    </IronShell>
  );
}
