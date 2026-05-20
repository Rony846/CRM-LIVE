import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';

const softCard =
  'bg-slate-900/80 border border-slate-800/80 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] rounded-xl';
const cls = (...xs) => xs.filter(Boolean).join(' ');

export default function CronRuns() {
  const { token } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/cron-runs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 },
      });
      setRuns(r.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout title="Scheduled Jobs">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-lg font-medium">Recent runs</h2>
            <p className="text-slate-500 text-xs">Latest 50 background-job executions across the CRM.</p>
          </div>
          <Button onClick={load} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
        <div className={cls(softCard)}>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-slate-800/40 rounded animate-pulse" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No runs recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {runs.map(r => (
                <RunRow key={r.id} run={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function RunRow({ run, expanded, onToggle }) {
  const statusIcon = run.status === 'completed'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    : run.status === 'failed'
    ? <AlertCircle className="w-4 h-4 text-rose-400" />
    : <Clock className="w-4 h-4 text-amber-400" />;
  const totalRefunds = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.refunds || 0), 0);
  const totalOrders = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.fetched_orders || 0), 0);
  const totalErrors = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.errors?.length || 0), 0);
  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at) - new Date(run.started_at)) / 1000)
    : null;
  return (
    <div className="p-4">
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        {statusIcon}
        <div className="flex-1">
          <div className="text-white font-medium text-sm">{run.job}</div>
          <div className="text-slate-500 text-xs">
            {new Date(run.started_at).toLocaleString()}
            {duration !== null && ` · ${duration}s`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-slate-700/40 text-slate-200 text-xs">{totalOrders} orders</Badge>
          {totalRefunds > 0 && <Badge className="bg-amber-500/15 text-amber-300 text-xs">{totalRefunds} refunds</Badge>}
          {totalErrors > 0 && <Badge className="bg-rose-500/15 text-rose-300 text-xs">{totalErrors} errors</Badge>}
        </div>
        <ChevronRight className={cls('w-4 h-4 text-slate-500 transition-transform', expanded && 'rotate-90')} />
      </button>
      {expanded && run.per_firm && (
        <div className="mt-3 pl-7 space-y-1 text-xs">
          {Object.entries(run.per_firm).map(([fid, stats]) => (
            <div key={fid} className="bg-slate-800/40 rounded px-3 py-2">
              <div className="font-mono text-slate-400">firm {fid.slice(0, 8)}…</div>
              <div className="text-slate-300 flex gap-3 mt-1">
                <span>{stats.fetched_orders || 0} orders</span>
                <span>{stats.refunds || 0} refunds</span>
                {stats.errors?.length > 0 && (
                  <span className="text-rose-300">{stats.errors.length} error{stats.errors.length === 1 ? '' : 's'}</span>
                )}
              </div>
              {stats.errors?.length > 0 && (
                <div className="text-rose-300 text-xs mt-1 space-y-0.5">
                  {stats.errors.slice(0, 3).map((e, i) => <div key={i}>· {e}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
