import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Send, Bot, User, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API = process.env.REACT_APP_BACKEND_URL;

const AIChatWidget = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your AI-powered CRM assistant. I have full access to your order data and can help you:

• **Search & analyze orders** - Just paste an order ID or ask about any order
• **Check dispatch status** - I'll tell you if an order is stuck or dispatched
• **Fix issues automatically** - Missing data, duplicate detection, serial reservation
• **Provide insights** - Stock levels, queue summaries, customer history

Try asking me something like:
- "What's the status of order 403-3777445-6067563?"
- "Show me all pending orders missing tracking"
- "Reserve serial MG2604128 for order XYZ"
- "Check for duplicate orders with tracking ABC123"`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    // Get fresh token on each request
    const token = localStorage.getItem('mg_token');
    if (!token) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "**Not logged in** - Please log in to use the AI Assistant."
      }]);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/api/bot/ai-chat`, {
        message: userMessage,
        session_id: sessionId
      }, { headers });

      setSessionId(res.data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message;
      let errorMessage = `Error: ${errorDetail}`;
      
      // Check for auth errors
      if (err.response?.status === 401 || errorDetail?.toLowerCase().includes('token') || errorDetail?.toLowerCase().includes('authenticated')) {
        errorMessage = "**Session Expired** - Your login session has expired. Please **log out and log back in** to continue using the AI Assistant.";
      }
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage
      }]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = async () => {
    if (sessionId) {
      try {
        const token = localStorage.getItem('mg_token');
        const headers = { Authorization: `Bearer ${token}` };
        await axios.post(`${API}/api/bot/ai-chat/reset`, 
          new URLSearchParams({ session_id: sessionId }), 
          { headers }
        );
      } catch (e) {
        console.error('Reset error:', e);
      }
    }
    setSessionId(null);
    setMessages([{
      role: 'assistant',
      content: "Chat reset! How can I help you?"
    }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl h-[80vh] flex flex-col bg-slate-900 border-slate-700">
        <CardHeader className="border-b border-slate-700 py-3 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">AI CRM Assistant</CardTitle>
              <p className="text-xs text-slate-400">Powered by GPT-4o • Full CRM Access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetChat}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-100'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="text-violet-300 font-semibold">{children}</strong>,
                            code: ({ children }) => <code className="bg-slate-700 px-1 py-0.5 rounded text-emerald-400">{children}</code>,
                            pre: ({ children }) => <pre className="bg-slate-950 p-2 rounded overflow-x-auto">{children}</pre>
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    <span className="text-slate-400 text-sm">Analyzing...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <div className="border-t border-slate-700 p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about any order, check status, or request actions..."
              className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              disabled={loading}
            />
            <Button 
              onClick={sendMessage} 
              disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            AI can search orders, check duplicates, reserve serials, and diagnose issues automatically
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AIChatWidget;
