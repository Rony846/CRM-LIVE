import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat, isInternalRole } from './ChatProvider';
import { useAuth } from '@/App';
import ChatChannelList from './ChatChannelList';
import ChatConversation from './ChatConversation';
import { MessageSquare, X, ArrowLeft, Maximize2, ChevronDown } from 'lucide-react';

// Hidden on auth/public pages and the full-screen /chat page (avoids double UI).
const HIDDEN_PREFIXES = ['/login', '/register', '/forgot', '/catalogue', '/chat', '/datasheet', '/verify'];

export default function ChatDock() {
  const { user } = useAuth();
  const chat = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' | 'convo'

  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  // keep provider's "open" flag in sync so unread/read logic knows we're viewing
  useEffect(() => {
    if (!chat) return;
    chat.setOpen(!hidden && chat.open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

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
      className="fixed bottom-5 right-5 z-[60] flex h-[34rem] max-h-[80vh] w-[26rem] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
        {view === 'convo' && (
          <button onClick={() => setView('list')} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        )}
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{view === 'convo' && activeChannel ? activeChannel.name : 'Team Chat'}</span>
        <span className={`ml-1 h-2 w-2 rounded-full ${chat.connected ? 'bg-[#a4d64c]' : 'bg-amber-400'}`} title={chat.connected ? 'Connected' : 'Reconnecting…'} />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => { setOpen(false); navigate('/chat'); }} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Open full screen"><Maximize2 className="h-3.5 w-3.5" /></button>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground"><ChevronDown className="h-4 w-4" /></button>
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
