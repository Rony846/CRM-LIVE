import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import StatCard from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Package, Truck, Clock, ArrowLeft, RefreshCw } from 'lucide-react';

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

  const renderRows = (items) => (
    <div className="divide-y divide-slate-700">
      {items.map((dispatch, index) => (
        <div
          key={dispatch.id}
          className={`grid grid-cols-6 gap-4 p-5 ${
            index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'
          } hover:bg-slate-800 transition-colors`}
        >
          <div className="font-mono text-xl font-bold text-blue-400">{dispatch.dispatch_number}</div>
          <div className="text-xl font-medium truncate">{dispatch.customer_name}</div>
          <div className="font-mono text-xl">{dispatch.phone}</div>
          <div className="text-xl text-orange-400 truncate">
            {dispatch.sku || dispatch.product_name || dispatch.item_name || '—'}
          </div>
          <div className="text-xl font-medium">{dispatch.courier || '—'}</div>
          <div className="font-mono text-lg text-slate-300">{dispatch.tracking_id || '—'}</div>
        </div>
      ))}
    </div>
  );

  const sectionHeader = (
    <div className="grid grid-cols-6 gap-4 p-4 bg-slate-800 text-slate-400 uppercase text-sm font-medium tracking-wider">
      <div>Dispatch #</div>
      <div>Customer</div>
      <div>Phone</div>
      <div>SKU / Product</div>
      <div>Courier</div>
      <div>Tracking</div>
    </div>
  );

  return (
    <div className="tv-mode min-h-screen bg-black text-white p-8">
      {/* Refresh Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-800">
        <div 
          key={refreshKey}
          className="h-full bg-gradient-to-r from-blue-500 to-orange-500"
          style={{
            animation: 'progressFill 10s linear',
            width: '0%'
          }}
        />
      </div>
      <style>{`
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-slate-800"
            onClick={() => navigate('/dispatcher')}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Exit TV Mode
          </Button>
          <h1 className="text-4xl font-bold font-['Barlow_Condensed']">
            DISPATCH QUEUE
          </h1>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm">Auto-refresh: 10s</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard
          title="READY TO DISPATCH"
          value={ready.length}
          icon={Package}
          tvMode
        />
        <StatCard 
          title="DISPATCHED TODAY" 
          value={stats?.dispatched_today || 0} 
          icon={Truck} 
          tvMode 
        />
        <StatCard 
          title="PENDING LABELS" 
          value={stats?.pending_labels || 0} 
          icon={Clock} 
          tvMode 
        />
      </div>

      {/* Queue Sections */}
      {queue.length === 0 ? (
        <div className="text-center py-24">
          <Package className="w-24 h-24 mx-auto mb-6 text-green-500" />
          <h2 className="text-5xl font-bold font-['Barlow_Condensed'] text-green-400">
            ALL CLEAR!
          </h2>
          <p className="text-2xl text-slate-400 mt-4">No product dispatches in queue</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending queue — awaiting label — shown at the top */}
          {pending.length > 0 && (
            <div className="bg-slate-900 rounded-xl border border-amber-500/40 overflow-hidden">
              <div className="flex items-center gap-3 p-3 bg-amber-500/10">
                <Clock className="w-6 h-6 text-amber-400" />
                <h2 className="text-2xl font-bold font-['Barlow_Condensed'] tracking-wider text-amber-300">
                  PENDING — AWAITING LABEL
                </h2>
                <span className="text-amber-400/80 text-xl ml-2">{pending.length}</span>
              </div>
              {sectionHeader}
              {renderRows(pending)}
            </div>
          )}

          {/* Ready to dispatch — real product dispatches */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-3 p-3 bg-emerald-500/10">
              <Package className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold font-['Barlow_Condensed'] tracking-wider text-emerald-300">
                READY TO DISPATCH
              </h2>
              <span className="text-emerald-400/80 text-xl ml-2">{ready.length}</span>
            </div>
            {sectionHeader}
            {ready.length > 0 ? renderRows(ready)
              : <div className="p-6 text-center text-slate-500 text-xl">Nothing ready right now</div>}
          </div>
        </div>
      )}

      {/* Bigship Live Board — latest bookings, green once picked up */}
      {bigship.length > 0 && (
        <div className="mt-8 mb-24 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-3 p-4 bg-slate-800">
            <Truck className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold font-['Barlow_Condensed'] tracking-wider">BIGSHIP — LIVE</h2>
            <span className="text-slate-400 text-lg ml-2">🟢 picked up · 🔴 not picked</span>
          </div>
          <div className="grid grid-cols-5 gap-4 p-3 bg-slate-800/60 text-slate-400 uppercase text-sm font-medium tracking-wider">
            <div>Order</div><div>Customer</div><div>AWB</div><div>Courier</div><div>Status</div>
          </div>
          <div className="divide-y divide-slate-700/60">
            {bigship.map((s) => {
              const np = isNotPicked(s.status);
              const picked = isPickedUp(s.status);
              return (
                <div key={s.id}
                  className={`grid grid-cols-5 gap-4 p-4 ${np ? 'bg-red-950/40 border-l-4 border-l-red-500'
                    : picked ? 'bg-green-950/40 border-l-4 border-l-green-500' : 'bg-slate-900/50'}`}>
                  <div className="font-mono text-lg">{s.bigship_order_id || s.order_id || '-'}</div>
                  <div className="text-lg truncate">{s.customer_name || '-'}</div>
                  <div className="font-mono text-base text-slate-300">{s.awb_number || '-'}</div>
                  <div className="text-base">{s.courier_name || '-'}</div>
                  <div className={`text-lg font-bold ${np ? 'text-red-400' : picked ? 'text-green-400' : 'text-slate-400'}`}>
                    {(s.status || 'UNKNOWN').toUpperCase()}{picked ? ' ✓' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-700">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-400">Live</span>
          </div>
          <div className="text-slate-500 font-mono">
            MuscleGrid CRM • Dispatcher View
          </div>
          <div className="text-slate-400">
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
