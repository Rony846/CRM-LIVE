import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import IronShell from '@/components/iron/IronShell';
import { T, Caps } from '@/components/iron/IronKit';
import { useChat } from '@/components/chat/ChatProvider';
import ChatChannelList from '@/components/chat/ChatChannelList';
import ChatConversation from '@/components/chat/ChatConversation';
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary';
import { openChatPopout } from '@/components/chat/chatUtils';
import { MessageSquare, ExternalLink } from 'lucide-react';

// The chat surface itself — shared between the in-dashboard full page and the
// standalone popped-out window. Restyled to Iron Console; behavior is identical
// (channel list + live conversation + popout + connection indicator).
function ChatSurface({ popout = false }) {
  const chat = useChat();
  return (
    <div
      data-testid="chat-page"
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 8,
        border: `1px solid ${T.iron200}`,
        background: T.white,
        boxShadow: '0 1px 2px rgba(15,15,15,.06)',
      }}
    >
      <div
        className="chat-channel-rail"
        style={{
          width: 288,
          flexShrink: 0,
          borderRight: `1px solid ${T.iron200}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${T.iron200}`,
            background: T.iron50,
            padding: '12px 16px',
          }}
        >
          <MessageSquare size={18} strokeWidth={1.9} color={T.orange} />
          <Caps size={11} color={T.iron900} ls=".08em">Team Chat</Caps>
          <span
            title={chat.connected ? 'Connected' : 'Reconnecting…'}
            style={{
              marginLeft: 'auto',
              height: 8,
              width: 8,
              borderRadius: 999,
              background: chat.connected ? T.green : T.voltage,
              display: 'inline-block',
            }}
          />
          {!popout && (
            <button
              onClick={openChatPopout}
              data-testid="chat-popout"
              title="Open in a new window"
              style={{
                border: 'none',
                background: 'transparent',
                borderRadius: 4,
                padding: 3,
                cursor: 'pointer',
                color: T.iron500,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ExternalLink size={14} strokeWidth={1.9} />
            </button>
          )}
        </div>
        <div style={{ minHeight: 0, flex: 1, overflow: 'hidden' }}>
          <ChatChannelList />
        </div>
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatConversation />
      </div>
    </div>
  );
}

export default function ChatPage() {
  const chat = useChat();
  const location = useLocation();
  const popout = new URLSearchParams(location.search).get('popout') === '1';

  // Mark the conversation as actively viewed while on this page (drives read state).
  useEffect(() => {
    if (!chat) return;
    chat.setOpen(true);
    if (!chat.activeId && chat.channels.length) {
      const general = chat.channels.find((c) => c.slug === 'general') || chat.channels[0];
      chat.openChannel(general.id);
    }
    return () => chat.setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.channels.length]);

  // A popped-out window is a clean, chrome-less standalone chat client (no shell).
  if (popout) {
    if (!chat) {
      return (
        <div style={{ display: 'grid', height: '100vh', placeItems: 'center', color: T.iron500, fontFamily: T.body }}>
          Chat is unavailable for your role.
        </div>
      );
    }
    return (
      <div style={{ height: '100vh', width: '100vw', background: T.iron50, padding: 8 }}>
        <ChatErrorBoundary><ChatSurface popout /></ChatErrorBoundary>
      </div>
    );
  }

  if (!chat) {
    return (
      <IronShell title="Team Chat" subtitle="INTERNAL / REALTIME">
        <div style={{ padding: 24, color: T.iron500, fontFamily: T.body }}>Chat is unavailable for your role.</div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Team Chat" subtitle="INTERNAL / REALTIME">
      <div style={{ height: 'calc(100vh - 58px - 44px)' }}>
        <ChatErrorBoundary><ChatSurface /></ChatErrorBoundary>
      </div>
    </IronShell>
  );
}
