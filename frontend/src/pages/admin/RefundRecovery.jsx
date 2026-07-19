import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { RefreshCw, Scale, Search, ShieldAlert, PackageCheck, HelpCircle, Truck, Ban } from 'lucide-react';

/* Refund-Recovery board — every refunded Amazon order classified by whether it was DELIVERED and
   actually RETURNED (via Amazon's return_delivery_date), with deduplicated refund amounts.
   'confirmed_leak' = delivered + report says never returned → SAFE-T / legal recovery. */

const VERDICTS = {
  confirmed_leak: { label: 'Confirmed leak', hint: 'delivered · not returned', color: '#b91c1c', bg: '#fef2f2', icon: ShieldAlert },
  return_unknown: { label: 'Return unknown', hint: 'delivered · no report yet', color: '#b45309', bg: '#fffbeb', icon: HelpCircle },
  returned: { label: 'Returned (came back)', hint: 'not a loss', color: '#15803d', bg: '#f0fdf4', icon: PackageCheck },
  in_transit: { label: 'Shipped / in transit', hint: 'not delivered yet', color: '#0369a1', bg: '#f0f9ff', icon: Truck },
  no_shipment: { label: 'No shipment record', hint: 'FBA / unlinked', color: '#6b7280', bg: '#f9fafb', icon: Ban },
  a_to_z: { label: 'A-to-z (excluded)', hint: 'handled separately', color: '#7c3aed', bg: '#faf5ff', icon: Scale },
};
const ORDER = ['confirmed_leak', 'return_unknown', 'returned', 'in_transit', 'no_shipment', 'a_to_z'];
const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 14 };

export default function RefundRecovery({ embedded }) {
  const { token } = useAuth();
  const H = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState(null);
  const [verdict, setVerdict] = useState('confirmed_leak');
  const [firm, setFirm] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/refund-recovery`, { headers: H, params: { verdict, firm: firm || undefined, q: q || undefined, limit: 1000 } });
      setData(data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  }, [H, verdict, firm, q]);
  useEffect(() => { load(); }, [load]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const { data } = await axios.post(`${API}/admin/refund-recovery/rebuild`, {}, { headers: H });
      toast.success(`Rebuilt — ${data.built} orders re-classified`);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Rebuild failed'); }
    finally { setRebuilding(false); }
  };

  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const builtAt = data?.built_at ? new Date(data.built_at).toLocaleString('en-IN') : '—';

  const shell = (kids) => embedded ? kids : (
    <IronShell title="Refund Recovery" subtitle="Refunded orders · delivered vs actually returned" onRefresh={load}
      headerRight={
        <button onClick={rebuild} disabled={rebuilding}
          style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 8, height: 38, padding: '0 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', opacity: rebuilding ? 0.6 : 1 }}>
          <RefreshCw size={15} className={rebuilding ? 'spin' : ''} /> {rebuilding ? 'Rebuilding…' : 'Rebuild'}
        </button>}>{kids}</IronShell>
  );
  return shell(<>
      <div style={{ marginBottom: 6, fontSize: 11.5, color: T.iron400, ...mono }}>
        Last rebuilt: {builtAt} · deduped refunds + Amazon return_delivery_date
      </div>

      {/* summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {ORDER.map((v) => {
          const s = summary[v] || { orders: 0, amount: 0 };
          const meta = VERDICTS[v]; const Icon = meta.icon; const active = verdict === v;
          return (
            <button key={v} onClick={() => setVerdict(active ? '' : v)}
              style={{ ...card, textAlign: 'left', cursor: 'pointer', borderColor: active ? meta.color : T.iron200, borderWidth: active ? 2 : 1, background: active ? meta.bg : T.white }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: meta.color }}>
                <Icon size={16} /><span style={{ fontWeight: 800, fontSize: 13 }}>{meta.label}</span>
              </div>
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, marginTop: 6 }}>{inr(s.amount)}</div>
              <div style={{ fontSize: 11.5, color: T.iron500 }}>{s.orders} orders · <span style={{ color: T.iron400 }}>{meta.hint}</span></div>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select value={firm} onChange={(e) => setFirm(e.target.value)}
          style={{ height: 38, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 10px', fontSize: 13, color: T.iron800 }}>
          <option value="">All sellers</option>
          {(data?.firms || []).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: T.iron400 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order id…"
            style={{ height: 38, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 10px 0 32px', fontSize: 13, width: 220, ...mono }} />
        </div>
        {verdict && <span style={{ fontSize: 12, color: T.iron500 }}>Filtered: <b style={{ color: VERDICTS[verdict]?.color }}>{VERDICTS[verdict]?.label}</b> — click the tile again to clear</span>}
      </div>

      {/* table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: T.iron50, textAlign: 'left' }}>
                {['Order', 'Seller', 'Refund', 'Verdict', 'Return reason', 'Return status', 'Legal case'].map((h) => (
                  <th key={h} style={{ padding: '9px 12px', color: T.iron500, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.iron400 }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.iron400 }}>No orders match.</td></tr>}
              {!loading && rows.map((r) => {
                const meta = VERDICTS[r.verdict] || {};
                return (
                  <tr key={r.order_id} style={{ borderTop: '1px solid ' + T.iron100 }}>
                    <td style={{ padding: '8px 12px', ...mono, color: T.iron900, whiteSpace: 'nowrap' }}>{r.order_id}</td>
                    <td style={{ padding: '8px 12px', color: T.iron700 }}>{r.firm_name}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: T.iron900, whiteSpace: 'nowrap' }}>{inr(r.refund_amount)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: meta.bg, color: meta.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{meta.label || r.verdict}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: T.iron600 }}>{r.return_reason || '—'}</td>
                    <td style={{ padding: '8px 12px', color: r.return_delivered_back ? '#15803d' : T.iron500, fontSize: 11.5 }}>
                      {r.return_delivered_back ? 'Returned to us' : r.in_return_report ? (r.return_tracking ? 'Label made, not back' : 'No return label') : 'No report'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {r.legal_case_serial
                        ? <a href="/admin/legal-cases" style={{ color: T.orange, fontWeight: 700, textDecoration: 'none', ...mono }}>{r.legal_case_serial}</a>
                        : <span style={{ color: T.iron300 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: T.iron400, marginTop: 8 }}>Showing {rows.length} orders (top by refund value). Upload a seller's Returns-Report XML to Files-for-Claude, then Rebuild to resolve its "Return unknown" rows.</div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </>);
}
