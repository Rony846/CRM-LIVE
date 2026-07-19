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
  const [exc, setExc] = useState({ active: false });   // BMS-skip exception window (today only)
  const [skipBms, setSkipBms] = useState(false);
  const [count, setCount] = useState(1);
  const [cellType, setCellType] = useState('');        // battery: cell chemistry
  const [bmsType, setBmsType] = useState('');           // battery: BMS brand (blank until picked; JK scanned, others auto-serial)
  const bmsRef = useRef(null); const mbRef = useRef(null); const wifiRef = useRef(null);
  // Inventory intake (record EXISTING labelled units into stock by scanning their serial)
  const [action, setAction] = useState('build');   // 'build' | 'stock'
  const [stockMulti, setStockMulti] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [stockSku, setStockSku] = useState('');
  const [stockSerial, setStockSerial] = useState('');
  const [stockScans, setStockScans] = useState([]);
  const [inStock, setInStock] = useState(null);
  const stockRef = useRef(null);

  const loadSummary = useCallback(() => {
    axios.get(`${API}/production/summary`, { headers: H }).then((r) => setSummary(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    axios.get(`${API}/master-skus`, { headers: H }).then((r) => setSkus(Array.isArray(r.data) ? r.data : (r.data.master_skus || []))).catch(() => {});
    axios.get(`${API}/production/bms-exception`, { headers: H }).then((r) => setExc(r.data || { active: false })).catch(() => {});
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const products = useMemo(() => {
    const kw = mode === 'battery' ? ['batter', 'lithium', 'lifepo'] : ['inverter'];
    return skus.filter((s) => kw.some((k) => `${s.name || ''} ${s.category || ''}`.toLowerCase().includes(k)));
  }, [skus, mode]);
  // Stock intake can be ANY product — filter the FULL catalogue. Space-insensitive + token match so
  // "4kva" finds "4 KVA", and "4kva 90" narrows to that variant. Shows all matches (not capped at 100).
  const stockProducts = useMemo(() => {
    const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
    const q = stockSearch.trim().toLowerCase();
    if (!q) return skus.slice(0, 300);
    const tokens = q.split(/\s+/).filter(Boolean).map(norm);
    return skus.filter((s) => {
      const hay = norm(`${s.name || ''} ${s.sku_code || ''} ${s.category || ''}`);
      return tokens.every((t) => hay.includes(t));
    }).slice(0, 300);
  }, [skus, stockSearch]);

  const loadInStock = (sid) => {
    if (!sid) { setInStock(null); return; }
    axios.get(`${API}/production/inventory-summary`, { headers: H, params: { master_sku_id: sid } })
      .then((r) => setInStock(r.data?.in_stock)).catch(() => {});
  };
  const recordStock = async () => {
    if (!stockSku) { toast.error('Pick the product first'); return; }
    const sn = stockSerial.trim();
    if (!sn) { toast.error('Scan the serial'); return; }
    if (stockScans.some((s) => s.serial === sn)) { setStockSerial(''); toast.info('Already scanned in this session'); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/production/inventory-scan`, { master_sku_id: stockSku, serial: sn }, { headers: H });
      setStockScans((prev) => [{ serial: sn, already: data.already }, ...prev]);
      if (data.already) toast.info(`${sn} was already on record (${data.status})`);
      setStockSerial(''); loadInStock(stockSku);
      if (stockMulti) setTimeout(() => stockRef.current?.focus(), 80);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not record'); }
    finally { setBusy(false); }
  };

  useEffect(() => { setSkuId(''); setBms(''); setMb(''); setWifi(''); setLastSerial(null); }, [mode]);
  useEffect(() => { if (!autoFocus) return; const t = setTimeout(() => (mode === 'battery' ? bmsRef : mbRef).current?.focus(), 150); return () => clearTimeout(t); }, [mode, skuId, autoFocus]);

  const CELL_TYPES = ['Highstar 100Ah', 'Highstar 314Ah', 'GP 100Ah', 'GP 320Ah'];
  const BMS_TYPES = ['JK', 'XJ', 'JBD', 'TDT'];
  const bmsAuto = mode === 'battery' && bmsType && bmsType !== 'JK';   // XJ/JBD/TDT → CRM mints + prints the BMS serial
  const noScan = exc.active && skipBms;   // exception: build w/o scanning the raw-material components
  const build = async () => {
    if (!skuId) { toast.error('Pick the product first'); return; }
    if (!noScan && mode === 'battery') {
      if (!cellType) { toast.error('Select the cell type'); return; }
      if (!bmsType) { toast.error('Select the BMS type'); return; }
      if (bmsType === 'JK' && !bms.trim()) { toast.error('Scan the JK BMS serial'); return; }
    }
    if (!noScan && mode === 'inverter' && (!mb.trim() || !wifi.trim())) { toast.error('Scan motherboard and wifi board'); return; }
    setBusy(true);
    try {
      const body = { product_type: mode, master_sku_id: skuId };
      if (noScan) { body.skip_bms = true; body.count = Math.max(1, Math.min(100, parseInt(count, 10) || 1)); }
      else if (mode === 'battery') { body.cell_type = cellType; body.bms_type = bmsType; if (bmsType === 'JK') body.bms_code = bms.trim(); }
      else { body.motherboard_code = mb.trim(); body.wifi_code = wifi.trim(); }
      const { data } = await axios.post(`${API}/production/build`, body, { headers: H });
      const serials = data.serials || [data.serial];
      setLastSerial({ serial: serials.join(', '), components: data.components, exception: data.exception });
      toast.success(serials.length > 1 ? `Built ${serials.length} serials — labels printing` : `Built ${data.serial}${data.bms_serials?.length ? ' + BMS ' + data.bms_serials.join(', ') : ''} — label${data.bms_serials?.length ? 's' : ''} printing`);
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setAction('build')} style={actBtn(action === 'build')}><Cpu size={15} /> Build unit</button>
        <button onClick={() => setAction('stock')} style={actBtn(action === 'stock')}>📦 Add to stock</button>
      </div>

      {action === 'stock' ? (
        <>
          <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <Caps size={9}>Product</Caps>
            <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Search any product…"
              style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 10px', fontSize: 12.5, marginTop: 3, marginBottom: 8, boxSizing: 'border-box' }} />
            <select value={stockSku} onChange={(e) => { setStockSku(e.target.value); loadInStock(e.target.value); }}
              style={{ width: '100%', height: 44, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 10px', fontSize: 13, background: T.white, color: T.iron900, marginBottom: 12 }}>
              <option value="">Select the product…</option>
              {stockProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setStockMulti(false)} style={pillBtn(!stockMulti)}>Single item</button>
              <button onClick={() => setStockMulti(true)} style={pillBtn(stockMulti)}>Scan multiple</button>
            </div>
            <Caps size={9}>Scan serial</Caps>
            <input ref={stockRef} autoFocus value={stockSerial} onChange={(e) => setStockSerial(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && stockSerial.trim() && !busy && recordStock()}
              placeholder="Scan the serial on the unit…" style={{ ...scanInput, marginTop: 3 }} />
            <div style={{ fontSize: 10.5, color: T.iron500, marginTop: 6 }}>
              {inStock != null ? `${inStock} currently in stock for this product` : 'Pick a product to see its stock'}{stockMulti ? ' · keep scanning, each is recorded' : ''}
            </div>
            {!stockMulti && (
              <button onClick={recordStock} disabled={busy}
                style={{ width: '100%', marginTop: 14, border: 'none', background: T.orange, color: '#fff', borderRadius: 10, padding: 13, fontSize: 14.5, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Add to stock</button>
            )}
          </div>
          {stockScans.length > 0 && (
            <div style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 }}>
              <Caps size={9}>Added this session · {stockScans.length}</Caps>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8, maxHeight: '40vh', overflowY: 'auto' }}>
                {stockScans.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: T.iron50, borderRadius: 6, padding: '5px 8px' }}>
                    <span style={{ color: s.already ? '#b45309' : '#16a34a', fontWeight: 800 }}>{s.already ? '=' : '✓'}</span>
                    <span style={{ ...mono, color: T.iron900, fontWeight: 700 }}>{s.serial}</span>
                    <span style={{ color: T.iron400, flex: 1, textAlign: 'right', fontSize: 10.5 }}>{s.already ? 'already on record' : 'added to stock'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
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

        {exc.active && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 10px', marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={skipBms} onChange={(e) => setSkipBms(e.target.checked)} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>⚠️ No {mode === 'battery' ? 'BMS' : 'board'} scan — exception (today only)</span>
            <span style={{ fontSize: 10.5, color: '#b45309' }}>for units already built</span>
          </label>
        )}
        {noScan ? (
          <>
            <Caps size={9}>How many {mode} serials to print</Caps>
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && build()} style={{ ...scanInput, marginTop: 3, letterSpacing: 0 }} />
            <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 5 }}>{mode === 'battery' ? 'BMS' : 'Motherboard/WiFi'} not scanned — flagged to link later. Serial + product are still correct for the model you picked.</div>
          </>
        ) : mode === 'battery' ? (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <Caps size={9}>Cell type</Caps>
                <select value={cellType} onChange={(e) => setCellType(e.target.value)}
                  style={{ width: '100%', height: 44, marginTop: 3, borderRadius: 10, border: '1px solid ' + (cellType ? T.iron200 : T.orange), padding: '0 10px', fontSize: 14, fontWeight: 700, color: T.iron900, background: '#fff' }}>
                  <option value="">Select cell…</option>
                  {CELL_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <Caps size={9}>BMS type</Caps>
                <select value={bmsType} onChange={(e) => setBmsType(e.target.value)}
                  style={{ width: '100%', height: 44, marginTop: 3, borderRadius: 10, border: '1px solid ' + (bmsType ? T.iron200 : T.orange), padding: '0 10px', fontSize: 14, fontWeight: 700, color: T.iron900, background: '#fff' }}>
                  <option value="">Select BMS…</option>
                  {BMS_TYPES.map((b) => <option key={b} value={b}>{b}{b === 'JK' ? ' (scan serial)' : ' (auto-serial)'}</option>)}
                </select>
              </div>
            </div>
            {!bmsType ? (
              <div style={{ fontSize: 12, color: T.iron400 }}>Pick the BMS type. JK = scan its serial. XJ / JBD / TDT = no serial, we print one for you.</div>
            ) : bmsType === 'JK' ? (
              <>
                <Caps size={9}>Scan JK BMS serial</Caps>
                <input ref={bmsRef} value={bms} onChange={(e) => setBms(e.target.value)} placeholder="Scan the JK BMS label…"
                  onKeyDown={(e) => e.key === 'Enter' && bms.trim() && !busy && build()} style={{ ...scanInput, marginTop: 3 }} />
              </>
            ) : (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#1e40af' }}>
                <b>{bmsType} BMS has no serial</b> — no need to scan or type anything. MuscleGrid will auto-generate a BMS serial and <b>print its sticker</b> when you press Build. Stick it on the BMS.
              </div>
            )}
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
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Cpu size={18} />} {noScan ? `Print ${Math.max(1, parseInt(count, 10) || 1)} ${mode} serial${(parseInt(count, 10) || 1) > 1 ? 's' : ''}` : 'Build & print serial'}
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
      )}
    </>
  );
}

const modeBtn = (active, color) => ({ flex: 1, border: '1px solid ' + (active ? color : T.iron200), background: active ? color : T.white, color: active ? '#fff' : T.iron700, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 });
const actBtn = (active) => ({ flex: 1, border: '1px solid ' + (active ? T.iron900 : T.iron200), background: active ? T.iron900 : T.white, color: active ? '#fff' : T.iron700, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 });
const pillBtn = (active) => ({ flex: 1, border: '1.5px solid ' + (active ? T.orange : T.iron200), background: active ? '#fff7ed' : T.white, color: active ? T.orange : T.iron700, borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' });
