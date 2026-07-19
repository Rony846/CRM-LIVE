import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { CheckCircle2, Clock, Ban, Pencil, Wallet, ShieldAlert, ExternalLink, X } from 'lucide-react';

/* PI Payment Approvals — the admin gate before a Proforma Invoice can reach the Ship Desk.
   Sales agent uploads the customer's payment screenshot → it lands here. Admin verifies the money is
   in and either APPROVES (→ Ship Desk for the accountant), records a PARTIAL payment (hold for the
   balance), MODIFIES the order (reduce quantity), or REJECTS. Razorpay-paid PIs skip this queue
   entirely (auto-verified, auto-moved). */

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 14 };
const btn = (bg, fg = '#fff') => ({ border: 'none', background: bg, color: fg, borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 });

export default function PIPaymentApprovals() {
  const { token } = useAuth();
  const H = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [proof, setProof] = useState(null);      // { number, url }
  const [modify, setModify] = useState(null);     // { row, qty: {idx: n} }
  const [partial, setPartial] = useState(null);   // { row, amount, note }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/pi-payment-approvals`, { headers: H });
      setRows(data?.approvals || []);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to load'); }
    finally { setLoading(false); }
  }, [H]);
  useEffect(() => { load(); }, [load]);

  const act = async (number, payload, okMsg) => {
    setBusy(number);
    try {
      await axios.post(`${API}/quotations/${encodeURIComponent(number)}/payment-approve`, payload, { headers: H });
      toast.success(okMsg);
      setModify(null); setPartial(null);
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
    finally { setBusy(''); }
  };

  const approve = (r) => {
    if (!window.confirm(`Confirm payment of ${inr(r.payment_amount || r.grand_total)} received for ${r.customer_name}?\n\nThis pushes ${r.quotation_number} to the Ship Desk for the accountant.`)) return;
    act(r.quotation_number, { action: 'approve' }, `${r.quotation_number} approved → Ship Desk`);
  };
  const reject = (r) => {
    const note = window.prompt(`Reject payment for ${r.quotation_number}? Reason (sent to the sales agent):`, 'Payment not received in bank');
    if (note === null) return;
    act(r.quotation_number, { action: 'reject', note }, `${r.quotation_number} rejected`);
  };

  const totalPending = rows.filter((r) => r.pi_payment_state === 'pending_admin').length;
  const onHold = rows.filter((r) => r.pi_payment_state === 'partial').length;
  const totalValue = rows.reduce((s, r) => s + (r.grand_total || 0), 0);

  return (
    <IronShell title="PI Payment Approvals" subtitle="Verify payment before a PI goes to the Ship Desk" onRefresh={load}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={card}><Caps size={9}>Awaiting approval</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26, color: T.iron900 }}>{totalPending}</div></div>
        <div style={{ ...card, borderColor: '#f5d9b0', background: '#fffbeb' }}><Caps size={9}>Partial-payment hold</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 26, color: '#b45309' }}>{onHold}</div></div>
        <div style={card}><Caps size={9}>Value in queue</Caps><div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900 }}>{inr(totalValue)}</div></div>
      </div>

      {!loading && rows.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: T.iron400, padding: 40 }}>
          <CheckCircle2 size={28} style={{ color: T.iron300 }} /><div style={{ marginTop: 8 }}>Nothing waiting. Razorpay-paid PIs move to the Ship Desk automatically.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 12 }}>
        {rows.map((r) => {
          const hot = (r.phone_reuse_alert && (r.phone_reuse_alert.distinct_names || 0) >= 2);
          const isPartial = r.pi_payment_state === 'partial';
          return (
            <div key={r.quotation_number} style={{ ...card, borderColor: isPartial ? '#f5d9b0' : (hot ? '#f5c2c2' : T.iron200), borderWidth: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900 }}>{r.customer_name}</div>
                  <div style={{ fontSize: 11.5, color: T.iron500, ...mono }}>{r.quotation_number} · {r.firm_name}</div>
                  <div style={{ fontSize: 11.5, color: T.iron500 }}>{r.customer_phone}{r.customer_city ? ' · ' + r.customer_city : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>{inr(r.grand_total)}</div>
                  {isPartial && <span style={{ background: '#fffbeb', color: '#b45309', borderRadius: 20, padding: '2px 8px', fontSize: 10.5, fontWeight: 800 }}>PARTIAL ₹{Math.round(r.payment_partial_amount || 0).toLocaleString('en-IN')}</span>}
                </div>
              </div>

              {hot && (
                <div style={{ marginTop: 8, background: '#fef2f2', border: '1px solid #f5c2c2', borderRadius: 8, padding: '6px 9px', fontSize: 11.5, color: '#b91c1c', fontWeight: 700 }}>
                  <ShieldAlert size={12} style={{ display: 'inline', marginRight: 4 }} />
                  This phone is on {r.phone_reuse_alert.distinct_names} customer names — verify before approving.
                </div>
              )}

              <div style={{ marginTop: 8, borderTop: '1px dashed ' + T.iron100, paddingTop: 8 }}>
                {(r.items || []).map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.iron700, padding: '2px 0' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 8 }}>× {it.quantity}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8, fontSize: 11.5, color: T.iron500, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span><Wallet size={11} style={{ display: 'inline', marginRight: 3 }} />{(r.payment_method || 'screenshot').toUpperCase()}</span>
                {r.payment_ref && <span>Ref: <b style={{ color: T.iron700 }}>{r.payment_ref}</b></span>}
                {r.payment_amount ? <span>Paid: <b style={{ color: T.iron700 }}>{inr(r.payment_amount)}</b></span> : null}
                {r.payment_submitted_by && <span>by {r.payment_submitted_by}</span>}
              </div>
              {r.payment_note && <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 4 }}>{r.payment_note}</div>}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {r.has_proof && (
                  <button style={btn(T.iron100, T.iron800)} onClick={() => setProof({ number: r.quotation_number })}>
                    <ExternalLink size={13} /> Proof
                  </button>
                )}
                <button disabled={busy === r.quotation_number} style={btn('#15803d')} onClick={() => approve(r)}><CheckCircle2 size={13} /> Approve → Ship Desk</button>
                <button disabled={busy === r.quotation_number} style={btn('#b45309')} onClick={() => setPartial({ row: r, amount: '', note: '' })}><Clock size={13} /> Partial</button>
                <button disabled={busy === r.quotation_number} style={btn(T.iron700)} onClick={() => setModify({ row: r, qty: Object.fromEntries((r.items || []).map((it, i) => [i, it.quantity])) })}><Pencil size={13} /> Modify</button>
                <button disabled={busy === r.quotation_number} style={btn('#fef2f2', '#b91c1c')} onClick={() => reject(r)}><Ban size={13} /> Reject</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Proof viewer */}
      {proof && (
        <Overlay onClose={() => setProof(null)} title={`Payment proof — ${proof.number}`}>
          <ProofView number={proof.number} token={token} />
        </Overlay>
      )}

      {/* Partial-payment */}
      {partial && (
        <Overlay onClose={() => setPartial(null)} title={`Record partial payment — ${partial.row.quotation_number}`}>
          <div style={{ fontSize: 12.5, color: T.iron600, marginBottom: 8 }}>PI total {inr(partial.row.grand_total)}. Record what the customer has actually paid; the PI stays on hold until the balance comes in.</div>
          <label style={{ fontSize: 11, color: T.iron500 }}>Amount received</label>
          <input type="number" value={partial.amount} autoFocus onChange={(e) => setPartial({ ...partial, amount: e.target.value })}
            style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid ' + T.iron300, padding: '0 10px', fontSize: 15, fontWeight: 700, boxSizing: 'border-box', marginBottom: 8 }} />
          <input placeholder="Note (optional)" value={partial.note} onChange={(e) => setPartial({ ...partial, note: e.target.value })}
            style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid ' + T.iron300, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' }} />
          <button style={{ ...btn('#b45309'), width: '100%', justifyContent: 'center', height: 44, marginTop: 12 }}
            onClick={() => {
              const a = parseFloat(partial.amount);
              if (!a || a <= 0) { toast.error('Enter the amount received'); return; }
              act(partial.row.quotation_number, { action: 'partial', amount_received: a, note: partial.note || undefined }, 'Partial payment recorded — on hold');
            }}>Record & hold for balance</button>
        </Overlay>
      )}

      {/* Modify quantities */}
      {modify && (
        <Overlay onClose={() => setModify(null)} title={`Modify order — ${modify.row.quotation_number}`}>
          <div style={{ fontSize: 12.5, color: T.iron600, marginBottom: 10 }}>Reduce quantities to match what the customer actually paid for. Setting a line to 0 removes it. Totals recompute automatically.</div>
          {(modify.row.items || []).map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px dashed ' + T.iron100 }}>
              <span style={{ fontSize: 13, color: T.iron800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
              <input type="number" min={0} value={modify.qty[i]} onChange={(e) => setModify({ ...modify, qty: { ...modify.qty, [i]: e.target.value } })}
                style={{ width: 74, height: 36, borderRadius: 8, border: '1px solid ' + T.iron300, padding: '0 8px', fontSize: 14, fontWeight: 700, textAlign: 'center' }} />
            </div>
          ))}
          <button style={{ ...btn(T.iron800), width: '100%', justifyContent: 'center', height: 44, marginTop: 12 }}
            onClick={() => {
              const items = (modify.row.items || []).map((it, i) => ({ index: i, quantity: parseInt(modify.qty[i] || 0, 10) }));
              act(modify.row.quotation_number, { action: 'modify', items }, 'Order updated — still awaiting approval');
            }}>Save new quantities</button>
        </Overlay>
      )}
    </IronShell>
  );
}

function Overlay({ title, children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 18, width: 'min(520px, 96vw)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 16, color: T.iron900 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron400 }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProofView({ number, token }) {
  const [src, setSrc] = useState(null);
  const [pdf, setPdf] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let obj;
    (async () => {
      try {
        const res = await axios.get(`${API}/quotations/${encodeURIComponent(number)}/payment-proof`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
        setPdf((res.data.type || '').includes('pdf'));
        obj = URL.createObjectURL(res.data);
        setSrc(obj);
      } catch (e) { setErr(true); }
    })();
    return () => { if (obj) URL.revokeObjectURL(obj); };
  }, [number, token]);
  if (err) return <div style={{ color: T.iron400, textAlign: 'center', padding: 24 }}>Could not load the proof file.</div>;
  if (!src) return <div style={{ color: T.iron400, textAlign: 'center', padding: 24 }}>Loading…</div>;
  return (
    <div style={{ textAlign: 'center' }}>
      {pdf
        ? <iframe title="proof" src={src} style={{ width: '100%', height: '70vh', border: '1px solid ' + T.iron200, borderRadius: 8 }} />
        : <img src={src} alt="payment proof" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, border: '1px solid ' + T.iron200 }} />}
    </div>
  );
}
