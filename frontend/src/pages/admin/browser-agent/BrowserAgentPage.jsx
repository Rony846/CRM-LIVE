import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Play, Square, Pause, RefreshCw, MousePointer, Keyboard,
  Monitor, Loader2, CheckCircle, XCircle, AlertTriangle,
  Package, FileText, Download, ExternalLink, ArrowLeft, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BrowserAgentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [agentState, setAgentState] = useState('idle');
  const [screenshot, setScreenshot] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Input fields for login
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [quickText, setQuickText] = useState('');
  
  const pollingRef = useRef(null);
  const canvasRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

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
            toast.success('Logged in to Amazon Seller Central');
            setAgentState('logged_in');
          } else {
            toast.info('Not logged in yet. Please log in using the controls below.');
          }
          break;
        case 'click':
          res = await axios.post(`${API}/api/browser-agent/click`, { x: data.x, y: data.y }, { headers });
          // Refresh screenshot after click
          setTimeout(() => sendCommand('screenshot'), 500);
          break;
        case 'type':
          res = await axios.post(`${API}/api/browser-agent/type`, { text: data.text }, { headers });
          // Refresh screenshot after typing
          setTimeout(() => sendCommand('screenshot'), 300);
          break;
        case 'key':
          res = await axios.post(`${API}/api/browser-agent/key`, { key: data.key }, { headers });
          setTimeout(() => sendCommand('screenshot'), 300);
          break;
        case 'get_orders':
          res = await axios.get(`${API}/api/browser-agent/orders`, { headers });
          setOrders(res.data.orders || []);
          toast.success(`Found ${res.data.orders?.length || 0} orders`);
          break;
        case 'process_order':
          res = await axios.post(`${API}/api/browser-agent/process-order`, { order_id: data.order_id }, { headers });
          setProcessResults(prev => [...prev, res.data]);
          if (res.data.success) {
            toast.success(`Order ${data.order_id} processed successfully`);
          } else {
            toast.error(`Order ${data.order_id} failed: ${res.data.error}`);
          }
          break;
        case 'process_all':
          res = await axios.post(`${API}/api/browser-agent/process-all`, {}, { headers });
          setProcessResults(res.data.results || []);
          toast.success(`Processed ${res.data.results?.length || 0} orders`);
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
      
      // Refresh status after command (except screenshot)
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
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1366 / rect.width;
    const scaleY = 768 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    sendCommand('click', { x, y });
    toast.info(`Clicked at (${x}, ${y})`);
  };

  // Type and submit text
  const typeText = (text) => {
    if (!text.trim()) return;
    sendCommand('type', { text });
  };

  // Press special key
  const pressKey = (key) => {
    sendCommand('key', { key });
  };

  // Login helper - types email, tabs, types password, enters
  const performLogin = async () => {
    if (!emailInput || !passwordInput) {
      toast.error('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      // Type email
      await axios.post(`${API}/api/browser-agent/type`, { text: emailInput }, { headers });
      await new Promise(r => setTimeout(r, 500));
      
      // Press Tab to move to password field
      await axios.post(`${API}/api/browser-agent/key`, { key: 'Tab' }, { headers });
      await new Promise(r => setTimeout(r, 300));
      
      // Type password
      await axios.post(`${API}/api/browser-agent/type`, { text: passwordInput }, { headers });
      await new Promise(r => setTimeout(r, 500));
      
      // Press Enter to submit
      await axios.post(`${API}/api/browser-agent/key`, { key: 'Enter' }, { headers });
      
      toast.success('Login submitted! Waiting for page to load...');
      
      // Wait and refresh
      await new Promise(r => setTimeout(r, 3000));
      await sendCommand('screenshot');
      
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

  const browserRunning = agentState !== 'idle' && agentState !== 'stopped';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Amazon Browser Agent</h1>
            <p className="text-sm text-gray-400">Automated Order Processing</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${connected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`}></span>
            {connected ? 'Connected' : 'Disconnected'}
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
                >
                  <Play className="w-4 h-4" /> Start
                </button>
                <button
                  onClick={() => sendCommand('stop')}
                  disabled={loading || !browserRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
                <button
                  onClick={() => sendCommand('screenshot')}
                  disabled={loading || !browserRunning}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setManualMode(!manualMode)}
                  disabled={!browserRunning}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${manualMode ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} ${!browserRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <MousePointer className="w-4 h-4" /> Click Mode {manualMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            
            {/* Browser Canvas */}
            <div 
              ref={canvasRef}
              className={`relative aspect-video bg-black ${manualMode && browserRunning ? 'cursor-crosshair' : ''}`}
              onClick={handleCanvasClick}
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
                    <p className="text-sm mt-2 text-gray-600">Then click "Go to Amazon Seller Central"</p>
                  </div>
                </div>
              )}
              
              {loading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              )}
              
              {manualMode && browserRunning && (
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                  Click Mode: Click anywhere on the browser to interact
                </div>
              )}
            </div>
            
            {/* Status Bar */}
            <div className="flex items-center justify-between p-2 bg-gray-900 border-t border-gray-700 text-sm">
              <div className={`flex items-center gap-2 ${getStateColor(agentState)}`}>
                {getStateIcon(agentState)}
                <span className="capitalize">{agentState.replace('_', ' ')}</span>
                {statusMessage && <span className="text-gray-500">- {statusMessage}</span>}
              </div>
              {currentOrder && (
                <span className="text-blue-400">Processing: {currentOrder}</span>
              )}
            </div>
          </div>

          {/* Keyboard Input Panel */}
          {browserRunning && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Keyboard className="w-5 h-5" /> Keyboard Input
              </h3>
              
              {/* Quick Text Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickText) {
                      typeText(quickText);
                      setQuickText('');
                    }
                  }}
                  placeholder="Type text and press Enter or click Send..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  disabled={loading}
                />
                <button
                  onClick={() => { typeText(quickText); setQuickText(''); }}
                  disabled={loading || !quickText}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded flex items-center gap-1"
                >
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
              
              {/* Special Keys */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-gray-400 text-sm mr-2">Keys:</span>
                {['Tab', 'Enter', 'Escape', 'Backspace', 'ArrowDown', 'ArrowUp'].map(key => (
                  <button
                    key={key}
                    onClick={() => pressKey(key)}
                    disabled={loading}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded text-sm"
                  >
                    {key}
                  </button>
                ))}
              </div>
              
              {/* Amazon Login Helper */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h4 className="text-sm font-medium text-orange-400 mb-3">Amazon Login Helper</h4>
                <p className="text-xs text-gray-500 mb-3">
                  1. First click on the Email field in the browser above<br/>
                  2. Then enter credentials below and click "Auto Login"
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Amazon Email"
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    disabled={loading}
                  />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Amazon Password"
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={performLogin}
                  disabled={loading || !emailInput || !passwordInput}
                  className="w-full mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Auto Login (Type Email → Tab → Password → Enter)
                </button>
              </div>
            </div>
          )}
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
              >
                <ExternalLink className="w-4 h-4" /> Go to Amazon Seller Central
              </button>
              <button
                onClick={() => sendCommand('check_login')}
                disabled={loading || !browserRunning}
                className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
              >
                <CheckCircle className="w-4 h-4" /> Check Login Status
              </button>
              <button
                onClick={() => sendCommand('get_orders')}
                disabled={loading || agentState !== 'logged_in'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
              >
                <Package className="w-4 h-4" /> Fetch Unshipped Orders
              </button>
              <button
                onClick={() => sendCommand('process_all')}
                disabled={loading || agentState !== 'logged_in'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded"
              >
                <Play className="w-4 h-4" /> Process All Self-Ship Orders
              </button>
            </div>
          </div>

          {/* Orders Queue */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Orders Queue ({orders.length})</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {orders.length === 0 ? (
                <p className="text-gray-500 text-sm">No orders fetched yet</p>
              ) : (
                orders.map((order, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                    <span className="font-mono text-xs">{order.order_id}</span>
                    <button
                      onClick={() => sendCommand('process_order', { order_id: order.order_id })}
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
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Processing Results</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {processResults.length === 0 ? (
                <p className="text-gray-500 text-sm">No orders processed yet</p>
              ) : (
                processResults.map((result, idx) => (
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
                ))
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-800 rounded-xl p-4 text-sm text-gray-400">
            <h3 className="font-semibold text-white mb-2">How to Use</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click <span className="text-green-400">"Start"</span> to launch browser</li>
              <li>Click <span className="text-orange-400">"Go to Amazon Seller Central"</span></li>
              <li>Enable <span className="text-blue-400">"Click Mode"</span> and click on email field</li>
              <li>Use the <span className="text-orange-400">Login Helper</span> below to enter credentials</li>
              <li>Click <span className="text-gray-300">"Check Login Status"</span> when logged in</li>
              <li>Use <span className="text-green-400">"Process All"</span> to automate orders</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
