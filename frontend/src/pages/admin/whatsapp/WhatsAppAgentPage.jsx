import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '../../../App';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  MessageSquare, RefreshCw, LogOut, CheckCircle, 
  XCircle, Loader2, Smartphone, ArrowLeft, Send,
  Bot, User
} from 'lucide-react';

export default function WhatsAppAgentPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  
  const [status, setStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  
  // Manual message state
  const [manualTo, setManualTo] = useState('');
  const [manualMessage, setManualMessage] = useState('');
  
  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/status`, { headers });
      setStatus(res.data);
      
      // If QR available, fetch it
      if (res.data.state === 'qr_ready' || res.data.qr_available) {
        const qrRes = await axios.get(`${API}/whatsapp/qr`, { headers });
        if (qrRes.data.qr) {
          setQrCode(qrRes.data.qr);
          // Generate QR image URL using a QR code API
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrRes.data.qr)}`;
          setQrImageUrl(qrUrl);
        }
      } else {
        setQrCode(null);
        setQrImageUrl(null);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
      setStatus({ state: 'error', error: err.message });
    }
  }, [token]);
  
  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/whatsapp/conversations`, { headers });
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [token]);
  
  // Poll status
  useEffect(() => {
    fetchStatus();
    fetchConversations();
    
    const interval = setInterval(() => {
      fetchStatus();
      if (status?.state === 'connected') {
        fetchConversations();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchStatus, fetchConversations, status?.state]);
  
  // Restart WhatsApp
  const handleRestart = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/whatsapp/restart`, {}, { headers });
      toast.success('Restarting WhatsApp connection...');
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      toast.error('Failed to restart');
    } finally {
      setLoading(false);
    }
  };
  
  // Logout WhatsApp
  const handleLogout = async () => {
    if (!window.confirm('This will disconnect WhatsApp and require re-scanning the QR code. Continue?')) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/whatsapp/logout`, {}, { headers });
      toast.success('Logged out. Scan QR code to reconnect.');
      setQrCode(null);
      setQrImageUrl(null);
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      toast.error('Failed to logout');
    } finally {
      setLoading(false);
    }
  };
  
  // Send manual message
  const handleSendMessage = async () => {
    if (!manualTo || !manualMessage) {
      toast.error('Enter phone number and message');
      return;
    }
    
    setLoading(true);
    try {
      // Format phone number
      let to = manualTo.replace(/[^0-9]/g, '');
      if (!to.endsWith('@c.us')) {
        to = `${to}@c.us`;
      }
      
      await axios.post(`${API}/whatsapp/send`, 
        { to, message: manualMessage },
        { headers }
      );
      toast.success('Message sent!');
      setManualMessage('');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };
  
  // Get status color
  const getStatusColor = () => {
    switch (status?.state) {
      case 'connected': return 'text-green-400';
      case 'qr_ready': return 'text-yellow-400';
      case 'authenticated': return 'text-blue-400';
      default: return 'text-red-400';
    }
  };
  
  const getStatusIcon = () => {
    switch (status?.state) {
      case 'connected': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'qr_ready': return <Smartphone className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 'authenticated': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      default: return <XCircle className="w-5 h-5 text-red-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-800 rounded-lg"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-400" />
                WhatsApp AI Agent
              </h1>
              <p className="text-gray-400 text-sm">Control your entire CRM from WhatsApp</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 ${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="capitalize">{status?.state || 'Unknown'}</span>
            </div>
            
            <button
              onClick={handleRestart}
              disabled={loading}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50"
              title="Restart Connection"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {status?.state === 'connected' && (
              <button
                onClick={handleLogout}
                disabled={loading}
                className="p-2 bg-red-900/50 hover:bg-red-800 rounded-lg disabled:opacity-50"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - QR Code / Status */}
          <div className="space-y-6">
            {/* QR Code Card */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-400" />
                Connect WhatsApp
              </h2>
              
              {status?.state === 'connected' ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-green-400">Connected!</p>
                  <p className="text-gray-400 mt-2">
                    Your WhatsApp is linked. Send a message to this number to interact with your CRM.
                  </p>
                </div>
              ) : qrImageUrl ? (
                <div className="text-center">
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    <img src={qrImageUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-gray-400">
                    Scan this QR code with your WhatsApp app to connect
                  </p>
                  <p className="text-yellow-400 text-sm mt-2">
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-gray-500 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-400">
                    {status?.state === 'bridge_offline' 
                      ? 'WhatsApp bridge is starting...' 
                      : 'Waiting for QR code...'}
                  </p>
                  <button
                    onClick={handleRestart}
                    className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
                  >
                    Start WhatsApp Connection
                  </button>
                </div>
              )}
            </div>
            
            {/* How It Works */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">How It Works</h2>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0">1</div>
                  <div>
                    <p className="font-medium">Scan QR Code</p>
                    <p className="text-gray-400">Link your WhatsApp by scanning the QR code above</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0">2</div>
                  <div>
                    <p className="font-medium">Send Messages</p>
                    <p className="text-gray-400">Talk naturally - "register this bill", "check my stock", etc.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shrink-0">3</div>
                  <div>
                    <p className="font-medium">AI Handles Everything</p>
                    <p className="text-gray-400">GPT understands your intent and operates the CRM for you</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-green-400 mb-2">Example Commands:</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• "How many pending orders do I have?"</li>
                  <li>• "Process 5 Amazon orders"</li>
                  <li>• "Register this purchase bill" (with image)</li>
                  <li>• "Check stock of whey protein"</li>
                  <li>• "What's my daily summary?"</li>
                  <li>• "Create a new supplier ABC Trading"</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Right Column - Conversations */}
          <div className="space-y-6">
            {/* Manual Send */}
            {status?.state === 'connected' && (
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Send Message
                </h2>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={manualTo}
                    onChange={(e) => setManualTo(e.target.value)}
                    placeholder="Phone number (e.g., 919876543210)"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  />
                  <textarea
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={loading || !manualTo || !manualMessage}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                </div>
              </div>
            )}
            
            {/* Recent Conversations */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Recent Conversations
              </h2>
              
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No conversations yet. Connect WhatsApp and send a message to start.
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {conversations.map((conv, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600"
                      onClick={() => setSelectedConversation(conv)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{conv.user_number}</span>
                        <span className="text-xs text-gray-400">
                          {conv.last_activity ? new Date(conv.last_activity).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {conv.messages?.length > 0 
                          ? conv.messages[conv.messages.length - 1]?.content?.slice(0, 50) + '...'
                          : 'No messages'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Conversation */}
            {selectedConversation && (
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{selectedConversation.user_number}</h3>
                  <button 
                    onClick={() => setSelectedConversation(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {selectedConversation.messages?.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && <Bot className="w-5 h-5 text-green-400 shrink-0" />}
                      <div className={`max-w-[80%] p-2 rounded-lg text-sm ${
                        msg.role === 'user' ? 'bg-green-600' : 'bg-gray-700'
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === 'user' && <User className="w-5 h-5 text-blue-400 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
