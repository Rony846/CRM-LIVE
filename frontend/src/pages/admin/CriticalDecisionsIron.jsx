import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth, API } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';
import { AlertTriangle, Phone, User, Clock } from 'lucide-react';

// Type → colour + label tone. These are the founder's red-flag categories.
const TYPE_STYLE = {
  refund_replacement:  { bg: '#fffbeb', bd: '#fcd34d', fg: '#b45309' },
  return_authenticity: { bg: '#eef2ff', bd: '#c7d2fe', fg: '#4338ca' },
  legal_threat:        { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
  review_warning:      { bg: '#fff1f2', bd: '#fecdd3', fg: '#be123c' },
  ultimatum:           { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
  money_gate:          { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
  other:               { bg: '#f8fafc', bd: '#e2e8f0', fg: '#475569' },
};

const ago = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

export default function CriticalDecisions() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [labels, setLabels] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/critical-decisions`, { headers, params: { status: tab } });
      setRows(data.decisions || []);
      setLabels(data.type_labels || {});
    } catch (e) { toast.error('Failed to load critical decisions'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (row, opt) => {
    const note = window.prompt(`Decision: "${opt.label}"\n\nAdd a note (optional):`, '');
    if (note === null) return; // cancelled
    try {
      const { data } = await axios.post(`${API}/admin/critical-decisions/${row.id}/resolve`,
        { decision: opt.key, decision_label: opt.label, note }, { headers });
      toast.success(data.message || 'Decision recorded');
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to record'); }
  };

  const TABS = [{ k: 'pending', l: 'Pending' }, { k: 'resolved', l: 'Resolved' }];

  return (
    <IronShell title="Critical Decisions" subtitle="FOUNDER RED-FLAG QUEUE" onRefresh={load}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: `1px solid ${T.iron200}`, paddingBottom: 2 }}>
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 16px',
            fontFamily: T.headline, fontWeight: 800, fontSize: 13,
            color: tab === t.k ? T.orange : T.iron500,
            borderBottom: `2px solid ${tab === t.k ? T.orange : 'transparent'}`,
          }}>{t.l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.iron400 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <IronCard pad={40}>
          <div style={{ textAlign: 'center', color: T.iron400 }}>
            {tab === 'pending' ? '✓ No critical decisions pending — all clear.' : 'No resolved decisions yet.'}
          </div>
        </IronCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => {
            const s = TYPE_STYLE[r.type] || TYPE_STYLE.other;
            const resolved = r.status === 'resolved';
            return (
              <IronCard key={r.id} pad={0}>
                <div style={{ padding: 16, borderLeft: `4px solid ${s.fg}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.fg, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
                      {labels[r.type] || r.type}
                    </span>
                    {r.severity === 'critical' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>
                        <AlertTriangle size={12} /> CRITICAL
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', ...mono, fontSize: 11, color: T.iron400, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {ago(r.created_at)}
                    </span>
                  </div>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: T.iron600, marginTop: 5, lineHeight: 1.55 }}>{r.summary}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: T.iron500 }}>
                    {r.customer_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={12} />{r.customer_name}</span>}
                    {r.customer_phone && <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} />{r.customer_phone}</span>}
                    {r.ticket_number && <span style={{ ...mono, color: T.orangeDeep }}>{r.ticket_number}</span>}
                  </div>

                  {resolved ? (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12.5, color: '#15803d' }}>
                      ✓ <b>{r.decision_label || r.decision}</b> — {r.resolved_by}{r.decision_note ? ` · "${r.decision_note}"` : ''}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                      {(r.options || []).map((opt) => (
                        <button key={opt.key} onClick={() => resolve(r, opt)} style={{
                          border: `1px solid ${T.iron300 || T.iron200}`, background: T.white, color: T.iron900,
                          borderRadius: 6, padding: '7px 13px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                          cursor: 'pointer',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = s.bg; e.currentTarget.style.borderColor = s.fg; e.currentTarget.style.color = s.fg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = T.white; e.currentTarget.style.borderColor = (T.iron300 || T.iron200); e.currentTarget.style.color = T.iron900; }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </IronCard>
            );
          })}
        </div>
      )}
    </IronShell>
  );
}
