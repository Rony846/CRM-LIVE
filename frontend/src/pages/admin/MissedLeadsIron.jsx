import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { AlertTriangle, CheckCircle2, ShoppingCart, Handshake, HelpCircle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Admin audit of sales/dealership intent detected on customer WhatsApp: what auto-became a lead,
// and what needs a human look (possible interest, or a failed capture). Backed by /admin/missed-leads.

const selectStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const INTENT = {
  sales: { label: 'Sales', icon: ShoppingCart, tone: 'ok' },
  dealership: { label: 'Dealership', icon: Handshake, tone: 'violet' },
  possible: { label: 'Possible', icon: HelpCircle, tone: 'warn' },
};

const Tile = ({ icon: Icon, label, value, color = T.iron900 }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icon ? <Icon size={13} strokeWidth={1.9} color={T.iron400} /> : null}
      <Caps size={9} color={T.iron400}>{label}</Caps>
    </div>
    <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, fontFamily: T.headline, color, ...mono }}>{value}</div>
  </IronCard>
);

function Row({ r }) {
  const meta = INTENT[r.intent] || INTENT.possible;
  const Icon = meta.icon;
  return (
    <tr className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, verticalAlign: 'top' }}>
      <td style={tdCell}>
        <div style={{ fontWeight: 600, color: T.iron900 }}>{r.name || '—'}</div>
        <div style={{ ...mono, fontSize: 11.5, color: T.iron500 }}>{r.phone}</div>
      </td>
      <td style={tdCell}>
        <span style={{ ...badgeStyle(meta.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon size={11} strokeWidth={2} />{meta.label}
        </span>
      </td>
      <td style={{ ...tdCell, maxWidth: 420, color: T.iron700 }}>{r.text}</td>
      <td style={{ ...tdCell, textAlign: 'center', whiteSpace: 'nowrap' }}>
        {r.captured
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: T.green }}><CheckCircle2 size={13} strokeWidth={2} /> Lead created</span>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: T.voltageText }}><AlertTriangle size={13} strokeWidth={2} /> Needs review</span>}
      </td>
      <td style={{ ...tdCell, whiteSpace: 'nowrap', ...mono, fontSize: 11.5, color: T.iron500 }}>
        {(r.created_at || '').slice(0, 16).replace('T', ' ')}
      </td>
    </tr>
  );
}

export default function MissedLeads() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [tab, setTab] = useState('missed'); // missed | captured

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/missed-leads`, {
        params: { days }, headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const rows = (tab === 'missed' ? data?.missed : data?.captured) || [];

  const H = ['Customer', 'Intent', 'Message', 'Outcome', 'When'];

  const headerRight = (
    <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={selectStyle}>
      <option value={7}>Last 7 days</option>
      <option value={14}>Last 14 days</option>
      <option value={30}>Last 30 days</option>
    </select>
  );

  return (
    <IronShell title="Missed Leads" subtitle="WHATSAPP LEAD AUDIT" onRefresh={load} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 19, color: T.iron900 }}>WhatsApp Lead Audit</div>
          <div style={{ fontSize: 13, color: T.iron500, marginTop: 2 }}>
            Sales &amp; dealership intent detected on customer WhatsApp — captured leads vs ones to review
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Tile icon={ShoppingCart} label="Intents detected" value={s.detected ?? '—'} />
          <Tile icon={CheckCircle2} label="Leads captured" value={s.captured ?? '—'} color={T.green} />
          <Tile icon={AlertTriangle} label="Needs review" value={s.needs_review ?? '—'} color={s.needs_review > 0 ? T.voltageText : T.iron900} />
          <Tile icon={Handshake} label="Dealership intents" value={s.by_intent?.dealership ?? 0} color="#6D4AB0" />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {[['missed', `Needs review (${s.needs_review ?? 0})`], ['captured', `Captured (${s.captured ?? 0})`]].map(([k, lbl]) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)} style={{
                borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                border: active ? 'none' : `1px solid ${T.iron200}`,
                background: active ? T.orange : T.white,
                color: active ? '#fff' : T.iron700,
              }}>
                {lbl}
              </button>
            );
          })}
        </div>

        <IronCard pad={0} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {H.map((h, i) => (
                  <th key={h} style={{ ...thCell, textAlign: i === 3 ? 'center' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: '40px 12px', textAlign: 'center', color: T.iron400, fontSize: 13 }}>Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '40px 12px', textAlign: 'center', color: T.iron400, fontSize: 13 }}>
                  {tab === 'missed' ? 'Nothing needs review 🎉' : 'No captured leads in this window.'}
                </td></tr>
              )}
              {!loading && rows.map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </IronCard>
      </div>
    </IronShell>
  );
}
