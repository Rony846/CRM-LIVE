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
  const [refreshKey, setRefreshKey] = useState(0);

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
      const [statsRes, queueRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers }),
        axios.get(`${API}/dispatcher/queue`, { headers })
      ]);
      setStats(statsRes.data);
      setQueue(queueRes.data.filter(d => d.status === 'ready_to_dispatch'));
    } catch (error) {
      console.error('Failed to fetch data');
    }
  };

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
          value={queue.length} 
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

      {/* Queue Table */}
      {queue.length === 0 ? (
        <div className="text-center py-24">
          <Package className="w-24 h-24 mx-auto mb-6 text-green-500" />
          <h2 className="text-5xl font-bold font-['Barlow_Condensed'] text-green-400">
            ALL CLEAR!
          </h2>
          <p className="text-2xl text-slate-400 mt-4">No pending dispatches</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-6 gap-4 p-4 bg-slate-800 text-slate-400 uppercase text-sm font-medium tracking-wider">
            <div>Dispatch #</div>
            <div>Customer</div>
            <div>Phone</div>
            <div>SKU / Product</div>
            <div>Courier</div>
            <div>Tracking</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-700">
            {queue.map((dispatch, index) => (
              <div 
                key={dispatch.id}
                className={`grid grid-cols-6 gap-4 p-5 ${
                  index % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'
                } hover:bg-slate-800 transition-colors`}
              >
                <div className="font-mono text-xl font-bold text-blue-400">
                  {dispatch.dispatch_number}
                </div>
                <div className="text-xl font-medium truncate">
                  {dispatch.customer_name}
                </div>
                <div className="font-mono text-xl">
                  {dispatch.phone}
                </div>
                <div className="text-xl text-orange-400">
                  {dispatch.sku || dispatch.dispatch_type?.replace('_', ' ')}
                </div>
                <div className="text-xl font-medium">
                  {dispatch.courier}
                </div>
                <div className="font-mono text-lg text-slate-300">
                  {dispatch.tracking_id}
                </div>
              </div>
            ))}
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
