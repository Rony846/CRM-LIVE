import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Inline warning banner that lights up when the customer identified by
 * (phone | amazonOrderId | name+pincode) has had a previous Amazon order
 * refunded (>50% of grand_total) or cancelled. The match logic lives in
 * the /customer/refund-history endpoint.
 *
 * Renders nothing while loading and nothing when there's no history —
 * safe to drop into any form without layout disruption.
 *
 * Props:
 *   phone           string  (any format — endpoint normalises to last 10 digits)
 *   amazonOrderId   string  (optional — direct order match)
 *   customerName    string  (optional — used with pincode for fuzzy match)
 *   pincode         string  (optional — used with customerName)
 *   className       string  (optional wrapper class)
 *   variant         'banner' | 'badge'  default 'banner'
 */
export default function CustomerHistoryBadge({
  phone,
  amazonOrderId,
  customerName,
  pincode,
  className = '',
  variant = 'banner',
}) {
  const { token } = useAuth() || {};
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const phoneOk = phone && String(phone).replace(/\D/g, '').length >= 10;
    const orderOk = amazonOrderId && amazonOrderId.trim().length > 5;
    const nameOk = customerName && pincode && pincode.trim().length === 6;
    if (!phoneOk && !orderOk && !nameOk) {
      setData(null);
      return;
    }
    let cancelled = false;
    const fetch = async () => {
      try {
        const params = new URLSearchParams();
        if (phoneOk) params.set('phone', phone);
        if (orderOk) params.set('amazon_order_id', amazonOrderId);
        if (nameOk) {
          params.set('customer_name', customerName);
          params.set('pincode', pincode);
        }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const r = await axios.get(`${API}/customer/refund-history?${params.toString()}`, { headers });
        if (!cancelled) setData(r.data);
      } catch (e) {
        // Silent on failure — never break the host form because of this check
        if (!cancelled) setData(null);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [phone, amazonOrderId, customerName, pincode, token]);

  if (!data || !data.has_history || dismissed) return null;

  const r = data.refunded_count;
  const c = data.cancelled_count;
  const summary = [
    r > 0 ? `${r} refunded` : null,
    c > 0 ? `${c} cancelled` : null,
  ].filter(Boolean).join(' • ');

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 ${className}`}
        title={`Past Amazon order history: ${summary}. Latest: ${data.matched_orders?.[0]?.amazon_order_id} (${data.matched_orders?.[0]?.crm_status}).`}
      >
        <AlertTriangle className="w-3 h-3" /> {summary}
      </span>
    );
  }

  // banner variant
  const recent = (data.matched_orders || []).slice(0, 3);
  return (
    <div className={`rounded-md border border-red-500/40 bg-red-500/10 text-red-400 px-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">
            Customer has past refund / cancellation history — {summary}
          </div>
          <div className="text-[12px] text-red-300/90 mt-1.5 space-y-0.5 font-mono">
            {recent.map(o => (
              <div key={o.amazon_order_id} className="truncate">
                <span className="text-red-200">{o.amazon_order_id}</span>
                <span className="text-red-400/70"> · {o.firm_name} · {o.purchase_date}</span>
                <span className="text-red-300"> · {o.is_refunded ? `refund ₹${Math.round(o.refund_amount).toLocaleString('en-IN')} (${Math.round(o.refund_ratio*100)}% of order)` : o.crm_status}</span>
              </div>
            ))}
            {data.matched_orders.length > recent.length && (
              <div className="text-red-400/60">+ {data.matched_orders.length - recent.length} more</div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-red-400/60 hover:text-red-300"
          title="Dismiss (will reappear on reload)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
