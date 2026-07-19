import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Loader2, Search } from 'lucide-react';

const fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function KommoBackupBrowse() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('all');
  const [skip, setSkip] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async (search, src, sk) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/kommo-backup`, {
        headers: H, params: { search: search || '', source: src, limit: LIMIT, skip: sk },
      });
      setRows(data.rows || []); setTotals(data.totals || {}); setTotal(data.total || 0);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load('', 'all', 0); }, [load]);
  const runSearch = () => { setSkip(0); load(q, source, 0); };
  const setSrc = (s) => { setSource(s); setSkip(0); load(q, s, 0); };
  const page = (delta) => { const s = Math.max(0, skip + delta * LIMIT); setSkip(s); load(q, source, s); };

  const Stat = ({ label, val, tint }) => (
    <div style={{ flex: 1, background: T.white, border: '1px solid ' + T.iron200, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: tint || T.iron900 }}>{(val ?? 0).toLocaleString('en-IN')}</div>
      <div style={{ fontSize: 10, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
  const Pill = ({ v, active, onClick }) => (
    <button onClick={onClick} style={{ border: '1px solid ' + (active ? T.orange : T.iron200), background: active ? T.orange : T.white, color: active ? '#fff' : T.iron600, borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{v}</button>
  );

  return (
    <IronShell title="Kommo lead backup" subtitle="Local safety-net copy — search by phone or name" onRefresh={() => load(q, source, skip)}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Stat label="Pipeline leads" val={totals.pipeline} />
        <Stat label="Unsorted chat leads" val={totals.unsorted} tint={T.orange} />
        <Stat label="Contacts" val={totals.contacts} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: T.iron400 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search phone or name…"
            style={{ width: '100%', border: '1px solid ' + T.iron200, borderRadius: 8, padding: '9px 10px 9px 32px', fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={runSearch} style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Search</button>
        <Pill v="All" active={source === 'all'} onClick={() => setSrc('all')} />
        <Pill v="Chat leads" active={source === 'unsorted'} onClick={() => setSrc('unsorted')} />
        <Pill v="Pipeline" active={source === 'pipeline'} onClick={() => setSrc('pipeline')} />
      </div>

      <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 150px 110px', gap: 8, padding: '9px 14px', background: T.iron50, borderBottom: '1px solid ' + T.iron200 }}>
          {['Type', 'Name', 'Phone', 'Status', 'Created'].map((h) => <Caps key={h} size={9}>{h}</Caps>)}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50, color: T.iron400 }}><Loader2 size={20} className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: T.iron400, fontSize: 13 }}>No matching leads in the backup.</div>
        ) : rows.map((r, i) => (
          <div key={(r.id || i) + r.source} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 150px 110px', gap: 8, padding: '9px 14px', borderBottom: '1px solid ' + T.iron100, alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 5, textAlign: 'center', background: r.source === 'unsorted' ? '#fff4e6' : '#eef2ff', color: r.source === 'unsorted' ? '#b45309' : '#3730a3' }}>
              {r.source === 'unsorted' ? 'CHAT' : 'PIPELINE'}
            </span>
            <span style={{ fontWeight: 600, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '—'}</span>
            <span style={{ ...mono, color: r.phone ? T.iron800 : T.iron400 }}>{r.phone || '—'}</span>
            <span style={{ color: T.iron500, fontSize: 11.5 }}>{r.status || '—'}</span>
            <span style={{ color: T.iron500, fontSize: 11.5 }}>{fmtDate(r.created_at)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ fontSize: 12, color: T.iron500 }}>{total.toLocaleString('en-IN')} matches{total > 500 ? ' (showing first 500)' : ''}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button disabled={skip === 0} onClick={() => page(-1)} style={{ border: '1px solid ' + T.iron200, background: T.white, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: skip === 0 ? 'default' : 'pointer', opacity: skip === 0 ? 0.5 : 1 }}>‹ Prev</button>
          <span style={{ fontSize: 12, color: T.iron500, alignSelf: 'center' }}>{Math.floor(skip / LIMIT) + 1}</span>
          <button disabled={skip + LIMIT >= total} onClick={() => page(1)} style={{ border: '1px solid ' + T.iron200, background: T.white, borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: skip + LIMIT >= total ? 'default' : 'pointer', opacity: skip + LIMIT >= total ? 0.5 : 1 }}>Next ›</button>
        </div>
      </div>
    </IronShell>
  );
}
