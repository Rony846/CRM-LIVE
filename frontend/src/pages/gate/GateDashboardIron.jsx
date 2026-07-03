import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Scan, ArrowDownLeft, ArrowUpRight, Loader2, Clock, Smartphone,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import GateDashboardMobile from './GateDashboardMobileIron';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '9px 11px', fontSize: 13, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const COURIERS = ['Delhivery', 'BlueDart', 'DTDC', 'FedEx', 'Ecom Express', 'Xpressbees', 'Shadowfax', 'India Post'];

export default function GateDashboard() {
  const { token, user } = useAuth();
  const [useMobileView, setUseMobileView] = useState(false);

  // All useState hooks must be at the top
  const [scanData, setScanData] = useState({
    scan_type: 'inward',
    tracking_id: '',
    courier: '',
    custom_courier: '',
    notes: '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, useMobileView]);

  // Use mobile dashboard on mobile devices
  if (useMobileView) {
    return <GateDashboardMobile />;
  }

  const fetchData = async () => {
    try {
      const [scheduledRes, logsRes, batchesRes] = await Promise.all([
        axios.get(`${API}/gate/scheduled`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/gate/logs?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/gate/return-batches?days=7`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => ({ data: { batches: [] } })),
      ]);
      setScheduled({
        incoming: scheduledRes.data.scheduled_incoming || [],
        outgoing: scheduledRes.data.scheduled_outgoing || [],
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
        notes: scanData.notes,
      };
      await axios.post(`${API}/gate/scan`, payload, {
        headers: { Authorization: `Bearer ${token}` },
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

  const isInward = scanData.scan_type === 'inward';

  if (initialLoading) {
    return (
      <IronShell title="Gate" subtitle="PARCEL FLOW · INWARD / OUTWARD">
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  const mobileBtn = (
    <button
      onClick={() => setUseMobileView(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}
    >
      <Smartphone size={14} /> Mobile View
    </button>
  );

  return (
    <IronShell title="Gate" subtitle="PARCEL FLOW · INWARD / OUTWARD" onRefresh={fetchData} headerRight={mobileBtn}>
      {/* Intro line */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900 }}>Gate Scanning Dashboard</div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
          Scan parcels entering and leaving the factory. Use barcode scanner or enter tracking ID manually.
        </div>
      </div>

      {/* Amazon Return-OTP batches — OTP stays locked until every parcel is scanned inward */}
      {returnBatches.length > 0 && (
        <IronCard pad={0} style={{ marginBottom: 16, borderLeft: `4px solid ${T.voltage}`, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ArrowDownLeft size={16} color={T.voltageText} />
            <Caps size={11} color={T.iron900} ls=".1em">Amazon Returns — OTP Gate</Caps>
            <span style={{ fontSize: 11, color: T.iron400 }}>Scan every parcel inward to unlock the OTP</span>
          </div>
          <div style={{ padding: 16, display: 'grid', gap: 16 }}>
            {Object.entries(
              returnBatches.reduce((acc, b) => {
                const f = b.firm || (b.firm_names || ['?'])[0];
                (acc[f] = acc[f] || []).push(b);
                return acc;
              }, {})
            ).map(([firm, batches]) => (
              <div key={firm}>
                <div style={{ borderBottom: `1px solid ${T.iron200}`, paddingBottom: 5, marginBottom: 10 }}>
                  <Caps size={9} color={T.voltageText}>{firm} · {batches.length} batch{batches.length > 1 ? 'es' : ''}</Caps>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {batches.map((b) => {
                    const done = !b.otp_locked;
                    const expired = b.status === 'expired';
                    const borderC = done ? '#CBE5D6' : expired ? '#F6D8BA' : T.iron200;
                    const bgC = done ? T.greenTint : expired ? '#FDEEE6' : T.iron50;
                    return (
                      <div key={b.id} style={{ borderRadius: 8, border: `1px solid ${borderC}`, background: bgC, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ fontSize: 12, color: T.iron700 }}>
                            <span style={{ color: T.iron500 }}>{b.email_date} · agent {b.agent_name || '?'}</span>
                            {b.valid_through && <span style={{ color: T.iron400 }}> · valid {b.valid_through}</span>}
                            {expired && <span style={{ color: T.orangeDeep, fontWeight: 700 }}> · EXPIRED</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={badgeStyle(done ? 'ok' : expired ? 'bad' : 'slate')}>{b.scanned_count}/{b.total} scanned</span>
                            {done ? (
                              <span style={{ ...mono, fontWeight: 700, color: T.green, fontSize: 16, letterSpacing: '.08em' }}>🔓 OTP {b.otp}</span>
                            ) : (
                              <span style={{ ...mono, color: T.iron400, fontSize: 16, letterSpacing: '.08em' }}>🔒 OTP ••••••</span>
                            )}
                          </div>
                        </div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                          {(b.items || []).map((it, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                              <span style={{ color: it.scanned ? T.green : T.iron400 }}>{it.scanned ? '✅' : '⬜'}</span>
                              <span style={{ ...mono, color: T.iron500 }}>{it.tracking_id}</span>
                              <span style={{ color: T.iron400 }}>{it.order_id}</span>
                              <span style={{ color: T.iron700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product}</span>
                              {it.reason && <span style={{ color: T.voltageText }}>{it.reason}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </IronCard>
      )}

      {/* Scan Form */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Scan size={16} color={T.orange} />
          <Caps size={11} color={T.iron900} ls=".1em">Scan Parcel</Caps>
        </div>
        <div style={{ padding: 16 }}>
          {/* Scan Type Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setScanData({ ...scanData, scan_type: 'inward' })}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 8, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 14,
                border: isInward ? 'none' : `1px solid ${T.iron200}`,
                background: isInward ? T.green : T.white,
                color: isInward ? '#fff' : T.iron700 }}
            >
              <ArrowDownLeft size={18} /> Inward
            </button>
            <button
              onClick={() => setScanData({ ...scanData, scan_type: 'outward' })}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 8, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 14,
                border: !isInward ? 'none' : `1px solid ${T.iron200}`,
                background: !isInward ? T.blue : T.white,
                color: !isInward ? '#fff' : T.iron700 }}
            >
              <ArrowUpRight size={18} /> Outward
            </button>
          </div>

          {/* Tracking ID */}
          <div style={{ marginBottom: 16 }}>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 6 }}>Tracking ID * (Scan barcode or type)</Caps>
            <input
              ref={trackingInputRef}
              placeholder="Scan barcode or enter tracking ID..."
              value={scanData.tracking_id}
              onChange={(e) => setScanData({ ...scanData, tracking_id: e.target.value })}
              onKeyDown={handleKeyDown}
              data-testid="tracking-input"
              autoFocus
              style={{ ...inputStyle, height: 48, fontSize: 16, ...mono }}
            />
          </div>

          {/* Courier Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <Caps size={8.5} style={{ display: 'block', marginBottom: 6 }}>Courier</Caps>
              <select
                value={scanData.courier}
                onChange={(e) => setScanData({ ...scanData, courier: e.target.value, custom_courier: '' })}
                style={{ ...selectStyle, height: 44 }}
              >
                <option value="">Select courier</option>
                {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other (Manual Entry)</option>
              </select>
            </div>

            {/* Custom Courier Name - Only shown when "Other" is selected */}
            {scanData.courier === 'Other' && (
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 6 }}>Courier Name *</Caps>
                <input
                  placeholder="Enter courier name..."
                  value={scanData.custom_courier}
                  onChange={(e) => setScanData({ ...scanData, custom_courier: e.target.value })}
                  data-testid="custom-courier-input"
                  style={{ ...inputStyle, height: 44 }}
                />
              </div>
            )}
          </div>

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={loading || (scanData.courier === 'Other' && !scanData.custom_courier)}
            data-testid="scan-btn"
            style={{ width: '100%', height: 48, borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 15,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: isInward ? T.green : T.blue, color: '#fff',
              opacity: (loading || (scanData.courier === 'Other' && !scanData.custom_courier)) ? 0.6 : 1 }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : isInward ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            {isInward ? 'Record Inward Scan' : 'Record Outward Scan'}
          </button>
        </div>
      </IronCard>

      {/* Scheduled Parcels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Expected Incoming */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownLeft size={16} color={T.green} />
            <Caps size={11} color={T.iron900} ls=".1em">Expected Incoming ({scheduled.incoming.length})</Caps>
          </div>
          <div style={{ padding: 12 }}>
            {scheduled.incoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: T.iron400, fontSize: 12.5 }}>No expected incoming</div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {scheduled.incoming.map((item, idx) => (
                  <div
                    key={idx}
                    className="iron-row"
                    onClick={() => quickScan(item.pickup_tracking, 'inward')}
                    style={{ padding: 10, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{item.ticket_number}</div>
                      <div style={{ fontSize: 11.5, color: T.iron500 }}>{item.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: T.blue }}>{item.pickup_courier}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{item.pickup_tracking}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>

        {/* Ready to Ship */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpRight size={16} color={T.blue} />
            <Caps size={11} color={T.iron900} ls=".1em">Ready to Ship ({scheduled.outgoing.length})</Caps>
          </div>
          <div style={{ padding: 12 }}>
            {scheduled.outgoing.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: T.iron400, fontSize: 12.5 }}>No items ready to ship</div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {scheduled.outgoing.map((item, idx) => (
                  <div
                    key={idx}
                    className="iron-row"
                    onClick={() => quickScan(item.return_tracking || item.tracking_id, 'outward')}
                    style={{ padding: 10, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{item.ticket_number || item.dispatch_number}</div>
                      <div style={{ fontSize: 11.5, color: T.iron500 }}>{item.customer_name}</div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: T.blue }}>{item.return_courier || item.courier}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{item.return_tracking || item.tracking_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </IronCard>
      </div>

      {/* Recent Scans */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={T.iron400} />
          <Caps size={11} color={T.iron900} ls=".1em">Recent Scans</Caps>
        </div>
        {recentScans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: T.iron400 }}>
            <Scan size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontSize: 12.5 }}>No recent scans</div>
          </div>
        ) : (
          <div>
            {recentScans.map((scan) => {
              const inward = scan.scan_type === 'inward';
              return (
                <div key={scan.id} className="iron-row" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: inward ? T.greenTint : T.blueTint }}>
                      {inward
                        ? <ArrowDownLeft size={18} color={T.green} />
                        : <ArrowUpRight size={18} color={T.blue} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: 13, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.tracking_id}</div>
                      <div style={{ fontSize: 11.5, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.customer_name || 'Unknown'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11.5, color: T.iron700 }}>{scan.courier || '-'}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{formatDate(scan.scanned_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}
