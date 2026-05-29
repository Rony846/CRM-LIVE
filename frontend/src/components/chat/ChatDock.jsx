import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat, isInternalRole } from './ChatProvider';
import { useAuth } from '@/App';
import ChatChannelList from './ChatChannelList';
import ChatConversation from './ChatConversation';
import { openChatPopout } from './chatUtils';
import { MessageSquare, ArrowLeft, Maximize2, ChevronDown, ExternalLink } from 'lucide-react';

// Hidden on auth/public pages and the full-screen /chat page (avoids double UI).
const HIDDEN_PREFIXES = ['/login', '/register', '/forgot', '/catalogue', '/chat', '/datasheet', '/verify'];

// Persisted, user-customizable dock size (clamped on read so an old/garbage
// value can never produce an off-screen or tiny panel).
const SIZE_KEY = 'mg.chat.dock.size';
const MIN_W = 320, MIN_H = 360;
const maxW = () => Math.round(window.innerWidth * 0.92);
const maxH = () => Math.round(window.innerHeight * 0.85);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function loadSize() {
  try {
    const s = JSON.parse(localStorage.getItem(SIZE_KEY));
    if (s && s.w && s.h) return { w: clamp(s.w, MIN_W, maxW()), h: clamp(s.h, MIN_H, maxH()) };
  } catch { /* ignore */ }
  return { w: 416, h: 544 }; // 26rem x 34rem defaults
}

export default function ChatDock() {
  const { user } = useAuth();
  const chat = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' | 'convo'
  const [size, setSize] = useState(loadSize);
  const dragRef = useRef(null);

  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  // keep provider's "open" flag in sync so unread/read logic knows we're viewing
  useEffect(() => {
    if (!chat) return;
    chat.setOpen(!hidden && chat.open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  // Drag-to-resize from the top-left grip. The panel is anchored bottom-right,
  // so growing left/upward = subtracting the pointer delta from the start size.
  const onResizeDown = useCallback((e) => {
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    const onMove = (ev) => {
      const d = dragRef.current; if (!d) return;
      setSize({
        w: clamp(d.w + (d.x - ev.clientX), MIN_W, maxW()),
        h: clamp(d.h + (d.y - ev.clientY), MIN_H, maxH()),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      dragRef.current = null; // size is persisted by the effect below
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [size.w, size.h]);

  // Persist the latest size after each resize settles.
  useEffect(() => {
    try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
  }, [size]);

  if (!chat || !user || !isInternalRole(user.role) || hidden) return null;

  const { open, setOpen, totalUnread, activeId, channels } = chat;
  const activeChannel = channels.find((c) => c.id === activeId);

  const launch = () => { setOpen(true); setView(activeId ? 'convo' : 'list'); };

  if (!open) {
    return (
      <button onClick={launch} data-testid="chat-dock-launcher"
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105">
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </button>
    );
  }

  return (
    <div data-testid="chat-dock-panel"
      style={{ width: size.w, height: size.h }}
      className="fixed bottom-5 right-5 z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* resize grip (top-left corner) */}
      <div onPointerDown={onResizeDown} data-testid="chat-dock-resize" title="Drag to resize"
        className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nwse-resize"
        style={{ touchAction: 'none' }}>
        <span className="absolute left-1 top-1 h-2 w-2 rounded-tl border-l-2 border-t-2 border-muted-foreground/50" />
      </div>
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        {view === 'convo' && (
          <button onClick={() => setView('list')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        )}
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{view === 'convo' && activeChannel ? activeChannel.name : 'Team Chat'}</span>
        <span className={`ml-1 h-2 w-2 rounded-full ${chat.connected ? 'bg-[#a4d64c]' : 'bg-amber-400'}`} title={chat.connected ? 'Connected' : 'Reconnecting…'} />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={openChatPopout} data-testid="chat-dock-popout" className="rounded p-1 text-muted-foreground hover:text-foreground" title="Open in a new window"><ExternalLink className="h-3.5 w-3.5" /></button>
          <button onClick={() => { setOpen(false); navigate('/chat'); }} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Open full screen"><Maximize2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Minimize"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {view === 'list'
          ? <ChatChannelList onSelect={() => setView('convo')} />
          : <ChatConversation compact />}
      </div>
    </div>
  );
}
