import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, RefreshCw, User, Bot } from 'lucide-react';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const brainLabel = (m) => {
  if (m.direction !== 'outgoing') return null;
  if ((m.brain || '').includes('opus')) return { name: 'Kalpana', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  if ((m.brain || '').includes('haiku')) return { name: 'Pratibha', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
  if (m.kind === 'missed_call') return { name: 'Missed-call', cls: 'bg-slate-600/30 text-slate-300 border-slate-600/50' };
  return { name: 'Bot', cls: 'bg-slate-600/30 text-slate-300 border-slate-600/50' };
};

export default function AdminWhatsAppChats() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  const loadConvos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/whatsapp-chats`, { headers });
      setConvos(data.conversations || []);
    } catch (e) { console.error('chats load failed', e); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openThread = async (phone) => {
    setActive(phone);
    try {
      const { data } = await axios.get(`${API}/admin/whatsapp-chats/${phone}`, { headers });
      setThread(data);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadConvos(); }, [loadConvos]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-emerald-400" /> Customer WhatsApp Chats
          </h1>
          <p className="text-slate-400 text-sm mt-1">What Pratibha &amp; Kalpana are saying to customers (official WhatsApp).</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConvos} className="border-slate-700 text-slate-300">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Conversation list */}
        <Card className="bg-slate-800/60 border-slate-700 overflow-y-auto md:col-span-1">
          {convos.length === 0 && !loading && (
            <div className="p-6 text-center text-slate-500 text-sm">No customer conversations yet.</div>
          )}
          {convos.map((c) => (
            <button key={c.phone} onClick={() => openThread(c.phone)}
              className={`w-full text-left px-4 py-3 border-b border-slate-700/60 hover:bg-slate-700/30 transition-colors
                ${active === c.phone ? 'bg-slate-700/40' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-medium">{c.name || c.phone}</span>
                <span className="text-slate-500 text-[11px]">{fmt(c.last_at).split(',').pop()}</span>
              </div>
              <div className="text-slate-500 text-xs">{c.phone} · {c.messages} msgs</div>
              <div className="text-slate-400 text-xs truncate mt-0.5">
                {c.last_dir === 'outgoing' ? '↩ ' : ''}{c.last_text}
              </div>
            </button>
          ))}
        </Card>

        {/* Thread */}
        <Card className="bg-slate-800/40 border-slate-700 overflow-y-auto md:col-span-2 p-4">
          {!thread && <div className="text-center text-slate-500 text-sm mt-10">Select a conversation to read it.</div>}
          {thread && (
            <>
              <div className="sticky top-0 -mt-4 -mx-4 px-4 py-2 bg-slate-900/80 backdrop-blur border-b border-slate-700 mb-3">
                <span className="text-slate-200 font-semibold">{thread.name || thread.phone}</span>
                <span className="text-slate-500 text-xs ml-2">{thread.phone}</span>
              </div>
              <div className="space-y-3">
                {(thread.messages || []).map((m, i) => {
                  const out = m.direction === 'outgoing';
                  const bl = brainLabel(m);
                  return (
                    <div key={i} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm
                        ${out ? 'bg-emerald-600/20 border border-emerald-600/30 text-slate-100'
                              : 'bg-slate-700/50 border border-slate-600/40 text-slate-200'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {out ? <Bot className="w-3 h-3 text-emerald-400" /> : <User className="w-3 h-3 text-slate-400" />}
                          {bl && <Badge variant="outline" className={`${bl.cls} text-[10px] px-1.5 py-0`}>{bl.name}</Badge>}
                          <span className="text-slate-500 text-[10px]">{fmt(m.received_at || m.ts)}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.text}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
