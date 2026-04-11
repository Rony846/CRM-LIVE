import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, X, Send, Paperclip, Loader2, Bot, User, 
  AlertTriangle, CheckCircle, Package, Clock, Sparkles,
  ChevronDown, Upload, FileText, Phone, MapPin, Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function OrderBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [context, setContext] = useState({});
  const [briefing, setBriefing] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Get auth from localStorage and re-check when token changes
  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem('mg_token');
      console.log('OrderBot: Token found?', !!storedToken);
      
      if (storedToken && storedToken !== token) {
        setToken(storedToken);
        
        axios.get(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        }).then(res => {
          console.log('OrderBot: User loaded', res.data?.role);
          setUser(res.data);
          setAuthChecked(true);
        }).catch(err => {
          console.error('OrderBot: Auth error', err);
          setAuthChecked(true);
        });
      } else if (!storedToken) {
        setAuthChecked(true);
        setUser(null);
        setToken(null);
      }
    };
    
    // Initial check
    checkAuth();
    
    // Listen for storage events and periodic check
    const handleStorageChange = (e) => {
      if (e.key === 'mg_token') {
        checkAuth();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Periodic check every 2 seconds for 30 seconds after mount
    let checkCount = 0;
    const interval = setInterval(() => {
      checkCount++;
      if (checkCount > 15 || user) {
        clearInterval(interval);
        return;
      }
      checkAuth();
    }, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [token, user]);
  
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Only show for accountant and admin
  const canUseBot = user && ['admin', 'accountant'].includes(user?.role);
  console.log('OrderBot: canUseBot?', canUseBot, 'user role:', user?.role, 'authChecked:', authChecked);
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Fetch briefing when chat opens
  const fetchBriefing = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await axios.get(`${API}/api/bot/daily-briefing`, { headers });
      setBriefing(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching briefing:', err);
      return null;
    }
  }, [token, headers]);
  
  const handleOpen = async () => {
    setIsOpen(true);
    
    if (messages.length === 0) {
      // Show welcome message with briefing
      const brief = await fetchBriefing();
      
      let welcomeMsg = `👋 **Hi ${user?.first_name || 'there'}!** I'm your Operations Assistant.\n\n`;
      
      if (brief) {
        const urgent = brief.urgent;
        const attention = brief.attention;
        
        if (urgent.stuck_ready_to_dispatch > 0 || urgent.missing_invoices > 0 || attention.new_amazon_orders > 0) {
          welcomeMsg += `📊 **Quick Status:**\n`;
          if (urgent.stuck_ready_to_dispatch > 0) {
            welcomeMsg += `🔴 ${urgent.stuck_ready_to_dispatch} orders stuck in Ready to Dispatch\n`;
          }
          if (urgent.missing_invoices > 0) {
            welcomeMsg += `🟡 ${urgent.missing_invoices} orders missing invoices\n`;
          }
          if (attention.new_amazon_orders > 0) {
            welcomeMsg += `📦 ${attention.new_amazon_orders} new Amazon orders to process\n`;
          }
          welcomeMsg += `\n`;
        }
      }
      
      welcomeMsg += `**What can I help you with?**\n• Enter **Order ID**, **Phone**, or **Name** to process\n• Type **status** for full summary\n• Type **stuck** to fix delayed orders\n• Type **help** for all commands`;
      
      setMessages([{
        id: Date.now(),
        type: 'bot',
        content: welcomeMsg,
        actions: [
          { type: 'button', label: '📊 Status', command: 'status' },
          { type: 'button', label: '⚠️ Stuck Orders', command: 'stuck' },
          { type: 'button', label: '📋 Missing Data', command: 'missing' }
        ]
      }]);
    }
  };
  
  const addMessage = (type, content, actions = null, orderContext = null) => {
    const msg = {
      id: Date.now() + Math.random(),
      type,
      content,
      actions,
      orderContext
    };
    setMessages(prev => [...prev, msg]);
    if (orderContext) {
      setContext(orderContext);
    }
    return msg;
  };
  
  const handleSend = async (messageText = null) => {
    const text = messageText || input.trim();
    if (!text) return;
    
    // Add user message
    addMessage('user', text);
    setInput('');
    setLoading(true);
    
    try {
      // Handle context-based responses first
      if (context.awaiting_address_confirm && (text.toLowerCase() === 'yes' || text.toLowerCase() === 'no')) {
        if (text.toLowerCase() === 'yes' && context.previous_address) {
          // Apply previous address
          const addr = context.previous_address;
          await axios.post(`${API}/api/bot/update-field`, 
            new URLSearchParams({ order_id: context.current_order_id, field: 'address', value: addr.address }),
            { headers }
          );
          if (addr.city) {
            await axios.post(`${API}/api/bot/update-field`,
              new URLSearchParams({ order_id: context.current_order_id, field: 'city', value: addr.city }),
              { headers }
            );
          }
          if (addr.state) {
            await axios.post(`${API}/api/bot/update-field`,
              new URLSearchParams({ order_id: context.current_order_id, field: 'state', value: addr.state }),
              { headers }
            );
          }
          if (addr.pincode) {
            await axios.post(`${API}/api/bot/update-field`,
              new URLSearchParams({ order_id: context.current_order_id, field: 'pincode', value: addr.pincode }),
              { headers }
            );
          }
          
          addMessage('bot', `✅ Applied previous address!\n\n📍 ${addr.address}, ${addr.city} - ${addr.pincode}`, null, { ...context, awaiting_address_confirm: false });
          
          // Check what's next
          await checkOrderCompletion(context.current_order_id);
          setLoading(false);
          return;
        } else {
          addMessage('bot', 'Please enter the shipping address:', null, { ...context, awaiting_address_confirm: false, next_field: 'address' });
          setLoading(false);
          return;
        }
      }
      
      // Handle field input
      if (context.next_field && !text.startsWith('/') && text.toLowerCase() !== 'skip') {
        const field = context.next_field;
        
        try {
          const res = await axios.post(`${API}/api/bot/update-field`,
            new URLSearchParams({ order_id: context.current_order_id, field, value: text }),
            { headers }
          );
          
          if (res.data.is_complete) {
            addMessage('bot', `✅ ${field.replace('_', ' ')} saved!\n\n🎉 **All data complete!** Ready to dispatch.`, [
              { type: 'button', label: '✓ Dispatch Now', command: 'dispatch' },
              { type: 'button', label: 'Cancel', command: 'cancel' }
            ], { ...context, next_field: null, ready_to_dispatch: true });
          } else {
            const nextField = res.data.remaining_fields[0];
            addMessage('bot', `✅ ${field.replace('_', ' ')} saved!\n\nNext: **${nextField.replace('_', ' ')}**?`, 
              getFieldActions(nextField),
              { ...context, next_field: nextField }
            );
          }
        } catch (err) {
          addMessage('bot', `❌ Error: ${err.response?.data?.detail || 'Failed to update'}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle dispatch command
      if (text.toLowerCase() === 'dispatch' && context.ready_to_dispatch) {
        try {
          const res = await axios.post(`${API}/api/bot/dispatch`,
            new URLSearchParams({ order_id: context.current_order_id }),
            { headers }
          );
          
          addMessage('bot', `✅ **Order Dispatched Successfully!**\n\n📦 Dispatch: ${res.data.dispatch_number}\n\nThe order is now in the Dispatcher Queue.\n\nProcess another order?`, [
            { type: 'button', label: '📊 Status', command: 'status' }
          ], {});
        } catch (err) {
          addMessage('bot', `❌ Dispatch failed: ${err.response?.data?.detail || 'Unknown error'}\n\nPlease check the order and try again.`);
        }
        setLoading(false);
        return;
      }
      
      // Handle cancel
      if (text.toLowerCase() === 'cancel') {
        setContext({});
        addMessage('bot', 'Operation cancelled. What else can I help you with?');
        setLoading(false);
        return;
      }
      
      // Handle quick commands and search
      const response = await processCommand(text);
      
      if (response) {
        addMessage('bot', response.message, response.actions, response.context);
      }
      
    } catch (err) {
      console.error('Bot error:', err);
      addMessage('bot', `❌ Something went wrong. Please try again.`);
    } finally {
      setLoading(false);
    }
  };
  
  const processCommand = async (text) => {
    const cmd = text.toLowerCase().trim();
    
    // Quick commands
    if (['status', 'summary', 'briefing'].includes(cmd)) {
      const brief = await fetchBriefing();
      if (!brief) return { message: '❌ Failed to fetch status' };
      
      const urgent = brief.urgent;
      const attention = brief.attention;
      
      return {
        message: `📊 **Operations Summary**\n\n🔴 **URGENT**\n• ${urgent.stuck_ready_to_dispatch} orders stuck (3+ days)\n• ${urgent.missing_invoices} missing invoices\n• ${urgent.missing_tracking} missing tracking\n\n🟡 **ATTENTION**\n• ${attention.stuck_awaiting_stock} waiting for stock (5+ days)\n• ${attention.new_amazon_orders} new Amazon orders\n\n🟢 **TODAY**\n• Dispatched: ${brief.today.dispatched}\n• Yesterday: ${brief.yesterday.dispatched}`,
        actions: [
          { type: 'button', label: 'Fix stuck', command: 'stuck' },
          { type: 'button', label: 'Missing data', command: 'missing' }
        ]
      };
    }
    
    if (['stuck', 'stuck orders'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/stuck-orders?days=3`, { headers });
        const data = res.data;
        
        if (data.total_stuck === 0) {
          return { message: '✅ Great! No orders are stuck.' };
        }
        
        let msg = `Found **${data.total_stuck}** stuck orders:\n\n`;
        
        if (data.ready_to_dispatch.length > 0) {
          msg += `🔴 **Ready to Dispatch:**\n`;
          data.ready_to_dispatch.slice(0, 5).forEach((o, i) => {
            const missing = o.missing_fields?.slice(0, 2).join(', ') || 'Complete';
            msg += `${i+1}. ${o.order_id} - ${o.customer_name || 'Unknown'} (${o.days_stuck}d)\n   Missing: ${missing}\n`;
          });
        }
        
        if (data.awaiting_stock.length > 0) {
          msg += `\n🟡 **Awaiting Stock:**\n`;
          data.awaiting_stock.slice(0, 3).forEach((o, i) => {
            msg += `${i+1}. ${o.order_id} - ${o.master_sku_name || 'Unknown'} (${o.days_stuck}d)\n`;
          });
        }
        
        msg += `\nEnter order ID to fix:`;
        
        return { message: msg, context: { mode: 'fix_stuck' } };
      } catch (err) {
        return { message: '❌ Failed to fetch stuck orders' };
      }
    }
    
    if (['missing', 'missing data'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/missing-data`, { headers });
        const data = res.data;
        
        if (data.total_issues === 0) {
          return { message: '✅ All orders have complete data!' };
        }
        
        let msg = `Found **${data.total_issues}** data gaps:\n\n`;
        if (data.invoices.count > 0) msg += `📄 Missing Invoices: ${data.invoices.count}\n`;
        if (data.tracking_ids.count > 0) msg += `📦 Missing Tracking: ${data.tracking_ids.count}\n`;
        if (data.shipping_labels.count > 0) msg += `🏷️ Missing Labels: ${data.shipping_labels.count}\n`;
        if (data.phone_numbers.count > 0) msg += `📞 Missing Phones: ${data.phone_numbers.count}\n`;
        if (data.addresses.count > 0) msg += `📍 Missing Addresses: ${data.addresses.count}\n`;
        
        return { message: msg, actions: [
          { type: 'button', label: 'Fix invoices', command: 'fix invoices' }
        ]};
      } catch (err) {
        return { message: '❌ Failed to fetch missing data' };
      }
    }
    
    if (['production', 'production suggestions'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/production-suggestions`, { headers });
        const data = res.data;
        
        if (!data.suggestions.length) {
          return { message: '✅ Stock levels adequate for all pending orders.' };
        }
        
        let msg = `🏭 **Production Recommendations:**\n\n`;
        data.suggestions.slice(0, 5).forEach(s => {
          const emoji = s.severity === 'critical' ? '🔴' : '🟡';
          msg += `${emoji} **${s.master_sku_name}**\n   Stock: ${s.current_stock} | Needed: ${s.total_quantity_needed} | Waiting: ${s.days_waiting}d\n\n`;
        });
        
        return { message: msg };
      } catch (err) {
        return { message: '❌ Failed to fetch production suggestions' };
      }
    }
    
    if (cmd === 'help') {
      return {
        message: `📖 **Commands:**\n\n• **status** - Daily summary\n• **stuck** - View stuck orders\n• **missing** - Find incomplete orders\n• **production** - Stock suggestions\n\n**Search:**\n• Enter Order ID\n• Enter Phone Number\n• Enter Customer Name\n\n**During processing:**\n• **skip** - Skip field\n• **cancel** - Cancel operation`
      };
    }
    
    // Search for order
    try {
      const res = await axios.post(`${API}/api/bot/search`,
        new URLSearchParams({ query: text }),
        { headers }
      );
      
      const results = res.data.results;
      
      if (results.length === 0) {
        return { message: `🔍 No orders found for "${text}".\n\nTry:\n• Full Order ID\n• Phone number\n• Customer name` };
      }
      
      if (results.length === 1) {
        return await formatOrderResponse(results[0]);
      }
      
      // Multiple results
      let msg = `Found **${results.length}** orders:\n\n`;
      results.slice(0, 5).forEach((o, i) => {
        msg += `${i+1}. **${o.order_id || 'N/A'}** - ${o.customer_name || 'Unknown'}\n   Status: ${o._source_display}\n`;
      });
      msg += `\nEnter number to select:`;
      
      return { message: msg, context: { search_results: results.slice(0, 5) } };
      
    } catch (err) {
      return { message: '❌ Search failed. Please try again.' };
    }
  };
  
  const formatOrderResponse = async (order) => {
    const known = order.known_fields || {};
    const missing = order.missing_fields || [];
    
    let msg = `📦 **Order Found!**\nStatus: **${order._source_display || order.status}**\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    Object.entries(known).forEach(([key, value]) => {
      msg += `✓ **${key.replace('_', ' ')}:** ${value}\n`;
    });
    
    missing.forEach(field => {
      msg += `✗ **${field.replace('_', ' ')}:** Missing\n`;
    });
    
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Check for repeat customer
    if (known.phone && missing.includes('address')) {
      try {
        const histRes = await axios.get(`${API}/api/bot/customer-history/${encodeURIComponent(known.phone)}`, { headers });
        const history = histRes.data;
        
        if (history.is_repeat_customer) {
          const addr = history.last_address;
          msg += `\n💡 **Repeat Customer** (${history.total_orders} orders)\n`;
          msg += `Last address: ${addr.address}, ${addr.city} - ${addr.pincode}\n`;
          msg += `Use this address?`;
          
          return {
            message: msg,
            actions: [
              { type: 'button', label: 'Yes, use this', command: 'yes' },
              { type: 'button', label: 'No, different', command: 'no' }
            ],
            context: {
              current_order_id: order.id,
              previous_address: addr,
              awaiting_address_confirm: true,
              missing_fields: missing
            }
          };
        }
      } catch (err) {
        console.error('Error checking customer history:', err);
      }
    }
    
    if (missing.length === 0) {
      if (order._source === 'pending_fulfillment' && order.status !== 'dispatched') {
        msg += `\n🎉 **All complete!** Ready to dispatch.`;
        return {
          message: msg,
          actions: [
            { type: 'button', label: '✓ Dispatch Now', command: 'dispatch' },
            { type: 'button', label: 'Cancel', command: 'cancel' }
          ],
          context: { current_order_id: order.id, ready_to_dispatch: true }
        };
      }
      return { message: msg + '\n✅ This order is complete.' };
    }
    
    const nextField = missing[0];
    msg += `\nLet me collect missing details.\n**${nextField.replace('_', ' ')}?**`;
    
    return {
      message: msg,
      actions: getFieldActions(nextField),
      context: { current_order_id: order.id, next_field: nextField, missing_fields: missing }
    };
  };
  
  const getFieldActions = (field) => {
    if (['invoice', 'shipping_label'].includes(field)) {
      return [{ type: 'file_upload', field, label: `Upload ${field.replace('_', ' ')}` }];
    }
    return [];
  };
  
  const checkOrderCompletion = async (orderId) => {
    try {
      const res = await axios.post(`${API}/api/bot/search`,
        new URLSearchParams({ query: orderId }),
        { headers }
      );
      
      if (res.data.results.length > 0) {
        const order = res.data.results[0];
        const missing = order.missing_fields || [];
        
        if (missing.length === 0) {
          addMessage('bot', `🎉 **All data complete!** Ready to dispatch.`, [
            { type: 'button', label: '✓ Dispatch Now', command: 'dispatch' },
            { type: 'button', label: 'Cancel', command: 'cancel' }
          ], { current_order_id: orderId, ready_to_dispatch: true });
        } else {
          const nextField = missing[0];
          addMessage('bot', `Next: **${nextField.replace('_', ' ')}**?`,
            getFieldActions(nextField),
            { current_order_id: orderId, next_field: nextField, missing_fields: missing }
          );
        }
      }
    } catch (err) {
      console.error('Error checking order:', err);
    }
  };
  
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingFile(field);
    
    try {
      const formData = new FormData();
      formData.append('order_id', context.current_order_id);
      formData.append('field', field);
      formData.append('file', file);
      
      const res = await axios.post(`${API}/api/bot/upload-file`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      addMessage('user', `📎 Uploaded: ${file.name}`);
      
      if (res.data.is_complete) {
        addMessage('bot', `✅ ${field.replace('_', ' ')} uploaded!\n\n🎉 **All complete!** Ready to dispatch.`, [
          { type: 'button', label: '✓ Dispatch Now', command: 'dispatch' },
          { type: 'button', label: 'Cancel', command: 'cancel' }
        ], { ...context, next_field: null, ready_to_dispatch: true });
      } else {
        const nextField = res.data.remaining_fields[0];
        addMessage('bot', `✅ ${field.replace('_', ' ')} uploaded!\n\nNext: **${nextField.replace('_', ' ')}**?`,
          getFieldActions(nextField),
          { ...context, next_field: nextField }
        );
      }
    } catch (err) {
      toast.error(`Upload failed: ${err.response?.data?.detail || 'Unknown error'}`);
    } finally {
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleActionClick = (action) => {
    if (action.type === 'button') {
      handleSend(action.command);
    } else if (action.type === 'file_upload') {
      fileInputRef.current?.click();
      setContext(prev => ({ ...prev, awaiting_file: action.field }));
    }
  };
  
  const renderMessage = (msg) => {
    const isBot = msg.type === 'bot';
    
    return (
      <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}>
        <div className={`max-w-[85%] ${isBot ? 'order-2' : 'order-1'}`}>
          {isBot && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs text-slate-500">Assistant</span>
            </div>
          )}
          <div className={`rounded-2xl px-4 py-2.5 ${
            isBot 
              ? 'bg-slate-700/80 text-slate-100 rounded-tl-sm' 
              : 'bg-cyan-600 text-white rounded-tr-sm'
          }`}>
            <div className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ 
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>')
            }} />
          </div>
          
          {/* Action buttons */}
          {msg.actions && msg.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {msg.actions.map((action, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={action.type === 'file_upload' ? 'outline' : 'secondary'}
                  className={`text-xs ${action.type === 'file_upload' ? 'border-cyan-500 text-cyan-400' : ''}`}
                  onClick={() => handleActionClick(action)}
                  disabled={uploadingFile === action.field}
                >
                  {action.type === 'file_upload' && <Upload className="w-3 h-3 mr-1" />}
                  {uploadingFile === action.field ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Don't render until auth is checked, or if user isn't an accountant/admin
  if (!authChecked || !canUseBot) return null;
  
  return (
    <>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => handleFileUpload(e, context.awaiting_file)}
      />
      
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-20 right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-105"
          data-testid="orderbot-toggle"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          {briefing && (briefing.urgent?.stuck_ready_to_dispatch > 0 || briefing.urgent?.missing_invoices > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
              !
            </span>
          )}
        </button>
      )}
      
      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 h-[32rem] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden" data-testid="orderbot-window">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Operations Assistant</h3>
                <p className="text-cyan-100 text-xs">Process orders faster</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {messages.map(renderMessage)}
            {loading && (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-3 border-t border-slate-700 bg-slate-800/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Enter order ID, phone, or command..."
                className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={loading}
                data-testid="orderbot-input"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-cyan-600 hover:bg-cyan-500"
                data-testid="orderbot-send"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
