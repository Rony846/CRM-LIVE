import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Search, AlertTriangle, Play,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px 7px 30px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const sentimentTone = (s) => {
  const v = (s || '').toLowerCase();
  if (v.includes('negative') || v.includes('frustrat') || v.includes('angry')) return 'bad';
  if (v.includes('positive') || v.includes('happy')) return 'ok';
  return 'slate';
};
const urgencyTone = (u) => {
  const v = (u || '').toLowerCase();
  if (v.includes('high') || v.includes('urgent') || v.includes('critical')) return 'warn';
  return 'slate';
};
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const H = ['When', 'Customer', 'Product', 'Issue', 'Urgency', 'Sentiment', 'Rec.'];

export default function AdminOmnidimCalls() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [bySentiment, setBySentiment] = useState({});
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [detail, setDetail] = useState(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/omnidim-calls`, {
        headers, params: { limit: 150, phone: phone || undefined, needs_help: needsHelp || undefined },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setBySentiment(data.by_sentiment || {});
    } catch (e) {
      console.error('omnidim calls load failed', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, needsHelp, token]);

  useEffect(() => { fetchCalls(); }, [needsHelp]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/admin/omnidim-calls/${id}`, { headers });
      setDetail(data);
    } catch (e) { console.error(e); }
  };

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(bySentiment).filter(([k]) => k).map(([k, n]) => (
        <span key={k} style={badgeStyle(sentimentTone(k))}>{k}: {n}</span>
      ))}
    </div>
  );

  return (
    <IronShell
      title="Omnidim Calls"
      subtitle={`${total} CALLS · VOICE-AGENT LOG`}
      onRefresh={fetchCalls}
      headerRight={headerRight}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={18} style={{ color: T.orange }} /> Omnidim Call Log
            </div>
            <div style={{ color: T.iron500, fontSize: 12, marginTop: 2 }}>
              Every voice-agent call — transcript, recording, and the issue raised. {total} total.
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 9, top: 9, color: T.iron400 }} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCalls()}
              placeholder="Search phone…"
              style={{ ...inputStyle, width: 220 }}
            />
          </div>
          <button
            onClick={() => setNeedsHelp((v) => !v)}
            style={needsHelp
              ? { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
              : { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <AlertTriangle size={14} /> Needs help only
          </button>
        </div>

        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {H.map((h) => (
                    <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const uT = urgencyTone(c.urgency);
                  const sT = sentimentTone(c.sentiment);
                  return (
                    <tr key={c.id} onClick={() => openDetail(c.id)} className="iron-row"
                      style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}>
                      <td style={{ ...tdCell, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...mono, color: T.iron500 }}>
                          {c.direction === 'outbound'
                            ? <PhoneOutgoing size={13} style={{ color: T.blue }} />
                            : <PhoneIncoming size={13} style={{ color: T.green }} />}
                          {fmt(c.received_at)}
                        </span>
                      </td>
                      <td style={tdCell}>
                        <div style={{ color: T.iron900, fontWeight: 600 }}>{c.customer_name || '—'}</div>
                        <div style={{ ...mono, color: T.iron400, fontSize: 11 }}>{c.phone || '—'}</div>
                      </td>
                      <td style={tdCell}>{c.product || '—'}</td>
                      <td style={{ ...tdCell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.technical_issue || ''}>
                        {c.technical_issue || <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={tdCell}>
                        {c.urgency ? <span style={badgeStyle(uT)}>{c.urgency}</span> : <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={tdCell}>
                        {c.sentiment ? <span style={badgeStyle(sT)}>{c.sentiment}</span> : <span style={{ color: T.iron400 }}>—</span>}
                      </td>
                      <td style={tdCell}>
                        {c.recording_url
                          ? <a href={c.recording_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: T.orange }}><Play size={15} /></a>
                          : <span style={{ color: T.iron400, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: T.iron400, fontSize: 13 }}>No calls found.</td></tr>
                )}
                {loading && items.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: T.iron400, fontSize: 13 }}>Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </IronCard>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={18} style={{ color: T.orange }} />
              {detail?.customer_name || detail?.phone || 'Call'} — {detail?.phone}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detail.urgency && <span style={badgeStyle(urgencyTone(detail.urgency))}>Urgency: {detail.urgency}</span>}
                {detail.sentiment && <span style={badgeStyle(sentimentTone(detail.sentiment))}>{detail.sentiment}</span>}
                {detail.direction && <span style={badgeStyle('slate')}>{detail.direction}</span>}
                {detail.duration && <span style={badgeStyle('slate')}>{detail.duration}s</span>}
              </div>
              {detail.product && <div><Caps size={9} color={T.iron400}>Product</Caps><div style={{ color: T.iron900 }}>{detail.product}</div></div>}
              {detail.technical_issue && <div><Caps size={9} color={T.iron400}>Issue</Caps><div style={{ color: T.iron900 }}>{detail.technical_issue}</div></div>}
              {detail.summary && <div><Caps size={9} color={T.iron400}>Summary</Caps><div style={{ color: T.iron700 }}>{detail.summary}</div></div>}
              {detail.recording_url && (
                <a href={detail.recording_url} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T.orange, fontSize: 13, fontWeight: 600 }}>
                  <Play size={15} /> Play recording
                </a>
              )}
              {detail.transcript && (
                <div>
                  <Caps size={9} color={T.iron400}>Transcript</Caps>
                  <pre style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: T.iron700, fontSize: 12.5, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 12, maxHeight: 288, overflowY: 'auto', fontFamily: T.body }}>
                    {detail.transcript}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
