import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { CheckCircle2, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

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
    <IronShell title="Scheduled Jobs" subtitle="BACKGROUND JOB RUNS" onRefresh={load}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Recent runs</div>
          <Caps size={9} color={T.iron400} ls=".06em" style={{ display: 'block', marginTop: 3, textTransform: 'none', letterSpacing: 0 }}>
            Latest 50 background-job executions across the CRM.
          </Caps>
        </div>

        <IronCard pad={0}>
          {loading ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: 46, background: T.iron100, borderRadius: 6 }} className="iron-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: T.iron400, fontSize: 13, fontFamily: T.body }}>
              No runs recorded yet.
            </div>
          ) : (
            <div>
              {runs.map((r) => (
                <RunRow
                  key={r.id}
                  run={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                />
              ))}
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}

function RunRow({ run, expanded, onToggle }) {
  const statusIcon = run.status === 'completed'
    ? <CheckCircle2 size={16} color={T.green} />
    : run.status === 'failed'
    ? <AlertCircle size={16} color={T.orangeDeep} />
    : <Clock size={16} color={T.voltageText} />;
  const totalRefunds = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.refunds || 0), 0);
  const totalOrders = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.fetched_orders || 0), 0);
  const totalErrors = Object.values(run.per_firm || {}).reduce((s, x) => s + (x.errors?.length || 0), 0);
  const duration = run.completed_at
    ? Math.round((new Date(run.completed_at) - new Date(run.started_at)) / 1000)
    : null;
  return (
    <div style={{ borderBottom: `1px solid ${T.iron200}`, padding: 14 }}>
      <button
        onClick={onToggle}
        className="iron-row"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {statusIcon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{run.job}</div>
          <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 2 }}>
            {new Date(run.started_at).toLocaleString()}
            {duration !== null && ` · ${duration}s`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={badgeStyle('slate')}>{totalOrders} orders</span>
          {totalRefunds > 0 && <span style={badgeStyle('warn')}>{totalRefunds} refunds</span>}
          {totalErrors > 0 && <span style={badgeStyle('bad')}>{totalErrors} errors</span>}
        </div>
        <ChevronRight
          size={16}
          color={T.iron400}
          style={{ transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'none' }}
        />
      </button>
      {expanded && run.per_firm && (
        <div style={{ marginTop: 12, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(run.per_firm).map(([fid, stats]) => (
            <div key={fid} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ ...mono, fontSize: 11, color: T.iron500 }}>firm {fid.slice(0, 8)}…</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: T.iron700, ...mono }}>
                <span>{stats.fetched_orders || 0} orders</span>
                <span>{stats.refunds || 0} refunds</span>
                {stats.errors?.length > 0 && (
                  <span style={{ color: T.orangeDeep }}>
                    {stats.errors.length} error{stats.errors.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {stats.errors?.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5, color: T.orangeDeep }}>
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
