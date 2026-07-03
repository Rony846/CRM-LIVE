import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { T, Fonts } from '@/components/iron/IronKit';
import { Package, Truck, Clock, ArrowLeft, RefreshCw } from 'lucide-react';

const CANVAS = '#141517';
const PANEL = '#1C1E21';
const PANEL_ALT = '#181A1D';
const HAIRLINE = '#2A2D31';

export default function DispatcherTVMode() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [bigship, setBigship] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const isNotPicked = (s) => (s || '').toUpperCase() === 'NOT PICKED';
  const isPickedUp = (s) => {
    const u = (s || '').toUpperCase();
    if (!u || u === 'NOT PICKED' || u.includes('PICKUP SCHEDULED') || u === 'MANIFESTED' || u.includes('CANCEL') || u.includes('RTO')) return false;
    return u.includes('TRANSIT') || u.includes('OUT FOR DELIVERY') || u.includes('DELIVERED');
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchData();
      setRefreshKey(k => k + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const queueRes = await axios.get(`${API}/dispatcher/queue`, { headers });
      const dispatchData = queueRes.data;
      axios.get(`${API}/courier/shipments?page_size=30`, { headers })
        .then(r => setBigship(r.data?.shipments || [])).catch(() => {});

      // Real product dispatches only — drop walk-in / hardware repair returns (those belong
      // on the dispatcher console, not the shipping TV).
      const isReturn = (d) => d.is_walkin === true
        || d.dispatch_type === 'walkin_return' || d.dispatch_type === 'return_dispatch';
      const realDispatches = dispatchData.filter(d => !isReturn(d));
      setQueue(realDispatches);

      // Compute stats locally (real dispatches only)
      const pendingLabels = realDispatches.filter(d => d.status === 'pending_label').length;
      const dispatchedToday = dispatchData.filter(d => {
        if (d.status !== 'dispatched' || !d.scanned_out_at) return false;
        const today = new Date().toISOString().split('T')[0];
        return d.scanned_out_at.startsWith(today);
      }).length;

      setStats({
        dispatched_today: dispatchedToday,
        pending_labels: pendingLabels
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const pending = queue.filter(d => d.status === 'pending_label');
  const ready = queue.filter(d => d.status === 'ready_for_dispatch' || d.status === 'ready_to_dispatch');

  const monoFont = { fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' };

  const sectionHeader = (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, padding: '14px 20px',
      background: '#0F1113', color: T.iron400, textTransform: 'uppercase',
      fontSize: 14, fontWeight: 700, letterSpacing: '.12em', fontFamily: T.headline,
      borderBottom: `1px solid ${HAIRLINE}`,
    }}>
      <div>Dispatch #</div>
      <div>Customer</div>
      <div>Phone</div>
      <div>SKU / Product</div>
      <div>Courier</div>
      <div>Tracking</div>
    </div>
  );

  const renderRows = (items) => (
    <div>
      {items.map((dispatch, index) => (
        <div
          key={dispatch.id}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, padding: '18px 20px',
            background: index % 2 === 0 ? PANEL : PANEL_ALT,
            borderBottom: `1px solid ${HAIRLINE}`, alignItems: 'center',
          }}
        >
          <div style={{ ...monoFont, fontSize: 22, fontWeight: 800, color: T.blue === '#0B6FB8' ? '#4FA8E0' : T.blue }}>{dispatch.dispatch_number}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.headline }}>{dispatch.customer_name}</div>
          <div style={{ ...monoFont, fontSize: 22, color: T.iron200 }}>{dispatch.phone}</div>
          <div style={{ fontSize: 21, color: T.orange, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.headline, fontWeight: 600 }}>
            {dispatch.sku || dispatch.product_name || dispatch.item_name || '—'}
          </div>
          <div style={{ fontSize: 21, fontWeight: 600, color: T.white, fontFamily: T.headline }}>{dispatch.courier || '—'}</div>
          <div style={{ ...monoFont, fontSize: 18, color: T.iron400 }}>{dispatch.tracking_id || '—'}</div>
        </div>
      ))}
    </div>
  );

  const statTile = (label, value, Icon, accent) => (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 12,
      padding: '26px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 1px 2px rgba(0,0,0,.4)',
    }}>
      <div>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400 }}>{label}</div>
        <div style={{ ...monoFont, fontSize: 64, fontWeight: 800, color: accent, lineHeight: 1.05, marginTop: 6 }}>{value}</div>
      </div>
      <Icon style={{ width: 56, height: 56, color: accent, opacity: 0.85 }} />
    </div>
  );

  const H1 = { fontFamily: T.display, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.02em', color: T.white };

  return (
    <div className="iron" style={{ minHeight: '100vh', background: CANVAS, color: T.white, padding: 32, position: 'relative' }}>
      <Fonts />
      {/* Refresh Progress Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: '#0B0C0D', zIndex: 50 }}>
        <div
          key={refreshKey}
          style={{
            height: '100%',
            background: `linear-gradient(to right, ${T.blue}, ${T.orange})`,
            animation: 'progressFill 10s linear',
            width: '0%',
          }}
        />
      </div>
      <style>{`
        @keyframes progressFill { from { width: 0%; } to { width: 100%; } }
        @keyframes ironPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => navigate('/dispatcher')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'transparent',
              border: `1px solid ${HAIRLINE}`, color: T.iron200, padding: '10px 16px',
              borderRadius: 8, cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 15,
            }}
          >
            <ArrowLeft style={{ width: 20, height: 20 }} />
            Exit TV Mode
          </button>
          <h1 style={{ ...H1, fontSize: 46, margin: 0 }}>
            DISPATCH QUEUE
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron400, fontFamily: T.headline, fontWeight: 600 }}>
          <RefreshCw style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 15 }}>Auto-refresh: 10s</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
        {statTile('READY TO DISPATCH', ready.length, Package, T.green === '#1F8A4C' ? '#3FC776' : T.green)}
        {statTile('DISPATCHED TODAY', stats?.dispatched_today || 0, Truck, '#4FA8E0')}
        {statTile('PENDING LABELS', stats?.pending_labels || 0, Clock, T.orange)}
      </div>

      {/* Queue Sections */}
      {queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '96px 0' }}>
          <Package style={{ width: 96, height: 96, margin: '0 auto 24px', color: '#3FC776', display: 'block' }} />
          <h2 style={{ ...H1, fontSize: 60, color: '#3FC776', margin: 0 }}>
            ALL CLEAR!
          </h2>
          <p style={{ fontSize: 26, color: T.iron400, marginTop: 16, fontFamily: T.headline }}>No product dispatches in queue</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Pending queue — awaiting label — shown at the top */}
          {pending.length > 0 && (
            <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${T.orange}55`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: `${T.orange}18` }}>
                <Clock style={{ width: 26, height: 26, color: T.orange }} />
                <h2 style={{ ...H1, fontSize: 28, color: T.orange, margin: 0, letterSpacing: '.06em' }}>
                  PENDING — AWAITING LABEL
                </h2>
                <span style={{ ...monoFont, color: T.orange, fontSize: 24, marginLeft: 8, fontWeight: 800 }}>{pending.length}</span>
              </div>
              {sectionHeader}
              {renderRows(pending)}
            </div>
          )}

          {/* Ready to dispatch — real product dispatches */}
          <div style={{ background: PANEL, borderRadius: 14, border: `1px solid ${HAIRLINE}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'rgba(63,199,118,.10)' }}>
              <Package style={{ width: 26, height: 26, color: '#3FC776' }} />
              <h2 style={{ ...H1, fontSize: 28, color: '#3FC776', margin: 0, letterSpacing: '.06em' }}>
                READY TO DISPATCH
              </h2>
              <span style={{ ...monoFont, color: '#3FC776', fontSize: 24, marginLeft: 8, fontWeight: 800 }}>{ready.length}</span>
            </div>
            {sectionHeader}
            {ready.length > 0 ? renderRows(ready)
              : <div style={{ padding: 28, textAlign: 'center', color: T.iron500, fontSize: 22, fontFamily: T.headline }}>Nothing ready right now</div>}
          </div>
        </div>
      )}

      {/* Bigship Live Board — latest bookings, green once picked up */}
      {bigship.length > 0 && (
        <div style={{ marginTop: 32, marginBottom: 96, background: PANEL, borderRadius: 14, border: `1px solid ${HAIRLINE}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#0F1113' }}>
            <Truck style={{ width: 26, height: 26, color: '#4FA8E0' }} />
            <h2 style={{ ...H1, fontSize: 28, margin: 0, letterSpacing: '.06em' }}>BIGSHIP — LIVE</h2>
            <span style={{ color: T.iron400, fontSize: 18, marginLeft: 8, fontFamily: T.headline }}>🟢 picked up · 🔴 not picked</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '14px 20px',
            background: '#0F1113', color: T.iron400, textTransform: 'uppercase', fontSize: 14,
            fontWeight: 700, letterSpacing: '.12em', fontFamily: T.headline, borderBottom: `1px solid ${HAIRLINE}`,
          }}>
            <div>Order</div><div>Customer</div><div>AWB</div><div>Courier</div><div>Status</div>
          </div>
          <div>
            {bigship.map((s) => {
              const np = isNotPicked(s.status);
              const picked = isPickedUp(s.status);
              const rowBg = np ? 'rgba(217,90,10,.14)' : picked ? 'rgba(63,199,118,.12)' : PANEL_ALT;
              const rowBorder = np ? '#E0533A' : picked ? '#3FC776' : 'transparent';
              const statusColor = np ? '#FF7A5C' : picked ? '#3FC776' : T.iron400;
              return (
                <div key={s.id}
                  style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '16px 20px',
                    background: rowBg, borderLeft: `4px solid ${rowBorder}`, borderBottom: `1px solid ${HAIRLINE}`,
                    alignItems: 'center',
                  }}>
                  <div style={{ ...monoFont, fontSize: 18, color: T.white }}>{s.bigship_order_id || s.order_id || '-'}</div>
                  <div style={{ fontSize: 18, color: T.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.headline }}>{s.customer_name || '-'}</div>
                  <div style={{ ...monoFont, fontSize: 16, color: T.iron400 }}>{s.awb_number || '-'}</div>
                  <div style={{ fontSize: 16, color: T.iron200, fontFamily: T.headline }}>{s.courier_name || '-'}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: statusColor, fontFamily: T.headline }}>
                    {(s.status || 'UNKNOWN').toUpperCase()}{picked ? ' ✓' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16, background: '#0F1113', borderTop: `1px solid ${HAIRLINE}`, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: '#3FC776', animation: 'ironPulse 1.6s ease-in-out infinite' }} />
            <span style={{ color: T.iron400, fontFamily: T.headline, fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ ...monoFont, color: T.iron500 }}>
            MuscleGrid CRM • Dispatcher View
          </div>
          <div style={{ color: T.iron400, fontFamily: T.headline }}>
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
