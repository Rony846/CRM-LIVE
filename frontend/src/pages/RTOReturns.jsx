import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Loader2, PackageCheck, Trash2, Wrench, Undo2 } from 'lucide-react';
import { CustomerName } from '@/components/Customer360';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
const STAGES = [
  { key: '', label: 'All' },
  { key: 'received', label: 'Received · action needed' },
  { key: 'expected', label: 'In transit back' },
  { key: 'restocked', label: 'Restocked' },
  { key: 'scrapped', label: 'Scrapped' },
  { key: 'repair', label: 'To repair' },
];
const stageTint = { received: '#f59e0b', expected: '#64748b', restocked: '#16a34a', scrapped: '#dc2626', repair: '#7c3aed' };

export default function RTOReturns() {
  const { token, user } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const role = user?.role;
  const canDisposition = ['admin', 'accountant', 'dispatcher', 'supervisor'].includes(role);
  const [data, setData] = useState({ returns: [], counts: {}, count: 0 });
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('received');
  const [busy, setBusy] = useState({});

  const load = useCallback(async (st) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/rto-returns`, { headers: H, params: { stage: st } });
      setData(data || { returns: [] });
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not load returns'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { load(stage); }, [load, stage]);

  const act = async (r, kind) => {
    const key = r.id;
    setBusy((b) => ({ ...b, [key]: kind }));
    try {
      if (kind === 'receive') {
        await axios.post(`${API}/rto-returns/${r.id}/receive`, {}, { headers: H });
        toast.success('Marked received');
      } else {
        if (!window.confirm(`${kind === 'restock' ? 'Restock' : kind === 'scrap' ? 'Scrap' : 'Send to repair'} this returned unit?\n${r.product_name || ''}`)) {
          setBusy((b) => ({ ...b, [key]: null })); return;
        }
        const { data: res } = await axios.post(`${API}/rto-returns/${r.id}/disposition`, { action: kind, note: '' }, { headers: H });
        toast.success(`${kind} done${res.serials_actioned?.length ? ` · ${res.serials_actioned.length} serial(s)` : ''}`);
      }
      load(stage);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
    finally { setBusy((b) => ({ ...b, [key]: null })); }
  };

  const Stat = ({ label, val, tint }) => (
    <div style={{ flex: 1, background: T.white, border: '1px solid ' + T.iron200, borderRadius: 10, padding: '11px 13px' }}>
      <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 21, color: tint || T.iron900 }}>{val ?? 0}</div>
      <div style={{ fontSize: 9.5, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );

  return (
    <IronShell title="RTO / Returns" subtitle="Failed-delivery units coming back — receive & disposition" onRefresh={() => load(stage)}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Stat label="Received · action" val={data.counts?.received} tint="#b45309" />
        <Stat label="In transit back" val={data.counts?.expected} />
        <Stat label="Restocked" val={data.counts?.restocked} tint="#16a34a" />
        <Stat label="Scrapped" val={data.counts?.scrapped} tint="#dc2626" />
        <Stat label="To repair" val={data.counts?.repair} tint="#7c3aed" />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {STAGES.map((s) => (
          <button key={s.key} onClick={() => setStage(s.key)}
            style={{ border: '1px solid ' + (stage === s.key ? T.orange : T.iron200), background: stage === s.key ? T.orange : T.white, color: stage === s.key ? '#fff' : T.iron600, borderRadius: 999, padding: '5px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: T.iron400 }}><Loader2 size={20} className="animate-spin" /></div>
      ) : (data.returns || []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 44, color: T.iron400, fontSize: 13 }}>Nothing here 🎉</div>
      ) : (
        <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 10, overflow: 'hidden' }}>
          {(data.returns || []).map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid ' + T.iron100, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: stageTint[r.stage] || T.iron300 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.iron900 }}>
                  <CustomerName name={r.customer_name} /> <span style={{ ...mono, fontSize: 11, color: T.iron400, fontWeight: 400 }}>· {r.awb}</span>
                </div>
                <div style={{ fontSize: 11.5, color: T.iron600 }}>{(r.product_name || '—').slice(0, 46)}</div>
                <div style={{ fontSize: 10.5, color: T.iron400 }}>
                  {r.firm_name || ''}{r.order_id ? ` · ${r.order_id}` : ''} · {r.courier_status}
                  {r.original_serials?.length ? ` · ${r.original_serials.length} serial(s)` : ''} · {fmtDate(r.updated_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {r.stage === 'expected' && (
                  <button onClick={() => act(r, 'receive')} disabled={busy[r.id]} style={btn('#2563eb')}>
                    <PackageCheck size={13} /> Receive
                  </button>
                )}
                {r.stage === 'received' && canDisposition && (
                  <>
                    <button onClick={() => act(r, 'restock')} disabled={busy[r.id]} style={btn('#16a34a')}>
                      <Undo2 size={13} /> Restock
                    </button>
                    <button onClick={() => act(r, 'repair')} disabled={busy[r.id]} style={btn('#7c3aed')}>
                      <Wrench size={13} /> Repair
                    </button>
                    <button onClick={() => act(r, 'scrap')} disabled={busy[r.id]} style={btn('#dc2626')}>
                      <Trash2 size={13} /> Scrap
                    </button>
                  </>
                )}
                {['restocked', 'scrapped', 'repair'].includes(r.stage) && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: stageTint[r.stage] }}>{r.stage} ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </IronShell>
  );
}

const btn = (bg) => ({ border: 'none', background: bg, color: '#fff', borderRadius: 7, padding: '6px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 });
