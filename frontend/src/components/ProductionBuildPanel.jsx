import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Loader2, Cpu, Battery, Zap } from 'lucide-react';

/* Shared production-build form (scan components -> mint + print the finished-good serial).
   Rendered standalone on /production/build AND inside a Ship Desk popup so the operator can build
   and pack at the same station without switching screens. Self-contained (own state + fetches). */
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 };
const scanInput = { width: '100%', height: 52, padding: '0 14px', borderRadius: 10, border: '1px solid ' + T.orange, fontSize: 17, fontWeight: 700, letterSpacing: 0.6, color: T.iron900, outline: 'none', boxSizing: 'border-box', ...mono };

export default function ProductionBuildPanel({ autoFocus = true }) {
  const { token, user } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const role = user?.role;
  const allowInverter = ['admin', 'service_agent', 'technician'].includes(role);
  const allowBattery = ['admin', 'supervisor', 'call_support'].includes(role);
  const [mode, setMode] = useState(allowInverter && !allowBattery ? 'inverter' : 'battery');
  const [skus, setSkus] = useState([]);
  const [skuId, setSkuId] = useState('');
  const [bms, setBms] = useState('');
  const [mb, setMb] = useState('');
  const [wifi, setWifi] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [lastSerial, setLastSerial] = useState(null);
  const bmsRef = useRef(null); const mbRef = useRef(null); const wifiRef = useRef(null);

  const loadSummary = useCallback(() => {
    axios.get(`${API}/production/summary`, { headers: H }).then((r) => setSummary(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    axios.get(`${API}/master-skus`, { headers: H }).then((r) => setSkus(Array.isArray(r.data) ? r.data : (r.data.master_skus || []))).catch(() => {});
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const products = useMemo(() => {
    const kw = mode === 'battery' ? ['batter', 'lithium', 'lifepo'] : ['inverter'];
    return skus.filter((s) => kw.some((k) => `${s.name || ''} ${s.category || ''}`.toLowerCase().includes(k)));
  }, [skus, mode]);

  useEffect(() => { setSkuId(''); setBms(''); setMb(''); setWifi(''); setLastSerial(null); }, [mode]);
  useEffect(() => { if (!autoFocus) return; const t = setTimeout(() => (mode === 'battery' ? bmsRef : mbRef).current?.focus(), 150); return () => clearTimeout(t); }, [mode, skuId, autoFocus]);

  const build = async () => {
    if (!skuId) { toast.error('Pick the product first'); return; }
    if (mode === 'battery' && !bms.trim()) { toast.error('Scan the BMS'); return; }
    if (mode === 'inverter' && (!mb.trim() || !wifi.trim())) { toast.error('Scan motherboard and wifi board'); return; }
    setBusy(true);
    try {
      const body = { product_type: mode, master_sku_id: skuId };
      if (mode === 'battery') body.bms_code = bms.trim();
      else { body.motherboard_code = mb.trim(); body.wifi_code = wifi.trim(); }
      const { data } = await axios.post(`${API}/production/build`, body, { headers: H });
      setLastSerial({ serial: data.serial, components: data.components });
      toast.success(`Built ${data.serial} — label printing`);
      setBms(''); setMb(''); setWifi(''); loadSummary();
      setTimeout(() => (mode === 'battery' ? bmsRef : mbRef).current?.focus(), 120);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Build failed'); }
    finally { setBusy(false); }
  };

  const setReceived = async (component) => {
    const v = window.prompt(`How many ${component.toUpperCase()} received (total in stock)?`, String(summary?.received?.[component] ?? ''));
    if (v == null || v === '') return;
    try { await axios.post(`${API}/production/component-stock`, { component, received: parseInt(v, 10) }, { headers: H }); loadSummary(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const StockTile = ({ comp, label }) => {
    const c = summary?.consumed?.[comp] ?? 0;
    const rem = summary?.remaining?.[comp];
    return (
      <div style={{ flex: 1, minWidth: 120, background: T.white, border: '1px solid ' + T.iron200, borderRadius: 10, padding: '11px 13px' }}>
        <div style={{ fontSize: 10, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: rem != null && rem <= 5 ? '#dc2626' : T.iron900 }}>
          {rem != null ? rem : '—'} <span style={{ fontSize: 11, color: T.iron400, fontWeight: 500 }}>left</span>
        </div>
        <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>used {c}{summary?.received?.[comp] != null ? ` / ${summary.received[comp]}` : ''}
          <button onClick={() => setReceived(comp)} style={{ marginLeft: 6, border: 'none', background: 'transparent', color: T.blue, fontSize: 10.5, cursor: 'pointer', fontWeight: 700 }}>set stock</button>
        </div>
      </div>
    );
  };

  return (
    <>
      {allowInverter && allowBattery && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode('battery')} style={modeBtn(mode === 'battery', '#16a34a')}><Battery size={16} /> Battery</button>
          <button onClick={() => setMode('inverter')} style={modeBtn(mode === 'inverter', T.blue)}><Zap size={16} /> Inverter</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {mode === 'battery'
          ? <StockTile comp="bms" label="BMS" />
          : <><StockTile comp="motherboard" label="Motherboard" /><StockTile comp="wifi" label="WiFi board" /></>}
        <div style={{ flex: 1, minWidth: 120, background: T.iron50, border: '1px solid ' + T.iron200, borderRadius: 10, padding: '11px 13px' }}>
          <div style={{ fontSize: 10, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.4 }}>Built today</div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.orange }}>{summary?.built_today ?? 0}</div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <Caps size={9}>Product</Caps>
        <select value={skuId} onChange={(e) => setSkuId(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 10px', fontSize: 13, marginTop: 3, marginBottom: 14, background: T.white, color: T.iron900 }}>
          <option value="">Select the {mode} model…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {mode === 'battery' ? (
          <>
            <Caps size={9}>Scan BMS</Caps>
            <input ref={bmsRef} value={bms} onChange={(e) => setBms(e.target.value)} placeholder="Scan the BMS label…"
              onKeyDown={(e) => e.key === 'Enter' && bms.trim() && !busy && build()} style={{ ...scanInput, marginTop: 3 }} />
          </>
        ) : (
          <>
            <Caps size={9}>Scan motherboard</Caps>
            <input ref={mbRef} value={mb} onChange={(e) => setMb(e.target.value)} placeholder="Scan the motherboard code…"
              onKeyDown={(e) => { if (e.key === 'Enter' && mb.trim()) wifiRef.current?.focus(); }} style={{ ...scanInput, marginTop: 3, marginBottom: 12 }} />
            <Caps size={9}>Scan WiFi board</Caps>
            <input ref={wifiRef} value={wifi} onChange={(e) => setWifi(e.target.value)} placeholder="Scan the wifi board code…"
              onKeyDown={(e) => e.key === 'Enter' && mb.trim() && wifi.trim() && !busy && build()} style={{ ...scanInput, marginTop: 3 }} />
          </>
        )}

        <button onClick={build} disabled={busy}
          style={{ width: '100%', marginTop: 16, border: 'none', background: T.orange, color: '#fff', borderRadius: 10, padding: 14, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Cpu size={18} />} Build & print serial
        </button>

        {lastSerial && (
          <div style={{ marginTop: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700 }}>✓ Built: <span style={{ ...mono }}>{lastSerial.serial}</span></div>
            <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>{Object.entries(lastSerial.components).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
          </div>
        )}
      </div>

      {summary?.recent?.length > 0 && (
        <div style={card}>
          <Caps size={9}>Recent builds</Caps>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {summary.recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: T.iron50, borderRadius: 6, padding: '5px 8px' }}>
                <span style={{ ...mono, color: T.iron900, fontWeight: 700 }}>{r.serial_number}</span>
                <span style={{ color: T.iron500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Object.entries(r.components || {}).map(([k, v]) => `${k}:${v}`).join(' · ')}</span>
                <span style={{ color: T.iron400, fontSize: 10.5 }}>{(r.built_at || '').slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const modeBtn = (active, color) => ({ flex: 1, border: '1px solid ' + (active ? color : T.iron200), background: active ? color : T.white, color: active ? '#fff' : T.iron700, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 });
