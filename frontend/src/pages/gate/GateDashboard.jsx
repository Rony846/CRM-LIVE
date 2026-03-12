import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Scan, ArrowDownLeft, ArrowUpRight, Package, 
  Loader2, CheckCircle, Clock, Truck
} from 'lucide-react';

export default function GateDashboard() {
  const { token, user } = useAuth();
  const [scanData, setScanData] = useState({
    scan_type: 'inward',
    tracking_id: '',
    courier: '',
    notes: ''
  });
  const [scheduled, setScheduled] = useState({ incoming: [], outgoing: [] });
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [scheduledRes, logsRes] = await Promise.all([
        axios.get(`${API}/gate/scheduled`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/gate/logs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setScheduled({
        incoming: scheduledRes.data.scheduled_incoming || [],
        outgoing: scheduledRes.data.scheduled_outgoing || []
      });
      setRecentScans(logsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleScan = async () => {
    if (!scanData.tracking_id) {
      toast.error('Please enter tracking ID');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/gate/scan`, scanData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${scanData.scan_type.toUpperCase()} scan recorded!`);
      setScanData({ ...scanData, tracking_id: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error('Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const quickScan = (trackingId, type) => {
    setScanData({ ...scanData, scan_type: type, tracking_id: trackingId });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN');
  };

  if (initialLoading) {
    return (
      <DashboardLayout title="Gate Control">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gate Control">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Gate Scanning Dashboard</h2>
        <p className="text-slate-400">
          Scan parcels entering and leaving the factory. Inward scans update ticket status to "Received at Factory".
        </p>
      </div>

      {/* Scan Form */}
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Scan className="w-5 h-5 text-cyan-400" />
            Scan Parcel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Scan Type</label>
              <Select 
                value={scanData.scan_type} 
                onValueChange={(v) => setScanData({ ...scanData, scan_type: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="inward">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-green-400" />
                      Inward
                    </span>
                  </SelectItem>
                  <SelectItem value="outward">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-blue-400" />
                      Outward
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Tracking ID *</label>
              <Input
                placeholder="Enter or scan tracking ID"
                value={scanData.tracking_id}
                onChange={(e) => setScanData({ ...scanData, tracking_id: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white"
                data-testid="tracking-input"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Courier</label>
              <Select 
                value={scanData.courier} 
                onValueChange={(v) => setScanData({ ...scanData, courier: v })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="Delhivery">Delhivery</SelectItem>
                  <SelectItem value="BlueDart">BlueDart</SelectItem>
                  <SelectItem value="DTDC">DTDC</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="Ecom Express">Ecom Express</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                onClick={handleScan} 
                disabled={loading}
                className={`w-full ${scanData.scan_type === 'inward' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : scanData.scan_type === 'inward' ? (
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                )}
                {scanData.scan_type === 'inward' ? 'Scan Inward' : 'Scan Outward'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Parcels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expected Incoming */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-green-400" />
              Expected Incoming ({scheduled.incoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.incoming.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No expected incoming</p>
            ) : (
              <div className="space-y-2">
                {scheduled.incoming.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700"
                    onClick={() => quickScan(item.pickup_tracking, 'inward')}
                  >
                    <div>
                      <p className="text-white font-medium">{item.ticket_number}</p>
                      <p className="text-slate-400 text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-sm">{item.pickup_courier}</p>
                      <p className="text-slate-500 text-xs font-mono">{item.pickup_tracking}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready to Ship */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
              Ready to Ship ({scheduled.outgoing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.outgoing.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No items ready to ship</p>
            ) : (
              <div className="space-y-2">
                {scheduled.outgoing.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700"
                    onClick={() => quickScan(item.return_tracking || item.tracking_id, 'outward')}
                  >
                    <div>
                      <p className="text-white font-medium">{item.ticket_number || item.dispatch_number}</p>
                      <p className="text-slate-400 text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-sm">{item.return_courier || item.courier}</p>
                      <p className="text-slate-500 text-xs font-mono">{item.return_tracking || item.tracking_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Recent Scans
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentScans.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Scan className="w-12 h-12 mx-auto mb-4 text-slate-600" />
              <p>No recent scans</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {recentScans.map((scan) => (
                <div key={scan.id} className="p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      scan.scan_type === 'inward' ? 'bg-green-600/20' : 'bg-blue-600/20'
                    }`}>
                      {scan.scan_type === 'inward' 
                        ? <ArrowDownLeft className="w-5 h-5 text-green-400" />
                        : <ArrowUpRight className="w-5 h-5 text-blue-400" />
                      }
                    </div>
                    <div>
                      <p className="text-white font-mono">{scan.tracking_id}</p>
                      <p className="text-slate-400 text-sm">{scan.customer_name || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400">{scan.courier || '-'}</p>
                    <p className="text-slate-500 text-xs">{formatDate(scan.scanned_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
