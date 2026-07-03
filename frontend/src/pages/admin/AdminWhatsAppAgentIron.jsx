import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
  MessageCircle, Loader2, QrCode, RefreshCw, LogOut, Send, CheckCircle2,
  AlertTriangle, XCircle, Smartphone, Bot, History, Sparkles, Power,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' };

// Connection-state -> label + Iron badge tone + icon.
const STATE_META = {
  connected:      { label: 'Connected',          tone: 'ok',    icon: CheckCircle2 },
  authenticated:  { label: 'Authenticated',      tone: 'ok',    icon: CheckCircle2 },
  qr_ready:       { label: 'QR Ready — Scan Now', tone: 'warn',  icon: QrCode },
  disconnected:   { label: 'Disconnected',       tone: 'bad',   icon: XCircle },
  auth_failed:    { label: 'Auth Failed',        tone: 'bad',   icon: AlertTriangle },
};

const FEATURES = [
  ['Inventory + Stock', "What's the stock of MG-IN-1100?"],
  ['Sales + Reports', "Show today's sales summary"],
  ['Party Management', 'Find party Ramesh Distributors'],
  ['Purchases + Payments', 'Record ₹15,000 from Ramesh on UPI'],
  ['Document Analysis', 'Send a PDF — invoice, manual, anything'],
  ['Amazon Orders', 'Any pending Amazon orders?'],
];

