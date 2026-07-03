import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '../../../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  MessageSquare, RefreshCw, LogOut, CheckCircle,
  XCircle, Loader2, Smartphone, ArrowLeft, Send,
  Bot, User,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

/* WhatsApp AI Agent — Iron Console restyle. 100% behaviour-preserving:
   same axios endpoints (status/qr/conversations/restart/logout/send), same 3s polling,
   same manual-send flow, same conversation drill-down. Only visuals changed. */

export default function WhatsAppAgentPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [status, setStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Manual message state
  const [manualTo, setManualTo] = useState('');
  const [manualMessage, setManualMessage] = useState('');

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/status`, { headers });
      setStatus(res.data);

      // If QR available, fetch it
      if (res.data.state === 'qr_ready' || res.data.qr_available) {
        const qrRes = await axios.get(`${API}/whatsapp/qr`, { headers });
        if (qrRes.data.qr) {
          setQrCode(qrRes.data.qr);
          // Generate QR image URL using a QR code API
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrRes.data.qr)}`;
          setQrImageUrl(qrUrl);
        }
      } else {
        setQrCode(null);
        setQrImageUrl(null);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
      setStatus({ state: 'error', error: err.message });
    }
  }, [token]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/conversations`, { headers });
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [token]);

  // Poll status
  useEffect(() => {
    fetchStatus();
    fetchConversations();

    const interval = setInterval(() => {
      fetchStatus();
      if (status?.state === 'connected') {
        fetchConversations();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchConversations, status?.state]);

  // Restart WhatsApp
  const handleRestart = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/whatsapp/restart`, {}, { headers });
      toast.success('Restarting WhatsApp connection...');
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      toast.error('Failed to restart');
    } finally {
      setLoading(false);
    }
  };

  // Logout WhatsApp
  const handleLogout = async () => {
    if (!window.confirm('This will disconnect WhatsApp and require re-scanning the QR code. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/whatsapp/logout`, {}, { headers });
      toast.success('Logged out. Scan QR code to reconnect.');
      setQrCode(null);
      setQrImageUrl(null);
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      toast.error('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  // Send manual message
  const handleSendMessage = async () => {
    if (!manualTo || !manualMessage) {
      toast.error('Enter phone number and message');
      return;
    }

    setLoading(true);
    try {
      // Format phone number
      let to = manualTo.replace(/[^0-9]/g, '');
      if (!to.endsWith('@c.us')) {
        to = `${to}@c.us`;
      }

      await axios.post(`${API}/whatsapp/send`,
        { to, message: manualMessage },
        { headers }
      );
      toast.success('Message sent!');
      setManualMessage('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  // Status -> Iron pill tone + icon
  const statusMeta = () => {
    switch (status?.state) {
      case 'connected': return { tone: 'ok', icon: <CheckCircle size={14} color={T.green} /> };
      case 'qr_ready': return { tone: 'warn', icon: <Smartphone size={14} color={T.voltageText} className="animate-pulse" /> };
      case 'authenticated': return { tone: 'info', icon: <Loader2 size={14} color={T.blue} className="animate-spin" /> };
      default: return { tone: 'bad', icon: <XCircle size={14} color={T.orangeDeep} /> };
    }
  };
  const sm = statusMeta();

  const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
  const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, height: 34, width: 34, display: 'grid', placeItems: 'center', cursor: 'pointer' };
  const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%', fontFamily: T.body };
  const sectionTitle = { fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 };

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...badgeStyle(sm.tone), display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'capitalize' }}>
        {sm.icon}
        {status?.state || 'Unknown'}
      </span>
      <button onClick={handleRestart} disabled={loading} title="Restart Connection" style={{ ...btnOutline, opacity: loading ? 0.5 : 1 }}>
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      </button>
      {status?.state === 'connected' && (
        <button onClick={handleLogout} disabled={loading} title="Logout" style={{ ...btnOutline, color: T.orangeDeep, opacity: loading ? 0.5 : 1 }}>
          <LogOut size={15} />
        </button>
      )}
    </div>
  );

  return (
    <IronShell title="WhatsApp Agent" subtitle="CONTROL THE CRM FROM WHATSAPP" onRefresh={() => { fetchStatus(); fetchConversations(); }} headerRight={headerRight}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/admin')}
          data-testid="back-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: T.iron500, fontFamily: T.headline, fontWeight: 600, fontSize: 12, cursor: 'pointer', marginBottom: 14, padding: 0 }}
        >
          <ArrowLeft size={14} /> Back to Admin
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
          {/* Left Column - QR Code / Status + How it works */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* QR Code Card */}
            <IronCard pad={18}>
              <div style={sectionTitle}>
                <Smartphone size={17} color={T.orange} /> Connect WhatsApp
              </div>

              {status?.state === 'connected' ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <CheckCircle size={56} color={T.green} style={{ margin: '0 auto 14px' }} />
                  <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.green, margin: 0 }}>Connected!</p>
                  <p style={{ color: T.iron500, fontSize: 13, marginTop: 8 }}>
                    Your WhatsApp is linked. Send a message to this number to interact with your CRM.
                  </p>
                </div>
              ) : qrImageUrl ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ background: T.white, border: `1px solid ${T.iron200}`, padding: 14, borderRadius: 12, display: 'inline-block', marginBottom: 14 }}>
                    <img src={qrImageUrl} alt="WhatsApp QR Code" style={{ width: 256, height: 256 }} />
                  </div>
                  <p style={{ color: T.iron700, fontSize: 13, margin: 0 }}>
                    Scan this QR code with your WhatsApp app to connect
                  </p>
                  <p style={{ color: T.voltageText, fontSize: 12, marginTop: 8 }}>
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <Loader2 size={44} color={T.iron400} className="animate-spin" style={{ margin: '0 auto 14px' }} />
                  <p style={{ color: T.iron500, fontSize: 13 }}>
                    {status?.state === 'bridge_offline'
                      ? 'WhatsApp bridge is starting...'
                      : 'Waiting for QR code...'}
                  </p>
                  <button onClick={handleRestart} style={{ ...btnPrimary, marginTop: 14 }}>
                    Start WhatsApp Connection
                  </button>
                </div>
              )}
            </IronCard>

            {/* How It Works */}
            <IronCard pad={18}>
              <div style={sectionTitle}>How It Works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
                {[
                  ['Scan QR Code', 'Link your WhatsApp by scanning the QR code above'],
                  ['Send Messages', 'Talk naturally - "register this bill", "check my stock", etc.'],
                  ['AI Handles Everything', 'The AI understands your intent and operates the CRM for you'],
                ].map(([t, d], i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 30, height: 30, background: T.orange, color: '#fff', borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>{i + 1}</div>
                    <div>
                      <p style={{ fontWeight: 600, color: T.iron900, margin: 0 }}>{t}</p>
                      <p style={{ color: T.iron500, margin: '2px 0 0' }}>{d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 18, padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                <Caps size={9.5} color={T.orangeDeep}>Example Commands</Caps>
                <ul style={{ fontSize: 12.5, color: T.iron700, margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>"How many pending orders do I have?"</li>
                  <li>"Process 5 Amazon orders"</li>
                  <li>"Register this purchase bill" (with image)</li>
                  <li>"Check stock of whey protein"</li>
                  <li>"What's my daily summary?"</li>
                  <li>"Create a new supplier ABC Trading"</li>
                </ul>
              </div>
            </IronCard>
          </div>

          {/* Right Column - Manual send + Conversations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Manual Send */}
            {status?.state === 'connected' && (
              <IronCard pad={18}>
                <div style={sectionTitle}>
                  <Send size={16} color={T.orange} /> Send Message
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="text"
                    value={manualTo}
                    onChange={(e) => setManualTo(e.target.value)}
                    placeholder="Phone number (e.g., 919876543210)"
                    style={{ ...inputStyle, ...mono }}
                  />
                  <textarea
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !manualTo || !manualMessage}
                    style={{ ...btnPrimary, width: '100%', padding: '10px 14px', opacity: (loading || !manualTo || !manualMessage) ? 0.55 : 1, cursor: (loading || !manualTo || !manualMessage) ? 'not-allowed' : 'pointer' }}
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Send
                  </button>
                </div>
              </IronCard>
            )}

            {/* Recent Conversations */}
            <IronCard pad={18}>
              <div style={sectionTitle}>
                <MessageSquare size={16} color={T.orange} /> Recent Conversations
              </div>

              {conversations.length === 0 ? (
                <p style={{ color: T.iron400, textAlign: 'center', padding: '28px 0', fontSize: 13 }}>
                  No conversations yet. Connect WhatsApp and send a message to start.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 384, overflowY: 'auto' }}>
                  {conversations.map((conv, idx) => (
                    <div
                      key={idx}
                      className="iron-row"
                      onClick={() => setSelectedConversation(conv)}
                      style={{ padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...mono, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{conv.user_number}</span>
                        <span style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>
                          {conv.last_activity ? new Date(conv.last_activity).toLocaleString() : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: T.iron500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.messages?.length > 0
                          ? conv.messages[conv.messages.length - 1]?.content?.slice(0, 50) + '...'
                          : 'No messages'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </IronCard>

            {/* Selected Conversation */}
            {selectedConversation && (
              <IronCard pad={18}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ ...mono, fontWeight: 700, fontSize: 13, color: T.iron900, margin: 0 }}>{selectedConversation.user_number}</h3>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    style={{ border: 'none', background: 'transparent', color: T.iron400, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 256, overflowY: 'auto' }}>
                  {selectedConversation.messages?.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{ display: 'flex', gap: 8, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}
                    >
                      {msg.role === 'assistant' && <Bot size={18} color={T.orange} style={{ flexShrink: 0 }} />}
                      <div style={{
                        maxWidth: '80%', padding: '8px 10px', borderRadius: 8, fontSize: 12.5,
                        background: msg.role === 'user' ? T.orange : T.iron100,
                        color: msg.role === 'user' ? '#fff' : T.iron900,
                        border: msg.role === 'user' ? 'none' : `1px solid ${T.iron200}`,
                      }}>
                        {msg.content}
                      </div>
                      {msg.role === 'user' && <User size={18} color={T.blue} style={{ flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              </IronCard>
            )}
          </div>
        </div>
      </div>
    </IronShell>
  );
}
