import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Play, Square, RefreshCw, MousePointer, 
  Monitor, Loader2, CheckCircle, XCircle, AlertTriangle,
  Package, ExternalLink, ArrowLeft, Send, MessageSquare,
  Bot, User, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BrowserAgentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [agentState, setAgentState] = useState('idle');
  const [screenshot, setScreenshot] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your AI-powered Amazon Browser Agent assistant. I understand natural language, so just tell me what you need!

**Examples of things you can say:**
• "Process one order" or "do the latest order"
• "How many orders do I have?"
• "Process a few orders" or "do 5 orders"
• "Check if I'm logged in"
• "Go to the orders page"

I'll handle the rest! What would you like to do?`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  
  // Login helper state - Pre-filled with Amazon Seller Central credentials
  const [emailInput, setEmailInput] = useState('info@musclegridindia.com');
  const [passwordInput, setPasswordInput] = useState('Rony@846');
  
  const pollingRef = useRef(null);
  const canvasRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  
  // Computed states - define early so they can be used in hooks
  const browserRunning = agentState !== 'idle' && agentState !== 'stopped';
  const isLoggedIn = agentState === 'logged_in';

  // Handle keyboard input when browser canvas is focused and click mode is on
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Check conditions using state directly (browserRunning computed above)
      const isRunning = agentState !== 'idle' && agentState !== 'stopped';
      if (!isFocused || !manualMode || !isRunning || loading) return;
      
      // Prevent default for most keys to avoid page navigation
      if (e.key !== 'F5' && e.key !== 'F12') {
        e.preventDefault();
      }
      
      try {
        // Special keys that need to be sent as key presses
        const specialKeys = ['Tab', 'Enter', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'];
        
        if (specialKeys.includes(e.key)) {
          await axios.post(`${API}/api/browser-agent/key`, { key: e.key }, { headers });
        } else if (e.key.length === 1) {
          // Single character - type it
          await axios.post(`${API}/api/browser-agent/type`, { text: e.key }, { headers });
        }
        
        // Refresh screenshot after typing
        setTimeout(fetchStatus, 200);
      } catch (err) {
        console.error('Keyboard input error:', err);
      }
    };

    const isRunning = agentState !== 'idle' && agentState !== 'stopped';
    if (manualMode && isRunning) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFocused, manualMode, agentState, loading, token]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Fetch agent status and screenshot
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/browser-agent/status`, { headers });
      setAgentState(res.data.state || 'idle');
      setCurrentOrder(res.data.current_order);
      setConnected(true);
      
      // If agent is running, also fetch screenshot
      if (res.data.state && res.data.state !== 'idle' && res.data.state !== 'stopped') {
        try {
          const screenshotRes = await axios.get(`${API}/api/browser-agent/screenshot`, { headers });
          if (screenshotRes.data.screenshot) {
            setScreenshot(`data:image/jpeg;base64,${screenshotRes.data.screenshot}`);
          }
        } catch (e) {
          // Screenshot may fail if browser is starting
        }
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Error fetching status:', err);
      }
      setConnected(true);
    }
  }, [token]);

  // Start polling when component mounts
  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 2000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchStatus]);

  // Send AI command
  const sendAICommand = async (command) => {
    if (!command.trim()) return;
    
    // Add user message
    const userMessage = {
      role: 'user',
      content: command,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      // Send conversation history for context
      const conversationHistory = chatMessages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const res = await axios.post(`${API}/api/browser-agent/ai-command`, 
        { command, conversation_history: conversationHistory },
        { headers }
      );
      
      // Add assistant response - show the AI's response with formatting
      const assistantMessage = {
        role: 'assistant',
        content: res.data.message || res.data.ai_response || 'Command executed.',
        success: res.data.success,
        data: res.data.data,
        ai_response: res.data.ai_response,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Update orders if returned
      if (res.data.data?.orders) {
        setOrders(res.data.data.orders);
      }
      
      // Update results if returned
      if (res.data.data?.results) {
        setProcessResults(res.data.data.results);
      }
      
      // Refresh screenshot
      if (res.data.data?.action === 'refresh_screenshot' || res.data.success) {
        setTimeout(fetchStatus, 500);
      }
      
      // Toast notification
      if (res.data.success) {
        toast.success(res.data.message.split('\n')[0]);
      } else {
        toast.error(res.data.message);
      }
      
    } catch (err) {
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${err.response?.data?.detail || err.message}`,
        success: false,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
      toast.error('Command failed');
    } finally {
      setChatLoading(false);
    }
  };

  // Send command to agent
  const sendCommand = async (command, data = {}) => {
    setLoading(true);
    try {
      let res;
      switch (command) {
        case 'start':
          res = await axios.post(`${API}/api/browser-agent/start`, {}, { headers });
          toast.success('Browser agent starting...');
          break;
        case 'stop':
          res = await axios.post(`${API}/api/browser-agent/stop`, {}, { headers });
          toast.success('Browser agent stopped');
          setScreenshot(null);
          setAgentState('idle');
          break;
        case 'navigate':
          res = await axios.post(`${API}/api/browser-agent/navigate`, { url: data.url }, { headers });
          break;
        case 'go_to_amazon':
          res = await axios.post(`${API}/api/browser-agent/navigate`, { url: 'https://sellercentral.amazon.in/' }, { headers });
          toast.info('Navigating to Amazon Seller Central...');
          break;
        case 'check_login':
          res = await axios.post(`${API}/api/browser-agent/check-login`, {}, { headers });
          if (res.data.logged_in) {
            toast.success('Logged in to Amazon Seller Central!');
            setAgentState('logged_in');
          } else {
            toast.info('Not logged in yet. Please sign in manually.');
          }
          break;
        case 'click':
          res = await axios.post(`${API}/api/browser-agent/click`, { x: data.x, y: data.y }, { headers });
          setTimeout(fetchStatus, 500);
          break;
        case 'type':
          res = await axios.post(`${API}/api/browser-agent/type`, { text: data.text }, { headers });
          setTimeout(fetchStatus, 300);
          break;
        case 'key':
          res = await axios.post(`${API}/api/browser-agent/key`, { key: data.key }, { headers });
          setTimeout(fetchStatus, 300);
          break;
        case 'screenshot':
          res = await axios.get(`${API}/api/browser-agent/screenshot`, { headers });
          if (res.data.screenshot) {
            setScreenshot(`data:image/jpeg;base64,${res.data.screenshot}`);
          }
          break;
        default:
          console.log('Unknown command:', command);
      }
      
      if (command !== 'screenshot') {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Command error:', err);
      toast.error(err.response?.data?.detail || 'Command failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle canvas click for manual control
  const handleCanvasClick = (e) => {
    if (!manualMode || !canvasRef.current || loading) return;
    
    // Focus the canvas for keyboard input
    canvasRef.current.focus();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1366 / rect.width;
    const scaleY = 768 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    sendCommand('click', { x, y });
    toast.info(`Clicked at (${x}, ${y}) - Now type to enter text!`);
  };

  // Login helper
  const performLogin = async () => {
    if (!emailInput || !passwordInput) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/api/browser-agent/type`, { text: emailInput }, { headers });
      await new Promise(r => setTimeout(r, 500));
      await axios.post(`${API}/api/browser-agent/key`, { key: 'Tab' }, { headers });
      await new Promise(r => setTimeout(r, 300));
      await axios.post(`${API}/api/browser-agent/type`, { text: passwordInput }, { headers });
      await new Promise(r => setTimeout(r, 500));
      await axios.post(`${API}/api/browser-agent/key`, { key: 'Enter' }, { headers });
      
      toast.success('Login submitted! Please wait...');
      await new Promise(r => setTimeout(r, 3000));
      await fetchStatus();
    } catch (err) {
      toast.error('Login failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'idle': return 'text-gray-400';
      case 'starting': return 'text-yellow-400';
      case 'waiting_login': return 'text-orange-400';
      case 'logged_in': return 'text-green-400';
      case 'processing': return 'text-blue-400';
      case 'paused': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'stopped': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStateIcon = (state) => {
    switch (state) {
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'logged_in': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <XCircle className="w-4 h-4" />;
      case 'waiting_login': return <AlertTriangle className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Amazon Browser Agent</h1>
            <p className="text-sm text-gray-400">Automated Order Processing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isLoggedIn ? 'bg-green-900/50 text-green-400 border border-green-700' : 
            browserRunning ? 'bg-orange-900/50 text-orange-400 border border-orange-700' : 
            'bg-gray-800 text-gray-400'
          }`}>
            {isLoggedIn ? <CheckCircle className="w-4 h-4" /> : browserRunning ? <AlertTriangle className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            {isLoggedIn ? 'Logged In' : browserRunning ? 'Awaiting Login' : 'Browser Stopped'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Browser View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            {/* Browser Toolbar */}
            <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendCommand('start')}
                  disabled={loading || browserRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
                  data-testid="start-browser-btn"
                >
                  <Play className="w-4 h-4" /> Start
                </button>
                <button
                  onClick={() => sendCommand('stop')}
                  disabled={loading || !browserRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
                  data-testid="stop-browser-btn"
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
                <button
                  onClick={() => sendCommand('screenshot')}
                  disabled={loading || !browserRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
                  data-testid="refresh-btn"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setManualMode(!manualMode)}
                  disabled={!browserRunning}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${manualMode ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${!browserRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-testid="click-mode-btn"
                >
                  <MousePointer className="w-4 h-4" /> Click Mode {manualMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            
            {/* Browser Canvas */}
            <div 
              ref={canvasRef}
              tabIndex={0}
              className={`relative aspect-video bg-black outline-none ${manualMode && browserRunning ? 'cursor-crosshair ring-2 ring-blue-500' : ''} ${isFocused && manualMode ? 'ring-2 ring-green-500' : ''}`}
              onClick={handleCanvasClick}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              data-testid="browser-canvas"
            >
              {screenshot ? (
                <img 
                  src={screenshot} 
                  alt="Browser View" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-lg">Click "Start" to launch browser</p>
                    <p className="text-sm mt-2 text-gray-600">Then use the AI Assistant to control it</p>
                  </div>
                </div>
              )}
              
              {loading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              )}
              
              {manualMode && browserRunning && (
                <div className={`absolute top-2 left-2 text-white text-xs px-2 py-1 rounded ${isFocused ? 'bg-green-600' : 'bg-blue-600'}`}>
                  {isFocused 
                    ? '⌨️ Keyboard Active - Type directly into browser!' 
                    : '🖱️ Click Mode ON - Click here to enable keyboard input'}
                </div>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="flex items-center justify-between p-2 bg-gray-900 border-t border-gray-700 text-sm">
              <div className={`flex items-center gap-2 ${getStateColor(agentState)}`}>
                {getStateIcon(agentState)}
                <span className="capitalize">{agentState.replace('_', ' ')}</span>
              </div>
              {currentOrder && (
                <span className="text-blue-400">Processing: {currentOrder}</span>
              )}
            </div>
          </div>

          {/* AI Command Interface */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">AI Assistant</h3>
              <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full ml-2">GPT Powered</span>
              <span className="text-xs text-gray-500 ml-auto">Talk naturally - "process one order", "how many orders?"</span>
            </div>
            
            {/* Chat Messages */}
            <div className="h-72 overflow-y-auto p-4 space-y-3" data-testid="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : msg.success === false 
                        ? 'bg-red-900/30 border border-red-700 text-red-200'
                        : 'bg-gray-700 text-gray-100'
                  }`}>
                    {/* Render message with basic markdown support */}
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.content?.split('\n').map((line, i) => (
                        <p key={i} className={line.startsWith('**') ? 'font-semibold' : ''}>
                          {line.replace(/\*\*/g, '').replace(/ACTION:\w+(?::\d+)?/g, '')}
                        </p>
                      ))}
                    </div>
                    {msg.data?.count !== undefined && (
                      <div className="text-xs mt-2 p-2 bg-blue-900/30 rounded border border-blue-700">
                        📦 Found <span className="font-bold text-blue-400">{msg.data.count}</span> orders
                      </div>
                    )}
                    {msg.data?.processed !== undefined && (
                      <div className="text-xs mt-2 p-2 bg-green-900/30 rounded border border-green-700">
                        ✅ Processed <span className="font-bold text-green-400">{msg.data.successful || msg.data.processed}/{msg.data.processed}</span> orders
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Processing...</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat Input */}
            <div className="p-3 border-t border-gray-700 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
                    e.preventDefault();
                    sendAICommand(chatInput);
                  }
                }}
                placeholder="Type a command... (e.g., 'process top 5 orders')"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                disabled={chatLoading || !browserRunning}
                data-testid="ai-command-input"
              />
              <button
                onClick={() => sendAICommand(chatInput)}
                disabled={chatLoading || !chatInput.trim() || !browserRunning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                data-testid="send-command-btn"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => sendAICommand('help')}
                disabled={chatLoading || !browserRunning}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded-lg"
                title="Show help"
                data-testid="help-btn"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => sendCommand('go_to_amazon')}
                disabled={loading || !browserRunning}
                className="w-full flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
                data-testid="go-to-amazon-btn"
              >
                <ExternalLink className="w-4 h-4" /> Go to Amazon Seller Central
              </button>
              <button
                onClick={() => sendCommand('check_login')}
                disabled={loading || !browserRunning}
                className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
                data-testid="check-login-btn"
              >
                <CheckCircle className="w-4 h-4" /> Check Login Status
              </button>
              <button
                onClick={() => sendAICommand('fetch orders')}
                disabled={loading || !isLoggedIn}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
                data-testid="fetch-orders-btn"
              >
                <Package className="w-4 h-4" /> Fetch Unshipped Orders
              </button>
              <button
                onClick={() => sendAICommand('process all orders')}
                disabled={loading || !isLoggedIn}
                className="w-full flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
                data-testid="process-all-btn"
              >
                <Play className="w-4 h-4" /> Process All Self-Ship Orders
              </button>
            </div>
          </div>

          {/* Login Helper */}
          {browserRunning && !isLoggedIn && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-orange-400">Amazon Login Helper</h3>
              <p className="text-xs text-gray-500 mb-3">
                <strong>Step 1:</strong> Click "Log in" button in browser<br/>
                <strong>Step 2:</strong> Click on email field, then "Auto Login"<br/>
                <strong>Step 3:</strong> Enter OTP if prompted
              </p>
              <div className="space-y-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Amazon Email"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  disabled={loading}
                  data-testid="login-email-input"
                />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Amazon Password"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  disabled={loading}
                  data-testid="login-password-input"
                />
                <button
                  onClick={performLogin}
                  disabled={loading || !emailInput || !passwordInput}
                  className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded flex items-center justify-center gap-2"
                  data-testid="auto-login-btn"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Auto Login (Email + Password)
                </button>
                
                {/* OTP Section */}
                <div className="border-t border-gray-600 pt-2 mt-2">
                  <p className="text-xs text-yellow-400 mb-2">If OTP is required:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="otpInput"
                      placeholder="Enter OTP"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      disabled={loading}
                      data-testid="otp-input"
                    />
                    <button
                      onClick={async () => {
                        const otpInput = document.getElementById('otpInput');
                        const otp = otpInput?.value;
                        if (otp) {
                          setLoading(true);
                          try {
                            await axios.post(`${API}/api/browser-agent/type`, { text: otp }, { headers });
                            await new Promise(r => setTimeout(r, 500));
                            await axios.post(`${API}/api/browser-agent/key`, { key: 'Enter' }, { headers });
                            toast.success('OTP submitted!');
                            otpInput.value = '';
                            await new Promise(r => setTimeout(r, 3000));
                            await fetchStatus();
                          } catch (err) {
                            toast.error('OTP submission failed');
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      disabled={loading}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-sm"
                      data-testid="submit-otp-btn"
                    >
                      Submit OTP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Queue */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Orders Queue ({orders.length})</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {orders.length === 0 ? (
                <p className="text-gray-500 text-sm">Use AI Assistant to fetch orders</p>
              ) : (
                orders.map((order, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                    <span className="font-mono text-xs">{order.order_id}</span>
                    <button
                      onClick={() => sendAICommand(`process order ${order.order_id}`)}
                      disabled={loading}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-xs"
                    >
                      Process
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Processing Results */}
          {processResults.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3">Processing Results</h3>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {processResults.map((result, idx) => (
                  <div key={idx} className={`p-2 rounded text-sm ${result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{result.order_id}</span>
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    {result.success ? (
                      <div className="mt-1 text-xs text-gray-400">
                        <p>Tracking: {result.tracking_id}</p>
                        <p>Shipping: {result.shipping_type}</p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-red-400">{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipping Rules Info */}
          <div className="bg-gray-800 rounded-xl p-4 text-sm">
            <h3 className="font-semibold text-white mb-2">Shipping Rules</h3>
            <div className="space-y-2 text-gray-400">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Weight &gt; 20KG → <span className="text-blue-400">B2B</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Value &gt; ₹30,000 → <span className="text-blue-400">B2B</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Otherwise → <span className="text-green-400">B2C</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
