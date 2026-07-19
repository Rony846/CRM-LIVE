import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';

export default function VerifySerial() {
  const { serial } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/public/verify/${encodeURIComponent(serial)}`)
      .then(r => setData(r.data))
      .catch(() => setData({ genuine: false, serial }))
      .finally(() => setLoading(false));
  }, [serial]);

  const wa = data?.support?.whatsapp || '919999036254';
  const genuine = data?.genuine;
  const w = data?.warranty;

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Arial, sans-serif', padding: '0 16px' }}>
      <div style={{ background: '#0a0a0a', color: '#fff', width: '100%', textAlign: 'center', padding: '18px 0', fontSize: 22, fontWeight: 'bold', letterSpacing: 0.5 }}>MuscleGrid</div>

      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,.08)', maxWidth: 420, width: '100%', marginTop: 22, padding: 24, textAlign: 'center' }}>
        {loading ? (
          <div style={{ color: '#888', padding: 40 }}>Verifying…</div>
        ) : genuine ? (
          <>
            <div style={{ fontSize: 54, lineHeight: 1 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#0b7d3e', marginTop: 8 }}>Genuine MuscleGrid Product</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>This serial is verified in our records.</div>

            <div style={{ textAlign: 'left', marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <Row label="Product" value={data.product} />
              <Row label="Serial No." value={<span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{data.serial}</span>} />
              {data.mfg_date && <Row label="Manufactured" value={data.mfg_date} />}
              <Row label="Warranty" value={
                w?.registered
                  ? <span style={{ color: w.active === false ? '#c0392b' : '#0b7d3e', fontWeight: 'bold' }}>
                      {w.active === false ? 'Expired' : 'Active'}{w.valid_till ? ` · till ${w.valid_till}` : ''}
                    </span>
                  : <span style={{ color: '#b26a00' }}>Not registered yet</span>
              } />
            </div>

            {!w?.registered && (
              <a href={`/warranty/${encodeURIComponent(data.serial)}`} style={btn('#0b7d3e')}>Register your warranty →</a>
            )}
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi, I need help with my MuscleGrid product. Serial: ' + data.serial)}`} style={btn('#111', true)}>💬 Get support on WhatsApp</a>
          </>
        ) : (
          <>
            <div style={{ fontSize: 54, lineHeight: 1 }}>⚠️</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#c0392b', marginTop: 8 }}>Could not verify this serial</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
              Serial <b style={{ fontFamily: 'monospace' }}>{serial}</b> is not in our records. It may be mistyped, or the product may not be genuine.
              Please contact us to confirm.
            </div>
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi, please verify my MuscleGrid product serial: ' + serial)}`} style={btn('#111', true)}>💬 Contact MuscleGrid</a>
          </>
        )}
      </div>

      <div style={{ color: '#aaa', fontSize: 11, marginTop: 20, textAlign: 'center', paddingBottom: 24 }}>
        service@musclegrid.in · Powered by MuscleGrid
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
    <span style={{ color: '#999' }}>{label}</span>
    <span style={{ color: '#222', textAlign: 'right', maxWidth: '65%' }}>{value}</span>
  </div>
);

const btn = (bg, mt) => ({
  display: 'block', background: bg, color: '#fff', textDecoration: 'none', borderRadius: 10,
  padding: '13px 0', fontWeight: 'bold', fontSize: 15, marginTop: mt ? 10 : 20,
});
