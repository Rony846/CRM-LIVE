import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Truck, Loader2, RefreshCw, Package, MapPin, Clock,
  CheckCircle, ExternalLink, Building2, PackagePlus
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Backend refreshes the board every 30 min; the page re-reads it on the same cadence.
const REFRESH_MS = 30 * 60 * 1000;

// Delhivery/board state -> Iron pill tone.
const STATE_TONE = {
  delivered: 'ok',
  in_transit: 'info',
  pending: 'warn',
  awaiting_pickup: 'violet',
  returned: 'bad',
  cancelled: 'bad',
};

function StatusBadge({ state, label }) {
  const tone = STATE_TONE[state] || 'slate';
  return (
    <span style={badgeStyle(tone)}>
      {label || (state ? state.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN')}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function CourierTracking() {
  const { token, user } = useAuth();
  const canForce = ['admin', 'dispatcher'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [firmFilter, setFirmFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const [detail, setDetail] = useState(null); // selected shipment for dialog
  const [firms, setFirms] = useState([]);     // {id,name} for the Amazon pull
  const [pullOpen, setPullOpen] = useState(false);

  // Firms list for the "Pull from Amazon" picker (admin only). Loaded separately
  // from the board so the pull works even when the board is currently empty.
  useEffect(() => {
    if (!isAdmin) return;
    axios.get(`${API}/firms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setFirms(Array.isArray(r.data) ? r.data : (r.data?.firms || [])))
      .catch(() => {});
  }, [isAdmin, token]);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/courier/delhivery-board`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setShipments(res.data.shipments || []);
        setLastLoaded(new Date().toISOString());
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load tracking board');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load + 30-min auto-refresh.
  useEffect(() => {
    fetchBoard();
    const id = setInterval(fetchBoard, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchBoard]);

  // "Refresh now": admin/dispatcher force a live Delhivery poll; others just re-read.
  const refreshNow = async () => {
    setRefreshing(true);
    try {
      if (canForce) {
        const res = await axios.post(`${API}/courier/delhivery-board/refresh`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          toast.success(`Polled ${res.data.checked} parcels · ${res.data.delivered} delivered`);
        }
      }
      await fetchBoard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const firmOptions = useMemo(() => {
    const names = [...new Set(shipments.map((s) => s.firm_name).filter(Boolean))];
    names.sort();
    return names;
  }, [shipments]);

  const courierOptions = useMemo(() => {
    const c = [...new Set(shipments.map((s) => s.platform || 'Bigship').filter(Boolean))];
    c.sort();
    return c;
  }, [shipments]);

  // Firm + courier filtered set drives the chip counts; the state chip then narrows the table.
  const base = useMemo(() => {
    let r = firmFilter === 'all' ? shipments : shipments.filter((s) => s.firm_name === firmFilter);
    if (courierFilter !== 'all') r = r.filter((s) => (s.platform || 'Bigship') === courierFilter);
    return r;
  }, [shipments, firmFilter, courierFilter]);

  const counts = useMemo(() => ({
    all: base.length,
    in_transit: base.filter((s) => s.state === 'in_transit').length,
    awaiting_pickup: base.filter((s) => s.state === 'awaiting_pickup').length,
    delivered: base.filter((s) => s.state === 'delivered').length,
  }), [base]);

  const visible = useMemo(() => (
    stateFilter === 'all' ? base : base.filter((s) => s.state === stateFilter)
  ), [base, stateFilter]);

  const deliveredCount = counts.delivered;
  const awaitingCount = counts.awaiting_pickup;

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Select value={courierFilter} onValueChange={setCourierFilter}>
        <SelectTrigger className="w-40 h-9 text-xs">
          <Truck className="h-4 w-4 mr-1 text-muted-foreground" />
          <SelectValue placeholder="All couriers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All couriers</SelectItem>
          {courierOptions.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={firmFilter} onValueChange={setFirmFilter}>
        <SelectTrigger className="w-52 h-9 text-xs">
          <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
          <SelectValue placeholder="All firms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All firms</SelectItem>
          {firmOptions.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={refreshNow}
        disabled={refreshing || loading}
        style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: (refreshing || loading) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: (refreshing || loading) ? 0.6 : 1 }}
      >
        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        {canForce ? 'Refresh now' : 'Reload'}
      </button>
      {isAdmin && (
        <button
          onClick={() => setPullOpen(true)}
          disabled={loading}
          style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}
        >
          <PackagePlus size={14} />
          Pull from Amazon
        </button>
      )}
    </div>
  );

  const CHIPS = [
    ['all', 'All'],
    ['in_transit', 'In Transit'],
    ['awaiting_pickup', 'Awaiting Pickup'],
    ['delivered', 'Delivered'],
  ];

  const H = ['Courier', 'Firm', 'Order / Customer', 'AWB', 'Destination', 'Status', 'Checked', 'Details'];

  return (
    <IronShell
      title="Courier Tracking"
      subtitle="LIVE PARCEL BOARD · AUTO 30M"
      onRefresh={fetchBoard}
      headerRight={headerRight}
    >
      <div data-testid="courier-tracking-page">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={20} color={T.orange} />
              Courier Tracking Board
            </div>
            <div style={{ color: T.iron500, fontSize: 12.5, marginTop: 2 }}>
              Live status of every active parcel — Bigship + Shiprocket — across firms · auto-refreshes every 30 min
            </div>
          </div>
        </div>

        <IronCard pad={0}>
          <div style={{ padding: 14, borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>
                {visible.length} parcel{visible.length === 1 ? '' : 's'}
                {awaitingCount > 0 && (
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#6D4AB0', marginLeft: 8 }}>
                    · {awaitingCount} awaiting pickup
                  </span>
                )}
                {deliveredCount > 0 && (
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: T.green, marginLeft: 8 }}>
                    · {deliveredCount} recently delivered
                  </span>
                )}
              </div>
              <Caps size={10} color={T.iron400}>Last loaded {timeAgo(lastLoaded)}</Caps>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {CHIPS.map(([key, label]) => {
                const active = stateFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStateFilter(key)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 11.5,
                      fontFamily: T.headline, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${active ? T.orange : T.iron200}`,
                      background: active ? T.orange : T.white,
                      color: active ? '#fff' : T.iron700,
                    }}
                  >
                    {label} <span style={{ opacity: 0.7 }}>{counts[key] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading && shipments.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={30} color={T.iron400} />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400 }}>
              <Package size={44} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ color: T.iron500, fontSize: 13 }}>No active parcels.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>
                Delivered parcels drop off automatically 1 day after delivery.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {H.map((h, i) => (
                      <th key={h} style={{ ...thCell, textAlign: i === H.length - 1 ? 'right' : 'left' }}>
                        <Caps size={8.5}>{h}</Caps>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const platform = s.platform || 'Bigship';
                    return (
                      <tr
                        key={`${s.platform || 'bs'}-${s.awb}`}
                        className="iron-row"
                        style={{ borderBottom: `1px solid ${T.iron200}`, background: s.state === 'delivered' ? T.greenTint : undefined }}
                      >
                        <td style={tdCell}>
                          <span style={badgeStyle(platform === 'Shiprocket' ? 'bad' : 'info')}>{platform}</span>
                          {s.courier && s.courier !== platform && s.courier !== 'Delhivery' && (
                            <div style={{ fontSize: 10, color: T.iron400, marginTop: 3 }}>{s.courier}</div>
                          )}
                        </td>
                        <td style={{ ...tdCell, fontSize: 12.5 }}>{s.firm_name || '—'}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{s.amazon_order_id || s.buyer_name || '—'}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 12.5, color: T.iron900 }}>{s.awb}</td>
                        <td style={{ ...tdCell, fontSize: 12.5 }}>{s.destination || '—'}</td>
                        <td style={tdCell}>
                          <StatusBadge state={s.state} label={s.status_label} />
                          {s.last_check_failed && s.state !== 'awaiting_pickup' && (
                            <div style={{ fontSize: 11, color: T.voltageText, marginTop: 3 }}>check failed</div>
                          )}
                        </td>
                        <td style={{ ...tdCell, fontSize: 11.5, color: T.iron400 }}>
                          {timeAgo(s.last_checked)}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button
                            onClick={() => setDetail(s)}
                            style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <MapPin size={12} /> Track
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </IronCard>
      </div>

      <TrackingDialog detail={detail} onClose={() => setDetail(null)} />
      <PullAmazonDialog
        open={pullOpen}
        firms={firms}
        token={token}
        onClose={() => setPullOpen(false)}
        onDone={fetchBoard}
      />
    </IronShell>
  );
}

// Admin one-click: scrape the last 15 days of Amazon orders missing tracking and
// auto-refresh the board when the scrape finishes. Polls the shared bulk-scrape
// job status so the operator sees live progress without leaving this page.
function PullAmazonDialog({ open, onClose, firms, token, onDone }) {
  const [firmId, setFirmId] = useState('');
  const [starting, setStarting] = useState(false);
  const [job, setJob] = useState(null);
  const pollRef = React.useRef(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Reset on close; always clear the interval on unmount.
  useEffect(() => {
    if (!open) { setFirmId(''); setJob(null); setStarting(false); stopPoll(); }
  }, [open]);
  useEffect(() => () => stopPoll(), []);

  const poll = (fid) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const r = await axios.get(
          `${API}/amazon/bulk-scrape-status?firm_id=${encodeURIComponent(fid)}`,
          { headers: { Authorization: `Bearer ${token}` } });
        const j = r.data || {};
        setJob(j);
        if (j.state === 'done' || j.state === 'cancelled' || j.state === 'idle') {
          stopPoll();
          const got = j.succeeded || 0;
          if (j.state === 'cancelled') toast.info(`Stopped · ${got} scraped before cancel`);
          else toast.success(`Scraped ${got}/${j.total || got} · board updated`);
          if (onDone) onDone();
        }
      } catch (e) { /* transient — keep polling */ }
    }, 3000);
  };

  const start = async () => {
    if (!firmId) { toast.error('Pick a firm first'); return; }
    setStarting(true);
    try {
      const r = await axios.post(
        `${API}/courier/delhivery-board/pull-recent-amazon?firm_id=${encodeURIComponent(firmId)}&days=15`,
        {}, { headers: { Authorization: `Bearer ${token}` } });
      if (r.data.total === 0) {
        toast.info(r.data.message || 'No recent orders missing tracking.');
        if (onDone) onDone();
        onClose();
      } else {
        toast.message(r.data.message || `Scraping ${r.data.total} orders…`);
        setJob({ state: 'running', total: r.data.total, succeeded: 0, failed: 0 });
        poll(firmId);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not start the scrape');
    } finally {
      setStarting(false);
    }
  };

  const cancel = async () => {
    try {
      await axios.post(
        `${API}/amazon/bulk-scrape-cancel?firm_id=${encodeURIComponent(firmId)}`,
        {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.info('Cancelling after current order…');
    } catch (e) { toast.error(e.response?.data?.detail || 'Cancel failed'); }
  };

  const running = job?.state === 'running';
  const done = (job?.succeeded || 0) + (job?.failed || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !running) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" /> Pull last 15 days from Amazon
          </DialogTitle>
          <DialogDescription>
            Scrapes recent orders that are missing a tracking number off Amazon Seller
            Central, writes their AWBs, and refreshes this board when done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Firm</label>
            <Select value={firmId} onValueChange={setFirmId} disabled={running}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select firm" />
              </SelectTrigger>
              <SelectContent>
                {firms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            The browser agent must be signed in to Amazon first (Admin → Browser
            Agents). Only orders without a stored tracking number are scraped.
          </p>

          {job && (
            <div className="rounded-md border p-3 text-sm">
              {running ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Scraping {done}/{job.total}…</span>
                  {job.current_order_id && (
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {job.current_order_id}
                    </span>
                  )}
                </div>
              ) : (
                <div>Done · {job.succeeded || 0} scraped, {job.failed || 0} failed</div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {running ? (
              <Button variant="outline" onClick={cancel}>Stop</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Close</Button>
                <Button onClick={start} disabled={starting || !firmId}>
                  {starting
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <PackagePlus className="h-4 w-4 mr-1" />}
                  Start scrape
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TrackingDialog({ detail, onClose }) {
  const t = detail?.tracking || {};
  const scans = Array.isArray(t.scans) ? t.scans : [];
  const states = Array.isArray(t.states) ? t.states : [];
  const expectedDelivery = t.delivery_date_text || t.delivery_date || t.promise_delivery_date;

  return (
    <Dialog open={!!detail} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Tracking {detail?.awb}
          </DialogTitle>
          <DialogDescription>
            {detail?.firm_name}
            {detail?.amazon_order_id ? ` · ${detail.amazon_order_id}` : ''}
          </DialogDescription>
        </DialogHeader>

        {!detail ? null : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Current status</p>
                <div className="mt-1"><StatusBadge state={t.state} label={t.status_label} /></div>
              </div>
              {expectedDelivery && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t.state === 'delivered' ? 'Delivered' : 'Expected'}
                  </p>
                  <p className="font-medium flex items-center gap-1 mt-1">
                    <Clock className="h-4 w-4" /> {expectedDelivery}
                  </p>
                </div>
              )}
              {t.destination && (
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4" /> {t.destination}
                  </p>
                </div>
              )}
              {detail.awb && (
                <a
                  href={`https://www.delhivery.com/track-v2/package/${encodeURIComponent(detail.awb)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-sm text-primary inline-flex items-center gap-1 hover:underline"
                >
                  Open on Delhivery <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {t.instructions && (
              <p className="text-sm text-muted-foreground italic">{t.instructions}</p>
            )}

            {states.length > 0 && (
              <div className="flex items-center gap-1">
                {states.map((st, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center text-center min-w-0 flex-1">
                      <CheckCircle className={`h-5 w-5 ${st.reached ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                      <span className={`text-xs mt-1 truncate w-full ${st.reached ? 'font-medium' : 'text-muted-foreground'}`}>
                        {st.label}
                      </span>
                    </div>
                    {idx < states.length - 1 && (
                      <div className={`h-0.5 flex-1 ${states[idx + 1].reached ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            {scans.length > 0 ? (
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                {scans.map((scan, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3">
                    <CheckCircle className={`h-4 w-4 mt-0.5 ${idx === 0 ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{scan.scan || scan.remark || 'Update'}</p>
                      {scan.remark && scan.scan && scan.remark !== scan.scan && (
                        <p className="text-xs text-muted-foreground">{scan.remark}</p>
                      )}
                      {scan.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {scan.location}
                        </p>
                      )}
                    </div>
                    {scan.timestamp && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{scan.timestamp}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No scan history available yet for this AWB.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
