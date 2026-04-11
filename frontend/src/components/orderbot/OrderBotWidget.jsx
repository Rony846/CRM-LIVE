import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, X, Send, Paperclip, Loader2, Bot, User, 
  AlertTriangle, CheckCircle, Package, Clock, Sparkles,
  ChevronDown, Upload, FileText, Phone, MapPin, Truck,
  Minimize2, RefreshCw, Search, FileWarning, Factory, HelpCircle,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function OrderBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
  
  // Reset conversation
  const resetConversation = () => {
    setMessages([]);
    setContext({});
    if (isOpen) {
      handleOpen(true);
    }
  };
  
  const handleOpen = async (forceRefresh = false) => {
    setIsOpen(true);
    setIsMinimized(false);
    
    if (messages.length === 0 || forceRefresh) {
      // Show welcome message with briefing
      const brief = await fetchBriefing();
      
      let welcomeMsg = `**Hi ${user?.first_name || 'there'}!** I'm your Operations Assistant.\n\n`;
      
      if (brief) {
        const urgent = brief.urgent;
        const attention = brief.attention;
        
        if (urgent.stuck_ready_to_dispatch > 0 || urgent.missing_invoices > 0 || attention.new_amazon_orders > 0 || urgent.missing_tracking > 0) {
          welcomeMsg += `**Quick Status:**\n`;
          if (urgent.stuck_ready_to_dispatch > 0) {
            welcomeMsg += `• ${urgent.stuck_ready_to_dispatch} orders stuck (Ready to Dispatch 3+ days)\n`;
          }
          if (urgent.missing_invoices > 0) {
            welcomeMsg += `• ${urgent.missing_invoices} orders missing invoices\n`;
          }
          if (urgent.missing_tracking > 0) {
            welcomeMsg += `• ${urgent.missing_tracking} orders missing tracking IDs\n`;
          }
          if (attention.new_amazon_orders > 0) {
            welcomeMsg += `• ${attention.new_amazon_orders} new Amazon orders to process\n`;
          }
          welcomeMsg += `\n`;
        }
      }
      
      welcomeMsg += `**I can understand natural language!** Try:\n• "Find order 1234" or "Show me order ABC-123"\n• "Status" or "How's everything today?"\n• "What orders are stuck?"\n• "Show missing invoices"`;
      
      if (forceRefresh) {
        setMessages([]);
      }
      
      setMessages([{
        id: Date.now(),
        type: 'bot',
        content: welcomeMsg,
        actions: [
          { type: 'button', label: 'Find Order', command: 'find_order_prompt', icon: 'search' },
          { type: 'button', label: 'Status', command: 'status', icon: 'status' },
          { type: 'button', label: 'Stuck Orders', command: 'stuck', icon: 'alert' },
          { type: 'button', label: 'Missing Invoices', command: 'fix_invoices', icon: 'file' },
          { type: 'button', label: 'Missing Data', command: 'missing', icon: 'data' },
          { type: 'button', label: 'Production', command: 'production', icon: 'factory' }
        ]
      }]);
      setContext({});
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
  
  // Parse natural language to detect intent
  const parseIntent = (text) => {
    const lower = text.toLowerCase().trim();
    
    // Check for commands FIRST before order matching
    // Fix invoices / missing invoices
    if (/fix\s*invoice|missing\s*invoice|orders?\s*without\s*invoice|need\s*invoice/i.test(lower)) {
      return { intent: 'fix_invoices' };
    }
    
    // Stuck orders
    if (/stuck|delayed|pending\s*too\s*long|old\s*orders/i.test(lower)) {
      return { intent: 'stuck_orders' };
    }
    
    // Status / Summary
    if (/status|summary|briefing|how'?s?\s*everything|what'?s?\s*going\s*on|overview/i.test(lower)) {
      return { intent: 'status' };
    }
    
    // Missing data
    if (/missing\s*data|incomplete|data\s*gap/i.test(lower)) {
      return { intent: 'missing_data' };
    }
    
    // Production
    if (/production|stock|inventory|what\s*to\s*make/i.test(lower)) {
      return { intent: 'production' };
    }
    
    // Help
    if (/^(help|what\s*can\s*you\s*do|commands|how\s*to\s*use)$/i.test(lower)) {
      return { intent: 'help' };
    }
    
    // Pattern: Find/show/get/check order [ID] - more specific patterns
    // Check for patterns with "order" keyword explicitly
    const orderPatterns = [
      // "show me order 123" or "find order 123" - require "order" keyword
      /(?:show\s+me|find|get|check|pull|look\s*up|search)\s+order\s+(?:id\s+)?[#]?([A-Za-z0-9][A-Za-z0-9\-_]+)/i,
      // "order 123" or "order id 123"
      /^order\s+(?:id\s+)?[#]?([A-Za-z0-9][A-Za-z0-9\-_]+)$/i,
      // "can you find order 123"
      /can\s+you\s+(?:find|show|get|check)\s+order\s+(?:id\s+)?[#]?([A-Za-z0-9][A-Za-z0-9\-_]+)/i,
      // Just a long alphanumeric string that looks like an order ID (e.g., 171-3496729-7741914)
      /^([0-9]{3}-[0-9]{7}-[0-9]{7})$/i,
      // Pattern like MG-1234 or ABC-123
      /^([A-Z]{2,4}-[0-9]+)$/i
    ];
    
    const skipWords = ["status", "stuck", "missing", "help", "production", "invoices", "me", "order", "orders", "the", "a", "an", "data"];
    
    for (const pattern of orderPatterns) {
      const match = text.match(pattern);
      if (match) {
        const orderId = match[1].trim();
        // Skip if it's just a command word
        if (skipWords.includes(orderId.toLowerCase())) {
          continue;
        }
        // Skip very short IDs (likely partial words)
        if (orderId.length < 3) {
          continue;
        }
        return { intent: 'find_order', orderId };
      }
    }
    
    return { intent: 'search', query: text };
  };
  
  const handleSend = async (messageText = null) => {
    const text = messageText || input.trim();
    if (!text) return;
    
    // Add user message
    addMessage('user', text);
    setInput('');
    setLoading(true);
    
    try {
      // Handle special commands from buttons first
      if (text === 'find_order_prompt') {
        addMessage('bot', `Enter the **Order ID**, **Tracking ID**, **Phone Number**, or **Customer Name** to search:\n\n_Example: "406-9879016-2716332" or "Find order MG-1234"_`, [], { awaiting_order_search: true });
        setLoading(false);
        return;
      }
      
      // Handle fix_invoices command directly
      if (text === 'fix_invoices' || text.toLowerCase() === 'fix invoices') {
        await handleFixInvoices();
        setLoading(false);
        return;
      }
      
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
          
          addMessage('bot', `Applied previous address!\n\n${addr.address}, ${addr.city} - ${addr.pincode}`, null, { ...context, awaiting_address_confirm: false });
          
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
            addMessage('bot', `**${field.replace('_', ' ')}** saved!\n\nBasic data complete. Let me prepare dispatch confirmation...`, [
              { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' },
              { type: 'button', label: 'Cancel', command: 'cancel' }
            ], { ...context, next_field: null, awaiting_prepare: true });
          } else {
            const nextField = res.data.remaining_fields[0];
            addMessage('bot', `**${field.replace('_', ' ')}** saved!\n\nNext: **${nextField.replace('_', ' ')}**?`, 
              getFieldActions(nextField),
              { ...context, next_field: nextField }
            );
          }
        } catch (err) {
          addMessage('bot', `Error: ${err.response?.data?.detail || 'Failed to update'}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle prepare_dispatch command - show comprehensive confirmation
      if (text.toLowerCase() === 'prepare_dispatch' || (context.awaiting_prepare && text.toLowerCase() === 'yes')) {
        try {
          const res = await axios.get(`${API}/api/bot/prepare-dispatch/${context.current_order_id}`, { headers });
          const data = res.data;
          
          let msg = `**DISPATCH CONFIRMATION**\n\n`;
          msg += `**ORDER DETAILS**\n`;
          msg += `Order ID: **${data.order.order_id}**\n`;
          msg += `Payment: **${data.order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}**\n\n`;
          
          msg += `**CUSTOMER**\n`;
          msg += `${data.customer.name}\n`;
          msg += `${data.customer.phone}\n`;
          msg += `${data.customer.address}, ${data.customer.city}\n`;
          msg += `${data.customer.state} - ${data.customer.pincode}\n\n`;
          
          msg += `**PRODUCT**\n`;
          msg += `${data.product.name}\n`;
          msg += `SKU: ${data.product.sku_code || 'N/A'}\n`;
          msg += `Qty: ${data.product.quantity}\n`;
          if (data.product.is_manufactured) {
            msg += `Manufactured Item (Serial Required)\n`;
          }
          msg += `\n`;
          
          msg += `**PRICING (${data.pricing.source === 'amazon' ? 'From Amazon' : 'From Order'})**\n`;
          msg += `Unit Price: ₹${data.pricing.unit_price_without_gst?.toLocaleString() || 0} + GST\n`;
          msg += `GST (${data.pricing.gst_rate}%): ₹${data.pricing.gst_amount?.toLocaleString() || 0}\n`;
          msg += `**TOTAL: ₹${data.pricing.total_value?.toLocaleString() || 0}**\n\n`;
          
          msg += `**COMPLIANCE**\n`;
          msg += `Tracking: ${data.logistics.tracking_id || 'NOT SET'}\n`;
          msg += `Invoice: ${data.documents.invoice_uploaded ? 'Uploaded' : 'Missing'}\n`;
          msg += `Label: ${data.documents.label_uploaded ? 'Uploaded' : 'Missing'}\n`;
          
          // E-Way Bill check
          if (data.pricing.total_value > 50000) {
            msg += `\n**E-WAY BILL REQUIRED** (Invoice > ₹50,000)\n`;
            msg += `E-Way Bill #: ${data.documents.eway_bill_number || 'NOT SET'}\n`;
          }
          
          // Serial Number
          if (data.serial_numbers.available?.length > 0 || data.product.is_manufactured) {
            msg += `\n**SERIAL NUMBER**\n`;
            if (data.serial_numbers.selected) {
              msg += `Selected: **${data.serial_numbers.selected}**\n`;
            } else {
              msg += `Not selected. Available: ${data.serial_numbers.available?.length || 0}\n`;
            }
          }
          
          // Missing fields
          if (data.missing_fields?.length > 0) {
            msg += `\n**MISSING (Required):**\n`;
            data.missing_fields.forEach(f => {
              msg += `• ${f.replace('_', ' ')}\n`;
            });
          }
          
          // Store dispatch data in context for confirmation
          const dispatchContext = {
            ...context,
            dispatch_data: data,
            awaiting_prepare: false
          };
          
          if (data.ready_to_dispatch) {
            msg += `\n**All compliance checks passed!**\n\nType **CONFIRM** to dispatch.`;
            dispatchContext.awaiting_confirm = true;
          } else {
            msg += `\n**Cannot dispatch - missing required data**`;
            
            // Determine next field to collect
            const nextMissing = data.missing_fields[0];
            dispatchContext.next_field = nextMissing;
            
            if (nextMissing === 'serial_number' && data.serial_numbers.available?.length > 0) {
              msg += `\n\nSelect a serial number:`;
              dispatchContext.awaiting_serial_select = true;
            } else if (nextMissing === 'tracking_id') {
              msg += `\n\nEnter the tracking ID:`;
            } else if (nextMissing === 'eway_bill_number') {
              msg += `\n\nEnter the E-Way Bill number:`;
            }
          }
          
          addMessage('bot', msg, data.ready_to_dispatch ? [] : getFieldActions(data.missing_fields[0]), dispatchContext);
          
        } catch (err) {
          addMessage('bot', `Error preparing dispatch: ${err.response?.data?.detail || 'Unknown error'}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle serial number selection
      if (context.awaiting_serial_select && text) {
        try {
          await axios.post(`${API}/api/bot/select-serial`,
            new URLSearchParams({ order_id: context.current_order_id, serial_number: text }),
            { headers }
          );
          
          addMessage('bot', `Serial number **${text}** selected!\n\nLet me refresh the dispatch details...`, [
            { type: 'button', label: 'Refresh', command: 'prepare_dispatch' }
          ], { ...context, awaiting_serial_select: false, awaiting_prepare: true });
        } catch (err) {
          addMessage('bot', `Error: ${err.response?.data?.detail || 'Invalid serial number'}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle CONFIRM dispatch
      if (text.toLowerCase() === 'confirm' && context.awaiting_confirm) {
        try {
          const data = context.dispatch_data;
          
          const res = await axios.post(`${API}/api/bot/dispatch`,
            new URLSearchParams({ 
              order_id: context.current_order_id,
              serial_numbers: data.serial_numbers?.selected || '',
              tracking_id: data.logistics?.tracking_id || '',
              payment_status: data.order?.payment_status || 'unpaid',
              invoice_value: data.pricing?.total_value || 0,
              eway_bill_number: data.documents?.eway_bill_number || '',
              confirmed: 'true'
            }),
            { headers }
          );
          
          addMessage('bot', `**ORDER DISPATCHED SUCCESSFULLY!**\n\nDispatch #: ${res.data.dispatch_number}\nCustomer: ${data.customer?.name}\nValue: ₹${data.pricing?.total_value?.toLocaleString()}\nTracking: ${data.logistics?.tracking_id}\n\nOrder is now in the Dispatcher Queue.\n\nProcess another order?`, [
            { type: 'button', label: 'Find Order', command: 'find_order_prompt', icon: 'search' },
            { type: 'button', label: 'Status', command: 'status', icon: 'status' }
          ], {});
        } catch (err) {
          const errorDetail = err.response?.data?.detail;
          if (errorDetail?.errors) {
            let errorMsg = `**Compliance Check Failed:**\n\n`;
            errorDetail.errors.forEach(e => {
              errorMsg += `• ${e}\n`;
            });
            errorMsg += `\nPlease provide the missing information.`;
            addMessage('bot', errorMsg);
          } else {
            addMessage('bot', `Dispatch failed: ${errorDetail || 'Unknown error'}`);
          }
        }
        setLoading(false);
        return;
      }
      
      // Handle old dispatch command - redirect to prepare
      if (text.toLowerCase() === 'dispatch' && (context.ready_to_dispatch || context.current_order_id)) {
        addMessage('bot', `Let me prepare the dispatch confirmation with all required details...`, [
          { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' }
        ], { ...context, awaiting_prepare: true });
        setLoading(false);
        return;
      }
      
      // Handle cancel
      if (text.toLowerCase() === 'cancel') {
        setContext({});
        addMessage('bot', 'Operation cancelled. What else can I help you with?', [
          { type: 'button', label: 'Find Order', command: 'find_order_prompt', icon: 'search' },
          { type: 'button', label: 'Status', command: 'status', icon: 'status' }
        ]);
        setLoading(false);
        return;
      }
      
      // Parse intent from natural language
      const intent = parseIntent(text);
      
      if (intent.intent === 'find_order' && intent.orderId) {
        // Do comprehensive order analysis
        await handleComprehensiveOrderLookup(intent.orderId);
        setLoading(false);
        return;
      }
      
      if (intent.intent === 'fix_invoices') {
        await handleFixInvoices();
        setLoading(false);
        return;
      }
      
      // Handle quick commands and search
      const response = await processCommand(text, intent);
      
      if (response) {
        addMessage('bot', response.message, response.actions, response.context);
      }
      
    } catch (err) {
      console.error('Bot error:', err);
      addMessage('bot', `Something went wrong. Please try again.`);
    } finally {
      setLoading(false);
    }
  };
  
  // Comprehensive order lookup with all checks
  const handleComprehensiveOrderLookup = async (orderId) => {
    try {
      const res = await axios.get(`${API}/api/bot/comprehensive-order/${encodeURIComponent(orderId)}`, { headers });
      const analysis = res.data;
      
      if (!analysis.found) {
        addMessage('bot', `No order found for "${orderId}".\n\nTry:\n• Full Order ID\n• Tracking ID\n• Phone number\n• Customer name`);
        return;
      }
      
      let msg = `**ORDER ANALYSIS: ${orderId}**\n`;
      msg += `Source: ${analysis.source.replace('_', ' ')}\n\n`;
      
      // Customer Details
      const cd = analysis.checks.customer_details;
      const cdIcon = cd.status === 'complete' ? '✓' : '✗';
      msg += `${cdIcon} **Customer Details** - ${cd.status.toUpperCase()}\n`;
      if (cd.data.name) msg += `   Name: ${cd.data.name}\n`;
      if (cd.data.phone) msg += `   Phone: ${cd.data.phone}\n`;
      if (cd.data.address) msg += `   Address: ${cd.data.address}\n`;
      if (cd.missing?.length > 0) msg += `   Missing: ${cd.missing.join(', ')}\n`;
      msg += '\n';
      
      // Tracking ID
      const tr = analysis.checks.tracking_id;
      const trIcon = tr.status === 'complete' ? '✓' : '✗';
      msg += `${trIcon} **Tracking ID** - ${tr.data || 'NOT SET'}\n\n`;
      
      // Serial Numbers
      const sn = analysis.checks.serial_numbers;
      if (sn.required) {
        const snIcon = sn.status === 'complete' ? '✓' : '✗';
        msg += `${snIcon} **Serial Numbers** - ${sn.status === 'complete' ? sn.data.join(', ') : 'NOT ASSIGNED'}\n\n`;
      }
      
      // SKU Mapping
      const sku = analysis.checks.sku_mapping;
      const skuIcon = sku.status === 'complete' ? '✓' : '✗';
      msg += `${skuIcon} **SKU Mapping** - ${sku.status.toUpperCase()}\n`;
      if (sku.data?.length > 0) {
        sku.data.forEach(s => {
          if (s.mapped) {
            msg += `   ${s.sku_code}: ${s.name} (HSN: ${s.hsn_code || 'N/A'})\n`;
          } else {
            msg += `   ${s.title || 'Unknown'}: NOT MAPPED\n`;
          }
        });
      }
      msg += '\n';
      
      // Pricing & GST
      const pg = analysis.checks.pricing_gst;
      const pgIcon = pg.status === 'complete' ? '✓' : '✗';
      msg += `${pgIcon} **Pricing & GST** - ${pg.status.toUpperCase()}\n`;
      if (pg.data?.invoice_value) msg += `   Invoice Value: ₹${pg.data.invoice_value.toLocaleString()}\n`;
      if (pg.data?.payment_status) msg += `   Payment Status: ${pg.data.payment_status}\n`;
      msg += '\n';
      
      // Sales Invoice
      const si = analysis.checks.sales_invoice;
      const siIcon = si.status === 'complete' ? '✓' : '✗';
      msg += `${siIcon} **Sales Invoice** - ${si.status === 'complete' ? si.data?.invoice_number : 'NOT CREATED'}\n\n`;
      
      // Dispatch Entry
      const de = analysis.checks.dispatch_entry;
      const deIcon = de.status === 'complete' ? '✓' : '✗';
      msg += `${deIcon} **Dispatch Entry** - ${de.status === 'complete' ? de.data?.dispatch_number : 'NOT DISPATCHED'}\n\n`;
      
      // Payment Reconciliation
      const pr = analysis.checks.payment_reconciliation;
      const prIcon = pr.status === 'complete' ? '✓' : pr.status === 'pending' ? '~' : '✗';
      msg += `${prIcon} **Payment Reconciliation** - ${pr.status.toUpperCase()}\n`;
      if (pr.marketplace_order) {
        msg += `   Marketplace order - ${pr.data?.matched ? 'Matched' : 'Not matched'}\n`;
      }
      msg += '\n';
      
      // Summary
      msg += `**SUMMARY:** ${analysis.summary.complete}/${analysis.summary.total} checks passed\n`;
      if (analysis.summary.issues.length > 0) {
        msg += `**Issues:**\n`;
        analysis.summary.issues.forEach(issue => {
          msg += `• ${issue}\n`;
        });
      }
      
      // Provide actions based on status
      const actions = [];
      if (analysis.source === 'pending_fulfillment' && analysis.checks.dispatch_entry.status === 'missing') {
        actions.push({ type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' });
      }
      actions.push({ type: 'button', label: 'Search Another', command: 'find_order_prompt', icon: 'search' });
      
      addMessage('bot', msg, actions, { 
        current_order_id: analysis.raw_order?.id,
        analysis: analysis
      });
      
    } catch (err) {
      console.error('Order lookup error:', err);
      
      // Fallback to simple search
      try {
        const res = await axios.post(`${API}/api/bot/search`,
          new URLSearchParams({ query: orderId }),
          { headers }
        );
        
        const results = res.data.results;
        
        if (results.length === 0) {
          addMessage('bot', `No orders found for "${orderId}".\n\nTry:\n• Full Order ID\n• Phone number\n• Customer name`);
          return;
        }
        
        if (results.length === 1) {
          const response = await formatOrderResponse(results[0]);
          addMessage('bot', response.message, response.actions, response.context);
          return;
        }
        
        // Multiple results
        let msg = `Found **${results.length}** orders:\n\n`;
        results.slice(0, 5).forEach((o, i) => {
          msg += `${i+1}. **${o.order_id || 'N/A'}** - ${o.customer_name || 'Unknown'}\n   Status: ${o._source_display}\n`;
        });
        msg += `\nEnter number to select:`;
        
        addMessage('bot', msg, [], { search_results: results.slice(0, 5) });
        
      } catch (searchErr) {
        addMessage('bot', `Search failed: ${searchErr.message}`);
      }
    }
  };
  
  // Handle fix invoices command
  const handleFixInvoices = async () => {
    try {
      const res = await axios.get(`${API}/api/bot/orders-missing-invoices`, { headers });
      const data = res.data;
      
      if (data.count === 0) {
        addMessage('bot', `All orders have invoices uploaded! No orders need fixing.`, [
          { type: 'button', label: 'Status', command: 'status' }
        ]);
        return;
      }
      
      let msg = `**Found ${data.count} orders missing invoices:**\n\n`;
      
      data.orders.slice(0, 10).forEach((order, i) => {
        msg += `${i+1}. **${order.order_id || order.tracking_id || 'N/A'}**\n`;
        msg += `   Customer: ${order.customer_name || 'Unknown'}\n`;
        msg += `   Tracking: ${order.has_tracking ? 'Yes' : 'No'} | Label: ${order.has_label ? 'Yes' : 'No'}\n`;
      });
      
      if (data.count > 10) {
        msg += `\n... and ${data.count - 10} more\n`;
      }
      
      msg += `\nEnter an order ID to upload invoice:`;
      
      addMessage('bot', msg, [
        { type: 'button', label: 'View All Missing Data', command: 'missing' }
      ], { mode: 'fix_invoices' });
      
    } catch (err) {
      addMessage('bot', `Error fetching orders: ${err.response?.data?.detail || err.message}`);
    }
  };
  
  const processCommand = async (text, intent) => {
    const cmd = text.toLowerCase().trim();
    
    // Quick commands
    if (intent?.intent === 'status' || ['status', 'summary', 'briefing'].includes(cmd)) {
      const brief = await fetchBriefing();
      if (!brief) return { message: 'Failed to fetch status' };
      
      const urgent = brief.urgent;
      const attention = brief.attention;
      
      return {
        message: `**Operations Summary**\n\n**URGENT**\n• ${urgent.stuck_ready_to_dispatch} orders stuck (3+ days)\n• ${urgent.missing_invoices} missing invoices\n• ${urgent.missing_tracking} missing tracking\n\n**ATTENTION**\n• ${attention.stuck_awaiting_stock} waiting for stock (5+ days)\n• ${attention.new_amazon_orders} new Amazon orders\n\n**TODAY**\n• Dispatched: ${brief.today.dispatched}\n• Yesterday: ${brief.yesterday.dispatched}`,
        actions: [
          { type: 'button', label: 'Fix Stuck', command: 'stuck' },
          { type: 'button', label: 'Missing Data', command: 'missing' },
          { type: 'button', label: 'Missing Invoices', command: 'fix_invoices' }
        ]
      };
    }
    
    if (intent?.intent === 'stuck_orders' || ['stuck', 'stuck orders'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/stuck-orders?days=3`, { headers });
        const data = res.data;
        
        if (data.total_stuck === 0) {
          return { message: 'Great! No orders are stuck.' };
        }
        
        let msg = `Found **${data.total_stuck}** stuck orders:\n\n`;
        
        if (data.ready_to_dispatch.length > 0) {
          msg += `**Ready to Dispatch:**\n`;
          data.ready_to_dispatch.slice(0, 5).forEach((o, i) => {
            const missing = o.missing_fields?.slice(0, 2).join(', ') || 'Complete';
            msg += `${i+1}. ${o.order_id} - ${o.customer_name || 'Unknown'} (${o.days_stuck}d)\n   Missing: ${missing}\n`;
          });
        }
        
        if (data.awaiting_stock.length > 0) {
          msg += `\n**Awaiting Stock:**\n`;
          data.awaiting_stock.slice(0, 3).forEach((o, i) => {
            msg += `${i+1}. ${o.order_id} - ${o.master_sku_name || 'Unknown'} (${o.days_stuck}d)\n`;
          });
        }
        
        msg += `\nEnter order ID to fix:`;
        
        return { message: msg, context: { mode: 'fix_stuck' } };
      } catch (err) {
        return { message: 'Failed to fetch stuck orders' };
      }
    }
    
    if (intent?.intent === 'missing_data' || ['missing', 'missing data'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/missing-data`, { headers });
        const data = res.data;
        
        if (data.total_issues === 0) {
          return { message: 'All orders have complete data!' };
        }
        
        let msg = `Found **${data.total_issues}** data gaps:\n\n`;
        if (data.invoices.count > 0) msg += `• Missing Invoices: ${data.invoices.count}\n`;
        if (data.tracking_ids.count > 0) msg += `• Missing Tracking: ${data.tracking_ids.count}\n`;
        if (data.shipping_labels.count > 0) msg += `• Missing Labels: ${data.shipping_labels.count}\n`;
        if (data.phone_numbers.count > 0) msg += `• Missing Phones: ${data.phone_numbers.count}\n`;
        if (data.addresses.count > 0) msg += `• Missing Addresses: ${data.addresses.count}\n`;
        
        return { message: msg, actions: [
          { type: 'button', label: 'Fix Invoices', command: 'fix_invoices' }
        ]};
      } catch (err) {
        return { message: 'Failed to fetch missing data' };
      }
    }
    
    if (intent?.intent === 'production' || ['production', 'production suggestions'].includes(cmd)) {
      try {
        const res = await axios.get(`${API}/api/bot/production-suggestions`, { headers });
        const data = res.data;
        
        if (!data.suggestions.length) {
          return { message: 'Stock levels adequate for all pending orders.' };
        }
        
        let msg = `**Production Recommendations:**\n\n`;
        data.suggestions.slice(0, 5).forEach(s => {
          const emoji = s.severity === 'critical' ? '!' : '-';
          msg += `${emoji} **${s.master_sku_name}**\n   Stock: ${s.current_stock} | Needed: ${s.total_quantity_needed} | Waiting: ${s.days_waiting}d\n\n`;
        });
        
        return { message: msg };
      } catch (err) {
        return { message: 'Failed to fetch production suggestions' };
      }
    }
    
    if (intent?.intent === 'help' || cmd === 'help') {
      return {
        message: `**What I Can Do:**\n\n**Natural Language Search:**\n• "Find order 1234" or "Show me order ABC"\n• "Check order status for 406-123-456"\n\n**Commands:**\n• **status** - Daily operations summary\n• **stuck** - View stuck orders (3+ days)\n• **missing** - Find incomplete data\n• **fix invoices** - Orders needing invoices\n• **production** - Stock recommendations\n\n**Search by:**\n• Order ID\n• Tracking ID\n• Phone Number\n• Customer Name\n\n**During Processing:**\n• **skip** - Skip optional field\n• **cancel** - Cancel operation`
      };
    }
    
    // Search for order (fallback)
    try {
      const res = await axios.post(`${API}/api/bot/search`,
        new URLSearchParams({ query: text }),
        { headers }
      );
      
      const results = res.data.results;
      
      if (results.length === 0) {
        return { message: `No orders found for "${text}".\n\nTry:\n• Full Order ID\n• Phone number\n• Customer name` };
      }
      
      if (results.length === 1) {
        return await formatOrderResponse(results[0]);
      }
      
      // Multiple results
      let msg = `Found **${results.length}** orders:\n\n`;
      results.slice(0, 5).forEach((o, i) => {
        msg += `${i+1}. **${o.order_id || 'N/A'}** - ${o.customer_name || 'Unknown'}\n   Status: ${o._source_display}\n`;
      });
      msg += `\nEnter order ID for full analysis:`;
      
      return { message: msg, context: { search_results: results.slice(0, 5) } };
      
    } catch (err) {
      return { message: 'Search failed. Please try again.' };
    }
  };
  
  const formatOrderResponse = async (order) => {
    const known = order.known_fields || {};
    const missing = order.missing_fields || [];
    
    let msg = `**Order Found!**\nStatus: **${order._source_display || order.status}**\n\n`;
    
    Object.entries(known).forEach(([key, value]) => {
      msg += `✓ **${key.replace('_', ' ')}:** ${value}\n`;
    });
    
    missing.forEach(field => {
      msg += `✗ **${field.replace('_', ' ')}:** Missing\n`;
    });
    
    // Check for repeat customer
    if (known.phone && missing.includes('address')) {
      try {
        const histRes = await axios.get(`${API}/api/bot/customer-history/${encodeURIComponent(known.phone)}`, { headers });
        const history = histRes.data;
        
        if (history.is_repeat_customer) {
          const addr = history.last_address;
          msg += `\n**Repeat Customer** (${history.total_orders} orders)\n`;
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
        // Instead of direct dispatch, prepare comprehensive confirmation
        msg += `\nBasic data complete. Let me prepare dispatch confirmation...`;
        return {
          message: msg,
          actions: [
            { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' },
            { type: 'button', label: 'Full Analysis', command: `find order ${order.order_id}` },
            { type: 'button', label: 'Cancel', command: 'cancel' }
          ],
          context: { current_order_id: order.id, awaiting_prepare: true }
        };
      }
      return { message: msg + '\nThis order is complete.' };
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
    if (['invoice', 'shipping_label', 'eway_bill_copy'].includes(field)) {
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
          addMessage('bot', `Basic data complete! Let me prepare dispatch confirmation...`, [
            { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' },
            { type: 'button', label: 'Cancel', command: 'cancel' }
          ], { current_order_id: orderId, awaiting_prepare: true });
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
      
      addMessage('user', `Uploaded: ${file.name}`);
      
      if (res.data.is_complete) {
        addMessage('bot', `**${field.replace('_', ' ')}** uploaded!\n\n**All complete!** Ready to dispatch.`, [
          { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch' },
          { type: 'button', label: 'Cancel', command: 'cancel' }
        ], { ...context, next_field: null, ready_to_dispatch: true, awaiting_prepare: true });
      } else {
        const nextField = res.data.remaining_fields[0];
        addMessage('bot', `**${field.replace('_', ' ')}** uploaded!\n\nNext: **${nextField.replace('_', ' ')}**?`,
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
  
  const getActionIcon = (iconName) => {
    switch (iconName) {
      case 'search': return <Search className="w-3 h-3 mr-1" />;
      case 'status': return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'alert': return <AlertCircle className="w-3 h-3 mr-1" />;
      case 'file': return <FileWarning className="w-3 h-3 mr-1" />;
      case 'data': return <FileText className="w-3 h-3 mr-1" />;
      case 'factory': return <Factory className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };
  
  const renderMessage = (msg) => {
    const isBot = msg.type === 'bot';
    
    return (
      <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}>
        <div className={`max-w-[90%] ${isBot ? 'order-2' : 'order-1'}`}>
          {isBot && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs text-slate-500">Assistant</span>
            </div>
          )}
          <div className={`rounded-2xl px-4 py-3 ${
            isBot 
              ? 'bg-slate-700/80 text-slate-100 rounded-tl-sm' 
              : 'bg-cyan-600 text-white rounded-tr-sm'
          }`}>
            <div className="text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ 
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em class="text-slate-400">$1</em>')
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
                  className={`text-xs h-8 ${action.type === 'file_upload' ? 'border-cyan-500 text-cyan-400' : 'bg-slate-600 hover:bg-slate-500'}`}
                  onClick={() => handleActionClick(action)}
                  disabled={uploadingFile === action.field}
                >
                  {action.icon && getActionIcon(action.icon)}
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
      
      {/* Floating button - show when closed or minimized */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={handleOpen}
          className="fixed bottom-20 right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group hover:scale-105"
          data-testid="orderbot-toggle"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          {briefing && (briefing.urgent?.stuck_ready_to_dispatch > 0 || briefing.urgent?.missing_invoices > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">
              !
            </span>
          )}
          {isMinimized && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
              Chat minimized
            </span>
          )}
        </button>
      )}
      
      {/* Chat window - LARGER SIZE */}
      {isOpen && !isMinimized && (
        <div 
          className="fixed bottom-20 right-6 z-50 w-[520px] h-[600px] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden" 
          data-testid="orderbot-window"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Operations Assistant</h3>
                <p className="text-cyan-100 text-xs">Natural language order processing</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Reset button */}
              <button 
                onClick={resetConversation}
                className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                title="Reset conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {/* Minimize button */}
              <button 
                onClick={() => setIsMinimized(true)}
                className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              {/* Close button */}
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {messages.map(renderMessage)}
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 p-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Try: 'Find order 1234' or 'Show status'"
                className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 h-11"
                disabled={loading}
                data-testid="orderbot-input"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 h-11 px-4"
                data-testid="orderbot-send"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Type naturally or use quick commands • Press Enter to send
            </p>
          </div>
        </div>
      )}
    </>
  );
}
