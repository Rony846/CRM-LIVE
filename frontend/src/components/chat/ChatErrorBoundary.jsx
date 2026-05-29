import React from 'react';
import { MessageSquare } from 'lucide-react';

// Hard isolation for the whole chat subtree. A crash in ANY chat component must
// never take down the dashboard or make the dock disappear. On error we keep a
// minimal always-present launcher and auto-retry, so chat "never goes away" even
// as it's developed further.
export default class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Log, but never rethrow — the rest of the app must keep working.
    // eslint-disable-next-line no-console
    console.error('[chat] isolated error (dashboard unaffected):', error, info?.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      // Degrade to a minimal launcher that recovers the chat on click —
      // the dock is still here, just reset.
      return (
        <button
          onClick={this.retry}
          title="Team Chat hit a snag — click to reload it"
          data-testid="chat-dock-recover"
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary/80 text-primary-foreground shadow-lg ring-2 ring-amber-400/60 transition-transform hover:scale-105"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      );
    }
    return this.props.children;
  }
}
