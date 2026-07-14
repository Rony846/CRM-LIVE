import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Check, ScanLine, RotateCcw, PackagePlus } from 'lucide-react';

/* Inventory Inward — mobile-friendly stock receiving. Pick a product, then continuously scan every
   incoming unit into stock. Hardware-scanner (BPS250BC) friendly: autofocus + Enter, keeps focus after
   each scan, no clicks between units. Each scan records the serial as in_stock. Works on phone + desktop. */
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 14 };

export default function InventoryInward() {
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

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? skus.filter((s) => `${s.name || ''} ${s.sku_code || ''}`.toLowerCase().includes(q)) : skus;
    return list.slice(0, 80);
  }, [skus, search]);
  const model = useMemo(() => skus.find((s) => s.id === skuId), [skus, skuId]);

  const loadStock = useCallback((sid) => {
    if (!sid) { setInStock(null); return; }
    axios.get(`${API}/production/inventory-summary`, { headers: H, params: { master_sku_id: sid } })
      .then((r) => setInStock(r.data?.in_stock)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { if (skuId) { loadStock(skuId); const t = setTimeout(() => inputRef.current?.focus(), 120); return () => clearTimeout(t); } }, [skuId, loadStock]);

  const record = async () => {
    const sn = serial.trim();
    if (!skuId) { toast.error('Pick a product first'); return; }
    if (!sn) return;
    if (scans.some((s) => s.serial === sn)) { setSerial(''); toast.info('Already scanned this session'); inputRef.current?.focus(); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/production/inventory-scan`, { master_sku_id: skuId, serial: sn }, { headers: H });
      setScans((prev) => [{ serial: sn, already: data.already, at: Date.now() }, ...prev]);
      if (data.already) toast.info(`${sn} was already on record`);
      setSerial(''); loadStock(skuId);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not record'); }
    finally { setBusy(false); setTimeout(() => inputRef.current?.focus(), 60); }
  };
  const changeModel = () => { setSkuId(''); setScans([]); setSerial(''); setInStock(null); setSearch(''); };

  return (
    <IronShell title="Inventory Inward" subtitle="Pick a product, then scan every incoming unit into stock">
      {!skuId ? (
        <div style={{ ...card, maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: T.iron700 }}>
            <PackagePlus size={18} /><span style={{ fontWeight: 700, fontSize: 14 }}>What are you receiving?</span>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" autoFocus
            style={{ width: '100%', height: 48, borderRadius: 10, border: '1px solid ' + T.iron200, padding: '0 14px', fontSize: 15, marginBottom: 10, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '64vh', overflowY: 'auto' }}>
            {products.length === 0 && <div style={{ color: T.iron400, fontSize: 14, padding: 20, textAlign: 'center' }}>No products{search ? ' match' : ''}.</div>}
            {products.map((s) => (
              <button key={s.id} onClick={() => setSkuId(s.id)}
                style={{ textAlign: 'left', border: '1px solid ' + T.iron200, background: T.white, borderRadius: 10, padding: '14px 15px', cursor: 'pointer', color: T.iron900, minHeight: 56 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: T.iron400, ...mono, marginTop: 2 }}>{s.sku_code}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ ...card, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900, lineHeight: 1.2 }}>{model?.name}</div>
              <div style={{ fontSize: 11.5, color: T.iron500, ...mono, marginTop: 2 }}>{model?.sku_code}
                {inStock != null && <span style={{ color: T.iron700, fontWeight: 700 }}> · {inStock} in stock</span>}</div>
            </div>
            <button onClick={changeModel} style={{ border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 8, padding: '9px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center', flex: 'none' }}>
              <RotateCcw size={14} /> Change
            </button>
          </div>

          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <Caps size={9}>Scan each unit</Caps>
              <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 30, color: T.orange, lineHeight: 1 }}>{scans.length}</span>
            </div>
            <div style={{ position: 'relative' }}>
              <ScanLine size={20} style={{ position: 'absolute', left: 13, top: 19, color: T.iron400 }} />
              <input ref={inputRef} autoFocus value={serial} onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && serial.trim() && !busy && record()}
                inputMode="text" autoComplete="off" autoCapitalize="characters"
                placeholder="Scan serial / barcode…"
                style={{ width: '100%', height: 58, padding: '0 14px 0 42px', borderRadius: 12, border: '2px solid ' + T.orange, fontSize: 18, fontWeight: 700, letterSpacing: 0.6, color: T.iron900, outline: 'none', boxSizing: 'border-box', ...mono }} />
            </div>
            <button onClick={record} disabled={busy || !serial.trim()}
              style={{ width: '100%', marginTop: 10, border: 'none', background: T.orange, color: '#fff', borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: (busy || !serial.trim()) ? 0.5 : 1 }}>
              Add to stock
            </button>
            <div style={{ fontSize: 11, color: T.iron400, marginTop: 8, textAlign: 'center' }}>Keep scanning — each unit is recorded. Duplicates ignored.</div>
          </div>

          {scans.length > 0 && (
            <div style={card}>
              <Caps size={9}>Received this session · {scans.length}</Caps>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: '46vh', overflowY: 'auto' }}>
                {scans.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, background: T.iron50, borderRadius: 8, padding: '9px 11px' }}>
                    <Check size={16} style={{ color: s.already ? '#b45309' : '#16a34a', flex: 'none' }} />
                    <span style={{ ...mono, color: T.iron900, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.serial}</span>
                    <span style={{ color: T.iron400, flex: 1, textAlign: 'right', fontSize: 11 }}>{s.already ? 'already on record' : 'added'}</span>
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
