import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Mail, Loader2, RefreshCw, Send, X, Cpu, CircleCheck, CircleAlert, Bot,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Category -> Iron pill tone.
const CAT_TONE = {
  sales_lead: 'ok', support_complaint: 'bad', order_query: 'info', dealer: 'violet',
  data_lookup: 'info', action: 'violet', spam: 'slate', other: 'warn',
};
const URG_DOT = { high: T.orangeDeep, medium: T.voltageText, low: T.green };

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const ghostBtn = { border: 'none', background: 'transparent', color: T.orange, fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };

export default function EmailAgent() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('needs_review');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/admin/email-agent/status`, { headers });
      setStatus(r.data);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/email-agent/messages?status=${tab}`, { headers });
      setRows(r.data.messages || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { load(); }, [load]);

  const refresh = () => { loadStatus(); load(); };

  return (
    <IronShell
      title="Email Agent"
      subtitle="PRATIBHA · LOCAL AI MAILBOX WATCHER"
      onRefresh={refresh}
      headerRight={
        <button onClick={refresh} disabled={loading} style={btnOutline}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      }
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
        {/* intro */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={20} color={T.orange} /> Email Agent · Pratibha
            </div>
            <p style={{ color: T.iron500, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              Pratibha watches the shared mailbox and stays quiet on customer mail until a teammate
              writes “{status?.trigger_word || 'Pratibha'}, handle this” on the thread (cc the mailbox) —
              then she answers the whole thread. Local AI, no external API.
            </p>
          </div>
        </div>

        {/* status strip */}
        {status && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 12.5, color: T.iron700 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={14} color={T.iron500} />
              {status.model_ok
                ? <span style={{ color: T.green, fontWeight: 600 }}>Local model online ({status.model})</span>
                : <span style={{ color: T.orangeDeep, fontWeight: 600 }}>Model offline</span>}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {status.configured
                ? <><CircleCheck size={14} color={T.green} /> {status.mailbox} · {status.trigger_senders_count} can trigger</>
                : <><CircleAlert size={14} color={T.voltageText} /> Mailbox not configured</>}
            </span>
            <span style={badgeStyle('slate')}>wake word: “{status.trigger_word}”</span>
            <span style={badgeStyle(status.auto_send ? 'warn' : 'ok')}>
              {status.auto_send ? 'auto-sends simple acknowledgements only' : 'all drafts wait for approval'}
            </span>
            {status.allow_actions
              ? <span style={badgeStyle('violet')}>
                  CRM actions ON · founder {status.founder_email}{status.pending_approvals ? ` · ${status.pending_approvals} awaiting` : ''}
                </span>
              : <span style={badgeStyle('slate')}>CRM actions off</span>}
          </div>
        )}

        {status && !status.configured && (
          <IronCard style={{ borderColor: '#EDDFA6' }}>
            <div style={{ fontSize: 12.5, color: T.iron700, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontWeight: 700, color: T.iron900 }}>To go live, add these to <code style={{ ...mono, fontSize: 11 }}>backend/.env</code> and restart:</p>
              <pre style={{ ...mono, fontSize: 11, background: T.iron100, borderRadius: 6, padding: 8, overflowX: 'auto', margin: 0 }}>{`EMAIL_AGENT_ENABLED=true
EMAIL_AGENT_EMAIL=service@musclegrid.in
EMAIL_AGENT_PASSWORD=<zoho app password>
EMAIL_AGENT_TRIGGER=Pratibha
EMAIL_AGENT_TRIGGER_SENDERS=@musclegrid.in
EMAIL_AGENT_AUTO_SEND=true`}</pre>
              <p>The brain already works — try it on the “Test” below; the queue fills once the mailbox is live.</p>
            </div>
          </IronCard>
        )}

        {/* Founder approvals log */}
        <ApprovalsLog headers={headers} pending={status?.pending_approvals || 0} />

        {/* Try Pratibha — dry run with no mailbox */}
        <TryPratibha headers={headers} />

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['needs_review', 'Needs review'], ['awaiting_approval', 'Awaiting approval'], ['replied', 'Replied'], ['observed', 'Observed'], ['all', 'All']].map(([k, l]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontFamily: T.headline, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${on ? T.orange : T.iron200}`, background: on ? T.orange : T.white, color: on ? '#fff' : T.iron700 }}>
                {l}{k === 'needs_review' && status?.needs_review ? ` (${status.needs_review})` : ''}
                {k === 'observed' && status?.observed ? ` (${status.observed})` : ''}
              </button>
            );
          })}
        </div>

        {/* list */}
        <IronCard pad={0}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9}>{rows.length} email{rows.length === 1 ? '' : 's'}</Caps>
          </div>
          {loading && rows.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 size={30} color={T.iron400} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400 }}>
              <Mail size={44} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: 13 }}>No emails here.</p>
            </div>
          ) : (
            <div>
              {rows.map((m) => (
                <button key={m.id} onClick={() => setActive(m)} className="iron-row"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', border: 'none', borderBottom: `1px solid ${T.iron200}`, background: 'transparent', cursor: 'pointer' }}>
                  <span style={{ marginTop: 6, height: 8, width: 8, borderRadius: 999, flexShrink: 0, background: URG_DOT[m.urgency] || T.iron400 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{m.from_name || m.from_addr}</span>
                      <span style={badgeStyle(CAT_TONE[m.category] || 'warn')}>{(m.category || '').replace(/_/g, ' ')}</span>
                      {m.lead_id && <span style={badgeStyle('slate')}>lead created</span>}
                      {m.status === 'replied' && <span style={badgeStyle('ok')}>replied</span>}
                    </div>
                    <div style={{ fontSize: 13, color: T.iron700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{m.subject || '(no subject)'}</div>
                    <div style={{ fontSize: 11.5, color: T.iron400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.summary || ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </IronCard>
      </div>

      <ReviewDialog email={active} headers={headers} onClose={() => setActive(null)} onDone={refresh} />
    </IronShell>
  );
}

const APPR_TONE = { pending: 'warn', approved: 'ok', declined: 'bad' };
const TIER_LABEL = { 1: 'T1', 2: 'T2 · founder', 3: 'T3 · founder→human' };

function ApprovalsLog({ headers, pending }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/email-agent/approvals`, { headers });
      setRows(r.data.approvals || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <IronCard pad={0}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
          <CircleCheck size={15} color={T.orange} /> Founder approvals
          {pending > 0 && <span style={badgeStyle('warn')}>{pending} pending</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {open && (
            <button onClick={load} disabled={loading} style={ghostBtn} title="Refresh">
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
          <button onClick={() => setOpen((v) => !v)} style={ghostBtn}>{open ? 'Hide' : 'Open'}</button>
        </span>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${T.iron200}`, padding: rows.length === 0 ? 14 : 0 }}>
          {rows.length === 0 ? (
            <p style={{ fontSize: 12.5, color: T.iron500 }}>No approval requests yet. Pratibha emails the founder for Tier 2/3 actions; they show here with the outcome.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['Ref', 'Request', 'Tier', 'Status', 'Outcome', 'When'].map((h) => (
                    <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 11 }}>{a.ref}</td>
                    <td style={{ ...tdCell, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.summary || ''}>{a.summary || a.action}</td>
                    <td style={{ ...tdCell, color: T.iron500, fontSize: 11 }}>{TIER_LABEL[a.tier] || a.tier}</td>
                    <td style={tdCell}><span style={badgeStyle(APPR_TONE[a.status] || 'slate')}>{a.status}</span></td>
                    <td style={{ ...tdCell, maxWidth: 240, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.result || ''}>{a.result || (a.status === 'pending' ? 'awaiting founder reply' : '—')}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, whiteSpace: 'nowrap' }}>{a.requested_at ? new Date(a.requested_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </IronCard>
  );
}

function TryPratibha({ headers }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('Hi Pratibha, please reply to this customer.\n\n----- Original -----\nFrom: ramesh@gmail.com\nI bought a MuscleGrid 5kVA stabilizer last month. It keeps making a humming noise — is this normal or should I worry?');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState(null);

  const run = async () => {
    setBusy(true); setReply(null);
    try {
      const r = await axios.post(`${API}/admin/email-agent/test`, { subject: 'Test', body: text }, { headers });
      setReply(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Test failed');
    } finally { setBusy(false); }
  };

  return (
    <IronCard pad={0}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
          <Cpu size={15} color={T.orange} /> Try Pratibha (dry run — nothing is sent)
        </span>
        <button onClick={() => setOpen((v) => !v)} style={ghostBtn}>{open ? 'Hide' : 'Open'}</button>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${T.iron200}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11.5, color: T.iron500 }}>
            Paste a sample email (as if a teammate forwarded it to Pratibha) and see the reply she’d draft.
            Works with no mailbox — runs the local model only.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: T.body }} />
          <div>
            <button onClick={run} disabled={busy || !text.trim()} style={{ ...btnPrimary, opacity: (busy || !text.trim()) ? 0.6 : 1 }}>
              {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Bot size={14} />}
              Draft a reply
            </button>
          </div>
          {reply && (
            <div style={{ border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 6, padding: 12, fontSize: 13, whiteSpace: 'pre-line', color: T.iron700 }}>
              <div style={{ fontSize: 11, color: T.iron400, marginBottom: 4 }}>
                tag: {reply.category} · {reply.model_ok ? 'model ok' : 'model offline'}
              </div>
              {reply.reply || '(no reply — model offline; check Ollama)'}
            </div>
          )}
        </div>
      )}
    </IronCard>
  );
}

function ReviewDialog({ email, headers, onClose, onDone }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(email?.draft_reply || ''); }, [email]);

  const send = async () => {
    if (!draft.trim()) { toast.error('Reply is empty'); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/email-agent/messages/${email.id}/send`, { body: draft }, { headers });
      toast.success('Reply sent');
      onDone(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
    } finally { setBusy(false); }
  };

  const dismiss = async () => {
    setBusy(true);
    try {
      await axios.post(`${API}/admin/email-agent/messages/${email.id}/dismiss`, {}, { headers });
      toast.success('Dismissed'); onDone(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!email} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{email?.subject || '(no subject)'}</DialogTitle>
          <DialogDescription>
            {email?.from_name ? `${email.from_name} · ` : ''}{email?.from_addr}
            {email?.order_number ? ` · ${email.order_number}` : ''}
            {email?.phone ? ` · ${email.phone}` : ''}
          </DialogDescription>
        </DialogHeader>
        {email && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ border: `1px solid ${T.iron200}`, background: T.iron50, borderRadius: 6, padding: 12, fontSize: 13, maxHeight: 192, overflowY: 'auto', whiteSpace: 'pre-line', color: T.iron700 }}>
              {email.body || '(empty)'}
            </div>
            {(email.reply_to?.length > 0) && (
              <p style={{ fontSize: 11.5, color: T.iron500 }}>
                Reply-all to <span style={{ color: T.iron900 }}>{(email.reply_to || []).join(', ')}</span>
                {email.reply_cc?.length ? <> · cc {email.reply_cc.join(', ')}</> : null}
              </p>
            )}
            {email.status === 'replied' && (
              <p style={{ fontSize: 11.5, color: T.green }}>Sent {email.replied_by_name ? `by ${email.replied_by_name}` : ''}.</p>
            )}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: T.iron900 }}>{email.status === 'replied' ? 'Sent reply' : 'Draft reply (edit before sending)'}</label>
              <textarea
                value={draft} onChange={(e) => setDraft(e.target.value)} rows={6}
                style={{ ...inputStyle, marginTop: 4, width: '100%', resize: 'vertical', fontFamily: T.body }}
                placeholder={email.category === 'spam' ? 'Classified as spam — usually just dismiss.' : 'Write a reply…'}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: T.iron500 }}>
                {email.model_ok ? 'Drafted by the local AI' : 'Model was offline — write manually'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={dismiss} disabled={busy} style={{ ...btnOutline, opacity: busy ? 0.6 : 1 }}>
                  <X size={14} /> Dismiss
                </button>
                <button onClick={send} disabled={busy || email.status === 'replied'} style={{ ...btnPrimary, opacity: (busy || email.status === 'replied') ? 0.6 : 1 }}>
                  {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                  {email.status === 'replied' ? 'Already replied' : 'Approve & send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
