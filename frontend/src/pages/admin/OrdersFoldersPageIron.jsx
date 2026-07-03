import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import axios from 'axios';
import { Folder, FileText, ArrowLeft, Home, ChevronRight, ExternalLink, Package, Receipt, Loader2, CheckCircle2, Printer } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const API = process.env.REACT_APP_BACKEND_URL;

// One folder tile in the explorer grid (Iron restyle).
function FolderTile({ name, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="iron-row"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        textAlign: 'center', width: 128, padding: 12, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${T.iron200}`, background: T.white,
      }}
    >
      <Folder size={44} strokeWidth={1.2} color={T.orange} fill={T.orange} fillOpacity={0.16} />
      <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, fontFamily: T.headline, color: T.iron900, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</div>
      {badge !== undefined && (
        <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{badge} orders</div>
      )}
    </button>
  );
}

// One order-leaf tile. Printed orders render green with a checkmark badge —
// accountants scan the day folder and immediately see what's done.
function OrderTile({ order, onClick }) {
  const printed = !!order.printed_at;
  return (
    <button
      onClick={onClick}
      className="iron-row"
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        textAlign: 'left', width: 176, padding: 12, borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${printed ? '#CBE5D6' : T.iron200}`,
        background: printed ? T.greenTint : T.white,
      }}
      title={printed ? `Printed${order.printed_by_name ? ' by ' + order.printed_by_name : ''}` : order.name}
    >
      <Folder size={44} strokeWidth={1.2} color={printed ? T.green : T.blue} fill={printed ? T.green : T.blue} fillOpacity={0.16} />
      {printed && (
        <CheckCircle2 size={18} style={{ position: 'absolute', top: 6, right: 6, color: T.green, background: T.white, borderRadius: 999 }} />
      )}
      <div style={{ ...mono, marginTop: 8, fontSize: 11.5, color: printed ? T.green : T.iron900, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.name}</div>
      {order.customer_name && (
        <div style={{ fontSize: 10.5, color: T.iron500, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer_name}</div>
      )}
      {order.tracking_id && (
        <div style={{ ...mono, fontSize: 10, color: T.iron400, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>AWB {order.tracking_id}</div>
      )}
      {printed && order.printed_by_name && (
        <div style={{ fontSize: 10, color: T.green, marginTop: 2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✓ {order.printed_by_name}</div>
      )}
    </button>
  );
}

// File row inside an order folder.
function FileRow({ file, token }) {
  const isExternal = !file.url.startsWith('/api/');
  const iconMap = { label: Package, invoice: Receipt, packing_slip: FileText };
  const Icon = iconMap[file.kind] || FileText;
  const colorMap = { label: '#6D4AB0', invoice: T.green, packing_slip: T.blue };

  const openFile = () => {
    // Backend-served PDFs need the auth token — fetch + blob-open. External
    // URLs (label hosted on a CDN, etc.) open directly.
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
    <div className="iron-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 6, borderBottom: `1px solid ${T.iron200}` }}>
      <Icon size={18} color={colorMap[file.kind] || T.iron400} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
        {file.generated && <div style={{ fontSize: 10, color: T.iron400 }}>auto-generated</div>}
      </div>
      <button
        onClick={openFile}
        title="Open"
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: 'pointer', fontFamily: T.headline, fontWeight: 600 }}
      >
        <ExternalLink size={14} /> Open
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
  }, [token, buildTreeQuery]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Toggle the order's "printed" flag (server-side). Optimistically updates the
  // open panel + the day-level tile so the green tint flips immediately, then
  // refetches the day listing to stay consistent.
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

  const printed = !!orderFiles?.printed_at;

  return (
    <IronShell
      title="Order Folders"
      subtitle="YEAR / FIRM / MONTH / DATE / ORDER"
      onRefresh={() => fetchLevel(crumbs)}
    >
      {/* Breadcrumb */}
      <IronCard pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Home size={15} color={T.iron400} />
          {crumbs.map((c, idx) => (
            <React.Fragment key={idx}>
              <button
                onClick={() => handleCrumbClick(idx)}
                style={{
                  padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent',
                  fontFamily: T.headline, fontSize: 12.5,
                  fontWeight: idx === crumbs.length - 1 ? 700 : 500,
                  color: idx === crumbs.length - 1 ? T.iron900 : T.iron500,
                }}
              >
                {c.label}
              </button>
              {idx < crumbs.length - 1 && <ChevronRight size={13} color={T.iron400} />}
            </React.Fragment>
          ))}
          {crumbs.length > 1 && (
            <button
              onClick={() => handleCrumbClick(crumbs.length - 2)}
              data-testid="back-btn"
              style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: 'pointer', fontFamily: T.headline, fontWeight: 600 }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>
      </IronCard>

      {/* Body */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: T.iron400 }}>
          <Loader2 size={18} className="animate-spin" style={{ marginRight: 8 }} /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', color: T.iron400, padding: '80px 0', fontSize: 13 }}>
          No folders here yet. Once orders are processed they'll show up under{' '}
          <code style={{ ...mono, color: T.iron700 }}>Year → Firm → Month → Date → Order</code>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((it, idx) => (
            it.type === 'order'
              ? <OrderTile key={idx} order={it} onClick={() => handleClick(it)} />
              : <FolderTile
                  key={idx}
                  name={it.name}
                  badge={it.count}
                  onClick={() => handleClick(it)}
                />
          ))}
        </div>
      )}

      {/* Order details panel (shown when an order tile is clicked) */}
      {selectedOrder && (
        <IronCard
          pad={16}
          style={{ marginTop: 24, border: `1px solid ${printed ? '#CBE5D6' : T.iron200}`, background: printed ? T.greenTint : T.white }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
            <div>
              <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900 }}>{selectedOrder.name}</div>
              {orderFiles && (
                <div style={{ ...mono, fontSize: 11.5, color: T.iron500, marginTop: 2 }}>
                  {orderFiles.customer_name} · AWB {orderFiles.tracking_id} · ₹{orderFiles.order_value}
                </div>
              )}
              {printed && (
                <div style={{ fontSize: 11, color: T.green, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} />
                  Printed {new Date(orderFiles.printed_at).toLocaleString()}
                  {orderFiles.printed_by_name ? ` by ${orderFiles.printed_by_name}` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => toggleOrderPrinted(selectedOrder, !orderFiles?.printed_at)}
                disabled={!orderFiles || togglingPrinted}
                data-testid="toggle-printed-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', fontSize: 12, borderRadius: 6,
                  border: printed ? `1px solid #CBE5D6` : 'none',
                  background: printed ? T.greenTint : T.blue,
                  color: printed ? T.green : '#fff',
                  cursor: (!orderFiles || togglingPrinted) ? 'not-allowed' : 'pointer',
                  opacity: (!orderFiles || togglingPrinted) ? 0.5 : 1,
                  fontFamily: T.headline, fontWeight: 700,
                }}
              >
                {togglingPrinted
                  ? <Loader2 size={14} className="animate-spin" />
                  : (printed ? <CheckCircle2 size={14} /> : <Printer size={14} />)}
                {printed ? 'Mark as Not Printed' : 'Mark as Printed'}
              </button>
              <button
                onClick={() => { setSelectedOrder(null); setOrderFiles(null); }}
                style={{ padding: '7px 12px', fontSize: 12, borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, cursor: 'pointer', fontFamily: T.headline, fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
          {!orderFiles ? (
            <div style={{ color: T.iron400, fontSize: 12.5 }}>
              <Loader2 size={15} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle' }} /> Loading files…
            </div>
          ) : (
            <div>
              {orderFiles.files.map((f, idx) => (
                <FileRow key={idx} file={f} token={token} />
              ))}
            </div>
          )}
        </IronCard>
      )}
    </IronShell>
  );
}
