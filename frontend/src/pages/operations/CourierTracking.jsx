import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Truck, Loader2, RefreshCw, Package, MapPin, Clock,
  CheckCircle, ExternalLink, Building2
} from 'lucide-react';

// Backend refreshes the board every 30 min; the page re-reads it on the same cadence.
const REFRESH_MS = 30 * 60 * 1000;

const STATE_BADGE = {
  delivered: 'bg-emerald-100 text-emerald-800',
  in_transit: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  awaiting_pickup: 'bg-violet-100 text-violet-800',
  returned: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
};

function StatusBadge({ state, label }) {
  return (
    <Badge className={STATE_BADGE[state] || 'bg-gray-100 text-gray-800'}>
      {label || (state ? state.replace(/_/g, ' ').toUpperCase() : 'UNKNOWN')}
    </Badge>
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

  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [firmFilter, setFirmFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');

  const [detail, setDetail] = useState(null); // selected shipment for dialog

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

  // Firm-filtered set drives the chip counts; the state chip then narrows the table.
  const base = useMemo(() => (
    firmFilter === 'all' ? shipments : shipments.filter((s) => s.firm_name === firmFilter)
  ), [shipments, firmFilter]);

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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="courier-tracking-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Delhivery Tracking Board
            </h1>
            <p className="text-muted-foreground">
              Live status of every active Delhivery parcel across firms · auto-refreshes every 30 min
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={firmFilter} onValueChange={setFirmFilter}>
              <SelectTrigger className="w-52">
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
            <Button variant="outline" onClick={refreshNow} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {canForce ? 'Refresh now' : 'Reload'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-lg">
                {visible.length} parcel{visible.length === 1 ? '' : 's'}
                {awaitingCount > 0 && (
                  <span className="text-sm font-normal text-violet-500 ml-2">
                    · {awaitingCount} awaiting pickup
                  </span>
                )}
                {deliveredCount > 0 && (
                  <span className="text-sm font-normal text-emerald-600 ml-2">
                    · {deliveredCount} recently delivered
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Last loaded {timeAgo(lastLoaded)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                ['all', 'All'],
                ['in_transit', 'In Transit'],
                ['awaiting_pickup', 'Awaiting Pickup'],
                ['delivered', 'Delivered'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStateFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    stateFilter === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {label} <span className="opacity-70">{counts[key] ?? 0}</span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading && shipments.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active Delhivery parcels.</p>
                <p className="text-xs mt-1">
                  Delivered parcels drop off automatically 1 day after delivery.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm</TableHead>
                    <TableHead>Amazon Order</TableHead>
                    <TableHead>AWB</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checked</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((s) => (
                    <TableRow
                      key={s.awb}
                      className={s.state === 'delivered' ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : ''}
                    >
                      <TableCell className="text-sm">{s.firm_name || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{s.amazon_order_id || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{s.awb}</TableCell>
                      <TableCell className="text-sm">{s.destination || '—'}</TableCell>
                      <TableCell>
                        <StatusBadge state={s.state} label={s.status_label} />
                        {s.last_check_failed && s.state !== 'awaiting_pickup' && (
                          <span className="block text-xs text-amber-600 mt-0.5">check failed</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {timeAgo(s.last_checked)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetail(s)}>
                          <MapPin className="h-3 w-3 mr-1" /> Track
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TrackingDialog detail={detail} onClose={() => setDetail(null)} />
    </DashboardLayout>
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
