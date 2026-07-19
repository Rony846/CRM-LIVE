import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, mono } from '@/components/iron/IronKit';
import { Search, Cpu, Battery, Layers } from 'lucide-react';

/* Genealogy lookup — enter a battery/inverter serial OR an order id and see exactly what raw material
   went into that unit: cell type, BMS brand + BMS serial, and boards. Traded stabilizers have no BOM. */
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 14 };
const kv = (label, value, hot) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed ' + T.iron100 }}>
    <span style={{ fontSize: 11.5, color: T.iron500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: value ? (hot ? T.orange : T.iron900) : T.iron300, ...(mono || {}) }}>{value || '—'}</span>
  </div>
);

export default function Genealogy() {
  const { token } = useAuth();
  const [q, setQ] = useState('');
  const [units, setUnits] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (term) => {
    const query = (term ?? q).trim();
    if (!query) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/production/genealogy`, {
        headers: { Authorization: `Bearer ${token}` }, params: { q: query },
      });
      setUnits(data?.units || []);
      if (!data?.units?.length) toast.info('No built unit found for that serial / order');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Lookup failed'); }
    finally { setLoading(false); }
  }, [q, token]);

  return (
    <IronShell title="Battery / Inverter Genealogy" subtitle="What raw material went into a unit — by serial or order">
      <div style={{ ...card, maxWidth: 640, marginBottom: 16 }}>
        <Caps size={9}>Scan a unit serial or type an order id</Caps>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 15, color: T.iron400 }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="e.g. MGLIB260700153  or  ORD-123  or  MGBMSXJ…"
              style={{ width: '100%', height: 48, borderRadius: 10, border: '2px solid ' + T.orange, padding: '0 12px 0 38px', fontSize: 15, fontWeight: 700, boxSizing: 'border-box', ...(mono || {}) }} />
          </div>
          <button onClick={() => search()} disabled={loading}
            style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 10, padding: '0 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '…' : 'Look up'}
          </button>
        </div>
      </div>

      {units && units.length === 0 && <div style={{ color: T.iron400, fontSize: 14 }}>No built unit matched. Traded stabilizers have no genealogy.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {(units || []).map((u) => {
          const isBattery = (u.product_type || '').toLowerCase() === 'battery';
          const Icon = isBattery ? Battery : (u.motherboard || u.wifi ? Cpu : Layers);
          return (
            <div key={u.serial_number} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={18} style={{ color: T.orange }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 15, color: T.iron900, ...(mono || {}) }}>{u.serial_number}</div>
                  <div style={{ fontSize: 11, color: T.iron500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.product}</div>
                </div>
                <span style={{ background: u.status === 'dispatched' ? '#fef2f2' : '#f0fdf4', color: u.status === 'dispatched' ? '#b91c1c' : '#15803d', borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{u.status}</span>
              </div>
              {isBattery ? (
                <>
                  {kv('Cell used', u.cell_type, true)}
                  {kv('BMS brand', u.bms_type ? `${u.bms_type}${u.bms_source ? ' (' + u.bms_source.replace('scanned_jk', 'scanned') + ')' : ''}` : '', true)}
                  {kv('BMS serial', u.bms_serial)}
                </>
              ) : (
                <>
                  {kv('Motherboard', u.motherboard)}
                  {kv('WiFi board', u.wifi)}
                  {kv('BMS', u.bms_serial)}
                </>
              )}
              {kv('Order', u.order_id)}
              {kv('Customer', u.customer_name)}
              {kv('Built by', u.built_by)}
              {kv('Built at', u.built_at ? new Date(u.built_at).toLocaleString('en-IN') : '')}
              {u.dispatched_at && kv('Dispatched', new Date(u.dispatched_at).toLocaleString('en-IN'))}
            </div>
          );
        })}
      </div>
    </IronShell>
  );
}
