import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { ArrowDownToLine, ArrowUpFromLine, Wallet, TrendingUp, Download } from 'lucide-react';

/* Importer Ledger — KNB's running account with MGIPL: PURCHASE (imported from China), SALE (billed to
   MGIPL), PAYMENTS (received from MGIPL), and the BALANCE = how much MGIPL still owes KNB in rupees. */

const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 };
const th = { padding: '9px 12px', color: T.iron500, fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: T.iron50, zIndex: 1 };
const td = { padding: '8px 12px', fontSize: 12.5, color: T.iron800, borderTop: '1px solid ' + T.iron100 };

function Section({ title, icon: Icon, tint, columns, rows, renderRow, total, totalLabel }) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid ' + T.iron100, background: tint }}>
        <Icon size={16} style={{ color: T.iron700 }} />
        <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 14, color: T.iron900 }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 14, color: T.iron900 }}>{inr(total)}</span>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 320, WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: T.iron50 }}>{columns.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: T.iron400, padding: 20 }}>Nothing recorded yet.</td></tr>}
            {rows.map((r, i) => renderRow(r, i))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ImporterLedger() {
  const { token } = useAuth();
  const H = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/importer/ledger`, { headers: H });
      setData(data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load ledger'); }
    finally { setLoading(false); }
  }, [H]);
  useEffect(() => { load(); }, [load]);

  const downloadStatement = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/importer/statement.pdf`, { headers: H, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');   // new tab → view, print, or save for their records
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error('Could not generate statement'); }
  }, [H]);

  const s = data?.summary || {};
  const owed = s.balance_due || 0;

  return (
    <IronShell title="Ledger" subtitle="Your account with MuscleGrid (MGIPL)" onRefresh={load}>
      {/* Headline balance — how much MGIPL owes KNB */}
      <div style={{ ...card, background: 'linear-gradient(135deg,#0f2b1e,#14532d)', border: 'none', color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, opacity: 0.85, letterSpacing: 0.3 }}>MGIPL owes you (receivable)</div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 34, lineHeight: 1.1 }}>{inr(owed)}</div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 4 }}>= Sales billed {inr(s.total_sale)} − Received {inr(s.total_paid)}</div>
          <button onClick={downloadStatement} style={{ marginTop: 12, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Download size={15} /> Download statement (PDF)
          </button>
        </div>
        <Wallet size={44} style={{ opacity: 0.5 }} />
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10, marginBottom: 16 }}>
        <div style={card}><Caps size={9}>Purchase (from China)</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{inr(s.total_purchase)}</div></div>
        <div style={card}><Caps size={9}>Sale (to MGIPL)</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{inr(s.total_sale)}</div></div>
        <div style={card}><Caps size={9}>Your margin</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: '#15803d' }}>{inr(s.gross_margin)}</div></div>
        <div style={card}><Caps size={9}>Received from MGIPL</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{inr(s.total_paid)}</div></div>
      </div>

      {loading && <div style={{ color: T.iron400, padding: 20 }}>Loading…</div>}

      {data && (
        <>
          {/* PURCHASE — imported from China */}
          <Section title="Purchase — imported from China" icon={ArrowDownToLine} tint="#fff7ed"
            columns={['Date', 'Supplier Invoice', 'BoE', 'Supplier ₹', 'Customs ₹', 'Shipping ₹', 'Landed ₹']}
            rows={data.purchases} total={s.total_purchase}
            renderRow={(r, i) => (
              <tr key={i}>
                <td style={td}>{r.date}</td>
                <td style={{ ...td, ...mono, fontWeight: 700 }}>{r.supplier_invoice}</td>
                <td style={{ ...td, ...mono, color: T.iron500 }}>{r.boe_number || '—'}</td>
                <td style={{ ...td, ...mono }}>{inr(r.supplier_paid)}</td>
                <td style={{ ...td, ...mono }}>{inr(r.customs)}</td>
                <td style={{ ...td, ...mono }}>{inr(r.shipping)}</td>
                <td style={{ ...td, ...mono, fontWeight: 700 }}>{inr(r.landed)}</td>
              </tr>
            )} />

          {/* SALE — billed to MGIPL */}
          <Section title="Sale — billed to MGIPL" icon={ArrowUpFromLine} tint="#eff6ff"
            columns={['Date', 'Sale Invoice', 'Against Supplier Inv', 'Amount ₹', 'Status']}
            rows={data.sales} total={s.total_sale}
            renderRow={(r, i) => (
              <tr key={i}>
                <td style={td}>{r.date}</td>
                <td style={{ ...td, ...mono, fontWeight: 700 }}>{r.sale_invoice}</td>
                <td style={{ ...td, ...mono, color: T.iron500 }}>{r.against_supplier_invoice}</td>
                <td style={{ ...td, ...mono, fontWeight: 700 }}>{inr(r.amount)}</td>
                <td style={td}><span style={{ fontSize: 10.5, fontWeight: 700, color: r.status === 'submitted' ? '#15803d' : T.iron500, background: r.status === 'submitted' ? '#f0fdf4' : T.iron50, borderRadius: 20, padding: '2px 8px' }}>{r.status}</span></td>
              </tr>
            )} />

          {/* PAYMENTS / BALANCE TRANSFER — received from MGIPL */}
          <Section title="Balance transfer — received from MGIPL" icon={TrendingUp} tint="#f0fdf4"
            columns={['Date', 'Narration', 'Amount ₹']}
            rows={data.payments} total={s.total_paid}
            renderRow={(r, i) => (
              <tr key={i}>
                <td style={td}>{r.date}</td>
                <td style={{ ...td, color: T.iron600, maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.narration}</td>
                <td style={{ ...td, ...mono, fontWeight: 700, color: '#15803d' }}>{inr(r.amount)}</td>
              </tr>
            )} />

          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: '#bbf7d0', background: '#f0fdf4' }}>
            <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900 }}>Net balance — MGIPL to pay you</span>
            <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: '#15803d' }}>{inr(owed)}</span>
          </div>
          {s.customs_igst_itc > 0 && (
            <div style={{ fontSize: 11.5, color: T.iron400, marginTop: 10 }}>
              Note: customs IGST of {inr(s.customs_igst_itc)} on your imports is your (KNB's) Input Tax Credit — you claim it against your GSTIN.
            </div>
          )}
        </>
      )}
    </IronShell>
  );
}
