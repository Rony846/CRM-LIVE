import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Mail, Loader2, RefreshCw, Send, X, Cpu, CircleCheck, CircleAlert, Bot,
} from 'lucide-react';

const CAT_BADGE = {
  sales_lead: 'bg-emerald-100 text-emerald-800',
  support_complaint: 'bg-rose-100 text-rose-800',
  order_query: 'bg-blue-100 text-blue-800',
  dealer: 'bg-violet-100 text-violet-800',
  spam: 'bg-gray-200 text-gray-600',
  other: 'bg-amber-100 text-amber-800',
};
const URG_DOT = { high: 'bg-rose-500', medium: 'bg-amber-500', low: 'bg-emerald-500' };

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
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Email Agent · Pratibha
            </h1>
            <p className="text-muted-foreground">
              Pratibha watches the shared mailbox and stays quiet on customer mail until a teammate
              writes “{status?.trigger_word || 'Pratibha'}, handle this” on the thread (cc the mailbox) —
              then she answers the whole thread. Local AI, no external API.
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* status strip */}
        {status && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-4 w-4" />
              {status.model_ok
                ? <span className="text-emerald-500">Local model online ({status.model})</span>
                : <span className="text-rose-500">Model offline</span>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {status.configured
                ? <><CircleCheck className="h-4 w-4 text-emerald-500" /> {status.mailbox} · {status.trigger_senders_count} can trigger</>
                : <><CircleAlert className="h-4 w-4 text-amber-500" /> Mailbox not configured</>}
            </span>
            <Badge variant="outline" className="text-[11px]">wake word: “{status.trigger_word}”</Badge>
            <Badge className={status.auto_send ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
              {status.auto_send ? 'auto reply-all on trigger' : 'drafts wait for approval'}
            </Badge>
          </div>
        )}

        {status && !status.configured && (
          <Card className="border-amber-500/40">
            <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">To go live, add these to <code>backend/.env</code> and restart:</p>
              <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto">{`EMAIL_AGENT_ENABLED=true
EMAIL_AGENT_EMAIL=service@musclegrid.in
EMAIL_AGENT_PASSWORD=<zoho app password>
EMAIL_AGENT_TRIGGER=Pratibha
EMAIL_AGENT_TRIGGER_SENDERS=@musclegrid.in
EMAIL_AGENT_AUTO_SEND=true`}</pre>
              <p>The brain already works — try it on the “Test” below; the queue fills once the mailbox is live.</p>
            </CardContent>
          </Card>
        )}

        {/* tabs */}
        <div className="flex gap-2">
          {[['needs_review', 'Needs review'], ['replied', 'Replied'], ['observed', 'Observed'], ['all', 'All']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                tab === k ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'}`}>
              {l}{k === 'needs_review' && status?.needs_review ? ` (${status.needs_review})` : ''}
              {k === 'observed' && status?.observed ? ` (${status.observed})` : ''}
            </button>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">{rows.length} email{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
          <CardContent>
            {loading && rows.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No emails here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((m) => (
                  <button key={m.id} onClick={() => setActive(m)}
                    className="w-full text-left py-3 flex items-start gap-3 hover:bg-accent/40 px-2 rounded">
                    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${URG_DOT[m.urgency] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{m.from_name || m.from_addr}</span>
                        <Badge className={CAT_BADGE[m.category] || CAT_BADGE.other}>{(m.category || '').replace(/_/g, ' ')}</Badge>
                        {m.lead_id && <Badge variant="outline" className="text-[10px]">lead created</Badge>}
                        {m.status === 'replied' && <Badge variant="outline" className="text-[10px] text-emerald-500">replied</Badge>}
                      </div>
                      <div className="text-sm truncate">{m.subject || '(no subject)'}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.summary || ''}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReviewDialog email={active} headers={headers} onClose={() => setActive(null)} onDone={refresh} />
    </DashboardLayout>
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
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm max-h-48 overflow-y-auto whitespace-pre-line">
              {email.body || '(empty)'}
            </div>
            {(email.reply_to?.length > 0) && (
              <p className="text-xs text-muted-foreground">
                Reply-all to <span className="text-foreground">{(email.reply_to || []).join(', ')}</span>
                {email.reply_cc?.length ? <> · cc {email.reply_cc.join(', ')}</> : null}
              </p>
            )}
            {email.status === 'replied' && (
              <p className="text-xs text-emerald-500">Sent {email.replied_by_name ? `by ${email.replied_by_name}` : ''}.</p>
            )}
            <div>
              <label className="text-sm font-medium">{email.status === 'replied' ? 'Sent reply' : 'Draft reply (edit before sending)'}</label>
              <textarea
                value={draft} onChange={(e) => setDraft(e.target.value)} rows={6}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={email.category === 'spam' ? 'Classified as spam — usually just dismiss.' : 'Write a reply…'}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {email.model_ok ? 'Drafted by the local AI' : 'Model was offline — write manually'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={dismiss} disabled={busy}>
                  <X className="h-4 w-4 mr-1" /> Dismiss
                </Button>
                <Button onClick={send} disabled={busy || email.status === 'replied'}>
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  {email.status === 'replied' ? 'Already replied' : 'Approve & send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
