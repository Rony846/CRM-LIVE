import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';

const INTERNAL_ROLES = ['admin', 'supervisor', 'call_support', 'service_agent', 'technician', 'accountant', 'dispatcher', 'gate'];

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);
export const isInternalRole = (role) => INTERNAL_ROLES.includes(role);

export function ChatProvider({ children }) {
  const { user, token } = useAuth();
  const enabled = !!user && isInternalRole(user.role);

  const [channels, setChannels] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [messages, setMessages] = useState({});      // { channelId: [msg] }
  const [activeId, setActiveId] = useState(null);
  const [typing, setTyping] = useState({});          // { channelId: { userId: {name, ts} } }
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);           // dock/page actively viewing
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [reads, setReads] = useState({}); // { channelId: { userId: {name, at} } }

  const headers = { Authorization: `Bearer ${token}` };
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const openRef = useRef(open); openRef.current = open;
  const esRef = useRef(null);

  // ---- data loaders -------------------------------------------------------
  const refreshChannels = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/chat/channels`, { headers });
      setChannels(r.data.channels || []);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refreshDirectory = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/chat/directory`, { headers });
      setDirectory(r.data.users || []);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const markRead = useCallback(async (channelId) => {
    setChannels((cs) => cs.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)));
    try { await axios.post(`${API}/chat/channels/${channelId}/read`, {}, { headers }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openChannel = useCallback(async (channelId) => {
    setActiveId(channelId);
    if (!messages[channelId]) {
      try {
        const r = await axios.get(`${API}/chat/channels/${channelId}/messages`, { headers });
        setMessages((m) => ({ ...m, [channelId]: r.data.messages || [] }));
      } catch { /* ignore */ }
    }
    markRead(channelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, token, markRead]);

  const loadOlder = useCallback(async (channelId) => {
    const cur = messages[channelId] || [];
    if (!cur.length) return;
    try {
      const r = await axios.get(`${API}/chat/channels/${channelId}/messages`, { headers, params: { before: cur[0].created_at } });
      const older = r.data.messages || [];
      if (older.length) setMessages((m) => ({ ...m, [channelId]: [...older, ...(m[channelId] || [])] }));
      return older.length;
    } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, token]);

  const sendMessage = useCallback(async (channelId, body, attachments, mentions) => {
    const r = await axios.post(`${API}/chat/channels/${channelId}/messages`,
      { body, attachments: attachments || [], mentions: mentions || [] }, { headers });
    // optimistic append (the SSE echo is filtered by id)
    const msg = r.data.message;
    if (msg) {
      setMessages((m) => {
        const arr = m[channelId] || [];
        if (arr.some((x) => x.id === msg.id)) return m;
        return { ...m, [channelId]: [...arr, msg] };
      });
    }
    return msg;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const react = useCallback(async (messageId, emoji) => {
    try { await axios.post(`${API}/chat/messages/${messageId}/react`, { emoji }, { headers }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const editMessage = useCallback(async (messageId, body) => {
    try { await axios.patch(`${API}/chat/messages/${messageId}`, { body }, { headers }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const deleteMessage = useCallback(async (messageId) => {
    try { await axios.delete(`${API}/chat/messages/${messageId}`, { headers }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const createChannel = useCallback(async (payload) => {
    const r = await axios.post(`${API}/chat/channels`, payload, { headers });
    await refreshChannels();
    return r.data.channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshChannels]);

  const openDM = useCallback(async (userId) => {
    const r = await axios.post(`${API}/chat/dm/${userId}`, {}, { headers });
    await refreshChannels();
    await openChannel(r.data.channel.id);
    return r.data.channel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshChannels, openChannel]);

  const uploadFile = useCallback(async (file) => {
    const fd = new FormData(); fd.append('file', file);
    const r = await axios.post(`${API}/chat/upload`, fd, { headers });
    return r.data; // {url, name, type, size}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sendTyping = useCallback((channelId) => {
    axios.post(`${API}/chat/channels/${channelId}/typing`, {}, { headers }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resolveAction = useCallback(async (messageId, confirm) => {
    await axios.post(`${API}/chat/actions/${messageId}/${confirm ? 'confirm' : 'cancel'}`, {}, { headers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pinMessage = useCallback(async (id) => {
    try { await axios.post(`${API}/chat/messages/${id}/pin`, {}, { headers }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveMessage = useCallback(async (id) => {
    try {
      const r = await axios.post(`${API}/chat/messages/${id}/save`, {}, { headers });
      setSavedIds((s) => { const n = new Set(s); r.data.saved ? n.add(id) : n.delete(id); return n; });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const muteChannel = useCallback(async (id) => {
    try {
      const r = await axios.post(`${API}/chat/channels/${id}/mute`, {}, { headers });
      setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, muted: r.data.muted } : c)));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchSaved = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/chat/saved`, { headers });
      setSavedIds(new Set((r.data.saved || []).map((m) => m.id)));
      return r.data.saved || [];
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchPins = useCallback(async (channelId) => {
    try { const r = await axios.get(`${API}/chat/channels/${channelId}/pins`, { headers }); return r.data.pins || []; }
    catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchReads = useCallback(async (channelId) => {
    try { const r = await axios.get(`${API}/chat/channels/${channelId}/reads`, { headers }); setReads((rr) => ({ ...rr, [channelId]: r.data.reads || {} })); }
    catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const editChannel = useCallback(async (id, payload) => {
    await axios.patch(`${API}/chat/channels/${id}`, payload, { headers });
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, ...payload } : c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addMembers = useCallback(async (id, userIds) => {
    const r = await axios.post(`${API}/chat/channels/${id}/members`, { user_ids: userIds }, { headers });
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, members: r.data.members } : c)));
    return r.data.members;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const removeMember = useCallback(async (id, userId) => {
    const r = await axios.delete(`${API}/chat/channels/${id}/members/${userId}`, { headers });
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, members: r.data.members } : c)));
    return r.data.members;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const createNudge = useCallback(async (messageId, assigneeId, intervalMin) => {
    const r = await axios.post(`${API}/chat/messages/${messageId}/nudge`,
      { assignee_id: assigneeId, interval_min: intervalMin }, { headers });
    return r.data.nudge;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resolveNudge = useCallback(async (nudgeId) => {
    await axios.post(`${API}/chat/nudges/${nudgeId}/done`, {}, { headers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---- SSE stream ---------------------------------------------------------
  useEffect(() => {
    if (!enabled || !token) return;
    refreshChannels(); refreshDirectory(); fetchSaved();
    const es = new EventSource(`${API}/chat/stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource auto-reconnects
    es.addEventListener('chat', (ev) => {
      let e; try { e = JSON.parse(ev.data); } catch { return; }
      if (e.type === 'message') {
        const { channel_id, message } = e;
        setMessages((m) => {
          const arr = m[channel_id] || [];
          if (arr.some((x) => x.id === message.id)) return m; // dedupe own echo
          // only append if we've loaded this channel; otherwise leave for lazy load
          if (!m[channel_id]) return m;
          return { ...m, [channel_id]: [...arr, message] };
        });
        const isActiveOpen = openRef.current && activeRef.current === channel_id;
        if (isActiveOpen) {
          markRead(channel_id);
        } else if (message.sender_id !== user.id) {
          setChannels((cs) => {
            const found = cs.find((c) => c.id === channel_id);
            if (!found) { refreshChannels(); return cs; }
            return cs.map((c) => (c.id === channel_id ? { ...c, unread: (c.unread || 0) + 1 } : c));
          });
        }
      } else if (e.type === 'message_update') {
        setMessages((m) => {
          const arr = m[e.channel_id]; if (!arr) return m;
          return { ...m, [e.channel_id]: arr.map((x) => x.id === e.message_id
            ? { ...x, ...(e.deleted !== undefined ? { deleted: e.deleted, ...(e.deleted ? { body: '', attachments: [] } : {}) } : {}), ...(e.body !== undefined ? { body: e.body, edited_at: e.edited_at } : {}), ...(e.action ? { action: e.action } : {}), ...(e.pinned !== undefined ? { pinned: e.pinned } : {}), ...(e.nudge !== undefined ? { nudge: e.nudge } : {}) } : x) };
        });
      } else if (e.type === 'reaction') {
        setMessages((m) => {
          const arr = m[e.channel_id]; if (!arr) return m;
          return { ...m, [e.channel_id]: arr.map((x) => x.id === e.message_id ? { ...x, reactions: e.reactions } : x) };
        });
      } else if (e.type === 'typing') {
        setTyping((t) => ({ ...t, [e.channel_id]: { ...(t[e.channel_id] || {}), [e.user.id]: { name: e.user.name, ts: Date.now() } } }));
      } else if (e.type === 'presence') {
        setDirectory((d) => d.map((u) => (u.id === e.user_id ? { ...u, online: e.online } : u)));
        setChannels((cs) => cs.map((c) => (c.dm_user && c.dm_user.id === e.user_id ? { ...c, dm_user: { ...c.dm_user, online: e.online } } : c)));
      } else if (e.type === 'read') {
        setReads((rr) => ({ ...rr, [e.channel_id]: { ...(rr[e.channel_id] || {}), [e.user.id]: { name: e.user.name, at: e.at } } }));
      } else if (e.type === 'channel_update') {
        setChannels((cs) => cs.map((c) => (c.id === e.channel_id ? { ...c, name: e.name, topic: e.topic } : c)));
      } else if (e.type === 'channel_members') {
        // I may have just been added to (or removed from) a private channel —
        // resync the whole list so it appears/disappears for me.
        if (e.members && !e.members.includes(user?.id)) {
          setChannels((cs) => cs.filter((c) => c.id !== e.channel_id));
          setActiveId((a) => (a === e.channel_id ? null : a));
        } else {
          refreshChannels();
        }
      }
    });
    return () => { es.close(); esRef.current = null; setConnected(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token]);

  // prune stale typing indicators
  useEffect(() => {
    const iv = setInterval(() => {
      setTyping((t) => {
        const now = Date.now(); let changed = false; const next = {};
        for (const ch of Object.keys(t)) {
          const users = {}; for (const uid of Object.keys(t[ch])) { if (now - t[ch][uid].ts < 5000) users[uid] = t[ch][uid]; else changed = true; }
          if (Object.keys(users).length) next[ch] = users;
        }
        return changed ? next : t;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const totalUnread = channels.reduce((s, c) => s + (c.muted ? 0 : (c.unread || 0)), 0);

  if (!enabled) return <>{children}</>;

  const value = {
    user, channels, directory, messages, activeId, typing, connected, open, setOpen,
    totalUnread, refreshChannels, refreshDirectory, openChannel, loadOlder, sendMessage,
    react, editMessage, deleteMessage, createChannel, openDM, uploadFile, sendTyping, markRead, setActiveId, resolveAction,
    savedIds, pinMessage, saveMessage, muteChannel, fetchSaved, fetchPins,
    reads, fetchReads, editChannel, addMembers, removeMember, createNudge, resolveNudge,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
