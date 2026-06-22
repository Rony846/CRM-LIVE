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
  Loader2, CheckCircle, Clock, Truck, Smartphone
} from 'lucide-react';
import GateDashboardMobile from './GateDashboardMobile';

export default function GateDashboard() {
  const { token, user } = useAuth();
  const [useMobileView, setUseMobileView] = useState(false);
  
  // All useState hooks must be at the top
  const [scanData, setScanData] = useState({
    scan_type: 'inward',
    tracking_id: '',
    courier: '',
    custom_courier: '',
    notes: ''
  });
  const [scheduled, setScheduled] = useState({ incoming: [], outgoing: [] });
  const [recentScans, setRecentScans] = useState([]);
  const [returnBatches, setReturnBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const trackingInputRef = React.useRef(null);
  
  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768 || 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setUseMobileView(isMobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!useMobileView) {
      fetchData();
      // Focus on tracking input for barcode scanner
      if (trackingInputRef.current) {
        trackingInputRef.current.focus();
      }
    }
  }, [token, useMobileView]);
  
  // Use mobile dashboard on mobile devices
  if (useMobileView) {
    return <GateDashboardMobile />;
  }

  const fetchData = async () => {
    try {
      const [scheduledRes, logsRes, batchesRes] = await Promise.all([
        axios.get(`${API}/gate/scheduled`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/gate/logs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/gate/return-batches?days=7`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { batches: [] } }))
      ]);
      setScheduled({
        incoming: scheduledRes.data.scheduled_incoming || [],
        outgoing: scheduledRes.data.scheduled_outgoing || []
      });
      setRecentScans(logsRes.data);
      setReturnBatches(batchesRes.data.batches || []);
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
    
    // Use custom courier if "Other" is selected
    const courierName = scanData.courier === 'Other' ? scanData.custom_courier : scanData.courier;
    
    setLoading(true);
    try {
      const payload = {
        scan_type: scanData.scan_type,
        tracking_id: scanData.tracking_id.trim(),
        courier: courierName,
        notes: scanData.notes
      };
      await axios.post(`${API}/gate/scan`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${scanData.scan_type.toUpperCase()} scan recorded!`);
      setScanData({ ...scanData, tracking_id: '', notes: '', custom_courier: '' });
      fetchData();
      // Refocus input for next scan
      if (trackingInputRef.current) {
        trackingInputRef.current.focus();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle barcode scanner input (Enter key triggers scan)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && scanData.tracking_id) {
      e.preventDefault();
      handleScan();
    }
  };

  const quickScan = (trackingId, type) => {
    setScanData({ ...scanData, scan_type: type, tracking_id: trackingId });
    if (trackingInputRef.current) {
      trackingInputRef.current.focus();
    }
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
      {/* Header with Mobile Toggle */}
      <div className="mb-4 md:mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">Gate Scanning Dashboard</h2>
          <p className="text-sm md:text-base text-slate-400">
            Scan parcels entering and leaving the factory. Use barcode scanner or enter tracking ID manually.
          </p>
        </div>
        <Button
          onClick={() => setUseMobileView(true)}
          variant="outline"
          className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          Mobile View
        </Button>
      </div>

      {/* Amazon Return-OTP batches — OTP stays locked until every parcel is scanned inward */}
      {returnBatches.length > 0 && (
        <Card className="bg-slate-800 border-amber-700/60 mb-4 md:mb-6">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-lg md:text-xl">
              <ArrowDownLeft className="w-5 h-5 text-amber-400" />
              Amazon Returns — OTP Gate
              <span className="text-xs font-normal text-slate-400 ml-2">
                Scan every parcel inward to unlock the OTP
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(
              returnBatches.reduce((acc, b) => {
                const f = b.firm || (b.firm_names || ['?'])[0];
                (acc[f] = acc[f] || []).push(b);
                return acc;
              }, {})
            ).map(([firm, batches]) => (
              <div key={firm}>
                <div className="text-xs font-bold text-amber-300/90 uppercase tracking-wide mb-2 border-b border-amber-700/30 pb-1">
                  {firm} · {batches.length} batch{batches.length > 1 ? 'es' : ''}
                </div>
                <div className="space-y-3">
                  {batches.map((b) => {
                    const done = !b.otp_locked;
                    const expired = b.status === 'expired';
                    return (
                      <div key={b.id} className={`rounded-lg border p-3 ${done ? 'border-green-600/70 bg-green-900/15' : expired ? 'border-red-700/70 bg-red-900/15' : 'border-slate-600 bg-slate-900/40'}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="text-sm text-slate-300">
                            <span className="text-slate-400">{b.email_date} · agent {b.agent_name || '?'}</span>
                            {b.valid_through && <span className="text-slate-500"> · valid {b.valid_through}</span>}
                            {expired && <span className="text-red-400 font-semibold"> · EXPIRED</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${done ? 'bg-green-600 text-white' : expired ? 'bg-red-700 text-white' : 'bg-slate-700 text-slate-300'}`}>
                              {b.scanned_count}/{b.total} scanned
                            </span>
                            {done ? (
                              <span className="font-mono font-bold text-green-300 text-lg tracking-wider">🔓 OTP {b.otp}</span>
                            ) : (
                              <span className="font-mono text-slate-500 text-lg tracking-wider">🔒 OTP ••••••</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1">
                          {(b.items || []).map((it, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className={it.scanned ? 'text-green-400' : 'text-slate-500'}>{it.scanned ? '✅' : '⬜'}</span>
                              <span className="font-mono text-slate-400">{it.tracking_id}</span>
                              <span className="text-slate-500">{it.order_id}</span>
                              <span className="text-slate-400 truncate flex-1">{it.product}</span>
                              {it.reason && <span className="text-amber-500/80">{it.reason}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scan Form - Mobile Optimized */}
      <Card className="bg-slate-800 border-slate-700 mb-4 md:mb-6">
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-white flex items-center gap-2 text-lg md:text-xl">
            <Scan className="w-5 h-5 text-cyan-400" />
            Scan Parcel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Scan Type Toggle - Large for Mobile */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              variant={scanData.scan_type === 'inward' ? 'default' : 'outline'}
              onClick={() => setScanData({ ...scanData, scan_type: 'inward' })}
              className={`h-14 md:h-12 text-base ${
                scanData.scan_type === 'inward' 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 mr-2" />
              Inward
            </Button>
            <Button
              variant={scanData.scan_type === 'outward' ? 'default' : 'outline'}
              onClick={() => setScanData({ ...scanData, scan_type: 'outward' })}
              className={`h-14 md:h-12 text-base ${
                scanData.scan_type === 'outward' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ArrowUpRight className="w-5 h-5 mr-2" />
              Outward
            </Button>
          </div>

          {/* Tracking ID - Large Input for Scanner */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-1 block">Tracking ID * (Scan barcode or type)</label>
            <Input
              ref={trackingInputRef}
              placeholder="Scan barcode or enter tracking ID..."
              value={scanData.tracking_id}
              onChange={(e) => setScanData({ ...scanData, tracking_id: e.target.value })}
              onKeyDown={handleKeyDown}
              className="bg-slate-900 border-slate-700 text-white h-14 md:h-12 text-lg md:text-base"
              data-testid="tracking-input"
              autoFocus
            />
          </div>

          {/* Courier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Courier</label>
              <Select 
                value={scanData.courier} 
                onValueChange={(v) => setScanData({ ...scanData, courier: v, custom_courier: '' })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white h-12">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="Delhivery">Delhivery</SelectItem>
                  <SelectItem value="BlueDart">BlueDart</SelectItem>
                  <SelectItem value="DTDC">DTDC</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="Ecom Express">Ecom Express</SelectItem>
                  <SelectItem value="Xpressbees">Xpressbees</SelectItem>
                  <SelectItem value="Shadowfax">Shadowfax</SelectItem>
                  <SelectItem value="India Post">India Post</SelectItem>
                  <SelectItem value="Other">Other (Manual Entry)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Custom Courier Name - Only shown when "Other" is selected */}
            {scanData.courier === 'Other' && (
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Courier Name *</label>
                <Input
                  placeholder="Enter courier name..."
                  value={scanData.custom_courier}
                  onChange={(e) => setScanData({ ...scanData, custom_courier: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white h-12"
                  data-testid="custom-courier-input"
                />
              </div>
            )}
          </div>
          
          {/* Scan Button - Large for Mobile */}
          <Button 
            onClick={handleScan} 
            disabled={loading || (scanData.courier === 'Other' && !scanData.custom_courier)}
            className={`w-full h-14 md:h-12 text-lg md:text-base ${
              scanData.scan_type === 'inward' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            data-testid="scan-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : scanData.scan_type === 'inward' ? (
              <ArrowDownLeft className="w-5 h-5 mr-2" />
            ) : (
              <ArrowUpRight className="w-5 h-5 mr-2" />
            )}
            {scanData.scan_type === 'inward' ? 'Record Inward Scan' : 'Record Outward Scan'}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Parcels - Mobile Friendly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Expected Incoming */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base md:text-lg">
              <ArrowDownLeft className="w-5 h-5 text-green-400" />
              Expected Incoming ({scheduled.incoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.incoming.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No expected incoming</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scheduled.incoming.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700 active:bg-slate-600"
                    onClick={() => quickScan(item.pickup_tracking, 'inward')}
                  >
                    <div>
                      <p className="text-white font-medium text-sm md:text-base">{item.ticket_number}</p>
                      <p className="text-slate-400 text-xs md:text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-xs md:text-sm">{item.pickup_courier}</p>
                      <p className="text-slate-500 text-xs font-mono truncate max-w-24 md:max-w-none">{item.pickup_tracking}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready to Ship */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-white flex items-center gap-2 text-base md:text-lg">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
              Ready to Ship ({scheduled.outgoing.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduled.outgoing.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No items ready to ship</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scheduled.outgoing.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-700 active:bg-slate-600"
                    onClick={() => quickScan(item.return_tracking || item.tracking_id, 'outward')}
                  >
                    <div>
                      <p className="text-white font-medium text-sm md:text-base">{item.ticket_number || item.dispatch_number}</p>
                      <p className="text-slate-400 text-xs md:text-sm">{item.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-xs md:text-sm">{item.return_courier || item.courier}</p>
                      <p className="text-slate-500 text-xs font-mono truncate max-w-24 md:max-w-none">{item.return_tracking || item.tracking_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans - Mobile Friendly */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-white flex items-center gap-2 text-base md:text-lg">
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
                <div key={scan.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      scan.scan_type === 'inward' ? 'bg-green-600/20' : 'bg-blue-600/20'
                    }`}>
                      {scan.scan_type === 'inward' 
                        ? <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                        : <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-mono text-sm md:text-base truncate">{scan.tracking_id}</p>
                      <p className="text-slate-400 text-xs md:text-sm truncate">{scan.customer_name || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-slate-400 text-xs md:text-sm">{scan.courier || '-'}</p>
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
