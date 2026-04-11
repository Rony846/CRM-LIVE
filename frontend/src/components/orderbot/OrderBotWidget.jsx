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
  
  // Search items by type (for adjust flow)
  const searchItemsByType = useCallback(async (itemType, search = '') => {
    try {
      const res = await axios.get(`${API}/api/bot/search-items?item_type=${itemType}&search=${encodeURIComponent(search)}&limit=20`, { headers });
      return res.data.items || [];
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
      
      welcomeMsg += `**I can help you with:**\n`;
      welcomeMsg += `• **Search** - Order ID, Tracking, Serial, Phone\n`;
      welcomeMsg += `• **order** - Create new offline order\n`;
      welcomeMsg += `• **adjust** - Adjust traded items & raw materials\n`;
      welcomeMsg += `• **transfer** - Transfer stock between firms\n`;
      welcomeMsg += `• **expense** - Record an expense\n`;
      welcomeMsg += `• **purchase** - Record a purchase entry\n`;
      welcomeMsg += `• **Ticket ID/Phone** - Check repair tickets\n`;
      welcomeMsg += `• **Dispatch #** - Update dispatch info\n`;
      
      setMessages([{
        id: Date.now(),
        type: 'bot',
        content: welcomeMsg,
        actions: [
          { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' },
          { type: 'button', label: 'New Order', command: 'order', icon: 'cart' },
          { type: 'button', label: 'Adjust', command: 'adjust', icon: 'edit' },
          { type: 'button', label: 'Transfer', command: 'transfer', icon: 'truck' },
          { type: 'button', label: 'Expense', command: 'expense', icon: 'file' },
          { type: 'button', label: 'Purchase', command: 'purchase', icon: 'package' }
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
      // First check if it looks like a ticket ID (TKT-) or dispatch number (DSP-, MG-D-)
      const isTicketPattern = query.toUpperCase().startsWith('TKT') || (query.length === 10 && query.match(/^\d+$/));
      const isDispatchPattern = query.toUpperCase().startsWith('DSP') || query.toUpperCase().startsWith('MG-D');
      
      // Try ticket lookup first if pattern matches
      if (isTicketPattern || (query.length >= 10 && query.match(/^\d+$/))) {
        try {
          const ticketRes = await axios.get(`${API}/api/bot/ticket-info/${encodeURIComponent(query)}`, { headers });
          if (ticketRes.data.found && ticketRes.data.tickets?.length > 0) {
            const tickets = ticketRes.data.tickets;
            let msg = `**TICKET${tickets.length > 1 ? 'S' : ''} FOUND**\n\n`;
            
            for (const t of tickets) {
              msg += `**${t.ticket_number}** - ${t.status}\n`;
              msg += `Customer: ${t.customer_name} (${t.customer_phone})\n`;
              msg += `Product: ${t.product || 'N/A'}\n`;
              if (t.serial_number) msg += `Serial: ${t.serial_number}\n`;
              msg += `Issue: ${t.issue || 'N/A'}\n`;
              
              if (t.pending_actions?.length > 0) {
                msg += `\n**Pending Actions:**\n`;
                if (t.pending_actions.includes('upload_reverse_label')) msg += `• Upload reverse pickup label\n`;
                if (t.pending_actions.includes('dispatch_spare')) msg += `• Dispatch spare part\n`;
                if (t.pending_actions.includes('record_payment')) msg += `• Record payment\n`;
              }
              msg += `\n`;
            }
            
            const firstTicket = tickets[0];
            const actions = [];
            if (firstTicket.pending_actions?.includes('upload_reverse_label')) {
              actions.push({ type: 'button', label: 'Upload Label', command: 'ticket_upload_label' });
            }
            if (firstTicket.pending_actions?.includes('dispatch_spare')) {
              actions.push({ type: 'button', label: 'Dispatch Spare', command: 'ticket_dispatch_spare' });
            }
            actions.push({ type: 'button', label: 'Update Status', command: 'ticket_update_status' });
            actions.push({ type: 'button', label: 'Search Another', command: 'search_prompt' });
            
            addMessage('bot', msg, actions, {
              flow: 'ticket',
              current_ticket: firstTicket,
              pending_actions: firstTicket.pending_actions
            });
            return;
          }
        } catch (err) { /* continue to universal search */ }
      }
      
      // Try dispatch lookup if pattern matches
      if (isDispatchPattern) {
        try {
          const dispRes = await axios.get(`${API}/api/bot/dispatch-info/${encodeURIComponent(query)}`, { headers });
          if (dispRes.data.found) {
            const d = dispRes.data.dispatch;
            let msg = `**DISPATCH: ${d.dispatch_number}**\n\n`;
            msg += `Order: ${d.order_id || 'N/A'}\n`;
            msg += `Status: **${d.status}**\n`;
            msg += `Customer: ${d.customer_name || 'N/A'}\n`;
            msg += `Phone: ${d.phone || 'N/A'}\n`;
            msg += `Address: ${d.address || 'N/A'}, ${d.city || ''}\n`;
            msg += `State: ${d.state || 'N/A'} - ${d.pincode || 'N/A'}\n`;
            msg += `Tracking: ${d.tracking_id || 'N/A'}\n`;
            msg += `Serial: ${d.serial_number || 'N/A'}\n`;
            msg += `Value: ₹${d.invoice_value?.toLocaleString() || 0}\n`;
            
            if (dispRes.data.missing_fields?.length > 0) {
              msg += `\n**Missing:** ${dispRes.data.missing_fields.join(', ')}\n`;
              msg += `\nWould you like to update these fields?`;
            }
            
            addMessage('bot', msg, [
              { type: 'button', label: 'Update Fields', command: 'update_dispatch_fields' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], {
              dispatch: d,
              missing_fields: dispRes.data.missing_fields
            });
            return;
          }
        } catch (err) { /* continue to universal search */ }
      }
      
      // Standard universal search
      const res = await axios.get(`${API}/api/bot/universal-search/${encodeURIComponent(query)}`, { headers });
      const data = res.data;
      
      if (data.found_in.length === 0) {
        // Also try ticket and dispatch lookup as fallback
        try {
          const ticketRes = await axios.get(`${API}/api/bot/ticket-info/${encodeURIComponent(query)}`, { headers });
          if (ticketRes.data.found) {
            // Handle ticket found
            const t = ticketRes.data.tickets[0];
            addMessage('bot', `**TICKET: ${t.ticket_number}**\nStatus: ${t.status}\nCustomer: ${t.customer_name}`, [
              { type: 'button', label: 'View Details', command: `search_prompt` }
            ]);
            return;
          }
        } catch (err) {}
        
        try {
          const dispRes = await axios.get(`${API}/api/bot/dispatch-info/${encodeURIComponent(query)}`, { headers });
          if (dispRes.data.found) {
            const d = dispRes.data.dispatch;
            addMessage('bot', `**DISPATCH: ${d.dispatch_number}**\nStatus: ${d.status}\nCustomer: ${d.customer_name}`, [
              { type: 'button', label: 'Update Fields', command: 'update_dispatch_fields' }
            ], { dispatch: d });
            return;
          }
        } catch (err) {}
        
        addMessage('bot', `No records found for "${query}".\n\nTry:\n• Order ID\n• Ticket ID (TKT-...)\n• Dispatch # (DSP-...)\n• Tracking ID\n• Serial Number\n• Phone Number`);
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
        
        // Check for unmapped SKUs
        const unmappedItems = order.items?.filter(i => !i.master_sku_id) || [];
        if (unmappedItems.length > 0) {
          msg += `\n⚠️ **UNMAPPED SKUs:**\n`;
          unmappedItems.forEach(item => {
            msg += `• ${item.amazon_sku} - ${item.title?.substring(0, 40)}...\n`;
          });
          msg += `\n_Map SKUs first before processing._\n`;
        }
        msg += `\n`;
        
        // Show available actions
        if (!ao.in_crm) {
          msg += `**This order is not yet in CRM.**\n`;
          msg += `Choose an action:\n`;
        }
        
        const actions = [];
        
        // If unmapped SKUs exist, show map SKU first
        if (unmappedItems.length > 0) {
          actions.push({ type: 'button', label: 'Map SKU First', command: 'map_amazon_sku', icon: 'link' });
        }
        
        if (ao.actions.includes('import_to_crm')) {
          actions.push({ type: 'button', label: 'Process in CRM', command: 'import_to_crm', icon: 'package' });
        }
        if (ao.actions.includes('mark_already_dispatched')) {
          actions.push({ type: 'button', label: 'Already Dispatched', command: 'mark_dispatched', icon: 'truck' });
        }
        if (ao.actions.includes('prepare_dispatch') && unmappedItems.length === 0) {
          actions.push({ type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' });
        }
        actions.push({ type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' });
        
        addMessage('bot', msg, actions, {
          amazon_order: order,
          amazon_order_id: order.amazon_order_id,
          current_order_id: order.amazon_order_id,  // Add this for prepare_dispatch
          unmapped_items: unmappedItems,
          source: 'amazon_orders'
        });
        return;
      }
      
      if (data.all_results.serial) {
        const sr = data.all_results.serial;
        const serial = sr.data;
        const masterSku = sr.master_sku;  // Get the looked-up master SKU
        
        msg += `**SERIAL NUMBER: ${serial.serial_number}**\n\n`;
        msg += `Status: **${serial.status || 'Unknown'}**\n`;
        // Use master_sku lookup data first, then fall back to serial data
        msg += `Product: ${masterSku?.name || serial.master_sku_name || 'Not mapped'}\n`;
        msg += `SKU Code: ${masterSku?.sku_code || serial.sku_code || 'N/A'}\n`;
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
        
        // Only show missing if no master_sku_id
        if (!serial.master_sku_id) {
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
      
      // Handle ticket search result
      if (data.all_results.ticket) {
        const ticketResult = data.all_results.ticket;
        const t = ticketResult.data;
        msg += `**REPAIR TICKET: ${t.ticket_number}**\n\n`;
        msg += `Status: **${t.status}**\n`;
        msg += `Type: ${t.ticket_type || 'phone'}\n`;
        msg += `Customer: ${t.customer_name || 'N/A'}\n`;
        msg += `Phone: ${t.customer_phone || 'N/A'}\n`;
        if (t.device_type) msg += `Device: ${t.device_type}\n`;
        if (t.serial_number || t.board_serial_number) msg += `Serial: ${t.serial_number || t.board_serial_number}\n`;
        if (t.issue_description) msg += `Issue: ${t.issue_description.substring(0, 100)}${t.issue_description.length > 100 ? '...' : ''}\n`;
        msg += `\n`;
        
        // Add tracking info if available
        if (t.tracking_id) msg += `Inward Tracking: ${t.tracking_id}\n`;
        if (t.return_tracking) msg += `Return Tracking: ${t.return_tracking}\n`;
        
        // Build actions based on status
        const actions = [];
        
        // Reverse pickup tickets - may need new label or tracking
        const isReversePickup = t.status === 'reverse_pickup' || 
                                 t.status === 'label_uploaded' ||
                                 t.status === 'awaiting_label' ||
                                 t.status === 'awaiting_pickup';
        
        // Hardware queue tickets - need reverse pickup or spare dispatch
        const isHardwareTicket = t.ticket_type === 'hardware_service' || 
                                  t.status === 'hardware_queue' || 
                                  t.status === 'hardware_service' ||
                                  t.status === 'repair_in_progress';
        
        if (isReversePickup) {
          actions.push({ type: 'button', label: 'Re-upload Label', command: 'ticket_reupload_label', icon: 'upload' });
          actions.push({ type: 'button', label: 'New Tracking ID', command: 'ticket_new_tracking', icon: 'truck' });
        }
        
        if (isHardwareTicket) {
          if (!t.return_tracking && !isReversePickup) {
            actions.push({ type: 'button', label: 'Upload Return Label', command: 'ticket_upload_return_label', icon: 'upload' });
            actions.push({ type: 'button', label: 'Enter Return Tracking', command: 'ticket_enter_return_tracking', icon: 'truck' });
          }
          actions.push({ type: 'button', label: 'Dispatch Spare', command: 'ticket_dispatch_spare', icon: 'package' });
        }
        
        // General actions
        actions.push({ type: 'button', label: 'Update Status', command: 'ticket_update_status', icon: 'edit' });
        actions.push({ type: 'button', label: 'Add Notes', command: 'ticket_add_notes', icon: 'file' });
        actions.push({ type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' });
        
        addMessage('bot', msg, actions, {
          ticket: t,
          ticket_id: t.id,
          ticket_number: t.ticket_number,
          source: 'tickets'
        });
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
      
      if (text === 'map_amazon_sku') {
        if (!context.unmapped_items || context.unmapped_items.length === 0) {
          addMessage('bot', 'All SKUs are already mapped!', [
            { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' }
          ], context);
          setLoading(false);
          return;
        }
        
        const item = context.unmapped_items[0];
        let msg = `**MAP AMAZON SKU**\n\n`;
        msg += `Amazon SKU: **${item.amazon_sku}**\n`;
        msg += `ASIN: ${item.asin || 'N/A'}\n`;
        msg += `Title: ${item.title}\n\n`;
        msg += `Enter the Master SKU code or search by name:`;
        
        addMessage('bot', msg, [], {
          ...context,
          flow: 'map_sku',
          step: 'search_master_sku',
          mapping_item: item
        });
        setLoading(false);
        return;
      }
      
      if (text.startsWith('rto_')) {
        await handleRtoAction(text);
        setLoading(false);
        return;
      }
      
      // ===== TICKET ACTIONS =====
      
      if (text === 'ticket_enter_return_tracking') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        addMessage('bot', `**Enter Return Tracking ID**\n\nTicket: ${context.ticket_number}\n\nEnter the return/reverse pickup tracking ID:`, [], {
          ...context,
          flow: 'ticket_action',
          step: 'enter_return_tracking'
        });
        setLoading(false);
        return;
      }
      
      if (text === 'ticket_reupload_label' || text === 'ticket_new_tracking') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        addMessage('bot', `**New Shipping Label / Tracking**\n\nTicket: ${context.ticket_number}\nCurrent Status: ${context.ticket.status}\n\nEnter the new tracking ID:`, [], {
          ...context,
          flow: 'ticket_action',
          step: 'enter_new_tracking'
        });
        setLoading(false);
        return;
      }
      
      if (text === 'ticket_upload_return_label') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        addMessage('bot', `**Upload Return Label**\n\nTicket: ${context.ticket_number}\n\nPlease upload the return shipping label using the upload button below, or enter tracking ID directly.\n\n_File upload will be available soon. For now, enter tracking ID:_`, [], {
          ...context,
          flow: 'ticket_action',
          step: 'enter_return_tracking'
        });
        setLoading(false);
        return;
      }
      
      if (text === 'ticket_dispatch_spare') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        // Fetch master SKUs for spare selection
        const skus = await fetchMasterSkus();
        let msg = `**Dispatch Spare Part**\n\nTicket: ${context.ticket_number}\nCustomer: ${context.ticket.customer_name}\nPhone: ${context.ticket.customer_phone}\n\n**Select spare part to dispatch:**\n`;
        skus.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code})\n`; });
        msg += `\nEnter number or search by name:`;
        addMessage('bot', msg, [], {
          ...context,
          flow: 'ticket_action',
          step: 'select_spare_sku',
          available_skus: skus
        });
        setLoading(false);
        return;
      }
      
      if (text === 'ticket_update_status') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        const statuses = ['pending', 'in_progress', 'hardware_queue', 'reverse_pickup', 'repair_in_progress', 'repair_completed', 'ready_for_dispatch', 'dispatched', 'closed'];
        let msg = `**Update Ticket Status**\n\nCurrent: ${context.ticket.status}\n\nSelect new status:\n`;
        statuses.forEach((s, i) => { msg += `${i + 1}. ${s}\n`; });
        msg += `\nEnter number:`;
        addMessage('bot', msg, [], {
          ...context,
          flow: 'ticket_action',
          step: 'select_status',
          status_options: statuses
        });
        setLoading(false);
        return;
      }
      
      if (text === 'ticket_add_notes') {
        if (!context.ticket) {
          addMessage('bot', 'No ticket in context. Please search for a ticket first.');
          setLoading(false);
          return;
        }
        addMessage('bot', `**Add Notes to Ticket**\n\nTicket: ${context.ticket_number}\n\nEnter your notes:`, [], {
          ...context,
          flow: 'ticket_action',
          step: 'enter_notes'
        });
        setLoading(false);
        return;
      }
      
      // ===== NEW COMMANDS =====
      
      // ADJUST command
      if (text.toLowerCase() === 'adjust') {
        try {
          const firmsRes = await axios.get(`${API}/api/bot/firms`, { headers });
          const firms = firmsRes.data.firms || [];
          let msg = `**Inventory Adjustment**\n\nSelect firm:\n`;
          firms.forEach((f, i) => { msg += `${i + 1}. ${f.name}\n`; });
          msg += `\nEnter firm number:`;
          addMessage('bot', msg, [], { 
            flow: 'adjust', 
            step: 'select_firm', 
            available_firms: firms 
          });
        } catch (err) {
          addMessage('bot', `Error: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // TRANSFER command
      if (text.toLowerCase() === 'transfer') {
        try {
          const firmsRes = await axios.get(`${API}/api/bot/firms`, { headers });
          const firms = firmsRes.data.firms || [];
          let msg = `**Stock Transfer**\n\nSelect source firm (FROM):\n`;
          firms.forEach((f, i) => { msg += `${i + 1}. ${f.name}\n`; });
          msg += `\nEnter firm number:`;
          addMessage('bot', msg, [], { 
            flow: 'transfer', 
            step: 'select_from_firm', 
            available_firms: firms 
          });
        } catch (err) {
          addMessage('bot', `Error: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // EXPENSE command
      if (text.toLowerCase() === 'expense') {
        try {
          const [firmsRes, catRes] = await Promise.all([
            axios.get(`${API}/api/bot/firms`, { headers }),
            axios.get(`${API}/api/bot/expense-categories`, { headers })
          ]);
          const firms = firmsRes.data.firms || [];
          let msg = `**Record Expense**\n\nSelect firm:\n`;
          firms.forEach((f, i) => { msg += `${i + 1}. ${f.name}\n`; });
          msg += `\nEnter firm number:`;
          addMessage('bot', msg, [], { 
            flow: 'expense', 
            step: 'select_firm', 
            available_firms: firms,
            expense_categories: catRes.data.categories || []
          });
        } catch (err) {
          addMessage('bot', `Error: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // ===== PURCHASE ENTRY COMMAND =====
      if (text.toLowerCase() === 'purchase') {
        try {
          const firmsRes = await axios.get(`${API}/api/bot/firms`, { headers });
          const firms = firmsRes.data.firms || [];
          let msg = `📦 **NEW PURCHASE ENTRY**\n\nSelect firm for this purchase:\n`;
          firms.forEach((f, i) => { msg += `${i + 1}. ${f.name}\n`; });
          msg += `\nEnter number:`;
          addMessage('bot', msg, [], { 
            flow: 'purchase', 
            step: 'select_firm', 
            available_firms: firms,
            purchase_items: []
          });
        } catch (err) {
          addMessage('bot', `Error: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // ===== OFFLINE ORDER COMMAND =====
      if (text.toLowerCase() === 'order') {
        try {
          const firmsRes = await axios.get(`${API}/api/bot/firms`, { headers });
          const firms = firmsRes.data.firms || [];
          let msg = `🛒 **NEW OFFLINE ORDER**\n\nSelect firm for this order:\n`;
          firms.forEach((f, i) => { msg += `${i + 1}. ${f.name}\n`; });
          msg += `\nEnter number:`;
          addMessage('bot', msg, [], { 
            flow: 'offline_order', 
            step: 'select_firm', 
            available_firms: firms,
            order_items: []
          });
        } catch (err) {
          addMessage('bot', `Error: ${err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle ADJUST flow steps
      if (context.flow === 'adjust') {
        if (context.step === 'select_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const selectedFirm = context.available_firms[num - 1];
            // Only traded items and raw materials can be adjusted
            // Manufactured items require production flow with serial tracking
            addMessage('bot', `Selected: **${selectedFirm.name}**\n\nWhat type of item to adjust?\n1. Traded Item\n2. Raw Material\n\n_(Manufactured items cannot be adjusted - use production flow)_\n\nEnter number:`, [], {
              ...context, step: 'select_type', selected_firm: selectedFirm
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_type') {
          // Only traded items and raw materials can be adjusted
          // Manufactured items require production/dispatch flow with serial tracking
          const types = { '1': 'traded_item', '2': 'raw_material' };
          const itemType = types[text];
          if (itemType) {
            let msg = `Enter item name or SKU code to search:`;
            addMessage('bot', msg, [], { ...context, step: 'search_item', item_type: itemType });
          } else {
            addMessage('bot', 'Invalid selection. Enter 1 or 2.');
          }
          setLoading(false);
          return;
        }
        if (context.step === 'search_item' && context.search_results) {
          // User is selecting from search results
          const num = parseInt(text);
          if (num >= 1 && num <= context.search_results?.length) {
            const selected = context.search_results[num - 1];
            addMessage('bot', `Selected: **${selected.name}**\n\nEnter quantity adjustment (e.g., -5 or +10):`, [], {
              ...context, step: 'enter_quantity', selected_item: selected, search_results: null
            });
          } else {
            addMessage('bot', `Invalid selection. Enter a number between 1 and ${context.search_results.length}.`);
          }
          setLoading(false);
          return;
        }
        if (context.step === 'search_item' && !context.search_results) {
          // User is searching for an item
          const items = await searchItemsByType(context.item_type, text);
          if (items.length === 0) {
            addMessage('bot', `No ${context.item_type === 'traded_item' ? 'traded items' : 'raw materials'} found for "${text}". Try another search.`);
          } else if (items.length === 1) {
            addMessage('bot', `Selected: **${items[0].name}**\n\nEnter quantity adjustment (use - for reduction, e.g., -5 or +10):`, [], {
              ...context, step: 'enter_quantity', selected_item: items[0]
            });
          } else {
            let msg = `**Found ${items.length} items:**\n`;
            items.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code || 'N/A'})\n`; });
            msg += `\nEnter number to select:`;
            addMessage('bot', msg, [], { ...context, search_results: items });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_quantity') {
          const qty = parseInt(text);
          if (isNaN(qty) || qty === 0) {
            addMessage('bot', 'Invalid quantity. Enter a number like -5 or +10.');
          } else {
            addMessage('bot', `Quantity: **${qty > 0 ? '+' : ''}${qty}**\n\nEnter reason for adjustment:`, [], {
              ...context, step: 'enter_reason', quantity_change: qty
            });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_reason') {
          try {
            const res = await axios.post(`${API}/api/bot/adjust-inventory`,
              new URLSearchParams({
                item_type: context.item_type,
                item_id: context.selected_item.id,
                firm_id: context.selected_firm.id,
                quantity_change: context.quantity_change,
                reason: text
              }), { headers });
            addMessage('bot', `**${res.data.message}**\n\nPrevious: ${res.data.previous_balance}\nNew: ${res.data.new_balance}`, [
              { type: 'button', label: 'Another Adjustment', command: 'adjust' },
              { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle TRANSFER flow steps
      if (context.flow === 'transfer') {
        if (context.step === 'select_from_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const fromFirm = context.available_firms[num - 1];
            let msg = `From: **${fromFirm.name}**\n\nSelect destination firm (TO):\n`;
            context.available_firms.forEach((f, i) => { 
              if (f.id !== fromFirm.id) msg += `${i + 1}. ${f.name}\n`; 
            });
            msg += `\nEnter firm number:`;
            addMessage('bot', msg, [], { ...context, step: 'select_to_firm', from_firm: fromFirm });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_to_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const toFirm = context.available_firms[num - 1];
            if (toFirm.id === context.from_firm.id) {
              addMessage('bot', 'Cannot transfer to same firm. Select a different firm.');
            } else {
              addMessage('bot', `To: **${toFirm.name}**\n\nItem type?\n1. Master SKU (Traded)\n2. Master SKU (Manufactured - Serial Tracked)\n3. Raw Material\n\nEnter number:`, [], {
                ...context, step: 'select_type', to_firm: toFirm
              });
            }
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_type') {
          const types = { '1': 'master_sku', '2': 'manufactured', '3': 'raw_material' };
          const itemType = types[text];
          if (itemType) {
            addMessage('bot', `Enter item name or SKU to search:`, [], { 
              ...context, step: 'search_item', item_type: itemType,
              is_manufactured: itemType === 'manufactured'
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter 1, 2, or 3.');
          }
          setLoading(false);
          return;
        }
        if (context.step === 'search_item') {
          let items = [];
          if (context.item_type === 'raw_material') {
            items = await searchItemsByType('raw_material', text);
          } else {
            // For master_sku and manufactured, search master_skus
            const skus = await fetchMasterSkus(text);
            items = skus.map(s => ({ ...s, type: 'master_sku' }));
          }
          
          if (items.length === 0) {
            addMessage('bot', 'No items found. Try another search:');
          } else if (items.length === 1) {
            // Check stock at source firm
            try {
              const stockRes = await axios.get(
                `${API}/api/bot/check-stock?item_type=${context.item_type === 'raw_material' ? 'raw_material' : 'master_sku'}&item_id=${items[0].id}&firm_id=${context.from_firm.id}`,
                { headers }
              );
              const stockInfo = stockRes.data;
              
              if (stockInfo.current_stock <= 0) {
                addMessage('bot', `⚠️ **${items[0].name}**\n\nNo stock available at ${context.from_firm.name}.\nCurrent Stock: 0\n\nSearch for another item:`, [], context);
              } else if (context.is_manufactured && stockInfo.serials?.length > 0) {
                // Manufactured item with serials - show available serials
                let msg = `**${items[0].name}**\n`;
                msg += `Available at ${context.from_firm.name}: **${stockInfo.current_stock}** units\n\n`;
                msg += `**Available Serial Numbers:**\n`;
                stockInfo.serials.slice(0, 20).forEach((s, i) => {
                  msg += `${i + 1}. ${s.serial_number}\n`;
                });
                if (stockInfo.serials.length > 20) msg += `... and ${stockInfo.serials.length - 20} more\n`;
                msg += `\nEnter serial numbers to transfer (comma-separated) or "all" for all:`;
                addMessage('bot', msg, [], {
                  ...context, step: 'select_serials', selected_item: items[0], 
                  available_stock: stockInfo.current_stock, available_serials: stockInfo.serials
                });
              } else {
                // Non-manufactured or no serials - quantity based
                addMessage('bot', `**${items[0].name}**\n\nAvailable at ${context.from_firm.name}: **${stockInfo.current_stock}** units\n\nEnter quantity to transfer:`, [], {
                  ...context, step: 'enter_quantity', selected_item: items[0], available_stock: stockInfo.current_stock
                });
              }
            } catch (err) {
              addMessage('bot', `Error checking stock: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            let msg = `Found ${items.length} items:\n`;
            items.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code || 'N/A'})\n`; });
            msg += `\nEnter number:`;
            addMessage('bot', msg, [], { ...context, step: 'select_search_result', search_results: items });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_search_result') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.search_results?.length) {
            const item = context.search_results[num - 1];
            // Check stock
            try {
              const stockRes = await axios.get(
                `${API}/api/bot/check-stock?item_type=${context.item_type === 'raw_material' ? 'raw_material' : 'master_sku'}&item_id=${item.id}&firm_id=${context.from_firm.id}`,
                { headers }
              );
              const stockInfo = stockRes.data;
              
              if (stockInfo.current_stock <= 0) {
                addMessage('bot', `⚠️ **${item.name}**\n\nNo stock available at ${context.from_firm.name}.\n\nSearch for another item:`, [], context);
              } else if (context.is_manufactured && stockInfo.serials?.length > 0) {
                let msg = `**${item.name}**\n`;
                msg += `Available at ${context.from_firm.name}: **${stockInfo.current_stock}** units\n\n`;
                msg += `**Available Serial Numbers:**\n`;
                stockInfo.serials.slice(0, 20).forEach((s, i) => {
                  msg += `${i + 1}. ${s.serial_number}\n`;
                });
                msg += `\nEnter serial numbers to transfer (comma-separated) or "all":`;
                addMessage('bot', msg, [], {
                  ...context, step: 'select_serials', selected_item: item,
                  available_stock: stockInfo.current_stock, available_serials: stockInfo.serials
                });
              } else {
                addMessage('bot', `**${item.name}**\n\nAvailable at ${context.from_firm.name}: **${stockInfo.current_stock}** units\n\nEnter quantity to transfer:`, [], {
                  ...context, step: 'enter_quantity', selected_item: item, available_stock: stockInfo.current_stock
                });
              }
            } catch (err) {
              addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        // Handle serial number selection for manufactured items
        if (context.step === 'select_serials') {
          let selectedSerials = [];
          
          if (text.toLowerCase() === 'all') {
            selectedSerials = context.available_serials.map(s => s.serial_number);
          } else {
            // Parse comma-separated serial numbers or numbers
            const inputs = text.split(',').map(s => s.trim());
            for (const input of inputs) {
              const num = parseInt(input);
              if (!isNaN(num) && num >= 1 && num <= context.available_serials.length) {
                selectedSerials.push(context.available_serials[num - 1].serial_number);
              } else {
                // Try to match as serial number
                const match = context.available_serials.find(s => 
                  s.serial_number.toLowerCase() === input.toLowerCase()
                );
                if (match) selectedSerials.push(match.serial_number);
              }
            }
          }
          
          if (selectedSerials.length === 0) {
            addMessage('bot', 'No valid serials selected. Enter serial numbers (comma-separated) or "all":');
            setLoading(false);
            return;
          }
          
          let msg = `**Selected ${selectedSerials.length} serial(s):**\n`;
          selectedSerials.slice(0, 10).forEach(s => { msg += `• ${s}\n`; });
          if (selectedSerials.length > 10) msg += `... and ${selectedSerials.length - 10} more\n`;
          msg += `\nEnter invoice/transfer reference number:`;
          
          addMessage('bot', msg, [], {
            ...context, step: 'enter_invoice', quantity: selectedSerials.length, selected_serials: selectedSerials
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_quantity') {
          const qty = parseInt(text);
          if (isNaN(qty) || qty <= 0) {
            addMessage('bot', 'Please enter a valid quantity:');
            setLoading(false);
            return;
          }
          if (qty > context.available_stock) {
            addMessage('bot', `⚠️ Insufficient stock!\n\nRequested: ${qty}\nAvailable: ${context.available_stock}\n\nEnter a valid quantity (max ${context.available_stock}):`);
            setLoading(false);
            return;
          }
          addMessage('bot', `✓ Quantity: **${qty}**\n\nEnter invoice/transfer reference number:`, [], {
            ...context, step: 'enter_invoice', quantity: qty
          });
          setLoading(false);
          return;
        }
        if (context.step === 'enter_invoice') {
          try {
            const payload = {
              item_type: context.item_type === 'manufactured' ? 'master_sku' : context.item_type,
              item_id: context.selected_item.id,
              from_firm_id: context.from_firm.id,
              to_firm_id: context.to_firm.id,
              quantity: context.quantity,
              invoice_number: text,
              is_manufactured: context.is_manufactured || false,
              serial_numbers: context.selected_serials || []
            };
            
            const res = await axios.post(`${API}/api/bot/transfer-stock`, payload, { headers });
            
            let msg = `✅ **${res.data.message}**\n\n`;
            msg += `Transfer #: ${res.data.transfer_number}\n`;
            msg += `${res.data.from_firm} → ${res.data.to_firm}\n`;
            msg += `Item: ${context.selected_item.name}\n`;
            msg += `Quantity: ${context.quantity}\n`;
            msg += `Invoice: ${res.data.invoice_number}\n`;
            if (context.selected_serials?.length > 0) {
              msg += `\n**Serials Transferred:**\n`;
              context.selected_serials.slice(0, 5).forEach(s => { msg += `• ${s}\n`; });
              if (context.selected_serials.length > 5) msg += `... and ${context.selected_serials.length - 5} more\n`;
            }
            
            addMessage('bot', msg, [
              { type: 'button', label: 'Another Transfer', command: 'transfer' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle EXPENSE flow steps
      if (context.flow === 'expense') {
        if (context.step === 'select_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const firm = context.available_firms[num - 1];
            addMessage('bot', `Firm: **${firm.name}**\n\nEnter expense date (YYYY-MM-DD):`, [], {
              ...context, step: 'enter_date', selected_firm: firm
            });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_date') {
          let msg = `Date: **${text}**\n\nSelect category:\n`;
          context.expense_categories?.forEach((c, i) => { msg += `${i + 1}. ${c}\n`; });
          addMessage('bot', msg, [], { ...context, step: 'select_category', expense_date: text });
          setLoading(false);
          return;
        }
        if (context.step === 'select_category') {
          const num = parseInt(text);
          const cat = context.expense_categories?.[num - 1] || text;
          addMessage('bot', `Category: **${cat}**\n\nEnter description:`, [], {
            ...context, step: 'enter_description', category: cat
          });
          setLoading(false);
          return;
        }
        if (context.step === 'enter_description') {
          addMessage('bot', `Description: **${text}**\n\nEnter amount (₹):`, [], {
            ...context, step: 'enter_amount', description: text
          });
          setLoading(false);
          return;
        }
        if (context.step === 'enter_amount') {
          const amt = parseFloat(text);
          if (amt > 0) {
            addMessage('bot', `Amount: **₹${amt}**\n\nPayment mode?\n1. Cash\n2. Bank\n3. UPI\n\nEnter number:`, [], {
              ...context, step: 'select_payment', amount: amt
            });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_payment') {
          const modes = { '1': 'cash', '2': 'bank', '3': 'upi' };
          const mode = modes[text] || text.toLowerCase();
          addMessage('bot', `Payment: **${mode}**\n\nIs GST applicable? (yes/no):`, [], {
            ...context, step: 'gst_check', payment_mode: mode
          });
          setLoading(false);
          return;
        }
        if (context.step === 'gst_check') {
          const gstApplicable = text.toLowerCase().startsWith('y');
          if (gstApplicable) {
            addMessage('bot', `Select GST Rate:\n1. 5%\n2. 12%\n3. 18%\n4. 28%\n\nEnter number:`, [], { 
              ...context, step: 'select_gst_rate', gst_applicable: true 
            });
          } else {
            // Record expense
            try {
              const res = await axios.post(`${API}/api/bot/record-expense`,
                new URLSearchParams({
                  firm_id: context.selected_firm.id,
                  expense_date: context.expense_date,
                  category: context.category,
                  description: context.description,
                  amount: context.amount,
                  payment_mode: context.payment_mode,
                  gst_applicable: 'false'
                }), { headers });
              addMessage('bot', `**${res.data.message}**\n\nExpense #: ${res.data.expense_number}`, [
                { type: 'button', label: 'Another Expense', command: 'expense' },
                { type: 'button', label: 'Search', command: 'search_prompt' }
              ], {});
            } catch (err) {
              addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
            }
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_gst_rate') {
          const rates = { '1': 5, '2': 12, '3': 18, '4': 28 };
          const gstRate = rates[text];
          if (!gstRate) {
            addMessage('bot', 'Invalid selection. Enter 1, 2, 3, or 4:');
            setLoading(false);
            return;
          }
          const gstAmt = (context.amount * gstRate / 100);
          const totalWithGst = context.amount + gstAmt;
          
          try {
            const res = await axios.post(`${API}/api/bot/record-expense`,
              new URLSearchParams({
                firm_id: context.selected_firm.id,
                expense_date: context.expense_date,
                category: context.category,
                description: context.description,
                amount: context.amount.toString(),
                payment_mode: context.payment_mode,
                gst_applicable: 'true',
                gst_rate: gstRate.toString(),
                gst_amount: gstAmt.toFixed(2)
              }), { headers });
            addMessage('bot', `**${res.data.message}**\n\nExpense #: ${res.data.expense_number}\nBase Amount: ₹${context.amount.toLocaleString()}\nGST (${gstRate}%): ₹${gstAmt.toLocaleString()}\n**Total: ₹${totalWithGst.toLocaleString()}**`, [
              { type: 'button', label: 'Another Expense', command: 'expense' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_gst') {
          const gstAmt = parseFloat(text);
          try {
            const res = await axios.post(`${API}/api/bot/record-expense`,
              new URLSearchParams({
                firm_id: context.selected_firm.id,
                expense_date: context.expense_date,
                category: context.category,
                description: context.description,
                amount: context.amount,
                payment_mode: context.payment_mode,
                gst_applicable: 'true',
                gst_amount: gstAmt
              }), { headers });
            addMessage('bot', `**${res.data.message}**\n\nExpense #: ${res.data.expense_number}\nTotal with GST: ₹${res.data.total_with_gst}`, [
              { type: 'button', label: 'Another Expense', command: 'expense' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // ===== PURCHASE ENTRY FLOW =====
      if (context.flow === 'purchase') {
        // Step 1: Select firm
        if (context.step === 'select_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const firm = context.available_firms[num - 1];
            addMessage('bot', `Firm: **${firm.name}**\n\nEnter supplier name or search existing party:`, [], {
              ...context, step: 'search_supplier', selected_firm: firm
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        // Step 2: Search/Select supplier
        if (context.step === 'search_supplier') {
          try {
            const res = await axios.get(`${API}/api/bot/search-parties?search=${encodeURIComponent(text)}&party_type=supplier`, { headers });
            const parties = res.data.parties || [];
            
            if (parties.length === 0) {
              addMessage('bot', `⚠️ Supplier "${text}" not found.\n\n1. Create New Supplier\n2. Search Again\n\nEnter choice:`, [], {
                ...context, step: 'supplier_not_found', supplier_name: text
              });
            } else if (parties.length === 1) {
              const supplier = parties[0];
              addMessage('bot', `✓ Supplier: **${supplier.name}**${supplier.gst_number ? `\nGST: ${supplier.gst_number}` : ''}\n\nEnter Purchase Invoice Number:`, [], {
                ...context, step: 'enter_invoice_number', selected_supplier: supplier
              });
            } else {
              let msg = `Found ${parties.length} suppliers:\n`;
              parties.slice(0, 10).forEach((p, i) => { msg += `${i + 1}. ${p.name}${p.gst_number ? ` (${p.gst_number})` : ''}\n`; });
              msg += `\nEnter number or search again:`;
              addMessage('bot', msg, [], { ...context, step: 'select_supplier', supplier_results: parties });
            }
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_supplier') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.supplier_results?.length) {
            const supplier = context.supplier_results[num - 1];
            addMessage('bot', `✓ Supplier: **${supplier.name}**${supplier.gst_number ? `\nGST: ${supplier.gst_number}` : ''}\n\nEnter Purchase Invoice Number:`, [], {
              ...context, step: 'enter_invoice_number', selected_supplier: supplier
            });
          } else {
            // Treat as new search
            addMessage('bot', `Searching for "${text}"...`, []);
            const res = await axios.get(`${API}/api/bot/search-parties?search=${encodeURIComponent(text)}&party_type=supplier`, { headers });
            const parties = res.data.parties || [];
            if (parties.length === 0) {
              addMessage('bot', `⚠️ Supplier "${text}" not found.\n\n1. Create New Supplier\n2. Search Again\n\nEnter choice:`, [], {
                ...context, step: 'supplier_not_found', supplier_name: text
              });
            }
          }
          setLoading(false);
          return;
        }
        
        // Step 3: Supplier not found - create or search again
        if (context.step === 'supplier_not_found') {
          if (text === '1') {
            addMessage('bot', `📝 **CREATE NEW SUPPLIER**\n\nSupplier Name: ${context.supplier_name}\n\nIs this a GST Registered Party? (yes/no):`, [], {
              ...context, step: 'gst_registered_check', new_supplier: { name: context.supplier_name }
            });
          } else {
            addMessage('bot', `Enter supplier name to search:`, [], {
              ...context, step: 'search_supplier'
            });
          }
          setLoading(false);
          return;
        }
        
        // Step 4: GST registration check
        if (context.step === 'gst_registered_check') {
          const isRegistered = text.toLowerCase().startsWith('y');
          if (isRegistered) {
            addMessage('bot', `Enter GST Number (15 characters):`, [], {
              ...context, step: 'enter_gst_number', new_supplier: { ...context.new_supplier, is_gst_registered: true }
            });
          } else {
            addMessage('bot', `Enter Supplier Contact Name:`, [], {
              ...context, step: 'enter_contact_name', new_supplier: { ...context.new_supplier, is_gst_registered: false }
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_gst_number') {
          const gstNum = text.toUpperCase().trim();
          if (gstNum.length !== 15) {
            addMessage('bot', 'GST number must be 15 characters. Please enter again:');
            setLoading(false);
            return;
          }
          // Auto-detect state from GST (first 2 digits)
          const stateCodes = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh' };
          const stateCode = gstNum.substring(0, 2);
          const detectedState = stateCodes[stateCode] || 'Unknown';
          
          addMessage('bot', `✓ GST: ${gstNum}\nState: ${detectedState} (auto-detected)\n\nEnter Supplier Contact Name:`, [], {
            ...context, step: 'enter_contact_name', 
            new_supplier: { ...context.new_supplier, gst_number: gstNum, state: detectedState }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_contact_name') {
          addMessage('bot', `✓ Contact: ${text}\n\nEnter Supplier Phone:`, [], {
            ...context, step: 'enter_supplier_phone', 
            new_supplier: { ...context.new_supplier, contact_name: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_supplier_phone') {
          addMessage('bot', `✓ Phone: ${text}\n\nEnter Supplier Address:`, [], {
            ...context, step: 'enter_supplier_address', 
            new_supplier: { ...context.new_supplier, phone: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_supplier_address') {
          // Create the supplier
          try {
            const supplierData = {
              ...context.new_supplier,
              address: text,
              party_type: 'supplier'
            };
            const res = await axios.post(`${API}/api/bot/create-party`, supplierData, { headers });
            const supplier = res.data.party;
            
            addMessage('bot', `✓ **Supplier Created!**\n\nName: ${supplier.name}${supplier.gst_number ? `\nGST: ${supplier.gst_number}` : ''}\nContact: ${supplier.contact_name}\n\nEnter Purchase Invoice Number:`, [], {
              ...context, step: 'enter_invoice_number', selected_supplier: supplier, new_supplier: null
            });
          } catch (err) {
            addMessage('bot', `Error creating supplier: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        // Step 5: Invoice details
        if (context.step === 'enter_invoice_number') {
          addMessage('bot', `✓ Invoice: ${text}\n\nEnter Invoice Date (YYYY-MM-DD):`, [], {
            ...context, step: 'enter_invoice_date', invoice_number: text
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_invoice_date') {
          addMessage('bot', `✓ Date: ${text}\n\nWhat are you purchasing?\n1. Raw Material\n2. Traded Item (Finished Goods)\n\nEnter choice:`, [], {
            ...context, step: 'select_item_type', invoice_date: text
          });
          setLoading(false);
          return;
        }
        
        // Step 6: Item type selection
        if (context.step === 'select_item_type') {
          const types = { '1': 'raw_material', '2': 'traded_item' };
          const itemType = types[text];
          if (!itemType) {
            addMessage('bot', 'Invalid selection. Enter 1 or 2:');
            setLoading(false);
            return;
          }
          addMessage('bot', `Search ${itemType === 'raw_material' ? 'Raw Material' : 'Traded Item'} by name/code:`, [], {
            ...context, step: 'search_item', item_type: itemType
          });
          setLoading(false);
          return;
        }
        
        // Step 7: Search and select item
        if (context.step === 'search_item') {
          const items = await searchItemsByType(context.item_type, text);
          if (items.length === 0) {
            addMessage('bot', `No items found for "${text}". Try another search:`);
          } else if (items.length === 1) {
            addMessage('bot', `✓ Selected: **${items[0].name}** (${items[0].sku_code || 'N/A'})\n\nEnter Quantity:`, [], {
              ...context, step: 'enter_quantity', selected_item: items[0]
            });
          } else {
            let msg = `Found ${items.length} items:\n`;
            items.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code || 'N/A'})\n`; });
            msg += `\nEnter number:`;
            addMessage('bot', msg, [], { ...context, step: 'select_item', item_results: items });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_item') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.item_results?.length) {
            const item = context.item_results[num - 1];
            addMessage('bot', `✓ Selected: **${item.name}** (${item.sku_code || 'N/A'})\n\nEnter Quantity:`, [], {
              ...context, step: 'enter_quantity', selected_item: item
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        // Step 8: Quantity and pricing
        if (context.step === 'enter_quantity') {
          const qty = parseFloat(text);
          if (isNaN(qty) || qty <= 0) {
            addMessage('bot', 'Please enter a valid quantity:');
            setLoading(false);
            return;
          }
          addMessage('bot', `✓ Quantity: ${qty}\n\nEnter Unit Rate (₹ per unit, before GST):`, [], {
            ...context, step: 'enter_unit_rate', quantity: qty
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_unit_rate') {
          const rate = parseFloat(text);
          if (isNaN(rate) || rate <= 0) {
            addMessage('bot', 'Please enter a valid rate:');
            setLoading(false);
            return;
          }
          const taxableValue = context.quantity * rate;
          addMessage('bot', `✓ Rate: ₹${rate}\nTaxable Value: ₹${taxableValue.toLocaleString()}\n\nSelect GST Rate:\n1. 5%\n2. 12%\n3. 18%\n4. 28%\n5. Exempt (0%)\n\nEnter number:`, [], {
            ...context, step: 'select_gst_rate', unit_rate: rate, taxable_value: taxableValue
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_gst_rate') {
          const rates = { '1': 5, '2': 12, '3': 18, '4': 28, '5': 0 };
          const gstRate = rates[text];
          if (gstRate === undefined) {
            addMessage('bot', 'Invalid selection. Enter 1-5:');
            setLoading(false);
            return;
          }
          
          const gstAmount = context.taxable_value * gstRate / 100;
          const itemTotal = context.taxable_value + gstAmount;
          
          // Add item to purchase_items
          const newItem = {
            item_id: context.selected_item.id,
            item_type: context.item_type,
            name: context.selected_item.name,
            sku_code: context.selected_item.sku_code,
            quantity: context.quantity,
            unit_rate: context.unit_rate,
            taxable_value: context.taxable_value,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            total: itemTotal
          };
          
          const updatedItems = [...(context.purchase_items || []), newItem];
          const subtotal = updatedItems.reduce((sum, i) => sum + i.taxable_value, 0);
          const totalGst = updatedItems.reduce((sum, i) => sum + i.gst_amount, 0);
          const grandTotal = subtotal + totalGst;
          
          let summary = `✓ Item added!\n\n**${newItem.name}**\n`;
          summary += `${context.quantity} × ₹${context.unit_rate} = ₹${context.taxable_value.toLocaleString()}\n`;
          summary += `GST (${gstRate}%): ₹${gstAmount.toLocaleString()}\n`;
          summary += `Item Total: ₹${itemTotal.toLocaleString()}\n\n`;
          summary += `**Running Total: ₹${grandTotal.toLocaleString()}**\n\n`;
          summary += `Add more items? (yes/no):`;
          
          addMessage('bot', summary, [], {
            ...context, step: 'add_more_items', purchase_items: updatedItems, selected_item: null, item_results: null
          });
          setLoading(false);
          return;
        }
        
        // Step 9: Add more items or proceed
        if (context.step === 'add_more_items') {
          if (text.toLowerCase().startsWith('y')) {
            addMessage('bot', `What are you purchasing?\n1. Raw Material\n2. Traded Item (Finished Goods)\n\nEnter choice:`, [], {
              ...context, step: 'select_item_type'
            });
          } else {
            // Show summary and ask for payment
            const items = context.purchase_items;
            const subtotal = items.reduce((sum, i) => sum + i.taxable_value, 0);
            const totalGst = items.reduce((sum, i) => sum + i.gst_amount, 0);
            const grandTotal = subtotal + totalGst;
            
            let summary = `📋 **PURCHASE SUMMARY**\n\n`;
            summary += `Invoice: ${context.invoice_number}\n`;
            summary += `Supplier: ${context.selected_supplier.name}\n`;
            summary += `Date: ${context.invoice_date}\n\n`;
            summary += `**Items:**\n`;
            items.forEach((item, i) => {
              summary += `${i + 1}. ${item.name} - ${item.quantity} × ₹${item.unit_rate} = ₹${item.taxable_value.toLocaleString()}\n`;
            });
            summary += `\nSubtotal: ₹${subtotal.toLocaleString()}\n`;
            summary += `GST: ₹${totalGst.toLocaleString()}\n`;
            summary += `**Grand Total: ₹${grandTotal.toLocaleString()}**\n\n`;
            summary += `Payment Status:\n1. Paid (Full)\n2. Partial Payment\n3. Credit (Unpaid)\n\nEnter choice:`;
            
            addMessage('bot', summary, [], {
              ...context, step: 'select_payment_status', subtotal, total_gst: totalGst, grand_total: grandTotal
            });
          }
          setLoading(false);
          return;
        }
        
        // Step 10: Payment details
        if (context.step === 'select_payment_status') {
          const statuses = { '1': 'paid', '2': 'partial', '3': 'credit' };
          const paymentStatus = statuses[text];
          if (!paymentStatus) {
            addMessage('bot', 'Invalid selection. Enter 1, 2, or 3:');
            setLoading(false);
            return;
          }
          
          if (paymentStatus === 'paid') {
            addMessage('bot', `Payment Mode:\n1. Cash\n2. Bank Transfer\n3. UPI\n4. Cheque\n\nEnter choice:`, [], {
              ...context, step: 'select_payment_mode', payment_status: 'paid', amount_paid: context.grand_total, balance_due: 0
            });
          } else if (paymentStatus === 'partial') {
            addMessage('bot', `Grand Total: ₹${context.grand_total.toLocaleString()}\n\nEnter Amount Paid (₹):`, [], {
              ...context, step: 'enter_amount_paid', payment_status: 'partial'
            });
          } else {
            // Credit - no payment now
            addMessage('bot', `✓ Credit purchase (unpaid)\n\nBalance Due: ₹${context.grand_total.toLocaleString()}\n\nConfirm to record purchase? (yes/no):`, [], {
              ...context, step: 'confirm_purchase', payment_status: 'credit', amount_paid: 0, balance_due: context.grand_total, payment_mode: null
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_amount_paid') {
          const amtPaid = parseFloat(text);
          if (isNaN(amtPaid) || amtPaid <= 0 || amtPaid > context.grand_total) {
            addMessage('bot', `Please enter a valid amount (max ₹${context.grand_total.toLocaleString()}):`);
            setLoading(false);
            return;
          }
          const balanceDue = context.grand_total - amtPaid;
          addMessage('bot', `✓ Amount Paid: ₹${amtPaid.toLocaleString()}\nBalance Due: ₹${balanceDue.toLocaleString()}\n\nPayment Mode:\n1. Cash\n2. Bank Transfer\n3. UPI\n4. Cheque\n\nEnter choice:`, [], {
            ...context, step: 'select_payment_mode', amount_paid: amtPaid, balance_due: balanceDue
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_payment_mode') {
          const modes = { '1': 'cash', '2': 'bank', '3': 'upi', '4': 'cheque' };
          const mode = modes[text];
          if (!mode) {
            addMessage('bot', 'Invalid selection. Enter 1-4:');
            setLoading(false);
            return;
          }
          
          if (mode === 'bank' || mode === 'cheque') {
            addMessage('bot', `Enter ${mode === 'bank' ? 'Bank Reference/UTR' : 'Cheque Number'} (or skip):`, [], {
              ...context, step: 'enter_reference', payment_mode: mode
            });
          } else {
            addMessage('bot', `✓ Payment Mode: ${mode}\n\nConfirm to record purchase? (yes/no):`, [], {
              ...context, step: 'confirm_purchase', payment_mode: mode
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_reference') {
          const ref = text.toLowerCase() === 'skip' ? null : text;
          addMessage('bot', `${ref ? `✓ Reference: ${ref}\n\n` : ''}Confirm to record purchase? (yes/no):`, [], {
            ...context, step: 'confirm_purchase', payment_reference: ref
          });
          setLoading(false);
          return;
        }
        
        // Step 11: Confirm and record purchase
        if (context.step === 'confirm_purchase') {
          if (!text.toLowerCase().startsWith('y')) {
            addMessage('bot', 'Purchase cancelled.', [
              { type: 'button', label: 'New Purchase', command: 'purchase' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
            setLoading(false);
            return;
          }
          
          try {
            const purchaseData = {
              firm_id: context.selected_firm.id,
              supplier_id: context.selected_supplier.id,
              invoice_number: context.invoice_number,
              invoice_date: context.invoice_date,
              items: context.purchase_items,
              subtotal: context.subtotal,
              total_gst: context.total_gst,
              grand_total: context.grand_total,
              payment_status: context.payment_status,
              amount_paid: context.amount_paid || 0,
              balance_due: context.balance_due || 0,
              payment_mode: context.payment_mode,
              payment_reference: context.payment_reference
            };
            
            const res = await axios.post(`${API}/api/bot/record-purchase`, purchaseData, { headers });
            
            let msg = `✅ **PURCHASE RECORDED!**\n\n`;
            msg += `Purchase #: ${res.data.purchase_number}\n`;
            msg += `Supplier: ${context.selected_supplier.name}\n`;
            msg += `Invoice: ${context.invoice_number}\n`;
            msg += `Total: ₹${context.grand_total.toLocaleString()}\n`;
            if (context.amount_paid > 0) msg += `Paid: ₹${context.amount_paid.toLocaleString()}\n`;
            if (context.balance_due > 0) msg += `Balance Due: ₹${context.balance_due.toLocaleString()}\n`;
            msg += `\n📦 **Stock Updated:**\n`;
            context.purchase_items.forEach(item => {
              msg += `• ${item.name}: +${item.quantity} units\n`;
            });
            
            addMessage('bot', msg, [
              { type: 'button', label: 'Another Purchase', command: 'purchase' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error recording purchase: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // ===== OFFLINE ORDER FLOW =====
      if (context.flow === 'offline_order') {
        // Step 1: Select firm
        if (context.step === 'select_firm') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.available_firms?.length) {
            const firm = context.available_firms[num - 1];
            addMessage('bot', `Firm: **${firm.name}**\n\nEnter customer name or phone to search:`, [], {
              ...context, step: 'search_customer', selected_firm: firm
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        // Step 2: Search customer
        if (context.step === 'search_customer') {
          try {
            const res = await axios.get(`${API}/api/bot/search-parties?search=${encodeURIComponent(text)}&party_type=customer`, { headers });
            const parties = res.data.parties || [];
            
            if (parties.length === 0) {
              addMessage('bot', `⚠️ Customer "${text}" not found.\n\n1. Create New Customer\n2. Search Again\n\nEnter choice:`, [], {
                ...context, step: 'customer_not_found', customer_search: text
              });
            } else if (parties.length === 1) {
              const customer = parties[0];
              let msg = `✓ **Customer Found:**\nName: ${customer.name}\nPhone: ${customer.phone || 'N/A'}`;
              if (customer.gst_number) msg += `\nGST: ${customer.gst_number}`;
              if (customer.address) msg += `\nAddress: ${customer.address}`;
              msg += `\n\n1. Use this customer\n2. Search another\n\nEnter choice:`;
              addMessage('bot', msg, [], { ...context, step: 'confirm_customer', found_customer: customer });
            } else {
              let msg = `Found ${parties.length} customers:\n`;
              parties.slice(0, 10).forEach((p, i) => { 
                msg += `${i + 1}. ${p.name} (${p.phone || 'N/A'})${p.gst_number ? ` GST: ${p.gst_number}` : ''}\n`; 
              });
              msg += `\nEnter number or search again:`;
              addMessage('bot', msg, [], { ...context, step: 'select_customer', customer_results: parties });
            }
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_customer') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.customer_results?.length) {
            const customer = context.customer_results[num - 1];
            addMessage('bot', `✓ Customer: **${customer.name}**\n\nEnter Invoice Number:`, [], {
              ...context, step: 'enter_invoice_number', selected_customer: customer
            });
          } else {
            // Treat as new search
            const res = await axios.get(`${API}/api/bot/search-parties?search=${encodeURIComponent(text)}&party_type=customer`, { headers });
            if (res.data.parties?.length === 0) {
              addMessage('bot', `Customer "${text}" not found.\n\n1. Create New Customer\n2. Search Again\n\nEnter choice:`, [], {
                ...context, step: 'customer_not_found', customer_search: text
              });
            }
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'confirm_customer') {
          if (text === '1') {
            addMessage('bot', `✓ Customer: **${context.found_customer.name}**\n\nEnter Invoice Number:`, [], {
              ...context, step: 'enter_invoice_number', selected_customer: context.found_customer
            });
          } else {
            addMessage('bot', `Enter customer name or phone to search:`, [], {
              ...context, step: 'search_customer'
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'customer_not_found') {
          if (text === '1') {
            addMessage('bot', `📝 **CREATE NEW CUSTOMER**\n\nEnter Customer Name:`, [], {
              ...context, step: 'enter_customer_name', new_customer: {}
            });
          } else {
            addMessage('bot', `Enter customer name or phone to search:`, [], {
              ...context, step: 'search_customer'
            });
          }
          setLoading(false);
          return;
        }
        
        // Create new customer steps
        if (context.step === 'enter_customer_name') {
          addMessage('bot', `✓ Name: ${text}\n\nEnter Phone Number (10 digits):`, [], {
            ...context, step: 'enter_customer_phone', new_customer: { ...context.new_customer, name: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_customer_phone') {
          const phone = text.replace(/\D/g, '');
          if (phone.length < 10) {
            addMessage('bot', 'Please enter a valid 10-digit phone number:');
            setLoading(false);
            return;
          }
          addMessage('bot', `✓ Phone: ${phone}\n\nIs this a GST Registered Customer? (yes/no):`, [], {
            ...context, step: 'customer_gst_check', new_customer: { ...context.new_customer, phone }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'customer_gst_check') {
          const isRegistered = text.toLowerCase().startsWith('y');
          if (isRegistered) {
            addMessage('bot', `Enter GST Number (15 characters):`, [], {
              ...context, step: 'enter_customer_gst', new_customer: { ...context.new_customer, is_gst_registered: true }
            });
          } else {
            addMessage('bot', `Enter Billing Address:`, [], {
              ...context, step: 'enter_customer_address', new_customer: { ...context.new_customer, is_gst_registered: false }
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_customer_gst') {
          const gstNum = text.toUpperCase().trim();
          if (gstNum.length !== 15) {
            addMessage('bot', 'GST number must be 15 characters. Please enter again:');
            setLoading(false);
            return;
          }
          const stateCodes = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh' };
          const stateCode = gstNum.substring(0, 2);
          const detectedState = stateCodes[stateCode] || 'Unknown';
          
          addMessage('bot', `✓ GST: ${gstNum}\nState: ${detectedState} (auto-detected)\n\nEnter Billing Address:`, [], {
            ...context, step: 'enter_customer_address', 
            new_customer: { ...context.new_customer, gst_number: gstNum, state: detectedState }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_customer_address') {
          addMessage('bot', `✓ Address saved\n\nEnter City:`, [], {
            ...context, step: 'enter_customer_city', new_customer: { ...context.new_customer, address: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_customer_city') {
          addMessage('bot', `✓ City: ${text}\n\nEnter Pincode:`, [], {
            ...context, step: 'enter_customer_pincode', new_customer: { ...context.new_customer, city: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_customer_pincode') {
          const pincode = text.replace(/\D/g, '');
          if (pincode.length !== 6) {
            addMessage('bot', 'Please enter a valid 6-digit pincode:');
            setLoading(false);
            return;
          }
          // Create customer
          try {
            const customerData = {
              ...context.new_customer,
              pincode,
              party_type: 'customer'
            };
            const res = await axios.post(`${API}/api/bot/create-party`, customerData, { headers });
            const customer = res.data.party;
            
            addMessage('bot', `✓ **Customer Created!**\n\nName: ${customer.name}\nPhone: ${customer.phone}${customer.gst_number ? `\nGST: ${customer.gst_number}` : ''}\n\nEnter Invoice Number:`, [], {
              ...context, step: 'enter_invoice_number', selected_customer: customer, new_customer: null
            });
          } catch (err) {
            addMessage('bot', `Error creating customer: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        // Invoice details
        if (context.step === 'enter_invoice_number') {
          addMessage('bot', `✓ Invoice: ${text}\n\nEnter Invoice Date (YYYY-MM-DD or 'today'):`, [], {
            ...context, step: 'enter_invoice_date', invoice_number: text
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_invoice_date') {
          const invoiceDate = text.toLowerCase() === 'today' ? new Date().toISOString().split('T')[0] : text;
          addMessage('bot', `✓ Date: ${invoiceDate}\n\nWhat type of product?\n1. Traded Item (Non-serialized)\n2. Manufactured Item (Serial Number Required)\n\nEnter choice:`, [], {
            ...context, step: 'select_product_type', invoice_date: invoiceDate
          });
          setLoading(false);
          return;
        }
        
        // Product selection
        if (context.step === 'select_product_type') {
          const types = { '1': 'traded', '2': 'manufactured' };
          const productType = types[text];
          if (!productType) {
            addMessage('bot', 'Invalid selection. Enter 1 or 2:');
            setLoading(false);
            return;
          }
          addMessage('bot', `Search product by name/SKU:`, [], {
            ...context, step: 'search_product', product_type: productType
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'search_product') {
          try {
            const res = await axios.get(`${API}/api/bot/search-products-with-stock?search=${encodeURIComponent(text)}&firm_id=${context.selected_firm.id}`, { headers });
            const products = res.data.products || [];
            
            if (products.length === 0) {
              addMessage('bot', `No products found for "${text}". Try another search:`);
            } else if (products.length === 1) {
              const p = products[0];
              if (context.product_type === 'manufactured' && p.available_serials?.length > 0) {
                let msg = `✓ **${p.name}** (${p.sku_code})\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'}\nStock: ${p.current_stock} units\n\n**Available Serial Numbers:**\n`;
                p.available_serials.slice(0, 15).forEach((s, i) => { msg += `${i + 1}. ${s.serial_number}\n`; });
                if (p.available_serials.length > 15) msg += `... and ${p.available_serials.length - 15} more\n`;
                msg += `\nEnter serial number(s) (comma-separated) or quantity for auto-assign:`;
                addMessage('bot', msg, [], {
                  ...context, step: 'select_serials', selected_product: p, available_serials: p.available_serials
                });
              } else if (context.product_type === 'traded') {
                addMessage('bot', `✓ **${p.name}** (${p.sku_code})\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'}\nStock: ${p.current_stock} units\n\nEnter Quantity:`, [], {
                  ...context, step: 'enter_quantity', selected_product: p
                });
              } else {
                addMessage('bot', `⚠️ No serial numbers available for ${p.name}. Try another product or use Traded Item type.`);
              }
            } else {
              let msg = `Found ${products.length} products:\n`;
              products.slice(0, 10).forEach((p, i) => { 
                msg += `${i + 1}. ${p.name} (${p.sku_code}) - Stock: ${p.current_stock}\n`; 
              });
              msg += `\nEnter number:`;
              addMessage('bot', msg, [], { ...context, step: 'select_product', product_results: products });
            }
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_product') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.product_results?.length) {
            const p = context.product_results[num - 1];
            if (context.product_type === 'manufactured' && p.available_serials?.length > 0) {
              let msg = `✓ **${p.name}** (${p.sku_code})\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'}\nStock: ${p.current_stock} units\n\n**Available Serial Numbers:**\n`;
              p.available_serials.slice(0, 15).forEach((s, i) => { msg += `${i + 1}. ${s.serial_number}\n`; });
              msg += `\nEnter serial number(s) or quantity:`;
              addMessage('bot', msg, [], {
                ...context, step: 'select_serials', selected_product: p, available_serials: p.available_serials
              });
            } else {
              addMessage('bot', `✓ **${p.name}** (${p.sku_code})\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'}\nStock: ${p.current_stock} units\n\nEnter Quantity:`, [], {
                ...context, step: 'enter_quantity', selected_product: p
              });
            }
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        // Serial selection for manufactured items
        if (context.step === 'select_serials') {
          let selectedSerials = [];
          const num = parseInt(text);
          
          if (!isNaN(num) && num > 0 && num <= context.available_serials.length) {
            // Auto-assign first N serials
            selectedSerials = context.available_serials.slice(0, num).map(s => s.serial_number);
          } else {
            // Parse comma-separated serials
            const inputs = text.split(',').map(s => s.trim());
            for (const input of inputs) {
              const idx = parseInt(input);
              if (!isNaN(idx) && idx >= 1 && idx <= context.available_serials.length) {
                selectedSerials.push(context.available_serials[idx - 1].serial_number);
              } else {
                const match = context.available_serials.find(s => 
                  s.serial_number.toLowerCase() === input.toLowerCase()
                );
                if (match) selectedSerials.push(match.serial_number);
              }
            }
          }
          
          if (selectedSerials.length === 0) {
            addMessage('bot', 'No valid serials selected. Enter serial numbers or quantity:');
            setLoading(false);
            return;
          }
          
          const p = context.selected_product;
          addMessage('bot', `✓ ${selectedSerials.length} serial(s) selected:\n${selectedSerials.slice(0, 5).map(s => `• ${s}`).join('\n')}${selectedSerials.length > 5 ? `\n... and ${selectedSerials.length - 5} more` : ''}\n\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'} per unit\nEnter Selling Rate (before GST) per unit\n(or type 'mrp' to use MRP):`, [], {
            ...context, step: 'enter_rate', quantity: selectedSerials.length, selected_serials: selectedSerials
          });
          setLoading(false);
          return;
        }
        
        // Quantity for traded items
        if (context.step === 'enter_quantity') {
          const qty = parseInt(text);
          if (isNaN(qty) || qty <= 0) {
            addMessage('bot', 'Please enter a valid quantity:');
            setLoading(false);
            return;
          }
          if (qty > context.selected_product.current_stock) {
            addMessage('bot', `⚠️ Insufficient stock!\nRequested: ${qty}\nAvailable: ${context.selected_product.current_stock}\n\nOrder will be placed but may require stock replenishment.\n\nContinue? (yes/no):`);
            // Store quantity and continue
          }
          const p = context.selected_product;
          addMessage('bot', `✓ Quantity: ${qty}\n\nMRP: ₹${p.mrp?.toLocaleString() || 'N/A'} per unit\nEnter Selling Rate (before GST) per unit\n(or type 'mrp' to use MRP):`, [], {
            ...context, step: 'enter_rate', quantity: qty
          });
          setLoading(false);
          return;
        }
        
        // Pricing
        if (context.step === 'enter_rate') {
          let rate = context.selected_product.mrp || 0;
          if (text.toLowerCase() !== 'mrp') {
            rate = parseFloat(text);
            if (isNaN(rate) || rate <= 0) {
              addMessage('bot', 'Please enter a valid rate:');
              setLoading(false);
              return;
            }
          }
          const taxableValue = context.quantity * rate;
          addMessage('bot', `✓ Rate: ₹${rate.toLocaleString()}/unit\nTaxable Value: ₹${taxableValue.toLocaleString()}\n\nSelect GST Rate:\n1. 5%\n2. 12%\n3. 18%\n4. 28%\n5. Exempt (0%)\n\nEnter number:`, [], {
            ...context, step: 'select_gst_rate', unit_rate: rate, taxable_value: taxableValue
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_gst_rate') {
          const rates = { '1': 5, '2': 12, '3': 18, '4': 28, '5': 0 };
          const gstRate = rates[text];
          if (gstRate === undefined) {
            addMessage('bot', 'Invalid selection. Enter 1-5:');
            setLoading(false);
            return;
          }
          
          const gstAmount = context.taxable_value * gstRate / 100;
          const itemTotal = context.taxable_value + gstAmount;
          
          const newItem = {
            master_sku_id: context.selected_product.id,
            product_name: context.selected_product.name,
            sku_code: context.selected_product.sku_code,
            quantity: context.quantity,
            serial_numbers: context.selected_serials || [],
            unit_rate: context.unit_rate,
            taxable_value: context.taxable_value,
            gst_rate: gstRate,
            gst_amount: gstAmount,
            total: itemTotal,
            is_manufactured: context.product_type === 'manufactured',
            default_warranty_years: context.selected_product.default_warranty_years || 1
          };
          
          const updatedItems = [...(context.order_items || []), newItem];
          const subtotal = updatedItems.reduce((sum, i) => sum + i.taxable_value, 0);
          const totalGst = updatedItems.reduce((sum, i) => sum + i.gst_amount, 0);
          const grandTotal = subtotal + totalGst;
          
          let summary = `✓ **Item added!**\n\n**${newItem.product_name}**\n`;
          summary += `${context.quantity} × ₹${context.unit_rate.toLocaleString()} = ₹${context.taxable_value.toLocaleString()}\n`;
          summary += `GST (${gstRate}%): ₹${gstAmount.toLocaleString()}\n`;
          summary += `Item Total: ₹${itemTotal.toLocaleString()}\n\n`;
          summary += `**Running Total: ₹${grandTotal.toLocaleString()}**\n\n`;
          summary += `Add more items? (yes/no):`;
          
          addMessage('bot', summary, [], {
            ...context, step: 'add_more_items', order_items: updatedItems, 
            selected_product: null, product_results: null, selected_serials: null
          });
          setLoading(false);
          return;
        }
        
        // Add more items or proceed
        if (context.step === 'add_more_items') {
          if (text.toLowerCase().startsWith('y')) {
            addMessage('bot', `What type of product?\n1. Traded Item (Non-serialized)\n2. Manufactured Item (Serial Number Required)\n\nEnter choice:`, [], {
              ...context, step: 'select_product_type'
            });
          } else {
            // Show summary
            const items = context.order_items;
            const subtotal = items.reduce((sum, i) => sum + i.taxable_value, 0);
            const totalGst = items.reduce((sum, i) => sum + i.gst_amount, 0);
            const grandTotal = subtotal + totalGst;
            
            let summary = `📋 **ORDER SUMMARY**\n\n`;
            summary += `Customer: ${context.selected_customer.name}\n`;
            summary += `Phone: ${context.selected_customer.phone || 'N/A'}\n`;
            if (context.selected_customer.gst_number) summary += `GST: ${context.selected_customer.gst_number}\n`;
            summary += `\nInvoice: ${context.invoice_number}\n`;
            summary += `Date: ${context.invoice_date}\n\n`;
            summary += `**Items:**\n`;
            items.forEach((item, i) => {
              summary += `${i + 1}. ${item.product_name} × ${item.quantity}`;
              if (item.serial_numbers?.length > 0) summary += ` (${item.serial_numbers.length} serials)`;
              summary += `\n   ₹${item.unit_rate.toLocaleString()} × ${item.quantity} = ₹${item.taxable_value.toLocaleString()}\n`;
            });
            summary += `\nSubtotal: ₹${subtotal.toLocaleString()}\n`;
            summary += `GST: ₹${totalGst.toLocaleString()}\n`;
            summary += `**Grand Total: ₹${grandTotal.toLocaleString()}**\n\n`;
            summary += `Delivery method:\n1. Self Pickup\n2. Courier / Transport\n3. Company Delivery\n\nEnter choice:`;
            
            addMessage('bot', summary, [], {
              ...context, step: 'select_delivery', subtotal, total_gst: totalGst, grand_total: grandTotal
            });
          }
          setLoading(false);
          return;
        }
        
        // Delivery
        if (context.step === 'select_delivery') {
          const methods = { '1': 'self_pickup', '2': 'courier', '3': 'company_delivery' };
          const method = methods[text];
          if (!method) {
            addMessage('bot', 'Invalid selection. Enter 1, 2, or 3:');
            setLoading(false);
            return;
          }
          
          if (method === 'self_pickup') {
            addMessage('bot', `✓ Delivery: Self Pickup\n\n**PAYMENT**\n\nGrand Total: ₹${context.grand_total.toLocaleString()}\n\nPayment Status:\n1. Paid (Full Payment Received)\n2. Partial Payment\n3. Credit (Pay Later)\n\nEnter choice:`, [], {
              ...context, step: 'select_payment', delivery_method: method, shipping_address: null
            });
          } else {
            addMessage('bot', `✓ Delivery: ${method === 'courier' ? 'Courier/Transport' : 'Company Delivery'}\n\nShipping address same as billing? (yes/no):`, [], {
              ...context, step: 'shipping_address_check', delivery_method: method
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'shipping_address_check') {
          if (text.toLowerCase().startsWith('y')) {
            addMessage('bot', `✓ Shipping: Same as billing\n\n**PAYMENT**\n\nGrand Total: ₹${context.grand_total.toLocaleString()}\n\nPayment Status:\n1. Paid (Full Payment Received)\n2. Partial Payment\n3. Credit (Pay Later)\n\nEnter choice:`, [], {
              ...context, step: 'select_payment', shipping_address: {
                address: context.selected_customer.address,
                city: context.selected_customer.city,
                state: context.selected_customer.state,
                pincode: context.selected_customer.pincode
              }
            });
          } else {
            addMessage('bot', `Enter shipping address:`, [], {
              ...context, step: 'enter_shipping_address'
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_shipping_address') {
          addMessage('bot', `✓ Address saved\n\nEnter shipping city:`, [], {
            ...context, step: 'enter_shipping_city', shipping_address: { address: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_shipping_city') {
          addMessage('bot', `✓ City: ${text}\n\nEnter shipping state:`, [], {
            ...context, step: 'enter_shipping_state', shipping_address: { ...context.shipping_address, city: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_shipping_state') {
          addMessage('bot', `✓ State: ${text}\n\nEnter shipping pincode:`, [], {
            ...context, step: 'enter_shipping_pincode', shipping_address: { ...context.shipping_address, state: text }
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_shipping_pincode') {
          addMessage('bot', `✓ Shipping address saved\n\n**PAYMENT**\n\nGrand Total: ₹${context.grand_total.toLocaleString()}\n\nPayment Status:\n1. Paid (Full Payment Received)\n2. Partial Payment\n3. Credit (Pay Later)\n\nEnter choice:`, [], {
            ...context, step: 'select_payment', shipping_address: { ...context.shipping_address, pincode: text }
          });
          setLoading(false);
          return;
        }
        
        // Payment
        if (context.step === 'select_payment') {
          const statuses = { '1': 'paid', '2': 'partial', '3': 'credit' };
          const status = statuses[text];
          if (!status) {
            addMessage('bot', 'Invalid selection. Enter 1, 2, or 3:');
            setLoading(false);
            return;
          }
          
          if (status === 'paid') {
            addMessage('bot', `✓ Full Payment\n\nPayment Mode:\n1. Cash\n2. Bank Transfer / NEFT / RTGS\n3. UPI\n4. Cheque\n5. Card\n\nEnter choice:`, [], {
              ...context, step: 'select_payment_mode', payment_status: 'paid', amount_paid: context.grand_total, balance_due: 0
            });
          } else if (status === 'partial') {
            addMessage('bot', `Grand Total: ₹${context.grand_total.toLocaleString()}\n\nEnter Amount Received (₹):`, [], {
              ...context, step: 'enter_amount_paid', payment_status: 'partial'
            });
          } else {
            addMessage('bot', `✓ Credit Sale\nBalance Due: ₹${context.grand_total.toLocaleString()}\n\nConfirm order? (yes/no):`, [], {
              ...context, step: 'confirm_order', payment_status: 'credit', amount_paid: 0, balance_due: context.grand_total, payment_mode: null
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_amount_paid') {
          const amt = parseFloat(text);
          if (isNaN(amt) || amt <= 0 || amt > context.grand_total) {
            addMessage('bot', `Please enter a valid amount (max ₹${context.grand_total.toLocaleString()}):`);
            setLoading(false);
            return;
          }
          const balance = context.grand_total - amt;
          addMessage('bot', `✓ Amount: ₹${amt.toLocaleString()}\nBalance Due: ₹${balance.toLocaleString()}\n\nPayment Mode:\n1. Cash\n2. Bank Transfer\n3. UPI\n4. Cheque\n5. Card\n\nEnter choice:`, [], {
            ...context, step: 'select_payment_mode', amount_paid: amt, balance_due: balance
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_payment_mode') {
          const modes = { '1': 'cash', '2': 'bank', '3': 'upi', '4': 'cheque', '5': 'card' };
          const mode = modes[text];
          if (!mode) {
            addMessage('bot', 'Invalid selection. Enter 1-5:');
            setLoading(false);
            return;
          }
          
          if (['bank', 'upi', 'cheque', 'card'].includes(mode)) {
            addMessage('bot', `Enter ${mode === 'bank' ? 'UTR/Reference' : mode === 'cheque' ? 'Cheque Number' : 'Transaction ID'} (or skip):`, [], {
              ...context, step: 'enter_payment_ref', payment_mode: mode
            });
          } else {
            addMessage('bot', `✓ Payment: Cash\n\nConfirm order? (yes/no):`, [], {
              ...context, step: 'confirm_order', payment_mode: mode
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_payment_ref') {
          const ref = text.toLowerCase() === 'skip' ? null : text;
          addMessage('bot', `${ref ? `✓ Reference: ${ref}\n\n` : ''}Confirm order? (yes/no):`, [], {
            ...context, step: 'confirm_order', payment_reference: ref
          });
          setLoading(false);
          return;
        }
        
        // Confirm and create order
        if (context.step === 'confirm_order') {
          if (!text.toLowerCase().startsWith('y')) {
            addMessage('bot', 'Order cancelled.', [
              { type: 'button', label: 'New Order', command: 'order' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
            setLoading(false);
            return;
          }
          
          try {
            const orderData = {
              firm_id: context.selected_firm.id,
              customer_id: context.selected_customer.id,
              invoice_number: context.invoice_number,
              invoice_date: context.invoice_date,
              items: context.order_items,
              subtotal: context.subtotal,
              total_gst: context.total_gst,
              grand_total: context.grand_total,
              delivery_method: context.delivery_method,
              shipping_address: context.shipping_address,
              payment_status: context.payment_status,
              amount_paid: context.amount_paid || 0,
              balance_due: context.balance_due || 0,
              payment_mode: context.payment_mode,
              payment_reference: context.payment_reference
            };
            
            const res = await axios.post(`${API}/api/bot/create-offline-order`, orderData, { headers });
            
            let msg = `✅ **ORDER CREATED!**\n\n`;
            msg += `Order #: ${res.data.order_number}\n`;
            msg += `Invoice: ${context.invoice_number}\n`;
            msg += `Customer: ${context.selected_customer.name}\n`;
            msg += `Total: ₹${context.grand_total.toLocaleString()}\n`;
            if (context.amount_paid > 0) msg += `Paid: ₹${context.amount_paid.toLocaleString()}\n`;
            if (context.balance_due > 0) msg += `Balance Due: ₹${context.balance_due.toLocaleString()}\n`;
            msg += `\n📦 **Status:** ${res.data.stock_status}\n`;
            msg += `Order moved to Pending Fulfillment queue.\n`;
            if (res.data.serials_reserved?.length > 0) {
              msg += `\n**Serials Reserved:**\n`;
              res.data.serials_reserved.slice(0, 5).forEach(s => { msg += `• ${s}\n`; });
            }
            
            addMessage('bot', msg, [
              { type: 'button', label: 'New Order', command: 'order' },
              { type: 'button', label: 'Search', command: 'search_prompt' }
            ], {});
          } catch (err) {
            addMessage('bot', `Error creating order: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle ticket actions
      if (context.flow === 'ticket' && context.step === 'select_action') {
        const ticket = context.current_ticket;
        if (text === '1' && context.pending_actions?.includes('upload_reverse_label')) {
          addMessage('bot', `Enter the reverse pickup label URL:`, [], { 
            ...context, step: 'enter_label_url', action: 'upload_reverse_label' 
          });
        } else if (text === '2' && context.pending_actions?.includes('dispatch_spare')) {
          addMessage('bot', `Enter spare part tracking ID:`, [], { 
            ...context, step: 'enter_tracking', action: 'dispatch_spare' 
          });
        } else if (text === '3') {
          addMessage('bot', `Enter new status:`, [], { 
            ...context, step: 'enter_status', action: 'update_status' 
          });
        }
        setLoading(false);
        return;
      }
      if (context.flow === 'ticket' && context.step === 'enter_label_url') {
        try {
          await axios.post(`${API}/api/bot/ticket-action`,
            new URLSearchParams({ ticket_id: context.current_ticket.id, action: 'upload_reverse_label', value: text }),
            { headers });
          addMessage('bot', `**Reverse label uploaded!**`, [{ type: 'button', label: 'Search', command: 'search_prompt' }], {});
        } catch (err) { addMessage('bot', `Error: ${err.message}`); }
        setLoading(false);
        return;
      }
      if (context.flow === 'ticket' && context.step === 'enter_tracking') {
        try {
          await axios.post(`${API}/api/bot/ticket-action`,
            new URLSearchParams({ ticket_id: context.current_ticket.id, action: 'dispatch_spare', value: text }),
            { headers });
          addMessage('bot', `**Spare dispatched!** Tracking: ${text}`, [{ type: 'button', label: 'Search', command: 'search_prompt' }], {});
        } catch (err) { addMessage('bot', `Error: ${err.message}`); }
        setLoading(false);
        return;
      }
      
      // Handle ticket_action flow (new flow for ticket operations)
      if (context.flow === 'ticket_action') {
        if (context.step === 'enter_return_tracking') {
          try {
            await axios.put(`${API}/api/tickets/${context.ticket_id}`,
              { return_tracking: text },
              { headers }
            );
            addMessage('bot', `**Return tracking updated!**\n\nTicket: ${context.ticket_number}\nTracking ID: ${text}`, [
              { type: 'button', label: 'Update Status', command: 'ticket_update_status' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], { ...context, ticket: { ...context.ticket, return_tracking: text } });
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_new_tracking') {
          try {
            // Update both tracking_id and potentially reset status for new label
            await axios.put(`${API}/api/tickets/${context.ticket_id}`,
              { 
                tracking_id: text,
                return_tracking: text,
                status: 'label_uploaded'  // Keep or set to label_uploaded for new label
              },
              { headers }
            );
            addMessage('bot', `**New tracking ID updated!**\n\nTicket: ${context.ticket_number}\nNew Tracking: ${text}\n\n_Label re-uploaded successfully. Courier can now process the pickup._`, [
              { type: 'button', label: 'Update Status', command: 'ticket_update_status' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], { ...context, ticket: { ...context.ticket, tracking_id: text, return_tracking: text } });
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_spare_details') {
          // For now, just update notes with spare details - full spare dispatch would need more
          try {
            const noteText = `Spare part dispatched: ${text}`;
            await axios.post(`${API}/api/tickets/${context.ticket_id}/notes`,
              { note: noteText },
              { headers }
            );
            addMessage('bot', `**Spare dispatch noted!**\n\nDetails: ${text}\n\n_For full spare dispatch with tracking, use the Pending Fulfillment workflow._`, [
              { type: 'button', label: 'Enter Tracking', command: 'ticket_enter_return_tracking' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], context);
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_spare_sku') {
          const num = parseInt(text);
          let selectedSku = null;
          
          if (num >= 1 && num <= context.available_skus?.length) {
            selectedSku = context.available_skus[num - 1];
          } else {
            // Search by name
            const searchResults = await fetchMasterSkus(text);
            if (searchResults.length === 1) {
              selectedSku = searchResults[0];
            } else if (searchResults.length > 1) {
              let msg = `**Found ${searchResults.length} items:**\n`;
              searchResults.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code})\n`; });
              msg += `\nEnter number:`;
              addMessage('bot', msg, [], { ...context, available_skus: searchResults });
              setLoading(false);
              return;
            } else {
              addMessage('bot', 'No items found. Try another search or enter a number.');
              setLoading(false);
              return;
            }
          }
          
          if (selectedSku) {
            addMessage('bot', `**Selected: ${selectedSku.name}**\n\nThis will create a spare dispatch entry for the Dispatcher to process.\n\nConfirm dispatch of **${selectedSku.name}** to:\n${context.ticket.customer_name}\n${context.ticket.customer_phone}\n\nType **yes** to confirm:`, [], {
              ...context,
              step: 'confirm_spare_dispatch',
              selected_spare: selectedSku
            });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'confirm_spare_dispatch') {
          if (text.toLowerCase() === 'yes' || text.toLowerCase() === 'y') {
            try {
              // Create pending_fulfillment entry for spare dispatch
              const res = await axios.post(`${API}/api/bot/create-spare-dispatch`,
                {
                  ticket_id: context.ticket_id,
                  ticket_number: context.ticket_number,
                  master_sku_id: context.selected_spare.id,
                  customer_name: context.ticket.customer_name,
                  customer_phone: context.ticket.customer_phone,
                  address: context.ticket.address || context.ticket.customer_address,
                  city: context.ticket.city,
                  state: context.ticket.state,
                  pincode: context.ticket.pincode
                },
                { headers }
              );
              addMessage('bot', `**Spare Dispatch Created!**\n\nOrder ID: ${res.data.order_id}\nProduct: ${context.selected_spare.name}\n\n**Next steps:**\n• Upload invoice\n• Upload shipping label\n• Dispatcher will complete the dispatch\n\nThe entry is now in **Pending Fulfillment** for processing.`, [
                { type: 'button', label: 'Search Another', command: 'search_prompt' }
              ], {});
            } catch (err) {
              addMessage('bot', `Error creating spare dispatch: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            addMessage('bot', 'Spare dispatch cancelled.', [
              { type: 'button', label: 'Try Again', command: 'ticket_dispatch_spare' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], context);
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_status') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.status_options?.length) {
            const newStatus = context.status_options[num - 1];
            try {
              await axios.put(`${API}/api/tickets/${context.ticket_id}`,
                { status: newStatus },
                { headers }
              );
              addMessage('bot', `**Status updated!**\n\nTicket: ${context.ticket_number}\nNew Status: ${newStatus}`, [
                { type: 'button', label: 'Add Notes', command: 'ticket_add_notes' },
                { type: 'button', label: 'Search Another', command: 'search_prompt' }
              ], { ...context, ticket: { ...context.ticket, status: newStatus } });
            } catch (err) {
              addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_notes') {
          try {
            await axios.post(`${API}/api/tickets/${context.ticket_id}/notes`,
              { note: text },
              { headers }
            );
            addMessage('bot', `**Notes added!**\n\nTicket: ${context.ticket_number}`, [
              { type: 'button', label: 'Update Status', command: 'ticket_update_status' },
              { type: 'button', label: 'Search Another', command: 'search_prompt' }
            ], context);
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle SKU mapping flow
      if (context.flow === 'map_sku') {
        if (context.step === 'search_master_sku') {
          const skus = await fetchMasterSkus(text);
          if (skus.length === 0) {
            addMessage('bot', `No SKUs found for "${text}". Try another search.`);
          } else if (skus.length === 1) {
            // Auto-select if only one match
            addMessage('bot', `**Match found!**\n\nAmazon SKU: ${context.mapping_item.amazon_sku}\nMaster SKU: ${skus[0].name} (${skus[0].sku_code})\n\nConfirm mapping? (yes/no)`, [], {
              ...context,
              step: 'confirm_mapping',
              selected_master_sku: skus[0]
            });
          } else {
            let msg = `**Found ${skus.length} SKUs:**\n`;
            skus.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name} (${s.sku_code})\n`; });
            msg += `\nEnter number to select:`;
            addMessage('bot', msg, [], { ...context, step: 'select_master_sku', sku_results: skus });
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'select_master_sku') {
          const num = parseInt(text);
          if (num >= 1 && num <= context.sku_results?.length) {
            const selected = context.sku_results[num - 1];
            addMessage('bot', `**Confirm mapping:**\n\nAmazon SKU: ${context.mapping_item.amazon_sku}\n→ Master SKU: ${selected.name} (${selected.sku_code})\n\nConfirm? (yes/no)`, [], {
              ...context,
              step: 'confirm_mapping',
              selected_master_sku: selected
            });
          } else {
            addMessage('bot', 'Invalid selection. Enter a number from the list.');
          }
          setLoading(false);
          return;
        }
        
        if (context.step === 'confirm_mapping') {
          if (text.toLowerCase() === 'yes' || text.toLowerCase() === 'y') {
            try {
              await axios.post(`${API}/api/amazon-sku-mapping`,
                {
                  amazon_sku: context.mapping_item.amazon_sku,
                  asin: context.mapping_item.asin,
                  master_sku_id: context.selected_master_sku.id
                },
                { headers }
              );
              
              // Remove mapped item from unmapped list
              const remainingUnmapped = context.unmapped_items.filter(
                i => i.amazon_sku !== context.mapping_item.amazon_sku
              );
              
              if (remainingUnmapped.length > 0) {
                addMessage('bot', `**SKU Mapped!** ✓\n\n${remainingUnmapped.length} more SKU(s) to map.`, [
                  { type: 'button', label: 'Map Next SKU', command: 'map_amazon_sku', icon: 'link' }
                ], { ...context, unmapped_items: remainingUnmapped, flow: null });
              } else {
                addMessage('bot', `**All SKUs Mapped!** ✓\n\nYou can now proceed with dispatch.`, [
                  { type: 'button', label: 'Prepare Dispatch', command: 'prepare_dispatch', icon: 'truck' },
                  { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
                ], { ...context, unmapped_items: [], flow: null });
              }
            } catch (err) {
              addMessage('bot', `Error mapping SKU: ${err.response?.data?.detail || err.message}`);
            }
          } else {
            addMessage('bot', 'Mapping cancelled. Search for a different SKU:', [], {
              ...context, step: 'search_master_sku'
            });
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle collect_address flow (after invoice and label uploaded)
      if (context.flow === 'collect_address') {
        if (context.step === 'enter_customer_name') {
          if (!text.trim()) {
            addMessage('bot', 'Please enter a valid customer name:');
            setLoading(false);
            return;
          }
          addMessage('bot', `✓ Customer: ${text}\n\nEnter **Customer Phone Number** (10 digits):`, [], {
            ...context,
            step: 'enter_phone',
            collected_customer_name: text.trim()
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_phone') {
          // Validate phone number (10 digits)
          const phone = text.replace(/\D/g, '');
          if (phone.length < 10) {
            addMessage('bot', 'Please enter a valid 10-digit phone number:');
            setLoading(false);
            return;
          }
          addMessage('bot', `✓ Phone: ${phone}\n\nEnter **Customer Address** (street/locality):`, [], {
            ...context,
            step: 'enter_address',
            collected_phone: phone
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_address') {
          addMessage('bot', `✓ Address saved\n\nEnter **City**:`, [], {
            ...context,
            step: 'enter_city',
            collected_address: text
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_city') {
          addMessage('bot', `✓ City: ${text}\n\nEnter **State** (e.g., UP, Maharashtra):`, [], {
            ...context,
            step: 'enter_state',
            collected_city: text
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_state') {
          // Normalize state
          let normalizedState = text;
          try {
            const stateRes = await axios.post(`${API}/api/bot/normalize-state`,
              new URLSearchParams({ state: text }), { headers });
            if (stateRes.data.normalized) {
              normalizedState = stateRes.data.normalized;
            }
          } catch (err) { /* use original */ }
          
          addMessage('bot', `✓ State: ${normalizedState}\n\nEnter **Pincode**:`, [], {
            ...context,
            step: 'enter_pincode',
            collected_state: normalizedState
          });
          setLoading(false);
          return;
        }
        
        if (context.step === 'enter_pincode') {
          const pincode = text.replace(/\D/g, '');
          if (pincode.length !== 6) {
            addMessage('bot', 'Please enter a valid 6-digit pincode:');
            setLoading(false);
            return;
          }
          
          // Now move order to pending fulfillment
          try {
            const moveRes = await axios.post(`${API}/api/bot/move-to-pending-fulfillment`,
              {
                amazon_order_id: context.amazon_order_id || context.current_order_id,
                customer_name: context.collected_customer_name,
                customer_phone: context.collected_phone,
                address: context.collected_address,
                city: context.collected_city,
                state: context.collected_state,
                pincode: pincode
              },
              { headers }
            );
            
            const stockInfo = moveRes.data.stock_info;
            const isInStock = stockInfo?.in_stock;
            const isManufactured = stockInfo?.is_manufactured;
            
            let msg = `✓ **Order moved to Pending Fulfillment!**\n\n`;
            msg += `Order: ${moveRes.data.order_id}\n`;
            msg += `Product: ${stockInfo?.product_name || 'N/A'}\n`;
            msg += `Current Stock: ${stockInfo?.current_stock || 0}\n\n`;
            
            if (isInStock) {
              msg += `**✓ Item is IN STOCK!**\n\nShall we proceed with dispatching?`;
              addMessage('bot', msg, [
                { type: 'button', label: 'Yes, Dispatch', command: 'proceed_dispatch', icon: 'truck' },
                { type: 'button', label: 'Later', command: 'search_prompt', icon: 'search' }
              ], {
                ...context,
                flow: 'ready_dispatch',
                pending_fulfillment_id: moveRes.data.pending_fulfillment_id,
                collected_pincode: pincode
              });
            } else if (isManufactured) {
              msg += `**✗ Item NOT in stock** (Manufactured Item)\n\nWould you like to initiate a **Production Order**?`;
              addMessage('bot', msg, [
                { type: 'button', label: 'Initiate Production', command: 'initiate_production', icon: 'factory' },
                { type: 'button', label: 'Wait for Stock', command: 'search_prompt', icon: 'search' }
              ], {
                ...context,
                flow: 'production_order',
                pending_fulfillment_id: moveRes.data.pending_fulfillment_id,
                stock_info: stockInfo
              });
            } else {
              msg += `**✗ Item NOT in stock** (Traded Item)\n\nThis order will wait in queue until stock arrives.`;
              addMessage('bot', msg, [
                { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
              ], {});
            }
          } catch (err) {
            addMessage('bot', `Error moving to pending fulfillment: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Handle ready_dispatch flow
      if (context.flow === 'ready_dispatch' && text === 'proceed_dispatch') {
        try {
          const res = await axios.post(`${API}/api/bot/dispatch`,
            new URLSearchParams({
              order_id: context.pending_fulfillment_id || context.current_order_id,
              confirmed: 'true'
            }),
            { headers }
          );
          
          addMessage('bot', `**ORDER READY FOR DISPATCH!**\n\nDispatch #: ${res.data.dispatch_number}\n\nOrder is now in Dispatcher Queue for final dispatch.`, [
            { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
          ], {});
        } catch (err) {
          const detail = err.response?.data?.detail;
          if (typeof detail === 'object' && detail.errors) {
            addMessage('bot', `**Cannot dispatch:**\n\n${detail.errors.map(e => `• ${e}`).join('\n')}`);
          } else {
            addMessage('bot', `Error: ${detail || err.message}`);
          }
        }
        setLoading(false);
        return;
      }
      
      // Handle production_order flow
      if (context.flow === 'production_order' && text === 'initiate_production') {
        const stockInfo = context.stock_info || {};
        addMessage('bot', `**Initiate Production Order**\n\nProduct: ${stockInfo.product_name}\nSKU: ${stockInfo.sku_code}\n\nEnter **Quantity** to produce:`, [], {
          ...context,
          step: 'enter_production_qty'
        });
        setLoading(false);
        return;
      }
      
      if (context.flow === 'production_order' && context.step === 'enter_production_qty') {
        const qty = parseInt(text);
        if (isNaN(qty) || qty < 1) {
          addMessage('bot', 'Please enter a valid quantity (1 or more):');
          setLoading(false);
          return;
        }
        
        try {
          const res = await axios.post(`${API}/api/production-orders`,
            {
              master_sku_id: context.stock_info?.master_sku_id,
              quantity: qty,
              priority: 'high',
              notes: `Auto-created from pending order ${context.current_order_id}`
            },
            { headers }
          );
          
          addMessage('bot', `**Production Order Created!**\n\nPO #: ${res.data.production_number || res.data.id}\nQuantity: ${qty}\n\nThe pending order will be fulfilled once production is complete.`, [
            { type: 'button', label: 'Search Another', command: 'search_prompt', icon: 'search' }
          ], {});
        } catch (err) {
          addMessage('bot', `Error creating production order: ${err.response?.data?.detail || err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle dispatch update flow
      if (context.flow === 'dispatch_update') {
        if (context.step === 'select_field') {
          const fields = ['tracking_id', 'customer_name', 'phone', 'address', 'city', 'state', 'pincode', 'serial_number', 'invoice_value'];
          const num = parseInt(text);
          if (num >= 1 && num <= fields.length) {
            const field = fields[num - 1];
            addMessage('bot', `Enter new value for **${field}**:`, [], {
              ...context, step: 'enter_value', update_field: field
            });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_value') {
          let finalValue = text;
          // Normalize state if updating state field
          if (context.update_field === 'state') {
            try {
              const stateRes = await axios.post(`${API}/api/bot/normalize-state`,
                new URLSearchParams({ state: text }), { headers });
              if (stateRes.data.normalized) {
                finalValue = stateRes.data.normalized;
              } else if (stateRes.data.suggestions?.length > 0) {
                addMessage('bot', `Did you mean **${stateRes.data.suggestions[0]}**? (yes/no)`, [], {
                  ...context, step: 'confirm_state', suggested_state: stateRes.data.suggestions[0], original_state: text
                });
                setLoading(false);
                return;
              }
            } catch (err) { /* use original */ }
          }
          
          try {
            const res = await axios.post(`${API}/api/bot/update-dispatch`,
              new URLSearchParams({ dispatch_id: context.dispatch.id, field: context.update_field, value: finalValue }),
              { headers });
            addMessage('bot', `**${res.data.message}**\n\nUpdate another field?`, [
              { type: 'button', label: 'Yes', command: 'update_dispatch_fields' },
              { type: 'button', label: 'Done', command: 'search_prompt' }
            ], { ...context, step: null });
          } catch (err) {
            addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
        if (context.step === 'confirm_state') {
          if (text.toLowerCase().startsWith('y')) {
            try {
              await axios.post(`${API}/api/bot/update-dispatch`,
                new URLSearchParams({ dispatch_id: context.dispatch.id, field: 'state', value: context.suggested_state }),
                { headers });
              addMessage('bot', `**State updated to ${context.suggested_state}**`, [
                { type: 'button', label: 'Update More', command: 'update_dispatch_fields' },
                { type: 'button', label: 'Done', command: 'search_prompt' }
              ], { ...context, step: null });
            } catch (err) { addMessage('bot', `Error: ${err.message}`); }
          } else {
            addMessage('bot', `State kept as: ${context.original_state}`);
          }
          setLoading(false);
          return;
        }
      }
      
      // Command to show dispatch update fields
      if (text === 'update_dispatch_fields' && context.dispatch) {
        let msg = `**Update Dispatch ${context.dispatch.dispatch_number}**\n\nSelect field to update:\n`;
        msg += `1. tracking_id\n2. customer_name\n3. phone\n4. address\n5. city\n6. state\n7. pincode\n8. serial_number\n9. invoice_value\n`;
        msg += `\nEnter number:`;
        addMessage('bot', msg, [], { ...context, flow: 'dispatch_update', step: 'select_field' });
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
          msg += `\n_Showing 1-10 of ${skus.length} SKUs_\n`;
        }
        msg += `\n• **Enter number (1-10)** to select\n• **Type SKU code/name** to search\n• **Type "more"** to see next 10`;
        
        addMessage('bot', msg, [], {
          ...context,
          awaiting_sku_for_serial: true,
          available_skus: skus,
          sku_page: 0
        });
        setLoading(false);
        return;
      }
      
      // Handle SKU selection for serial
      if (context.awaiting_sku_for_serial) {
        // Handle "more" command for pagination
        if (text.toLowerCase() === 'more' || text.toLowerCase() === 'next') {
          const currentPage = (context.sku_page || 0) + 1;
          const startIdx = currentPage * 10;
          const skus = context.available_skus || [];
          
          if (startIdx >= skus.length) {
            addMessage('bot', `No more SKUs. Type a SKU code/name to search or enter a number.`);
            setLoading(false);
            return;
          }
          
          let msg = `**SKUs ${startIdx + 1}-${Math.min(startIdx + 10, skus.length)} of ${skus.length}:**\n\n`;
          skus.slice(startIdx, startIdx + 10).forEach((sku, i) => {
            msg += `${startIdx + i + 1}. ${sku.name} (${sku.sku_code})\n`;
          });
          if (startIdx + 10 < skus.length) {
            msg += `\n• **Type "more"** to see next 10`;
          }
          msg += `\n• **Enter number** to select\n• **Type SKU code/name** to search`;
          
          addMessage('bot', msg, [], {
            ...context,
            sku_page: currentPage
          });
          setLoading(false);
          return;
        }
        
        const num = parseInt(text);
        if (num >= 1 && num <= context.available_skus?.length) {
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
            addMessage('bot', `No SKUs found matching "${text}". Try a different search or type "more" to see next 10.`);
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
              available_skus: searchSkus,
              sku_page: 0
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
          
          // Step-by-step document collection
          if (data.missing_fields?.length > 0) {
            const missing = data.missing_fields;
            msg += `\n**Missing:** ${missing.join(', ')}\n\n`;
            
            // Ask for first missing item only
            if (missing.includes('tracking_id')) {
              msg += `Enter **Tracking ID**:`;
              addMessage('bot', msg, [], { 
                ...context, 
                dispatch_data: data, 
                flow: 'dispatch_docs',
                step: 'enter_tracking'
              });
            } else if (missing.includes('invoice')) {
              msg += `Please upload **Invoice**:`;
              addMessage('bot', msg, [
                { type: 'file_upload', field: 'invoice', label: 'Upload Invoice' }
              ], { 
                ...context, 
                dispatch_data: data,
                flow: 'dispatch_docs',
                step: 'upload_invoice'
              });
            } else if (missing.includes('label')) {
              msg += `Please upload **Shipping Label**:`;
              addMessage('bot', msg, [
                { type: 'file_upload', field: 'shipping_label', label: 'Upload Label' }
              ], { 
                ...context, 
                dispatch_data: data,
                flow: 'dispatch_docs',
                step: 'upload_label'
              });
            }
          } else {
            msg += `\n**Ready to dispatch!** Type CONFIRM to proceed.`;
            addMessage('bot', msg, [], { ...context, dispatch_data: data, awaiting_confirm: true });
          }
          
        } catch (err) {
          addMessage('bot', `Error: ${err.response?.data?.detail || err.message}`);
        }
        setLoading(false);
        return;
      }
      
      // Handle dispatch_docs flow (step-by-step document collection)
      if (context.flow === 'dispatch_docs') {
        if (context.step === 'enter_tracking') {
          // Save tracking ID and check next missing field
          try {
            await axios.post(`${API}/api/pending-fulfillment/${context.current_order_id}/update`,
              { tracking_id: text },
              { headers }
            );
            
            // Re-fetch and check what's next
            const res = await axios.get(`${API}/api/bot/prepare-dispatch/${context.current_order_id}`, { headers });
            const data = res.data;
            
            if (data.missing_fields?.length > 0) {
              const missing = data.missing_fields;
              if (missing.includes('invoice')) {
                addMessage('bot', `✓ Tracking ID saved!\n\nNow please upload **Invoice**:`, [
                  { type: 'file_upload', field: 'invoice', label: 'Upload Invoice' }
                ], { ...context, dispatch_data: data, step: 'upload_invoice' });
              } else if (missing.includes('label')) {
                addMessage('bot', `✓ Tracking ID saved!\n\nNow please upload **Shipping Label**:`, [
                  { type: 'file_upload', field: 'shipping_label', label: 'Upload Label' }
                ], { ...context, dispatch_data: data, step: 'upload_label' });
              }
            } else {
              addMessage('bot', `✓ Tracking ID saved!\n\n**All documents ready!** Type CONFIRM to proceed.`, [], {
                ...context, dispatch_data: data, flow: null, awaiting_confirm: true
              });
            }
          } catch (err) {
            addMessage('bot', `Error saving tracking ID: ${err.response?.data?.detail || err.message}`);
          }
          setLoading(false);
          return;
        }
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
      
      const uploadRes = await axios.post(`${API}/api/bot/upload-file`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      
      addMessage('user', `Uploaded: ${file.name}`);
      
      // Check if more documents needed (step-by-step flow)
      const remaining = uploadRes.data.remaining_fields || [];
      
      if (field === 'invoice') {
        // After invoice, ask for shipping label
        addMessage('bot', `✓ **Invoice** uploaded!\n\nNow please upload **Shipping Label**:`, [
          { type: 'file_upload', field: 'shipping_label', label: 'Upload Label' }
        ], { ...context, step: 'upload_label' });
      } else if (field === 'shipping_label') {
        // After shipping label, ask for customer name first
        addMessage('bot', `✓ **Shipping Label** uploaded!\n\nNow let's collect delivery details.\n\nEnter **Customer Name**:`, [], {
          ...context,
          flow: 'collect_address',
          step: 'enter_customer_name'
        });
      } else {
        // Other uploads - show check status
        addMessage('bot', `✓ **${field.replace('_', ' ')}** uploaded!`, [
          { type: 'button', label: 'Check Status', command: 'prepare_dispatch' }
        ]);
      }
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
          className="fixed bottom-20 right-2 sm:right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-105"
          data-testid="orderbot-toggle"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          {briefing && (briefing.urgent?.stuck_ready_to_dispatch > 0 || briefing.urgent?.missing_invoices > 0) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold animate-pulse">!</span>
          )}
        </button>
      )}
      
      {isOpen && !isMinimized && (
        <div className="fixed bottom-20 right-2 sm:right-6 z-50 w-[calc(100vw-16px)] sm:w-[520px] max-w-[520px] h-[70vh] sm:h-[600px] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden" data-testid="orderbot-window">
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
