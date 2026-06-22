import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PackageCheck, FileText, Truck, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

/**
 * Split-dispatch queue (mobile-first). Backend filters by role:
 *  - technician (service_agent) -> INVERTER tasks
 *  - supervisor -> BATTERY & other tasks
 * Each card shows the staff's own product lines + the SHARED label + invoice.
 * "Mark as Sent" turns the card GREEN but KEEPS it in the queue — it only disappears
 * once the parcel is scanned out at the outward gate (dispatch status -> dispatched).
 * Auto-refreshes every 5 minutes (and immediately after an action).
 */
export default function DispatchTasks() {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const role = user?.role;
  const heading =
    role === 'service_agent' || role === 'technician'
      ? 'Inverter Dispatch'
      : role === 'supervisor'
      ? 'Battery & Items Dispatch'
      : 'Split Dispatch';

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/dispatch-tasks`, { headers });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not load dispatch tasks');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // auto-refresh every 5 minutes
    return () => clearInterval(t);
  }, [load]);

  const markSent = async (t) => {
    setBusyId(t.dispatch_id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(`${API}/dispatch-tasks/${t.dispatch_id}/ready`, {}, { headers });
      toast.success(
        res.data?.all_ready
          ? `${t.group_label} sent — both products ready, awaiting gate scan ✅`
          : `${t.group_label} marked sent ✅`
      );
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not mark sent');
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== 'ready').length;

  return (
    <DashboardLayout>
      <div className="p-3 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <PackageCheck className="h-6 w-6 shrink-0" /> {heading}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} to send` : 'All sent — waiting on gate scan'} · auto‑refreshes every 5 min
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="shrink-0">
            <RefreshCw className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Nothing to dispatch right now. New orders will appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
            {tasks.map((t) => {
              const sent = t.status === 'ready';
              const counterpart = (t.all_tasks || []).find((x) => x.group !== t.group);
              const bothReady = t.dispatch_status === 'ready_for_dispatch';
              return (
                <Card
                  key={`${t.dispatch_id}-${t.group}`}
                  className={
                    'border-l-4 transition-colors ' +
                    (sent
                      ? 'border-l-green-500 bg-green-50 dark:bg-green-950/30'
                      : 'border-l-primary')
                  }
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="truncate">#{t.dispatch_number}</span>
                      {sent ? (
                        <Badge className="bg-green-600 hover:bg-green-600 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Sent
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">{t.group_label}</Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {t.order_id || '—'} · {t.customer_name || 'Customer'} · {t.city || ''} {t.state || ''}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1">YOUR ITEMS</p>
                      <ul className="text-sm space-y-1">
                        {(t.items || []).map((it, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{it.master_sku_name || it.sku_code || 'Item'}</span>
                            <span className="text-muted-foreground shrink-0">
                              x{it.quantity}{it.serial_number ? ` · ${it.serial_number}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Truck className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.courier || '—'}{t.tracking_id ? ` · ${t.tracking_id}` : ''}</span>
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {t.label_url && (
                        <a href={t.label_url} target="_blank" rel="noreferrer" className="flex-1 min-w-[8rem]">
                          <Button variant="outline" className="w-full h-11">
                            <FileText className="h-4 w-4 mr-1" /> Label
                          </Button>
                        </a>
                      )}
                      {t.invoice_url && (
                        <a href={t.invoice_url} target="_blank" rel="noreferrer" className="flex-1 min-w-[8rem]">
                          <Button variant="outline" className="w-full h-11">
                            <FileText className="h-4 w-4 mr-1" /> Invoice
                          </Button>
                        </a>
                      )}
                    </div>

                    {counterpart && (
                      <p className="text-xs flex items-center gap-1 text-muted-foreground">
                        {counterpart.status === 'ready' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            {counterpart.label} already sent
                            {counterpart.completed_by_name ? ` by ${counterpart.completed_by_name}` : ''}
                          </>
                        ) : (
                          <>
                            <Clock className="h-3.5 w-3.5 shrink-0" /> Waiting on {counterpart.label} too
                          </>
                        )}
                      </p>
                    )}

                    {sent ? (
                      <div className="w-full h-12 rounded-md bg-green-600/10 border border-green-600/40 flex items-center justify-center text-green-700 dark:text-green-400 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {bothReady ? 'Sent — awaiting outward gate scan' : 'Sent — waiting for the other product'}
                      </div>
                    ) : (
                      <Button
                        className="w-full h-12 text-base"
                        disabled={busyId === t.dispatch_id}
                        onClick={() => markSent(t)}
                      >
                        <PackageCheck className="h-5 w-5 mr-1" />
                        {busyId === t.dispatch_id ? 'Saving…' : `Mark ${t.group_label} as Sent`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
