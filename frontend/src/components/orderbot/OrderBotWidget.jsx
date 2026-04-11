import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, X, Send, Loader2, Bot,
  Minimize2, RefreshCw, Search, FileWarning, Factory, HelpCircle,
  CheckCircle2, XCircle, AlertCircle, Package, Truck, Upload, FileText,
  RotateCcw, Wrench, Trash2, Archive, Hash, Phone, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function OrderBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState({});
  const [briefing, setBriefing] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [masterSkus, setMasterSkus] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Auth setup
  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem('mg_token');
      if (storedToken && storedToken !== token) {
        setToken(storedToken);
        axios.get(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        }).then(res => {
          setUser(res.data);
          setAuthChecked(true);
        }).catch(() => setAuthChecked(true));
      } else if (!storedToken) {
        setAuthChecked(true);
        setUser(null);
        setToken(null);
      }
    };
    checkAuth();
    const interval = setInterval(() => {
      if (!user) checkAuth();
    }, 2000);
    return () => clearInterval(interval);
  }, [token, user]);
  
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const canUseBot = user && ['admin', 'accountant'].includes(user?.role);
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  
  // Fetch briefing
  const fetchBriefing = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await axios.get(`${API}/api/bot/daily-briefing`, { headers });
      setBriefing(res.data);
      return res.data;
    } catch (err) { return null; }
  }, [token, headers]);
  
  // Fetch master SKUs
  const fetchMasterSkus = useCallback(async (search = '') => {
    try {
      const res = await axios.get(`${API}/api/bot/master-skus?search=${encodeURIComponent(search)}&limit=20`, { headers });
      setMasterSkus(res.data.skus || []);
      return res.data.skus;
    } catch (err) { return []; }
  }, [headers]);
  
  // Reset conversation
  const resetConversation = () => {
    setMessages([]);
    setContext({});
    if (isOpen) handleOpen(true);
  };
  
  const handleOpen = async (forceRefresh = false) => {
    setIsOpen(true);
    setIsMinimized(false);
    
    if (messages.length === 0 || forceRefresh) {
      const brief = await fetchBriefing();
      
      let welcomeMsg = `**Hi ${user?.first_name || 'there'}!** I'm your Operations Assistant.\n\n`;
      
      if (brief) {
        const { urgent, attention } = brief;
        if (urgent.stuck_ready_to_dispatch > 0 || urgent.missing_invoices > 0 || attention.new_amazon_orders > 0) {
          welcomeMsg += `**Quick Status:**\n`;
          if (urgent.stuck_ready_to_dispatch > 0) welcomeMsg += `• ${urgent.stuck_ready_to_dispatch} orders stuck (3+ days)\n`;
          if (urgent.missing_invoices > 0) welcomeMsg += `• ${urgent.missing_invoices} orders missing invoices\n`;
          if (attention.new_amazon_orders > 0) welcomeMsg += `• ${attention.new_amazon_orders} Amazon orders to process\n`;
          welcomeMsg += `\n`;
        }
      }
      
      welcomeMsg += `**I can search across ALL CRM data:**\n`;
      welcomeMsg += `• Order ID → Find & process orders\n`;
      welcomeMsg += `• Tracking ID → Returns, dispatches, RTO\n`;
      welcomeMsg += `• Serial Number → Full product history\n`;
      welcomeMsg += `• Phone Number → Customer orders\n`;
      
      setMessages([{
        id: Date.now(),
        type: 'bot',
        content: welcomeMsg,
        actions: [
          { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' },
          { type: 'button', label: 'Status', command: 'status', icon: 'status' },
          { type: 'button', label: 'Missing Data', command: 'missing', icon: 'data' },
          { type: 'button', label: 'Production', command: 'production', icon: 'factory' }
        ]
      }]);
      setContext({});
    }
  };
  
  const addMessage = (type, content, actions = null, newContext = null) => {
    const msg = { id: Date.now() + Math.random(), type, content, actions };
    setMessages(prev => [...prev, msg]);
    if (newContext) setContext(newContext);
    return msg;
  };
  
  // Universal search handler
  const handleUniversalSearch = async (query) => {
    try {
      const res = await axios.get(`${API}/api/bot/universal-search/${encodeURIComponent(query)}`, { headers });
      const data = res.data;
      
      if (data.found_in.length === 0) {
        addMessage('bot', `No records found for "${query}".\n\nTry searching by:\n• Order ID (e.g., 407-8638149-4710714)\n• Tracking ID\n• Serial Number\n• Phone Number`);
        return;
      }
      
      let msg = `**Found in: ${data.found_in.join(', ')}**\n\n`;
      
      // Handle different result types
      if (data.all_results.amazon_order) {
        const ao = data.all_results.amazon_order;
        const order = ao.data;
        msg += `**AMAZON ORDER**\n`;
        msg += `Order ID: **${order.amazon_order_id}**\n`;
        msg += `Customer: ${order.buyer_name || order.customer_name || 'N/A'}\n`;
        msg += `Status: ${ao.status || 'Unknown'}\n`;
        msg += `In CRM: ${ao.in_crm ? 'Yes' : 'No'}\n`;
        if (order.order_total) msg += `Value: ₹${order.order_total?.toLocaleString()}\n`;
        if (order.tracking_id) msg += `Tracking: ${order.tracking_id}\n`;
        msg += `\n`;
        
        // Show available actions
        if (!ao.in_crm) {
          msg += `**This order is not yet in CRM.**\n`;
          msg += `Choose an action:\n`;
        }
        
        const actions = [];
        if (ao.actions.includes('import_to_crm')) {
          actions.push({ type: 'button', label: 'Process in CRM', command: 'import_to_crm', icon: 'package' });
        }
        if (ao.actions.includes('mark_already_dispatched')) {
          actions.push({ type: 'button', label: 'Already Dispatched', command: 'mark_dispatched', icon: 'truck' });
        }
        if (ao.actions.includes('prepare_dispatch')) {
          actions.push({ type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' });
        }
        actions.push({ type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' });
        
        addMessage('bot', msg, actions, {
          amazon_order: order,
          amazon_order_id: order.amazon_order_id,
          source: 'amazon_orders'
        });
        return;
      }
      
      if (data.all_results.serial) {
        const sr = data.all_results.serial;
        const serial = sr.data;
        msg += `**SERIAL NUMBER: ${serial.serial_number}**\n\n`;
        msg += `Status: **${serial.status || 'Unknown'}**\n`;
        msg += `Product: ${serial.master_sku_name || 'Not mapped'}\n`;
        msg += `SKU Code: ${serial.sku_code || 'N/A'}\n`;
        if (serial.manufacturing_date) msg += `Mfg Date: ${serial.manufacturing_date}\n`;
        if (serial.batch_number) msg += `Batch: ${serial.batch_number}\n`;
        msg += `\n`;
        
        if (sr.dispatch_info) {
          msg += `**Dispatch Info:**\n`;
          msg += `Dispatch #: ${sr.dispatch_info.dispatch_number}\n`;
          msg += `Customer: ${sr.dispatch_info.customer_name}\n`;
          msg += `Date: ${sr.dispatch_info.created_at?.split('T')[0]}\n\n`;
        }
        
        if (sr.warranty_info) {
          msg += `**Warranty:** ${sr.warranty_info.warranty_status || 'Active'}\n\n`;
        }
        
        // Missing fields
        if (sr.data && !serial.master_sku_id) {
          msg += `**Missing:** Product SKU not mapped\n`;
        }
        
        const actions = [
          { type: 'button', label: 'Update Info', command: 'update_serial', icon: 'edit' },
          { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
        ];
        
        addMessage('bot', msg, actions, {
          serial: serial,
          serial_number: serial.serial_number,
          source: 'serial_numbers'
        });
        return;
      }
      
      if (data.all_results.incoming) {
        const inc = data.all_results.incoming;
        const item = inc.data;
        msg += `**INCOMING RETURN / RTO**\n\n`;
        msg += `Tracking: **${item.tracking_id || item.awb_number}**\n`;
        msg += `Status: ${item.status || 'Pending'}\n`;
        if (item.order_id) msg += `Order: ${item.order_id}\n`;
        if (item.master_sku_name) msg += `Product: ${item.master_sku_name}\n`;
        msg += `\n`;
        msg += `**What would you like to do with this return?**\n`;
        
        const actions = [
          { type: 'button', label: 'Add to Inventory', command: 'rto_add_inventory', icon: 'package' },
          { type: 'button', label: 'Send to Repair', command: 'rto_send_repair', icon: 'wrench' },
          { type: 'button', label: 'Repair Yard', command: 'rto_repair_yard', icon: 'archive' },
          { type: 'button', label: 'Dead Stock', command: 'rto_dead_stock', icon: 'trash' }
        ];
        
        addMessage('bot', msg, actions, {
          incoming: item,
          tracking_id: item.tracking_id || item.awb_number,
          source: 'incoming_queue'
        });
        return;
      }
      
      if (data.all_results.pending_fulfillment) {
        const pf = data.all_results.pending_fulfillment;
        const order = pf.data;
        msg += `**PENDING FULFILLMENT**\n\n`;
        msg += `Order: **${order.order_id}**\n`;
        msg += `Status: ${order.status}\n`;
        msg += `Customer: ${order.customer_name}\n`;
        if (order.tracking_id) msg += `Tracking: ${order.tracking_id}\n`;
        
        const actions = [
          { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' },
          { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
        ];
        
        addMessage('bot', msg, actions, {
          pending_fulfillment: order,
          current_order_id: order.id,
          source: 'pending_fulfillment'
        });
        return;
      }
      
      if (data.all_results.dispatch) {
        const disp = data.all_results.dispatch;
        const d = disp.data;
        msg += `**DISPATCH RECORD**\n\n`;
        msg += `Dispatch #: **${d.dispatch_number}**\n`;
        msg += `Status: ${d.status}\n`;
        msg += `Customer: ${d.customer_name}\n`;
        msg += `Tracking: ${d.tracking_id || 'N/A'}\n`;
        if (d.serial_number) msg += `Serial: ${d.serial_number}\n`;
        
        addMessage('bot', msg, [
          { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
        ], { dispatch: d, source: 'dispatches' });
        return;
      }
      
      if (data.all_results.customer) {
        const cust = data.all_results.customer;
        msg += `**CUSTOMER ORDERS**\n\n`;
        msg += `Total Orders: ${cust.total_orders}\n`;
        msg += `Pending: ${cust.pending_orders?.length || 0}\n`;
        msg += `Dispatched: ${cust.dispatched_orders?.length || 0}\n\n`;
        
        if (cust.pending_orders?.length > 0) {
          msg += `**Pending Orders:**\n`;
          cust.pending_orders.slice(0, 3).forEach(o => {
            msg += `• ${o.order_id} - ${o.status}\n`;
          });
        }
        
        addMessage('bot', msg, [
          { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
        ], { customer: cust, source: 'customer' });
        return;
      }
      
      // Generic result
      addMessage('bot', msg + `\nFound in: ${data.found_in.join(', ')}`, [
        { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
      ]);
      
    } catch (err) {
      console.error('Search error:', err);
      addMessage('bot', `Search failed: ${err.response?.data?.detail || err.message}`);
    }
  };
  
  // Handle RTO actions
  const handleRtoAction = async (action) => {
    const trackingId = context.tracking_id;
    if (!trackingId) {
      addMessage('bot', 'No tracking ID in context. Please search for the return first.');
      return;
    }
    
    // Check if we need master SKU
    if (!context.incoming?.master_sku_id && action !== 'rto_dead_stock') {
      // Need to ask for SKU
      const skus = await fetchMasterSkus();
      let msg = `**Select the Master SKU for this return:**\n\n`;
      skus.slice(0, 10).forEach((sku, i) => {
        msg += `${i + 1}. ${sku.name} (${sku.sku_code})\n`;
      });
      if (skus.length > 10) {
        msg += `\n_Showing first 10 of ${skus.length} SKUs_\n`;
      }
      msg += `\n**Enter number (1-10)** or **type SKU code/name to search**:`;
      
      addMessage('bot', msg, [], {
        ...context,
        awaiting_sku_selection: true,
        pending_rto_action: action,
        available_skus: skus
      });
      return;
    }
    
    await executeRtoAction(action, trackingId, context.incoming?.master_sku_id);
  };
  
  const executeRtoAction = async (action, trackingId, masterSkuId) => {
    const actionMap = {
      'rto_add_inventory': 'add_to_inventory',
      'rto_send_repair': 'send_to_repair',
      'rto_repair_yard': 'send_to_repair_yard',
      'rto_dead_stock': 'mark_dead_stock'
    };
    
    try {
      const res = await axios.post(`${API}/api/bot/handle-rto`,
        new URLSearchParams({
          tracking_id: trackingId,
          action: actionMap[action],
          master_sku_id: masterSkuId || '',
          condition: 'good'
        }),
        { headers }
      );
      
      addMessage('bot', `**${res.data.message}**\n\n${
        res.data.ticket_number ? `Ticket #: ${res.data.ticket_number}\n` : ''
      }${
        res.data.new_balance ? `New Stock Balance: ${res.data.new_balance}\n` : ''
      }\nProcess another?`, [
        { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' },
        { type: 'button', label: 'Status', command: 'status', icon: 'status' }
      ], {});
      
    } catch (err) {
      addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
    }
  };
  
  // Handle import to CRM
  const handleImportToCrm = async () => {
    const amazonOrderId = context.amazon_order_id;
    if (!amazonOrderId) {
      addMessage('bot', 'No Amazon order in context.');
      return;
    }
    
    try {
      const res = await axios.post(`${API}/api/bot/import-amazon-to-crm`,
        new URLSearchParams({ amazon_order_id: amazonOrderId }),
        { headers }
      );
      
      addMessage('bot', `**Order imported to CRM!**\n\nOrder ID: ${res.data.order_id}\nStatus: ${res.data.status}\n\n**Next steps:**\n• Upload invoice\n• Upload shipping label\n• Prepare for dispatch`, [
        { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' },
        { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
      ], {
        ...context,
        current_order_id: res.data.pending_fulfillment_id,
        source: 'pending_fulfillment'
      });
      
    } catch (err) {
      addMessage('bot', `Import failed: ${err.response?.data?.detail || err.message}`);
    }
  };
  
  // Handle mark as already dispatched
  const handleMarkDispatched = async () => {
    const amazonOrderId = context.amazon_order_id;
    if (!amazonOrderId) {
      addMessage('bot', 'No Amazon order in context.');
      return;
    }
    
    // Ask for additional info
    addMessage('bot', `**Mark as Already Dispatched**\n\nI'll record this order as already shipped.\n\nPlease provide:\n• Tracking ID (if available)\n• Serial Number (if applicable)\n\nEnter tracking ID or type 'skip':`, [], {
      ...context,
      awaiting_dispatched_tracking: true
    });
  };
  
  const handleSend = async (messageText = null) => {
    const text = messageText || input.trim();
    if (!text) return;
    
    addMessage('user', text);
    setInput('');
    setLoading(true);
    
    try {
      // Handle special commands
      if (text === 'search_prompt') {
        addMessage('bot', `**Enter any of these to search:**\n\n• Order ID (e.g., 407-8638149-4710714)\n• Tracking ID (AWB number)\n• Serial Number\n• Phone Number\n\nI'll find all related CRM data.`, [], { awaiting_search: true });
        setLoading(false);
        return;
      }
      
      if (text === 'import_to_crm') {
        await handleImportToCrm();
        setLoading(false);
        return;
      }
      
      if (text === 'mark_dispatched') {
        await handleMarkDispatched();
        setLoading(false);
        return;
      }
      
      if (text.startsWith('rto_')) {
        await handleRtoAction(text);
        setLoading(false);
        return;
      }
      
      if (text === 'update_serial') {
        const serial = context.serial;
        if (!serial) {
          addMessage('bot', 'No serial in context. Search for a serial number first.');
        } else {
          addMessage('bot', `**Update Serial: ${serial.serial_number}**\n\nWhat would you like to update?\n\n• Manufacturing Date\n• Batch Number\n• Product SKU\n\nType the field name or select:`, [
            { type: 'button', label: 'Set SKU', command: 'set_serial_sku' },
            { type: 'button', label: 'Cancel', command: 'cancel' }
          ], { ...context, awaiting_serial_update: true });
        }
        setLoading(false);
        return;
      }
      
      if (text === 'set_serial_sku') {
        const skus = await fetchMasterSkus();
        let msg = `**Select Master SKU for Serial ${context.serial_number}:**\n\n`;
        skus.slice(0, 10).forEach((sku, i) => {
          msg += `${i + 1}. ${sku.name} (${sku.sku_code})\n`;
        });
        if (skus.length > 10) {
          msg += `\n_Showing first 10 of ${skus.length} SKUs_\n`;
        }
        msg += `\n**Enter number (1-10)** or **type SKU code/name to search**:`;
        
        addMessage('bot', msg, [], {
          ...context,
          awaiting_sku_for_serial: true,
          available_skus: skus
        });
        setLoading(false);
        return;
      }
      
      // Handle SKU selection for serial
      if (context.awaiting_sku_for_serial) {
        const num = parseInt(text);
        if (num >= 1 && num <= context.available_skus?.length && num <= 10) {
          // Direct selection by number
          const selectedSku = context.available_skus[num - 1];
          try {
            await axios.post(`${API}/api/bot/update-serial`,
              new URLSearchParams({
                serial_number: context.serial_number,
                field: 'master_sku_id',
                value: selectedSku.id
              }),
              { headers }
            );
            addMessage('bot', `**Serial updated!**\n\n${context.serial_number} → ${selectedSku.name}`, [
              { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
            ], {});
          } catch (err) {
            addMessage('bot', `Update failed: ${err.response?.data?.detail || err.message}`);
          }
        } else {
          // Search by SKU code or name
          const searchSkus = await fetchMasterSkus(text);
          if (searchSkus.length === 0) {
            addMessage('bot', `No SKUs found matching "${text}". Try a different search term or enter a number 1-10.`);
            setLoading(false);
            return;
          } else if (searchSkus.length === 1) {
            // Single match - apply directly
            const selectedSku = searchSkus[0];
            try {
              await axios.post(`${API}/api/bot/update-serial`,
                new URLSearchParams({
                  serial_number: context.serial_number,
                  field: 'master_sku_id',
                  value: selectedSku.id
                }),
                { headers }
              );
              addMessage('bot', `**Serial updated!**\n\n${context.serial_number} → ${selectedSku.name} (${selectedSku.sku_code})`, [
                { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
              ], {});
            } catch (err) {
              addMessage('bot', `Update failed: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            // Multiple matches - show list
            let msg = `**Found ${searchSkus.length} SKUs matching "${text}":**\n\n`;
            searchSkus.slice(0, 15).forEach((sku, i) => {
              msg += `${i + 1}. ${sku.name} (${sku.sku_code})\n`;
            });
            msg += `\nEnter number (1-${Math.min(15, searchSkus.length)}) to select:`;
            addMessage('bot', msg, [], {
              ...context,
              awaiting_sku_for_serial: true,
              available_skus: searchSkus
            });
          }
        }
        setLoading(false);
        return;
      }
      
      // Handle SKU selection for RTO
      if (context.awaiting_sku_selection) {
        const num = parseInt(text);
        let selectedSkuId = null;
        
        if (num >= 1 && num <= context.available_skus?.length && num <= 15) {
          // Direct selection by number
          selectedSkuId = context.available_skus[num - 1].id;
          await executeRtoAction(context.pending_rto_action, context.tracking_id, selectedSkuId);
        } else {
          // Search by SKU code or name
          const searchSkus = await fetchMasterSkus(text);
          if (searchSkus.length === 0) {
            addMessage('bot', `No SKUs found matching "${text}". Try a different search term.`);
          } else if (searchSkus.length === 1) {
            // Single match - apply directly
            await executeRtoAction(context.pending_rto_action, context.tracking_id, searchSkus[0].id);
          } else {
            // Multiple matches - show list
            let msg = `**Found ${searchSkus.length} SKUs matching "${text}":**\n\n`;
            searchSkus.slice(0, 15).forEach((sku, i) => {
              msg += `${i + 1}. ${sku.name} (${sku.sku_code})\n`;
            });
            msg += `\nEnter number (1-${Math.min(15, searchSkus.length)}) to select:`;
            addMessage('bot', msg, [], {
              ...context,
              available_skus: searchSkus
            });
          }
        }
        setLoading(false);
        return;
      }
      
      // Handle tracking ID for mark dispatched
      if (context.awaiting_dispatched_tracking) {
        const trackingId = text.toLowerCase() === 'skip' ? '' : text;
        addMessage('bot', `Enter serial number (or type 'skip'):`, [], {
          ...context,
          awaiting_dispatched_tracking: false,
          awaiting_dispatched_serial: true,
          dispatched_tracking: trackingId
        });
        setLoading(false);
        return;
      }
      
      if (context.awaiting_dispatched_serial) {
        const serialNumber = text.toLowerCase() === 'skip' ? '' : text;
        try {
          const res = await axios.post(`${API}/api/bot/mark-amazon-dispatched`,
            new URLSearchParams({
              amazon_order_id: context.amazon_order_id,
              tracking_id: context.dispatched_tracking || '',
              serial_number: serialNumber
            }),
            { headers }
          );
          
          addMessage('bot', `**Order marked as dispatched!**\n\nDispatch #: ${res.data.dispatch_number}\nTracking: ${res.data.tracking_id || 'N/A'}\n\nThis order is now recorded in CRM for reconciliation.`, [
            { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
          ], {});
        } catch (err) {
          addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle standard commands
      if (['status', 'stuck', 'missing', 'production', 'help'].includes(text.toLowerCase())) {
        const response = await processCommand(text.toLowerCase());
        if (response) addMessage('bot', response.message, response.actions, response.context);
        setLoading(false);
        return;
      }
      
      if (text === 'cancel') {
        setContext({});
        addMessage('bot', 'Cancelled. What else can I help with?', [
          { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' },
          { type: 'button', label: 'Status', command: 'status', icon: 'status' }
        ]);
        setLoading(false);
        return;
      }
      
      // Handle prepare_dispatch
      if (text === 'prepare_dispatch' && context.current_order_id) {
        try {
          const res = await axios.get(`${API}/api/bot/prepare-dispatch/${context.current_order_id}`, { headers });
          const data = res.data;
          
          let msg = `**DISPATCH CONFIRMATION**\n\n`;
          msg += `Order: **${data.order.order_id}**\n`;
          msg += `Customer: ${data.customer.name}\n\n`;
          
          // Show pricing breakdown with GST-inclusive indicator for marketplace
          msg += `**PRICING**`;
          if (data.pricing.is_gst_inclusive) {
            msg += ` _(${data.pricing.source === 'amazon' ? 'Amazon' : 'Marketplace'} - GST Inclusive)_\n`;
          } else {
            msg += `\n`;
          }
          msg += `Taxable: ₹${data.pricing.taxable_value?.toLocaleString() || 0}\n`;
          msg += `GST (${data.pricing.gst_rate}%): ₹${data.pricing.gst_amount?.toLocaleString() || 0}\n`;
          msg += `**Total: ₹${data.pricing.total_value?.toLocaleString() || 0}**\n\n`;
          
          msg += `**COMPLIANCE:**\n`;
          msg += `${data.compliance.tracking_id_provided ? '✓' : '✗'} Tracking ID\n`;
          msg += `${data.compliance.invoice_uploaded ? '✓' : '✗'} Invoice\n`;
          msg += `${data.compliance.label_uploaded ? '✓' : '✗'} Label\n`;
          
          if (data.missing_fields?.length > 0) {
            msg += `\n**Missing:** ${data.missing_fields.join(', ')}\n`;
            msg += `\nPlease upload required documents first.`;
          } else {
            msg += `\n**Ready to dispatch!** Type CONFIRM to proceed.`;
          }
          
          addMessage('bot', msg, data.ready_to_dispatch ? [] : [
            { type: 'file_upload', field: 'invoice', label: 'Upload Invoice' },
            { type: 'file_upload', field: 'shipping_label', label: 'Upload Label' }
          ], { ...context, dispatch_data: data, awaiting_confirm: data.ready_to_dispatch });
          
        } catch (err) {
          addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle CONFIRM
      if (text.toLowerCase() === 'confirm' && context.awaiting_confirm) {
        try {
          const data = context.dispatch_data;
          const res = await axios.post(`${API}/api/bot/dispatch`,
            new URLSearchParams({
              order_id: context.current_order_id,
              tracking_id: data.logistics?.tracking_id || '',
              confirmed: 'true'
            }),
            { headers }
          );
          
          addMessage('bot', `**ORDER READY FOR DISPATCH!**\n\nDispatch #: ${res.data.dispatch_number}\n\nOrder is now in Dispatcher Queue.`, [
            { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
          ], {});
        } catch (err) {
          const detail = err.response?.data?.detail;
          if (detail?.errors) {
            addMessage('bot', `**Cannot dispatch:**\n\n${detail.errors.map(e => `• ${e}`).join('\n')}`);
          } else {
            addMessage('bot', `Error: ${detail || err.message}`);
          }
        }
        setLoading(false);
        return;
      }
      
      // Default: Universal search
      await handleUniversalSearch(text);
      
    } catch (err) {
      console.error('Bot error:', err);
      addMessage('bot', `Something went wrong. Please try again.`);
    } finally {
      setLoading(false);
    }
  };
  
  const processCommand = async (cmd) => {
    if (cmd === 'status') {
      const brief = await fetchBriefing();
      if (!brief) return { message: 'Failed to fetch status' };
      
      return {
        message: `**Operations Summary**\n\n**URGENT**\n• ${brief.urgent.stuck_ready_to_dispatch} stuck orders\n• ${brief.urgent.missing_invoices} missing invoices\n\n**ATTENTION**\n• ${brief.attention.new_amazon_orders} Amazon orders\n\n**TODAY**\n• Dispatched: ${brief.today.dispatched}`,
        actions: [
          { type: 'button', label: 'Search', command: 'search_prompt' },
          { type: 'button', label: 'Missing Data', command: 'missing' }
        ]
      };
    }
    
    if (cmd === 'missing') {
      try {
        const res = await axios.get(`${API}/api/bot/missing-data`, { headers });
        const data = res.data;
        return {
          message: `**Data Gaps: ${data.total_issues}**\n\n• Missing Invoices: ${data.invoices.count}\n• Missing Tracking: ${data.tracking_ids.count}\n• Missing Labels: ${data.shipping_labels.count}`,
          actions: []
        };
      } catch { return { message: 'Failed to fetch' }; }
    }
    
    if (cmd === 'help') {
      return {
        message: `**Universal Search:**\n• Order ID → Find orders, import to CRM\n• Tracking ID → Returns, RTO, dispatches\n• Serial Number → Product history\n• Phone → Customer orders\n\n**Commands:**\n• status - Operations summary\n• missing - Data gaps\n• production - Stock needs`
      };
    }
    
    return null;
  };
  
  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file || !context.current_order_id) return;
    
    setUploadingFile(field);
    try {
      const formData = new FormData();
      formData.append('order_id', context.current_order_id);
      formData.append('field', field);
      formData.append('file', file);
      
      await axios.post(`${API}/api/bot/upload-file`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      addMessage('user', `Uploaded: ${file.name}`);
      addMessage('bot', `**${field.replace('_', ' ')}** uploaded!`, [
        { type: 'button', label: 'Check Status', command: 'prepare_dispatch' }
      ]);
    } catch (err) {
      toast.error(`Upload failed: ${err.response?.data?.detail || 'Error'}`);
    } finally {
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handleActionClick = (action) => {
    if (action.type === 'button') {
      handleSend(action.command);
    } else if (action.type === 'file_upload') {
      setContext(prev => ({ ...prev, awaiting_file: action.field }));
      fileInputRef.current?.click();
    }
  };
  
  const getActionIcon = (iconName) => {
    const icons = {
      search: Search, status: CheckCircle2, alert: AlertCircle, file: FileWarning,
      data: FileText, factory: Factory, package: Package, truck: Truck,
      wrench: Wrench, archive: Archive, trash: Trash2, edit: RefreshCw
    };
    const Icon = icons[iconName];
    return Icon ? <Icon className="w-3 h-3 mr-1" /> : null;
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
            isBot ? 'bg-slate-700/80 text-slate-100 rounded-tl-sm' : 'bg-cyan-600 text-white rounded-tr-sm'
          }`}>
            <div className="text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/_(.*?)_/g, '<em class="text-slate-400">$1</em>')
                .replace(/\n/g, '<br/>')
            }} />
          </div>
          {msg.actions?.length > 0 && (
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
                  {uploadingFile === action.field && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  if (!authChecked || !canUseBot) return null;
  
  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => handleFileUpload(e, context.awaiting_file)}
      />
      
      {(!isOpen || isMinimized) && (
        <button
          onClick={handleOpen}
          className="fixed bottom-20 right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-105"
          data-testid="orderbot-toggle"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          {briefing && (briefing.urgent?.stuck_ready_to_dispatch > 0 || briefing.urgent?.missing_invoices > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">!</span>
          )}
        </button>
      )}
      
      {isOpen && !isMinimized && (
        <div className="fixed bottom-20 right-6 z-50 w-[520px] h-[600px] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden" data-testid="orderbot-window">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Operations Assistant</h3>
                <p className="text-cyan-100 text-xs">Natural language order processing</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={resetConversation} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg" title="Reset">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setIsMinimized(true)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg" title="Minimize">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-lg" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
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
          
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Order ID, Tracking, Serial, Phone..."
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
          </div>
        </div>
      )}
    </>
  );
}
