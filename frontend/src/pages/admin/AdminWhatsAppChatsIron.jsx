import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { User, Bot, Send, Download, Power, MessageCircle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// WhatsApp timestamps arrive as ISO (outgoing/Kommo) OR unix epoch strings (Cloud incoming, s or ms).
const fmt = (v) => {
  if (!v) return '';
  let d;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) { const n = Number(s); d = new Date(n > 1e12 ? n : n * 1000); }
  else d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

// Outgoing message author badge -> label + Iron badge tone.
const brainLabel = (m) => {
  if (m.direction !== 'outgoing') return null;
  if (m.kind === 'human') return { name: m.by || 'Staff', tone: 'violet' };
  if ((m.brain || '').includes('opus')) return { name: 'Kalpana', tone: 'warn' };
  if ((m.brain || '').includes('haiku')) return { name: 'Pratibha', tone: 'info' };
  if (m.kind === 'missed_call') return { name: 'Missed-call', tone: 'slate' };
  return { name: 'Bot', tone: 'slate' };
};

export default function AdminWhatsAppChats() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const fileBase = API.replace(/\/api\/?$/, ''); // media_url already starts with /api/files
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const endRef = useRef(null);

  const loadConvos = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/whatsapp-chats`, { headers, params: q ? { search: q } : {} });
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

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !active) return;
    setSending(true);
    try {
      await axios.post(`${API}/admin/whatsapp-chats/${active}/send`, { text }, { headers });
      setReply('');
      await openThread(active);
    } catch (e) {
      alert(e?.response?.data?.detail || 'Send failed — the customer may be outside the 24-hour window.');
    } finally { setSending(false); }
  };

  const toggleBot = async () => {
    if (!active || !thread) return;
    try {
      await axios.post(`${API}/admin/whatsapp-chats/${active}/bot`, { paused: !thread.bot_paused }, { headers });
      await openThread(active);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadConvos(); }, [loadConvos]);
  // Debounced server-side search across all conversations (not just the loaded page).
  useEffect(() => {
    const id = setTimeout(() => loadConvos(search.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const bubbleIn = { background: T.iron100, border: `1px solid ${T.iron200}`, color: T.iron900 };
  const bubbleOut = { background: '#FDEEE6', border: `1px solid #F6D8BA`, color: T.iron900 };
  // Channel tag → little pill. Cloud = our official line; Kommo = mirrored from Kommo.
  const chPill = (ch) => {
    const on = ch === 'kommo';
    return (
      <span key={ch} style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: 0.3, textTransform: 'uppercase',
        padding: '1px 5px', borderRadius: 4, flexShrink: 0,
        background: on ? '#EEF2FF' : '#ECFDF5', color: on ? '#4338CA' : '#047857',
        border: `1px solid ${on ? '#C7D2FE' : '#A7F3D0'}`,
      }}>{on ? 'Kommo' : 'Cloud'}</span>
    );
  };

  return (
    <IronShell
      title="Customer WhatsApp"
      subtitle="UNIFIED INBOX · CLOUD + KOMMO"
      onRefresh={() => loadConvos(search.trim())}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 17, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={18} color={T.orange} /> Customer WhatsApp Chats
        </div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
          Every customer WhatsApp conversation in one place — <b>Cloud</b> (our official line, Pratibha&nbsp;+&nbsp;Kalpana) and <b>Kommo</b>-mirrored chats.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 14, height: 'calc(100vh - 210px)' }}>
        {/* Conversation list */}
        <IronCard pad={0} style={{ overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: 10, background: T.white, borderBottom: `1px solid ${T.iron200}` }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone or message…"
              style={{ width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {convos.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>No customer conversations yet.</div>
          )}
          {loading && convos.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>Loading…</div>
          )}
          {convos.map((c) => (
            <button
              key={c.phone}
              onClick={() => openThread(c.phone)}
              className="iron-row"
              style={{
                width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none',
                borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer',
                background: active === c.phone ? T.iron50 : T.white,
                borderLeft: active === c.phone ? `3px solid ${T.orange}` : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || c.phone}</span>
                <span style={{ ...mono, fontSize: 10.5, color: T.iron400, flexShrink: 0 }}>{fmt(c.last_at).split(',').pop()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                {(c.channels || []).map(chPill)}
                <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{c.phone} · {c.messages} msgs</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.last_dir === 'outgoing' ? '↩ ' : ''}{c.last_text}
              </div>
            </button>
          ))}
        </IronCard>

        {/* Thread */}
        <IronCard pad={0} style={{ overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {!thread && (
            <div style={{ textAlign: 'center', color: T.iron400, fontSize: 12.5, marginTop: 40 }}>Select a conversation to read it.</div>
          )}
          {thread && (
            <>
              {/* Sticky header */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 2, padding: '10px 16px', background: T.white,
                borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>{thread.name || thread.phone}</span>
                  <span style={{ ...mono, fontSize: 11, color: T.iron400, marginLeft: 8 }}>{thread.phone}</span>
                </div>
                <button
                  onClick={toggleBot}
                  style={{
                    ...badgeStyle(thread.bot_paused ? 'violet' : 'ok'),
                    fontSize: 10, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: 4, flexShrink: 0, textTransform: 'none', letterSpacing: 0,
                  }}
                >
                  <Power size={12} /> {thread.bot_paused ? "You're handling — resume bot" : 'Bot active — take over'}
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(thread.messages || []).map((m, i) => {
                  const out = m.direction === 'outgoing';
                  const bl = brainLabel(m);
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '78%', borderRadius: 12, padding: '8px 12px', fontSize: 12.5, ...(out ? bubbleOut : bubbleIn) }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          {out ? <Bot size={12} color={T.orange} /> : <User size={12} color={T.iron400} />}
                          {bl && <span style={{ ...badgeStyle(bl.tone), fontSize: 9, padding: '1px 6px' }}>{bl.name}</span>}
                          {m.channel === 'kommo' && chPill('kommo')}
                          <span style={{ ...mono, fontSize: 9.5, color: T.iron400 }}>{fmt(m.received_at || m.ts)}</span>
                        </div>
                        {m.media_url && (
                          (m.media_type || '').startsWith('image')
                            ? <img src={`${fileBase}${m.media_url}`} alt="attachment" style={{ borderRadius: 8, maxHeight: 256, marginBottom: 4, display: 'block' }} />
                            : (m.media_type || '').startsWith('video')
                              ? <video src={`${fileBase}${m.media_url}`} controls style={{ borderRadius: 8, maxHeight: 256, marginBottom: 4, display: 'block', width: '100%' }} />
                              : (m.media_type || '').startsWith('audio')
                                ? <audio src={`${fileBase}${m.media_url}`} controls style={{ marginBottom: 4, display: 'block', width: '100%' }} />
                                : <a href={`${fileBase}${m.media_url}`} target="_blank" rel="noreferrer"
                                     style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.orangeDeep, textDecoration: 'underline', marginBottom: 4 }}>📄 Open file</a>
                        )}
                        {m.media_url && (
                          <a href={`${fileBase}${m.media_url}`} download target="_blank" rel="noreferrer"
                             style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.iron500, marginBottom: 4, textDecoration: 'none' }}>
                            <Download size={12} /> Download
                          </a>
                        )}
                        {m.text && !/^\[(image|video|document|audio|voice|sticker)\]$/i.test(m.text.trim()) && (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Sticky reply bar — staff jumps in (this pauses the bot) */}
              <div style={{
                position: 'sticky', bottom: 0, zIndex: 2, padding: '10px 16px', background: T.white,
                borderTop: `1px solid ${T.iron200}`, display: 'flex', gap: 8,
              }}>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder={thread.bot_paused ? 'Type a message to the customer…' : 'Type to reply (this pauses the bot)…'}
                  style={{ flex: 1, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 11px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' }}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  style={{
                    border: 'none', background: sending || !reply.trim() ? T.iron200 : T.orange, color: '#fff',
                    borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                    cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
