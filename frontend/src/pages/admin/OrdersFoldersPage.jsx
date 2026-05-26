import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import axios from 'axios';
import { Folder, FileText, ArrowLeft, Home, ChevronRight, Download, ExternalLink, Package, Receipt, Loader2, CheckCircle2, Printer } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// One folder tile in the explorer grid.
function FolderTile({ icon: Icon, name, subtitle, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-start text-center w-32 p-3 rounded-lg hover:bg-secondary/60 transition-colors"
    >
      <Icon className="w-14 h-14 text-amber-500 group-hover:text-amber-400 transition-colors" strokeWidth={1.2} fill="currentColor" fillOpacity={0.18} />
      <div className="mt-2 text-[13px] font-medium text-foreground truncate w-full" title={name}>{name}</div>
      {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      {badge !== undefined && <div className="text-[11px] text-muted-foreground mt-0.5">{badge} orders</div>}
    </button>
  );
}

// One order-leaf tile. Printed orders render in green with a checkmark
// badge — accountants scan the day folder and immediately see what's done.
function OrderTile({ order, onClick }) {
  const printed = !!order.printed_at;
  return (
    <button
      onClick={onClick}
      className={`relative group flex flex-col items-start text-left w-44 p-3 rounded-lg transition-colors ${
        printed ? 'bg-emerald-900/20 hover:bg-emerald-900/30 ring-1 ring-emerald-600/30' : 'hover:bg-secondary/60'
      }`}
      title={printed ? `Printed${order.printed_by_name ? ' by ' + order.printed_by_name : ''}` : order.name}
    >
      <Folder
        className={`w-14 h-14 ${printed ? 'text-emerald-500 group-hover:text-emerald-400' : 'text-blue-500 group-hover:text-blue-400'}`}
        strokeWidth={1.2}
        fill="currentColor"
        fillOpacity={0.18}
      />
      {printed && (
        <CheckCircle2 className="absolute top-1.5 right-1.5 w-5 h-5 text-emerald-400 bg-background rounded-full" />
      )}
      <div className={`mt-2 text-[12px] font-mono truncate w-full ${printed ? 'text-emerald-100' : 'text-foreground'}`}>{order.name}</div>
      {order.customer_name && <div className="text-[11px] text-muted-foreground truncate w-full">{order.customer_name}</div>}
      {order.tracking_id && <div className="text-[10px] font-mono text-muted-foreground/80 truncate w-full">AWB {order.tracking_id}</div>}
      {printed && order.printed_by_name && (
        <div className="text-[10px] text-emerald-400/80 mt-0.5 truncate w-full">✓ {order.printed_by_name}</div>
      )}
    </button>
  );
}

// File row inside an order folder.
function FileRow({ file, token }) {
  const isExternal = !file.url.startsWith('/api/');
  const iconMap = { label: Package, invoice: Receipt, packing_slip: FileText };
  const Icon = iconMap[file.kind] || FileText;
  const colorMap = { label: 'text-purple-500', invoice: 'text-emerald-500', packing_slip: 'text-sky-500' };

  const openFile = () => {
    // For backend-served PDFs we need to include the auth token. Easiest:
    // fetch and blob-open. For external URLs (label hosted on a CDN, etc.)
    // just open directly.
    if (isExternal) {
      window.open(file.url, '_blank');
      return;
    }
    const url = file.url.startsWith('http') ? file.url : `${API}${file.url}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : Promise.reject(r))
      .then(b => window.open(URL.createObjectURL(b), '_blank'))
      .catch(() => toast.error(`Could not open ${file.name}`));
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded hover:bg-secondary/40">
      <Icon className={`w-5 h-5 ${colorMap[file.kind] || 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{file.name}</div>
        {file.generated && <div className="text-[10px] text-muted-foreground">auto-generated</div>}
      </div>
      <button
        onClick={openFile}
        className="flex items-center gap-1 px-2 py-1 text-[12px] rounded bg-secondary hover:bg-secondary/70 text-foreground"
        title="Open"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Open
      </button>
    </div>
  );
}

export default function OrdersFoldersPage() {
  const { token } = useAuth();
  const [crumbs, setCrumbs] = useState([{ level: 'root', label: 'Order Folders' }]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderFiles, setOrderFiles] = useState(null);
  const [togglingPrinted, setTogglingPrinted] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // Resolve the current crumb stack to query params for /tree.
  const buildTreeQuery = useCallback((stack) => {
    const top = stack[stack.length - 1];
    const params = new URLSearchParams({ level: top.level });
    const findCrumb = (lvl) => stack.find(c => c.level === lvl);
    const y = findCrumb('year-selected') || findCrumb('root');
    if (top.level !== 'root' && top.year) params.set('year', top.year);
    if (['firm', 'month', 'day'].includes(top.level)) {
      params.set('firm_id', top.firm_id);
    }
    if (['month', 'day'].includes(top.level)) {
      params.set('month', top.month);
    }
    if (top.level === 'day') {
      params.set('day', top.day);
    }
    return params.toString();
  }, []);

  const fetchLevel = useCallback(async (stack) => {
    setLoading(true);
    setSelectedOrder(null);
    setOrderFiles(null);
    try {
      const qs = buildTreeQuery(stack);
      const res = await axios.get(`${API}/api/order-folders/tree?${qs}`, { headers });
      setItems(res.data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, [token, buildTreeQuery]);

  useEffect(() => { fetchLevel(crumbs); }, [fetchLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a tile is clicked, descend into the next level (or open order).
  const handleClick = (it) => {
    const top = crumbs[crumbs.length - 1];
    if (top.level === 'root') {
      setCrumbs(c => [...c, { level: 'year', label: it.name, year: it.year }]);
    } else if (top.level === 'year') {
      setCrumbs(c => [...c, { level: 'firm', label: it.name, year: top.year, firm_id: it.firm_id }]);
    } else if (top.level === 'firm') {
      setCrumbs(c => [...c, { level: 'month', label: it.name, year: top.year, firm_id: top.firm_id, month: it.month }]);
    } else if (top.level === 'month') {
      setCrumbs(c => [...c, { level: 'day', label: it.name, year: top.year, firm_id: top.firm_id, month: top.month, day: it.day }]);
    } else if (top.level === 'day') {
      // Open the order's file list inline (don't push crumb — order isn't a tree level).
      openOrder(it);
    }
  };

  const openOrder = async (orderItem) => {
    setSelectedOrder(orderItem);
    setOrderFiles(null);
    try {
      const res = await axios.get(`${API}/api/order-folders/order/${orderItem.order_id}/files`, { headers });
      setOrderFiles(res.data);
    } catch (err) {
      toast.error('Could not load files for order');
    }
  };

  // Toggle the order's "printed" flag (server-side). Optimistically updates
  // the open panel + the day-level tile so the green tint flips immediately,
  // then refetches the day listing to stay consistent.
  const toggleOrderPrinted = async (orderItem, makePrinted) => {
    setTogglingPrinted(true);
    try {
      const res = await axios.post(
        `${API}/api/order-folders/order/${orderItem.order_id}/mark-printed`,
        { printed: !!makePrinted },
        { headers }
      );
      setOrderFiles(prev => prev && ({
        ...prev,
        printed_at: res.data.printed_at || null,
        printed_by_name: res.data.printed_by_name || null,
      }));
      // Update the tile in the day grid without a full refetch
      setItems(prev => prev.map(it =>
        it.type === 'order' && it.order_id === orderItem.order_id
          ? { ...it, printed_at: res.data.printed_at || null, printed_by_name: res.data.printed_by_name || null }
          : it
      ));
      toast.success(makePrinted ? 'Marked as printed' : 'Cleared printed flag');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update printed status');
    } finally {
      setTogglingPrinted(false);
    }
  };

  const handleCrumbClick = (idx) => {
    const stack = crumbs.slice(0, idx + 1);
    setCrumbs(stack);
    fetchLevel(stack);
  };

  useEffect(() => { fetchLevel(crumbs); }, [crumbs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = crumbs[crumbs.length - 1];

  return (
    <div className="min-h-screen p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-4 text-[13px]">
        <Home className="w-4 h-4 text-muted-foreground" />
        {crumbs.map((c, idx) => (
          <React.Fragment key={idx}>
            <button
              onClick={() => handleCrumbClick(idx)}
              className={`px-2 py-0.5 rounded hover:bg-secondary/60 ${idx === crumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
            >
              {c.label}
            </button>
            {idx < crumbs.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
          </React.Fragment>
        ))}
        {crumbs.length > 1 && (
          <button
            onClick={() => handleCrumbClick(crumbs.length - 2)}
            className="ml-3 flex items-center gap-1 px-2 py-1 text-[12px] rounded bg-secondary hover:bg-secondary/70"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          No folders here yet. Once orders are processed they'll show up under <code>Year → Firm → Month → Date → Order</code>.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it, idx) => (
            it.type === 'order'
              ? <OrderTile key={idx} order={it} onClick={() => handleClick(it)} />
              : <FolderTile
                  key={idx}
                  icon={Folder}
                  name={it.name}
                  badge={it.count}
                  onClick={() => handleClick(it)}
                />
          ))}
        </div>
      )}

      {/* Order details panel (shown when an order tile is clicked) */}
      {selectedOrder && (
        <div className={`mt-6 p-4 rounded-lg border bg-card transition-colors ${
          orderFiles?.printed_at ? 'border-emerald-600/40 bg-emerald-900/10' : 'border-border'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-sm font-semibold">{selectedOrder.name}</div>
              {orderFiles && (
                <div className="text-[12px] text-muted-foreground">
                  {orderFiles.customer_name} · AWB {orderFiles.tracking_id} · ₹{orderFiles.order_value}
                </div>
              )}
              {orderFiles?.printed_at && (
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Printed {new Date(orderFiles.printed_at).toLocaleString()}
                  {orderFiles.printed_by_name ? ` by ${orderFiles.printed_by_name}` : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleOrderPrinted(selectedOrder, !orderFiles?.printed_at)}
                disabled={!orderFiles || togglingPrinted}
                className={`px-2.5 py-1 text-[12px] rounded flex items-center gap-1 ${
                  orderFiles?.printed_at
                    ? 'bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-200'
                    : 'bg-sky-600 hover:bg-sky-700 text-white'
                } disabled:opacity-50`}
                data-testid="toggle-printed-btn"
              >
                {togglingPrinted
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : (orderFiles?.printed_at ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />)}
                {orderFiles?.printed_at ? 'Mark as Not Printed' : 'Mark as Printed'}
              </button>
              <button
                onClick={() => { setSelectedOrder(null); setOrderFiles(null); }}
                className="px-2 py-1 text-[12px] rounded bg-secondary hover:bg-secondary/70"
              >
                Close
              </button>
            </div>
          </div>
          {!orderFiles ? (
            <div className="text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading files…</div>
          ) : (
            <div className="space-y-1">
              {orderFiles.files.map((f, idx) => (
                <FileRow key={idx} file={f} token={token} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
