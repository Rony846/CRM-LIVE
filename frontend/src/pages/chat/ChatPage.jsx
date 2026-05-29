import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useChat } from '@/components/chat/ChatProvider';
import ChatChannelList from '@/components/chat/ChatChannelList';
import ChatConversation from '@/components/chat/ChatConversation';
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary';
import { openChatPopout } from '@/components/chat/chatUtils';
import { MessageSquare, ExternalLink } from 'lucide-react';

// The chat surface itself — shared between the in-dashboard full page and the
// standalone popped-out window.
function ChatSurface({ popout = false }) {
  const chat = useChat();
  return (
    <div className="mg-card flex h-full overflow-hidden rounded-lg border border-border bg-card" data-testid="chat-page">
      <div className="hidden w-72 flex-shrink-0 border-r border-border md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-semibold">Team Chat</span>
          <span className={`ml-auto h-2 w-2 rounded-full ${chat.connected ? 'bg-[#a4d64c]' : 'bg-amber-400'}`} title={chat.connected ? 'Connected' : 'Reconnecting…'} />
          {!popout && (
            <button onClick={openChatPopout} data-testid="chat-popout" title="Open in a new window"
              className="rounded p-1 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></button>
          )}
        </div>
        <div className="min-h-0 flex-1"><ChatChannelList /></div>
      </div>
      <div className="min-w-0 flex-1"><ChatConversation /></div>
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

  // A popped-out window is a clean, chrome-less standalone chat client.
  if (popout) {
    if (!chat) return <div className="grid h-screen place-items-center text-muted-foreground">Chat is unavailable for your role.</div>;
    return (
      <div className="h-screen w-screen bg-background p-2">
        <ChatErrorBoundary><ChatSurface popout /></ChatErrorBoundary>
      </div>
    );
  }

  if (!chat) {
    return <DashboardLayout title="Team Chat"><div className="p-6 text-muted-foreground">Chat is unavailable for your role.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout title="Team Chat">
      <div className="p-4" style={{ height: 'calc(100vh - 4rem)' }}>
        <ChatErrorBoundary><ChatSurface /></ChatErrorBoundary>
      </div>
    </DashboardLayout>
  );
}
