import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Check, ScanLine, RotateCcw } from 'lucide-react';

/* Stabilizer stock — pick a model, then continuously scan every unit into stock.
   Hardware-scanner (BPS250BC) friendly: autofocus + Enter-to-submit, keeps focus after each scan,
   never needs a click between units. Each scan records the serial as in_stock (POST inventory-scan). */
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 };

export default function StabilizerStockScan() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [skus, setSkus] = useState([]);
  const [skuId, setSkuId] = useState('');
  const [search, setSearch] = useState('');
  const [serial, setSerial] = useState('');
  const [scans, setScans] = useState([]);
  const [inStock, setInStock] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/master-skus`, { headers: H }).then((r) => setSkus(Array.isArray(r.data) ? r.data : (r.data.master_skus || []))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const stabilizers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skus.filter((s) => `${s.name || ''} ${s.category || ''}`.toLowerCase().includes('stabil'))
      .filter((s) => !q || `${s.name || ''} ${s.sku_code || ''}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [skus, search]);

  const model = useMemo(() => skus.find((s) => s.id === skuId), [skus, skuId]);

  const loadStock = useCallback((sid) => {
    if (!sid) { setInStock(null); return; }
    axios.get(`${API}/production/inventory-summary`, { headers: H, params: { master_sku_id: sid } })
      .then((r) => setInStock(r.data?.in_stock)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // when a model is chosen, focus the scan box and load its stock count
  useEffect(() => { if (skuId) { loadStock(skuId); const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); } }, [skuId, loadStock]);

  const record = async () => {
    const sn = serial.trim();
    if (!skuId) { toast.error('Pick a stabilizer model first'); return; }
    if (!sn) return;
    if (scans.some((s) => s.serial === sn)) { setSerial(''); toast.info('Already scanned this session'); inputRef.current?.focus(); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/production/inventory-scan`, { master_sku_id: skuId, serial: sn }, { headers: H });
      setScans((prev) => [{ serial: sn, already: data.already, at: Date.now() }, ...prev]);
      if (data.already) toast.info(`${sn} was already on record`);
      setSerial(''); loadStock(skuId);
      try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==').play?.(); } catch { /* beep best-effort */ }
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not record'); }
    finally { setBusy(false); setTimeout(() => inputRef.current?.focus(), 60); }
  };

  const changeModel = () => { setSkuId(''); setScans([]); setSerial(''); setInStock(null); setSearch(''); };

  return (
    <IronShell title="Stabilizer stock — scan in" subtitle="Pick a model, then scan every unit — continuous">
      {!skuId ? (
        <div style={{ ...card, maxWidth: 560 }}>
          <Caps size={9}>Pick the stabilizer model</Caps>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stabilizer model…"
            style={{ width: '100%', height: 42, borderRadius: 8, border: '1px solid ' + T.iron200, padding: '0 12px', fontSize: 13.5, marginTop: 4, marginBottom: 10, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '62vh', overflowY: 'auto' }}>
            {stabilizers.length === 0 && <div style={{ color: T.iron400, fontSize: 13, padding: 16, textAlign: 'center' }}>No stabilizer models{search ? ' match' : ''}.</div>}
            {stabilizers.map((s) => (
              <button key={s.id} onClick={() => setSkuId(s.id)}
                style={{ textAlign: 'left', border: '1px solid ' + T.iron200, background: T.white, borderRadius: 8, padding: '11px 13px', cursor: 'pointer', fontSize: 13, color: T.iron900 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: T.iron400, ...mono }}>{s.sku_code}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          {/* chosen model header */}
          <div style={{ ...card, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900 }}>{model?.name}</div>
              <div style={{ fontSize: 11, color: T.iron500, ...mono }}>{model?.sku_code}
                {inStock != null && <span style={{ color: T.iron700, fontWeight: 700 }}> · {inStock} in stock</span>}</div>
            </div>
            <button onClick={changeModel} style={{ border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <RotateCcw size={13} /> Change
            </button>
          </div>

          {/* scan box */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Caps size={9}>Scan each unit</Caps>
              <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.orange }}>{scans.length}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <ScanLine size={18} style={{ position: 'absolute', left: 12, top: 17, color: T.iron400 }} />
              <input ref={inputRef} autoFocus value={serial} onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && serial.trim() && !busy && record()}
                placeholder="Scan the serial / barcode…"
                style={{ width: '100%', height: 52, padding: '0 14px 0 38px', borderRadius: 10, border: '1px solid ' + T.orange, fontSize: 17, fontWeight: 700, letterSpacing: 0.6, color: T.iron900, outline: 'none', boxSizing: 'border-box', ...mono }} />
            </div>
            <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 6 }}>Keep scanning — each unit is recorded to stock. Duplicates are ignored.</div>
          </div>

          {/* session list */}
          {scans.length > 0 && (
            <div style={card}>
              <Caps size={9}>Scanned this session · {scans.length}</Caps>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8, maxHeight: '48vh', overflowY: 'auto' }}>
                {scans.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: T.iron50, borderRadius: 6, padding: '6px 9px' }}>
                    <Check size={14} style={{ color: s.already ? '#b45309' : '#16a34a' }} />
                    <span style={{ ...mono, color: T.iron900, fontWeight: 700 }}>{s.serial}</span>
                    <span style={{ color: T.iron400, flex: 1, textAlign: 'right', fontSize: 10.5 }}>{s.already ? 'already on record' : 'added to stock'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </IronShell>
  );
}
