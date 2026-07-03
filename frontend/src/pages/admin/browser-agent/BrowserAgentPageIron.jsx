import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Play, Square, RefreshCw, MousePointer,
  Monitor, Loader2, CheckCircle, XCircle, AlertTriangle,
  Package, ExternalLink, Send, MessageSquare,
  Bot, User, HelpCircle, Brain
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const API = process.env.REACT_APP_BACKEND_URL;

// ---- Iron Console inline style helpers -------------------------------------
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnGreen = { border: 'none', background: T.green, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnRose = { border: 'none', background: T.rose, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const inputStyle = { width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

const disabledStyle = (base, disabled) => (disabled ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base);

export default function BrowserAgentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { firmId: firmIdFromUrl } = useParams();
  const [connected, setConnected] = useState(false);
  const [agentState, setAgentState] = useState('idle');
  const [screenshot, setScreenshot] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [processResults, setProcessResults] = useState([]);
  const [aiThinkingLog, setAiThinkingLog] = useState([]);  // Real-time AI thinking logs
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Firm tabs — one browser profile per firm; only one alive at a time.
  const [firms, setFirms] = useState([]);
  const [activeFirmId, setActiveFirmId] = useState(null);

  // Background job state
  const [activeJob, setActiveJob] = useState(null);
  const [jobPollingInterval, setJobPollingInterval] = useState(null);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your AI-powered Amazon Browser Agent assistant with **GPT intelligence** and **background job processing**!

**Examples of things you can say:**
• "Process one order" or "do the latest order"
• "How many orders do I have?"
• "Process 5 orders in background" (runs reliably without timeouts)
• "Check if I'm logged in"
• "Go to the orders page"

**New Features:**
• 🧠 GPT analyzes errors and suggests fixes
• ⏱️ Background jobs for reliable processing
• 📊 Checkpoint-based recovery if anything fails

I'll handle the rest! What would you like to do?`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const thinkingLogRef = useRef(null);  // For auto-scrolling thinking log

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

  // Scroll thinking log to bottom when updated
  useEffect(() => {
    if (thinkingLogRef.current) {
      thinkingLogRef.current.scrollTop = thinkingLogRef.current.scrollHeight;
    }
  }, [aiThinkingLog]);

  // Fetch agent status and screenshot
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/browser-agent/status`, { headers });
      setAgentState(res.data.state || 'idle');
      setCurrentOrder(res.data.current_order);
      if (res.data.active_firm_id) setActiveFirmId(res.data.active_firm_id);
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

  // Load the firm tab list once on mount + refresh after switches.
  const fetchFirms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/browser-agent/firms`, { headers });
      setFirms(res.data.firms || []);
      if (res.data.active_firm_id) setActiveFirmId(res.data.active_firm_id);
    } catch (err) {
      console.error('Error fetching firms:', err);
    }
  }, [token]);

  // Switch active firm — backend stops the current browser and starts the
  // requested firm's profile. Persisted cookies mean no re-login.
  // If updateUrl is true, also reflect the switch in the URL so the sidebar
  // sub-link stays in sync.
  const switchFirm = async (firmId, { updateUrl = true } = {}) => {
    if (!firmId || firmId === activeFirmId) return;
    setLoading(true);
    try {
      await axios.post(`${API}/api/browser-agent/switch`, { firm_id: firmId }, { headers });
      setActiveFirmId(firmId);
      setScreenshot(null);
      toast.success('Switched browser profile');
      if (updateUrl && firmId !== firmIdFromUrl) {
        navigate(`/admin/browser-agent/${firmId}`, { replace: true });
      }
      await fetchFirms();
      await fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to switch firm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFirms(); }, [fetchFirms]);

  // If we landed here with /:firmId in the URL (clicked a sidebar sub-entry),
  // and that firm isn't already the active one, switch to it.
  useEffect(() => {
    if (!firmIdFromUrl || !firms.length) return;
    if (firmIdFromUrl === activeFirmId) return;
    const known = firms.find(f => f.firm_id === firmIdFromUrl);
    if (known) switchFirm(firmIdFromUrl, { updateUrl: false });
  }, [firmIdFromUrl, firms, activeFirmId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start polling when component mounts
  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      // Clean up job polling
      if (jobPollingInterval) {
        clearInterval(jobPollingInterval);
      }
    };
  }, [fetchStatus]);

  // Poll job status
  const pollJobStatus = useCallback(async (jobId) => {
    try {
      const res = await axios.get(`${API}/api/browser-agent/jobs/${jobId}`, { headers });
      if (res.data.success && res.data.job) {
        const job = res.data.job;
        setActiveJob(job);

        // Update thinking log from job
        if (job.thinking_log && job.thinking_log.length > 0) {
          setAiThinkingLog(job.thinking_log);
        }

        // Update results
        if (job.results && job.results.length > 0) {
          setProcessResults(job.results);
        }

        // Check if job is complete
        if (job.status === 'completed' || job.status === 'failed') {
          // Stop polling
          if (jobPollingInterval) {
            clearInterval(jobPollingInterval);
            setJobPollingInterval(null);
          }

          // Show completion message
          const successCount = job.results?.filter(r => r.success).length || 0;
          if (job.status === 'completed') {
            toast.success(`Job completed: ${successCount}/${job.order_ids.length} orders successful`);
          } else {
            toast.error(`Job failed: ${job.error || 'Unknown error'}`);
          }
        }
      }
    } catch (err) {
      console.error('Error polling job:', err);
    }
  }, [token, jobPollingInterval]);

  // Start a background job
  const startBackgroundJob = async (orderIds = [], count = 0) => {
    try {
      setChatLoading(true);
      setAiThinkingLog([]);  // Clear previous thinking log

      const res = await axios.post(`${API}/api/browser-agent/jobs/create`,
        { order_ids: orderIds, count: count },
        { headers }
      );

      if (res.data.success) {
        const jobId = res.data.job_id;
        toast.success(`Job started: Processing ${res.data.order_count} orders`);

        // Add initial message to chat
        const assistantMessage = {
          role: 'assistant',
          content: `🚀 **Background Job Started**\n\nJob ID: \`${jobId}\`\nProcessing ${res.data.order_count} orders...\n\nYou can continue using the interface while orders are processed. Progress will appear in the AI Thinking panel.`,
          success: true,
          timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, assistantMessage]);

        // Start polling for job status
        const interval = setInterval(() => pollJobStatus(jobId), 2000);
        setJobPollingInterval(interval);

        // Initial poll
        await pollJobStatus(jobId);
      } else {
        toast.error(res.data.error || 'Failed to create job');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start job');
    } finally {
      setChatLoading(false);
    }
  };

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

    // Check if user wants background processing
    const cmdLower = command.toLowerCase();
    const wantsBackground = cmdLower.includes('background') || cmdLower.includes('reliable') || cmdLower.includes('job');
    const processMatch = cmdLower.match(/process\s*(\d+|all|one|a few|some)/i);

    // If processing orders and wants background OR processing more than 1
    if (processMatch) {
      let count = 1;
      const num = processMatch[1].toLowerCase();
      if (num === 'all') count = 100;  // Will be limited by available orders
      else if (num === 'one') count = 1;
      else if (num === 'a few' || num === 'some') count = 3;
      else count = parseInt(num) || 1;

      // Use background job for any order processing
      if (count >= 1) {
        const assistantMsg = {
          role: 'assistant',
          content: `🚀 Starting background job to process ${count === 100 ? 'all' : count} order(s)...\n\nThis runs reliably without timeouts. Progress will appear in the AI Thinking panel.`,
          timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, assistantMsg]);
        await startBackgroundJob([], count);
        return;
      }
    }

    setChatLoading(true);

    try {
      // Send conversation history for context
      const conversationHistory = chatMessages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await axios.post(`${API}/api/browser-agent/ai-command`,
        { command, conversation_history: conversationHistory },
        { headers, timeout: 180000 }  // 3 minute timeout for long operations
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

        // Extract thinking logs from results
        const allThinkingLogs = [];
        res.data.data.results.forEach(result => {
          if (result.thinking_log && result.thinking_log.length > 0) {
            allThinkingLogs.push(...result.thinking_log);
          }
        });
        if (allThinkingLogs.length > 0) {
          setAiThinkingLog(prev => [...prev, ...allThinkingLogs]);
          // Auto-scroll thinking log
          setTimeout(() => {
            thinkingLogRef.current?.scrollTo({ top: thinkingLogRef.current.scrollHeight, behavior: 'smooth' });
          }, 100);
        }
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
      // Intelligent error handling - try to understand what happened
      let errorContent = '';
      const statusCode = err.response?.status;
      const errorDetail = err.response?.data?.detail || err.response?.data?.message || err.message;

      if (statusCode === 502 || statusCode === 504 || err.code === 'ECONNABORTED') {
        // Timeout errors - operation may have completed!
        errorContent = `⏱️ **Request timed out** - but the operation may have completed!\n\n` +
          `The AI agent was processing your command but took longer than expected. ` +
          `This is common for order processing as it involves multiple steps.\n\n` +
          `**What to check:**\n` +
          `1. Look at the Amazon browser view above - tracking might already be updated\n` +
          `2. Check Bigship dashboard for new shipments\n` +
          `3. Try "check status" or refresh the page\n\n` +
          `*Technical: ${errorDetail}*`;
      } else if (statusCode === 500) {
        errorContent = `🔧 **Server error** - Let me analyze what went wrong.\n\n` +
          `The server encountered an unexpected error. This could be:\n` +
          `- Amazon page changed its layout\n` +
          `- Network connectivity issue\n` +
          `- Bigship API temporary issue\n\n` +
          `**Try:** Refresh the page and try the command again.\n\n` +
          `*Technical: ${errorDetail}*`;
      } else {
        errorContent = `Error: ${errorDetail}`;
      }

      const errorMessage = {
        role: 'assistant',
        content: errorContent,
        success: false,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMessage]);

      // Less alarming toast for timeouts
      if (statusCode === 502 || statusCode === 504) {
        toast.warning('Request timed out - check if operation completed', { duration: 5000 });
      } else {
        toast.error('Command failed');
      }
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

  // Per-firm saved credentials (Seller Central email + password).
  const [savedEmail, setSavedEmail] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [credsSaving, setCredsSaving] = useState(false);

  // Load saved credentials whenever the active firm changes.
  useEffect(() => {
    if (!activeFirmId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/api/browser-agent/firm-credentials?firm_id=${activeFirmId}`, { headers });
        if (cancelled) return;
        setSavedEmail(res.data.email || null);
        setHasPassword(!!res.data.has_password);
        if (res.data.email) setEmailInput(res.data.email);
        setPasswordInput('');  // never pre-fill password
      } catch (err) {
        // Non-fatal — just means we won't pre-fill.
      }
    })();
    return () => { cancelled = true; };
  }, [activeFirmId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist email (+ optionally password) for the active firm.
  const saveCredentials = async () => {
    if (!activeFirmId) { toast.error('Pick a firm first'); return; }
    if (!emailInput) { toast.error('Email is required'); return; }
    setCredsSaving(true);
    try {
      const body = { firm_id: activeFirmId, email: emailInput };
      if (passwordInput) body.password = passwordInput;
      const res = await axios.post(`${API}/api/browser-agent/firm-credentials`, body, { headers });
      setSavedEmail(res.data.email);
      setHasPassword(res.data.has_password);
      setPasswordInput('');
      toast.success('Credentials saved for ' + (firms.find(f => f.firm_id === activeFirmId)?.firm_name || 'firm'));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save credentials');
    } finally {
      setCredsSaving(false);
    }
  };

  // Quick login — server-side keystrokes using saved credentials. If user
  // entered an override in the inputs we send those through; otherwise the
  // backend falls back to stored values.
  const performLogin = async () => {
    if (!hasPassword && !passwordInput) {
      toast.error('No saved password — enter it once and click Save.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/api/browser-agent/auto-login`, {
        firm_id: activeFirmId,
        email: emailInput || undefined,
        password: passwordInput || undefined,
      }, { headers });
      toast.success('Login submitted — enter OTP if prompted');
      await new Promise(r => setTimeout(r, 3000));
      await fetchStatus();
    } catch (err) {
      toast.error('Login failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Iron state color (replaces legacy tailwind text-* classes with hex).
  const getStateColor = (state) => {
    switch (state) {
      case 'idle': return T.iron400;
      case 'starting': return T.voltageText;
      case 'waiting_login': return T.orange;
      case 'logged_in': return T.green;
      case 'processing': return T.blue;
      case 'paused': return T.voltageText;
      case 'error': return T.rose;
      case 'stopped': return T.iron500;
      default: return T.iron400;
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

  const activeFirm = activeFirmId ? firms.find(f => f.firm_id === activeFirmId) : null;
  const subtitle = activeFirm ? `${activeFirm.firm_name} · ${activeFirm.host}`.toUpperCase() : 'PICK A FIRM TO BEGIN';

  const statusTone = isLoggedIn ? 'ok' : browserRunning ? 'warn' : 'slate';
  const statusLabel = isLoggedIn ? 'Logged In' : browserRunning ? 'Awaiting Login' : 'Browser Stopped';

  const headerRight = (
    <span style={{ ...badgeStyle(statusTone), display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px' }}>
      {isLoggedIn ? <CheckCircle className="w-3.5 h-3.5" /> : browserRunning ? <AlertTriangle className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
      {statusLabel}
    </span>
  );

  return (
    <IronShell title="Browser Agent" subtitle={subtitle} onRefresh={fetchStatus} headerRight={headerRight}>
      {/* Firm tab row — one profile per firm, only one alive at a time. */}
      {firms.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {firms.map((f) => {
            const isActive = f.firm_id === activeFirmId;
            const isAmazon = f.host === 'amazon';
            const disabled = loading || isActive;
            const base = isActive
              ? { border: 'none', background: isAmazon ? T.orange : '#6D4AB0', color: '#fff', borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'default', display: 'flex', alignItems: 'center', gap: 8 }
              : { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
            return (
              <button
                key={f.firm_id}
                onClick={() => switchFirm(f.firm_id)}
                disabled={disabled}
                style={disabled && !isActive ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base}
                data-testid={`firm-tab-${f.firm_id}`}
                title={`${f.firm_name} (${f.host})`}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: f.running ? T.green : T.iron400 }} />
                <span>{f.firm_name}</span>
                <Caps size={8.5} color={isActive ? 'rgba(255,255,255,.8)' : T.iron400}>{f.host}</Caps>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)', gap: 16, alignItems: 'start' }}>
        {/* Browser View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            {/* Browser Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: T.iron50, borderBottom: `1px solid ${T.iron200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => sendCommand('start')}
                  disabled={loading || browserRunning}
                  style={disabledStyle({ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px' }, loading || browserRunning)}
                  data-testid="start-browser-btn"
                >
                  <Play className="w-4 h-4" /> Start
                </button>
                <button
                  onClick={() => sendCommand('stop')}
                  disabled={loading || !browserRunning}
                  style={disabledStyle({ ...btnRose, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px' }, loading || !browserRunning)}
                  data-testid="stop-browser-btn"
                >
                  <Square className="w-4 h-4" /> Stop
                </button>
                <button
                  onClick={() => sendCommand('screenshot')}
                  disabled={loading || !browserRunning}
                  style={disabledStyle({ ...btnOutline, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px' }, loading || !browserRunning)}
                  data-testid="refresh-btn"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setManualMode(!manualMode)}
                  disabled={!browserRunning}
                  style={disabledStyle(manualMode
                    ? { border: 'none', background: T.blue, color: '#fff', borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }
                    : { ...btnOutline, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px' }, !browserRunning)}
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
              onClick={handleCanvasClick}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              data-testid="browser-canvas"
              style={{
                position: 'relative', aspectRatio: '16 / 9', background: '#000', outline: 'none',
                cursor: manualMode && browserRunning ? 'crosshair' : 'default',
                boxShadow: (isFocused && manualMode)
                  ? `inset 0 0 0 2px ${T.green}`
                  : (manualMode && browserRunning) ? `inset 0 0 0 2px ${T.blue}` : 'none',
              }}
            >
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="Browser View"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.iron500 }}>
                  <div style={{ textAlign: 'center' }}>
                    <Monitor className="w-16 h-16 mx-auto mb-2" style={{ opacity: 0.5 }} />
                    <p style={{ fontSize: 18 }}>Click "Start" to launch browser</p>
                    <p style={{ fontSize: 13, marginTop: 8, color: T.iron700 }}>Then use the AI Assistant to control it</p>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: T.blue }} />
                </div>
              )}

              {manualMode && browserRunning && (
                <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 6, background: isFocused ? T.green : T.blue }}>
                  {isFocused
                    ? '⌨️ Keyboard Active - Type directly into browser!'
                    : '🖱️ Click Mode ON - Click here to enable keyboard input'}
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, background: T.iron50, borderTop: `1px solid ${T.iron200}`, fontSize: 12.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: getStateColor(agentState), fontWeight: 600 }}>
                {getStateIcon(agentState)}
                <span style={{ textTransform: 'capitalize' }}>{agentState.replace('_', ' ')}</span>
              </div>
              {currentOrder && (
                <span style={{ ...mono, color: T.blue }}>Processing: {currentOrder}</span>
              )}
            </div>
          </IronCard>

          {/* AI Assistant + chat panel intentionally removed.
              Use the firm tab + Login Helper + per-order endpoints directly.
              Old chat panel block follows as dead JSX inside a hidden guard
              so the file diff stays localized; React tree-shakes it away. */}
          {false && (
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
          )}
        </div>

        {/* Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Quick Actions card intentionally removed. Wrapped as
              {false && (...)} so the legacy JSX block compiles unchanged
              but is never mounted. */}
          {false && (
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
          )}

          {/* Login Helper — per-firm saved credentials.
              Email + password are stored per firm in marketplace_credentials.
              On firm switch we pre-fill the email and indicate whether the
              password is on file ("Saved"). Quick Login uses the stored
              creds; the user only types the OTP. */}
          {browserRunning && !isLoggedIn && (
            <IronCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.orangeDeep }}>Amazon Login Helper</h3>
                {hasPassword && (
                  <span style={badgeStyle('ok')}>Saved</span>
                )}
              </div>
              <p style={{ fontSize: 11.5, color: T.iron500, marginBottom: 12, lineHeight: 1.5 }}>
                <strong>Step 1:</strong> Click "Log in" in the browser & focus the email field<br/>
                <strong>Step 2:</strong> Click "Quick Login" — fills your saved creds<br/>
                <strong>Step 3:</strong> Enter the OTP below
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Amazon Email"
                  style={inputStyle}
                  disabled={loading}
                  data-testid="login-email-input"
                />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={hasPassword ? "Password (saved — leave blank to keep)" : "Amazon Password"}
                  style={inputStyle}
                  disabled={loading}
                  data-testid="login-password-input"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveCredentials}
                    disabled={credsSaving || !emailInput || (!passwordInput && hasPassword === false)}
                    style={disabledStyle({ ...btnOutline, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }, credsSaving || !emailInput || (!passwordInput && hasPassword === false))}
                    title={hasPassword ? 'Update saved credentials' : 'Save email + password for this firm'}
                    data-testid="save-creds-btn"
                  >
                    {credsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {hasPassword ? 'Update Saved' : 'Save Credentials'}
                  </button>
                  <button
                    onClick={performLogin}
                    disabled={loading || (!hasPassword && (!emailInput || !passwordInput))}
                    style={disabledStyle({ ...btnPrimary, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }, loading || (!hasPassword && (!emailInput || !passwordInput)))}
                    title="Type email + password into the focused Amazon field"
                    data-testid="auto-login-btn"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Quick Login
                  </button>
                </div>

                {/* OTP Section */}
                <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 8, marginTop: 8 }}>
                  <p style={{ fontSize: 11.5, color: T.voltageText, marginBottom: 8 }}>When OTP is shown on Amazon:</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      id="otpInput"
                      placeholder="Enter OTP"
                      style={{ ...inputStyle, flex: 1 }}
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
                      style={disabledStyle({ border: 'none', background: T.voltageText, color: '#fff', borderRadius: 6, padding: '7px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }, loading)}
                      data-testid="submit-otp-btn"
                    >
                      Submit OTP
                    </button>
                  </div>
                </div>
              </div>
            </IronCard>
          )}

          {/* Orders Queue */}
          <IronCard>
            <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Orders Queue ({orders.length})</h3>
            <div style={{ maxHeight: 192, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.length === 0 ? (
                <p style={{ color: T.iron400, fontSize: 12.5 }}>No orders loaded yet. Once logged in, the agent's processing flow populates this.</p>
              ) : (
                orders.map((order, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, fontSize: 12.5 }}>
                    <span style={{ ...mono, fontSize: 11 }}>{order.order_id}</span>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await axios.post(`${API}/api/browser-agent/process-order`, { order_id: order.order_id }, { headers });
                          if (res.data.success) toast.success(`Processed ${order.order_id} → AWB ${res.data.tracking_id}`);
                          else toast.error(`Failed: ${res.data.error || 'unknown'}`);
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Process failed');
                        } finally { setLoading(false); }
                      }}
                      disabled={loading}
                      style={disabledStyle({ border: 'none', background: T.blue, color: '#fff', borderRadius: 5, padding: '4px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer' }, loading)}
                    >
                      Process
                    </button>
                  </div>
                ))
              )}
            </div>
          </IronCard>

          {/* Active Job Status */}
          {activeJob && (
            <IronCard style={{
              background: activeJob.status === 'running' ? T.blueTint :
                activeJob.status === 'completed' ? T.greenTint :
                activeJob.status === 'failed' ? '#FDEEE6' : T.white,
              borderColor: activeJob.status === 'running' ? '#CBE0F0' :
                activeJob.status === 'completed' ? '#CBE5D6' :
                activeJob.status === 'failed' ? '#F6D8BA' : T.iron200,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {activeJob.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" style={{ color: T.blue }} />}
                {activeJob.status === 'completed' && <CheckCircle className="w-4 h-4" style={{ color: T.green }} />}
                {activeJob.status === 'failed' && <XCircle className="w-4 h-4" style={{ color: T.rose }} />}
                <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>
                  {activeJob.status === 'running' ? 'Processing Orders...' :
                   activeJob.status === 'completed' ? 'Job Completed' :
                   activeJob.status === 'failed' ? 'Job Failed' : 'Job Status'}
                </h3>
              </div>
              <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ color: T.iron500 }}>Job: <span style={{ ...mono, fontSize: 11 }}>{activeJob.job_id}</span></p>
                {activeJob.progress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: T.iron200, borderRadius: 999, height: 8, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: 8, borderRadius: 999, transition: 'all .2s',
                          background: activeJob.status === 'completed' ? T.green : activeJob.status === 'failed' ? T.rose : T.blue,
                          width: `${(activeJob.progress.completed / activeJob.progress.total) * 100}%`
                        }}
                      />
                    </div>
                    <span style={{ ...mono, fontSize: 11 }}>{activeJob.progress.completed}/{activeJob.progress.total}</span>
                  </div>
                )}
                {activeJob.status === 'running' && activeJob.progress?.current > 0 && (
                  <p style={{ color: T.blue, fontSize: 11.5 }}>
                    Currently processing: Order {activeJob.progress.current} of {activeJob.progress.total}
                  </p>
                )}
              </div>
            </IronCard>
          )}

          {/* AI Thinking Log Panel — intentionally hidden alongside the
              AI Assistant removal. Block kept inline-gated to minimize diff. */}
          {false && aiThinkingLog.length > 0 && (
            <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-xl p-4 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                <h3 className="font-semibold text-purple-300">AI Thinking Process</h3>
                <button
                  onClick={() => setAiThinkingLog([])}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <div
                ref={thinkingLogRef}
                className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs"
              >
                {aiThinkingLog.map((log, idx) => (
                  <div key={idx} className="flex gap-2 text-gray-300 py-1 border-b border-purple-900/30">
                    <span className="text-purple-500 shrink-0">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                    <span className={`${
                      log.thought.includes('✅') ? 'text-green-400' :
                      log.thought.includes('❌') ? 'text-red-400' :
                      log.thought.includes('⚠️') ? 'text-yellow-400' :
                      log.thought.includes('🔧') ? 'text-blue-400' :
                      'text-gray-300'
                    }`}>
                      {log.thought}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing Results */}
          {processResults.length > 0 && (
            <IronCard>
              <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Processing Results</h3>
              <div style={{ maxHeight: 192, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {processResults.map((result, idx) => (
                  <div key={idx} style={{ padding: 8, borderRadius: 6, fontSize: 12.5, background: result.success ? T.greenTint : '#FDEEE6', border: `1px solid ${result.success ? '#CBE5D6' : '#F6D8BA'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...mono, fontSize: 11 }}>{result.order_id}</span>
                      {result.success ? (
                        <CheckCircle className="w-4 h-4" style={{ color: T.green }} />
                      ) : (
                        <XCircle className="w-4 h-4" style={{ color: T.rose }} />
                      )}
                    </div>
                    {result.success ? (
                      <div style={{ marginTop: 4, fontSize: 11.5, color: T.iron500 }}>
                        <p>Tracking: {result.tracking_id}</p>
                        <p>Shipping: {result.shipping_type}</p>
                      </div>
                    ) : (
                      <p style={{ marginTop: 4, fontSize: 11.5, color: T.orangeDeep }}>{result.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </IronCard>
          )}

          {/* Shipping Rules Info */}
          <IronCard>
            <h3 style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Shipping Rules</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: T.iron500, fontSize: 12.5 }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: T.blue }} />
                Weight &gt; 20KG → <span style={{ color: T.blue, fontWeight: 600 }}>B2B</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: T.blue }} />
                Value &gt; ₹30,000 → <span style={{ color: T.blue, fontWeight: 600 }}>B2B</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: T.green }} />
                Otherwise → <span style={{ color: T.green, fontWeight: 600 }}>B2C</span>
              </p>
            </div>
          </IronCard>
        </div>
      </div>
    </IronShell>
  );
}
