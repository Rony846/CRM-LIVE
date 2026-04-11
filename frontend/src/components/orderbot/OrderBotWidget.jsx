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
      welcomeMsg += `• **adjust** - Adjust traded items & raw materials\n`;
      welcomeMsg += `• **transfer** - Transfer stock between firms\n`;
      welcomeMsg += `• **expense** - Record an expense\n`;
      welcomeMsg += `• **Ticket ID/Phone** - Check repair tickets\n`;
      welcomeMsg += `• **Dispatch #** - Update dispatch info\n`;
      
      setMessages([{
        id: Date.now(),
        type: 'bot',
        content: welcomeMsg,
        actions: [
          { type: 'button', label: 'Search', command: 'search_prompt', icon: 'search' },
          { type: 'button', label: 'Adjust', command: 'adjust', icon: 'edit' },
          { type: 'button', label: 'Transfer', command: 'transfer', icon: 'truck' },
          { type: 'button', label: 'Expense', command: 'expense', icon: 'file' }
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
              addMessage('bot', `To: **${toFirm.name}**\n\nItem type?\n1. Master SKU\n2. Raw Material\n\nEnter number:`, [], {
                ...context, step: 'select_type', to_firm: toFirm
              });
            }
          }
          setLoading(false);
          return;
        }
        if (context.step === 'select_type') {
          const types = { '1': 'master_sku', '2': 'raw_material' };
          const itemType = types[text];
          if (itemType) {
            addMessage('bot', `Enter item name or SKU to search:`, [], { ...context, step: 'search_item', item_type: itemType });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'search_item') {
          const skus = await fetchMasterSkus(text);
          if (skus.length === 1) {
            addMessage('bot', `Item: **${skus[0].name}**\n\nEnter quantity to transfer:`, [], {
              ...context, step: 'enter_quantity', selected_item: skus[0]
            });
          } else if (skus.length > 1) {
            let msg = `Found ${skus.length} items:\n`;
            skus.slice(0, 10).forEach((s, i) => { msg += `${i + 1}. ${s.name}\n`; });
            addMessage('bot', msg, [], { ...context, search_results: skus });
          } else {
            addMessage('bot', 'No items found. Try another search.');
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_quantity') {
          const qty = parseInt(text);
          if (qty > 0) {
            addMessage('bot', `Quantity: **${qty}**\n\nEnter invoice number:`, [], {
              ...context, step: 'enter_invoice', quantity: qty
            });
          }
          setLoading(false);
          return;
        }
        if (context.step === 'enter_invoice') {
          try {
            const res = await axios.post(`${API}/api/bot/transfer-stock`,
              new URLSearchParams({
                item_type: context.item_type,
                item_id: context.selected_item.id,
                from_firm_id: context.from_firm.id,
                to_firm_id: context.to_firm.id,
                quantity: context.quantity,
                invoice_number: text
              }), { headers });
            addMessage('bot', `**${res.data.message}**\n\nTransfer #: ${res.data.transfer_number}\n${res.data.from_firm} → ${res.data.to_firm}\nInvoice: ${res.data.invoice_number}`, [
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
            addMessage('bot', `Enter GST amount (₹):`, [], { ...context, step: 'enter_gst', gst_applicable: true });
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
