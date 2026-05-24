import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
  MessageCircle, Loader2, QrCode, RefreshCw, LogOut, Send, CheckCircle2,
  AlertTriangle, XCircle, Smartphone, Bot, History, Sparkles, Phone, Power,
} from 'lucide-react';

const STATE_META = {
  connected:      { label: 'Connected',          tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle2 },
  authenticated:  { label: 'Authenticated',      tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle2 },
  qr_ready:       { label: 'QR Ready — Scan Now', tone: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',     icon: QrCode },
  disconnected:   { label: 'Disconnected',       tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',        icon: XCircle },
  auth_failed:    { label: 'Auth Failed',        tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',        icon: AlertTriangle },
};

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

  return (
    <DashboardLayout title="WhatsApp AI Agent">
      <div className="space-y-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" /> WhatsApp AI Agent
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pair a dedicated phone and chat with the CRM in natural language. Powered by Claude.
            </p>
          </div>
          <Badge className={`${meta.tone} font-mono text-[11px] uppercase tracking-wider px-3 py-1.5`}>
            <Icon className={`w-3.5 h-3.5 mr-1.5 ${state === 'qr_ready' ? 'animate-pulse' : ''}`} />
            {meta.label}
          </Badge>
        </div>

        {loading ? (
          <Card className="mg-card border-border">
            <CardContent className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: connection panel */}
            <Card className="mg-card border-border">
              <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" /> Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 text-center">
                {qrDataUrl && !isConnected && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Open WhatsApp on your <strong>dedicated agent phone</strong> → Settings → Linked Devices → Link a Device → scan this QR.
                    </p>
                    <div className="inline-block p-3 bg-white rounded-lg shadow-soft-lg">
                      <img src={qrDataUrl} alt="WhatsApp QR" className="w-72 h-72" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 font-mono">
                      QR auto-rotates every ~30s. Page polls every 5s.
                    </p>
                  </>
                )}

                {isConnected && (
                  <>
                    <div className="py-6">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <div className="text-foreground font-semibold mb-1">WhatsApp connected ✓</div>
                      <p className="text-sm text-muted-foreground">
                        The agent is live. Anyone messaging this number — after entering the auth code <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono">Rony846</code> — will chat with Claude.
                      </p>
                    </div>
                  </>
                )}

                {state === 'disconnected' && !qrDataUrl && (
                  <div className="py-6">
                    <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                    <div className="text-foreground font-semibold mb-1">Bridge offline</div>
                    <p className="text-sm text-muted-foreground">
                      The bridge process isn't responding. Check pm2 logs (<code>pm2 logs crm-wa-bridge</code>) or click Restart below.
                    </p>
                  </div>
                )}

                {state === 'auth_failed' && (
                  <div className="py-6">
                    <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                    <div className="text-foreground font-semibold mb-1">Authentication failed</div>
                    <p className="text-sm text-muted-foreground">
                      The previous WhatsApp session was invalidated. Click "Logout & Re-pair" to start fresh.
                    </p>
                  </div>
                )}

                {status?.error && state !== 'qr_ready' && state !== 'connected' && (
                  <div className="mt-4 text-xs text-muted-foreground font-mono">Last error: {status.error}</div>
                )}

                <div className="mt-6 flex justify-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={fetchStatus} className="border-border">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                  </Button>
                  <Button size="sm" variant="outline" onClick={restartBridge} disabled={restarting} className="border-border">
                    {restarting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}
                    Restart Bridge
                  </Button>
                  <Button size="sm" variant="outline" onClick={logoutSession} disabled={loggingOut} className="border-border text-rose-400">
                    {loggingOut ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}
                    Logout &amp; Re-pair
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: how-to + send test */}
            <div className="space-y-4">
              <Card className="mg-card border-border">
                <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> What the agent can do
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 text-sm space-y-2">
                  <FeatureRow label="Inventory + Stock" hint="What's the stock of MG-IN-1100?" />
                  <FeatureRow label="Sales + Reports" hint="Show today's sales summary" />
                  <FeatureRow label="Party Management" hint="Find party Ramesh Distributors" />
                  <FeatureRow label="Purchases + Payments" hint="Record ₹15,000 from Ramesh on UPI" />
                  <FeatureRow label="Document Analysis" hint="Send a PDF — invoice, manual, anything" />
                  <FeatureRow label="Amazon Orders" hint="Any pending Amazon orders?" />
                  <div className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                    Model: <span className="font-mono text-foreground">claude-sonnet-4-6</span> · Tool count: <span className="font-mono text-foreground">19</span> · Auth code: <span className="font-mono text-primary">Rony846</span>
                  </div>
                </CardContent>
              </Card>

              {isConnected && (
                <Card className="mg-card border-border">
                  <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Send className="w-4 h-4 text-primary" /> Send a test message
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-2">
                    <Input placeholder="Phone (10-digit or +91-prefixed)" value={sendForm.to} onChange={(e) => setSendForm(f => ({ ...f, to: e.target.value }))}
                           className="bg-background border-border text-foreground font-mono" />
                    <Input placeholder="Message" value={sendForm.message} onChange={(e) => setSendForm(f => ({ ...f, message: e.target.value }))}
                           className="bg-background border-border text-foreground" />
                    <Button onClick={sendTest} disabled={sending} className="bg-primary text-primary-foreground w-full">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Send</>}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Useful for verifying the bridge can push messages to a phone. The AI brain isn't invoked for sends initiated here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Conversations (if available) */}
        {conversations.length > 0 && (
          <Card className="mg-card border-border">
            <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Recent Conversations ({conversations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Last Activity</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Messages</th>
                    <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Authed</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map(c => (
                    <tr key={c.user_number} className="border-b border-border/40 hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-foreground">{c.user_number}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(c.last_activity || '').slice(0, 19).replace('T', ' ')}</td>
                      <td className="px-4 py-3 text-foreground">{(c.messages || []).length}</td>
                      <td className="px-4 py-3">
                        {c.is_authenticated ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase">Yes</Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground font-mono text-[10px] uppercase">No</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function FeatureRow({ label, hint }) {
  return (
    <div className="flex items-start gap-3">
      <Bot className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground italic">"{hint}"</div>
      </div>
    </div>
  );
}