export default function AdminWhatsAppAgent() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [sendForm, setSendForm] = useState({ to: '', message: '' });
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/whatsapp/status`, { headers: { Authorization: `Bearer ${token}` } });
      setStatus(r.data);
      if (r.data?.qr_available) {
        const qr = await axios.get(`${API}/whatsapp/qr`, { headers: { Authorization: `Bearer ${token}` } });
        if (qr.data?.qr) {
          const dataUrl = await QRCode.toDataURL(qr.data.qr, { width: 320, margin: 1, errorCorrectionLevel: 'L' });
          setQrDataUrl(dataUrl);
        }
      } else {
        setQrDataUrl(null);
      }
    } catch (err) {
      console.warn('whatsapp status fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchConversations = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/whatsapp/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      setConversations(r.data?.conversations || r.data || []);
    } catch (err) {
      /* this endpoint may not be wired, ignore */
    }
  }, [token]);

  // Poll every 5s — QR rotates every ~30s and connection state changes fast
  useEffect(() => {
    if (!token) return;
    fetchStatus();
    fetchConversations();
    pollRef.current = setInterval(() => {
      fetchStatus();
      fetchConversations();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [token, fetchStatus, fetchConversations]);

  const restartBridge = async () => {
    if (!window.confirm('Restart the WhatsApp bridge? You may need to re-scan the QR code.')) return;
    setRestarting(true);
    try {
      await axios.post(`${API}/whatsapp/restart`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Bridge restarting…');
      setTimeout(fetchStatus, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Restart failed');
    } finally {
      setRestarting(false);
    }
  };

  const logoutSession = async () => {
    if (!window.confirm('Log out the WhatsApp session? You will need to re-scan a QR code to reconnect.')) return;
    setLoggingOut(true);
    try {
      await axios.post(`${API}/whatsapp/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Session cleared — new QR code generating');
      setTimeout(fetchStatus, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Logout failed');
    } finally {
      setLoggingOut(false);
    }
  };

  const sendTest = async () => {
    if (!sendForm.to || !sendForm.message) {
      toast.error('Phone number and message both required');
      return;
    }
    setSending(true);
    try {
      // Normalise phone to WhatsApp's <countrycode><number>@c.us format
      const phone = sendForm.to.replace(/\D/g, '');
      const waId = phone.length === 10 ? `91${phone}@c.us` : `${phone}@c.us`;
      await axios.post(`${API}/whatsapp/send`,
        { to: waId, message: sendForm.message },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Sent to ${sendForm.to}`);
      setSendForm({ to: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const state = status?.state || 'disconnected';
  const meta = STATE_META[state] || STATE_META.disconnected;
  const Icon = meta.icon;
  const isConnected = ['connected', 'authenticated'].includes(state);

  const stateBadge = (
    <span style={{ ...badgeStyle(meta.tone), display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 10 }}>
      <Icon size={12} className={state === 'qr_ready' ? 'animate-pulse' : ''} /> {meta.label}
    </span>
  );

  return (
    <IronShell
      title="WhatsApp Agent"
      subtitle="AI OPS · CLAUDE"
      onRefresh={fetchStatus}
      headerRight={stateBadge}
    >
      <div style={{ maxWidth: 1120, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Intro strip */}
        <IronCard pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#FDEEE6', color: T.orangeDeep, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <MessageCircle size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>WhatsApp AI Agent</div>
            <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>
              Pair a dedicated phone and chat with the CRM in natural language. Powered by Claude.
            </div>
          </div>
        </IronCard>

        {loading ? (
          <IronCard pad={0} style={{ padding: 48, display: 'grid', placeItems: 'center' }}>
            <Loader2 className="animate-spin" size={30} color={T.orange} />
          </IronCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
            {/* Left: connection panel */}
            <IronCard pad={0}>
              <div style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={15} color={T.orange} />
                <Caps size={10} color={T.iron700}>Connection</Caps>
              </div>
              <div style={{ padding: 24, textAlign: 'center' }}>
                {qrDataUrl && !isConnected && (
                  <>
                    <p style={{ fontSize: 12.5, color: T.iron500, marginBottom: 16 }}>
                      Open WhatsApp on your <strong>dedicated agent phone</strong> → Settings → Linked Devices → Link a Device → scan this QR.
                    </p>
                    <div style={{ display: 'inline-block', padding: 12, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 10, boxShadow: '0 2px 8px rgba(15,15,15,.08)' }}>
                      <img src={qrDataUrl} alt="WhatsApp QR" style={{ width: 288, height: 288, display: 'block' }} />
                    </div>
                    <p style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 12 }}>
                      QR auto-rotates every ~30s. Page polls every 5s.
                    </p>
                  </>
                )}

                {isConnected && (
                  <div style={{ padding: '24px 0' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: T.greenTint, color: T.green, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                      <CheckCircle2 size={40} />
                    </div>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900, marginBottom: 4 }}>WhatsApp connected ✓</div>
                    <p style={{ fontSize: 12.5, color: T.iron500 }}>
                      The agent is live. Anyone messaging this number — after entering the auth code <code style={{ ...mono, padding: '1px 6px', borderRadius: 4, background: T.iron100, color: T.orangeDeep }}>Rony846</code> — will chat with Claude.
                    </p>
                  </div>
                )}

                {state === 'disconnected' && !qrDataUrl && (
                  <div style={{ padding: '24px 0' }}>
                    <XCircle size={48} color={T.orangeDeep} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900, marginBottom: 4 }}>Bridge offline</div>
                    <p style={{ fontSize: 12.5, color: T.iron500 }}>
                      The bridge process isn't responding. Check pm2 logs (<code style={{ ...mono }}>pm2 logs crm-wa-bridge</code>) or click Restart below.
                    </p>
                  </div>
                )}

                {state === 'auth_failed' && (
                  <div style={{ padding: '24px 0' }}>
                    <AlertTriangle size={48} color={T.orangeDeep} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900, marginBottom: 4 }}>Authentication failed</div>
                    <p style={{ fontSize: 12.5, color: T.iron500 }}>
                      The previous WhatsApp session was invalidated. Click "Logout &amp; Re-pair" to start fresh.
                    </p>
                  </div>
                )}

                {status?.error && state !== 'qr_ready' && state !== 'connected' && (
                  <div style={{ ...mono, marginTop: 16, fontSize: 11, color: T.iron500 }}>Last error: {status.error}</div>
                )}

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={fetchStatus} style={btnOutline}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                  <button onClick={restartBridge} disabled={restarting} style={{ ...btnOutline, opacity: restarting ? 0.6 : 1 }}>
                    {restarting ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />} Restart Bridge
                  </button>
                  <button onClick={logoutSession} disabled={loggingOut} style={{ ...btnOutline, color: T.orangeDeep, opacity: loggingOut ? 0.6 : 1 }}>
                    {loggingOut ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />} Logout &amp; Re-pair
                  </button>
                </div>
              </div>
            </IronCard>

            {/* Right: how-to + send test */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <IronCard pad={0}>
                <div style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={15} color={T.orange} />
                  <Caps size={10} color={T.iron700}>What the agent can do</Caps>
                </div>
                <div style={{ padding: 18 }}>
                  {FEATURES.map(([label, hint]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <Bot size={15} color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.iron900 }}>{label}</div>
                        <div style={{ fontSize: 11.5, color: T.iron500, fontStyle: 'italic' }}>"{hint}"</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                    Model: <span style={{ ...mono, color: T.iron900 }}>claude-sonnet-4-6</span> · Tool count: <span style={{ ...mono, color: T.iron900 }}>19</span> · Auth code: <span style={{ ...mono, color: T.orangeDeep }}>Rony846</span>
                  </div>
                </div>
              </IronCard>

              {isConnected && (
                <IronCard pad={0}>
                  <div style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Send size={15} color={T.orange} />
                    <Caps size={10} color={T.iron700}>Send a test message</Caps>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Phone (10-digit or +91-prefixed)" value={sendForm.to}
                      onChange={(e) => setSendForm(f => ({ ...f, to: e.target.value }))}
                      style={{ ...inputStyle, ...mono }} />
                    <input placeholder="Message" value={sendForm.message}
                      onChange={(e) => setSendForm(f => ({ ...f, message: e.target.value }))}
                      style={inputStyle} />
                    <button onClick={sendTest} disabled={sending} style={{ ...btnPrimary, width: '100%', opacity: sending ? 0.6 : 1 }}>
                      {sending ? <Loader2 size={15} className="animate-spin" /> : <><Send size={15} /> Send</>}
                    </button>
                    <p style={{ fontSize: 11.5, color: T.iron500 }}>
                      Useful for verifying the bridge can push messages to a phone. The AI brain isn't invoked for sends initiated here.
                    </p>
                  </div>
                </IronCard>
              )}
            </div>
          </div>
        )}

        {/* Conversations (if available) */}
        {conversations.length > 0 && (
          <IronCard pad={0}>
            <div style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={15} color={T.orange} />
              <Caps size={10} color={T.iron700}>Recent Conversations ({conversations.length})</Caps>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['User', 'Last Activity', 'Messages', 'Authed'].map(h => (
                      <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conversations.map(c => (
                    <tr key={c.user_number} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{c.user_number}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{(c.last_activity || '').slice(0, 19).replace('T', ' ')}</td>
                      <td style={{ ...tdCell, ...mono }}>{(c.messages || []).length}</td>
                      <td style={tdCell}>
                        {c.is_authenticated ? (
                          <span style={badgeStyle('ok')}>Yes</span>
                        ) : (
                          <span style={badgeStyle('slate')}>No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IronCard>
        )}
      </div>
    </IronShell>
  );
}
