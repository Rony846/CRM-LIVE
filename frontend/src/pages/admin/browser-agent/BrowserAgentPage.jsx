import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { 
  Play, Square, Pause, RefreshCw, MousePointer, Keyboard,
  Monitor, Loader2, CheckCircle, XCircle, AlertTriangle,
  Package, FileText, Download, ExternalLink, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API.replace('https://', 'wss://').replace('http://', 'ws://');

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
  const [commandInput, setCommandInput] = useState('');
  
  const wsRef = useRef(null);
  const canvasRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/browser-agent`);
    
    ws.onopen = () => {
      setConnected(true);
      toast.success('Connected to Browser Agent');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'screenshot':
          setScreenshot(`data:image/jpeg;base64,${message.data}`);
          break;
        case 'status':
          setAgentState(message.data.state);
          setStatusMessage(message.data.message);
          setCurrentOrder(message.data.current_order);
          break;
        case 'login_status':
          if (message.logged_in) {
            toast.success('Logged in to Amazon Seller Central');
            setAgentState('logged_in');
          } else {
            toast.info('Please log in to Amazon Seller Central');
          }
          break;
        case 'orders':
          setOrders(message.data || []);
          break;
        case 'process_result':
          setProcessResults(prev => [...prev, message.data]);
          if (message.data.success) {
            toast.success(`Order ${message.data.order_id} processed successfully`);
          } else {
            toast.error(`Order ${message.data.order_id} failed: ${message.data.error}`);
          }
          break;
        case 'process_results':
          setProcessResults(message.data || []);
          toast.success(`Processed ${message.data.length} orders`);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };
    
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error');
    };
    
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Send command to agent
  const sendCommand = (command, data = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, ...data }));
    } else {
      toast.error('Not connected to agent');
    }
  };

  // Handle canvas click for manual control
  const handleCanvasClick = (e) => {
    if (!manualMode || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1366 / rect.width;
    const scaleY = 768 / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    sendCommand('click', { x, y });
  };

  // Handle keyboard input for manual control
  const handleKeyDown = (e) => {
    if (!manualMode) return;
    
    if (e.key === 'Enter' && commandInput) {
      sendCommand('type', { text: commandInput });
      setCommandInput('');
    } else if (e.key.length === 1) {
      // Single character
    } else {
      sendCommand('key', { key: e.key });
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
        <div className="lg:col-span-2 bg-gray-800 rounded-xl overflow-hidden">
          {/* Browser Toolbar */}
          <div className="flex items-center justify-between p-3 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendCommand('start')}
                disabled={agentState !== 'idle' && agentState !== 'stopped'}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
              >
                <Play className="w-4 h-4" /> Start
              </button>
              <button
                onClick={() => sendCommand('stop')}
                disabled={agentState === 'idle' || agentState === 'stopped'}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm"
              >
                <Square className="w-4 h-4" /> Stop
              </button>
              <button
                onClick={() => sendCommand('screenshot')}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setManualMode(!manualMode)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${manualMode ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                <MousePointer className="w-4 h-4" /> Manual Control
              </button>
            </div>
          </div>
          
          {/* Browser Canvas */}
          <div 
            ref={canvasRef}
            className="relative aspect-video bg-black cursor-crosshair"
            onClick={handleCanvasClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
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
                  <p>Click "Start" to launch browser</p>
                </div>
              </div>
            )}
            
            {manualMode && (
              <div className="absolute bottom-2 left-2 right-2">
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendCommand('type', { text: commandInput });
                      setCommandInput('');
                    }
                  }}
                  placeholder="Type text and press Enter..."
                  className="w-full px-3 py-2 bg-black/80 border border-gray-600 rounded text-white text-sm"
                />
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

        {/* Control Panel */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => sendCommand('go_to_amazon')}
                disabled={agentState === 'idle'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 rounded"
              >
                <ExternalLink className="w-4 h-4" /> Go to Amazon Seller Central
              </button>
              <button
                onClick={() => sendCommand('check_login')}
                disabled={agentState === 'idle'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 rounded"
              >
                <CheckCircle className="w-4 h-4" /> Check Login Status
              </button>
              <button
                onClick={() => sendCommand('get_orders')}
                disabled={agentState !== 'logged_in'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
              >
                <Package className="w-4 h-4" /> Fetch Unshipped Orders
              </button>
              <button
                onClick={() => sendCommand('process_all')}
                disabled={agentState !== 'logged_in'}
                className="w-full flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
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
                    <span className="font-mono">{order.order_id}</span>
                    <button
                      onClick={() => sendCommand('process_order', { order_id: order.order_id })}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
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
            <div className="max-h-64 overflow-y-auto space-y-2">
              {processResults.length === 0 ? (
                <p className="text-gray-500 text-sm">No orders processed yet</p>
              ) : (
                processResults.map((result, idx) => (
                  <div key={idx} className={`p-2 rounded text-sm ${result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{result.order_id}</span>
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
                        {result.invoice_path && (
                          <a href={`${API}${result.invoice_path}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                            Download Invoice
                          </a>
                        )}
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
            <h3 className="font-semibold text-white mb-2">Instructions</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click "Start" to launch browser</li>
              <li>Click "Go to Amazon Seller Central"</li>
              <li>Enable "Manual Control" to log in</li>
              <li>Click "Check Login Status" when done</li>
              <li>Use "Process All" or process individual orders</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
