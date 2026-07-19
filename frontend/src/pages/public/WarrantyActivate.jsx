import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';

/* PUBLIC warranty activation (no login). Reached from the label QR (/warranty/:serial) or /warranty.
   - Pre-fills name/phone/product from the serial's dispatch record.
   - REQUIRES a live product photo (camera) with GPS + timestamp for every product.
   - For a battery, on success it reveals the JK-BMS app download (gated behind this activation). */

const ORANGE = '#F58220', DARK = '#0f0f10', CARD = '#18181b', LINE = '#2a2a2e', MUT = '#a1a1aa';
const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Others'];

export default function WarrantyActivate() {
  const { serial: serialParam } = useParams();
  const [serial, setSerial] = useState(serialParam || '');
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    device_type: '', product_name: '', order_id: '', invoice_date: '', invoice_amount: '',
  });
  const [prefill, setPrefill] = useState(null);
  const [photo, setPhoto] = useState(null);         // File
  const [photoUrl, setPhotoUrl] = useState('');     // preview
  const [geo, setGeo] = useState(null);             // {lat,lng,accuracy}
  const [geoState, setGeoState] = useState('idle'); // idle|asking|ok|denied
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);           // success payload
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadPrefill = useCallback((sn) => {
    if (!sn) return;
    axios.get(`${API}/public/warranty/prefill/${encodeURIComponent(sn)}`)
      .then((r) => {
        const d = r.data;
        setPrefill(d);
        if (d.found) {
          setForm((f) => ({
            ...f,
            first_name: f.first_name || d.first_name || '',
            last_name: f.last_name || d.last_name || '',
            phone: f.phone || d.phone || '',
            device_type: d.device_type || f.device_type || '',
            product_name: d.product_name || f.product_name || '',
            order_id: d.order_id || f.order_id || '',
          }));
        }
      })
      .catch(() => setPrefill({ found: false }));
  }, []);

  useEffect(() => { if (serialParam) loadPrefill(serialParam); }, [serialParam, loadPrefill]);

  // Ask for location as soon as the page opens (best-effort; denial is allowed).
  const captureGeo = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoState('denied'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGeoState('ok'); },
      () => { setGeoState('denied'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);
  useEffect(() => { captureGeo(); }, [captureGeo]);

  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoUrl(URL.createObjectURL(f));
    if (geoState === 'idle' || geoState === 'denied') captureGeo();  // retry geo when they take the photo
  };

  const submit = async () => {
    setErr('');
    const sn = (serial || '').trim();
    if (!sn) return setErr('Please enter the product serial number.');
    if (!form.first_name.trim()) return setErr('Please enter your name.');
    if (!/\d{10}/.test((form.phone || '').replace(/\D/g, ''))) return setErr('Please enter a valid 10-digit phone number.');
    if (!form.device_type) return setErr('Please select the product type.');
    if (!photo) return setErr('A photo of your product is required to activate the warranty.');

    const fd = new FormData();
    fd.append('serial_number', sn);
    fd.append('first_name', form.first_name);
    fd.append('last_name', form.last_name || '');
    fd.append('phone', form.phone);
    fd.append('email', form.email || '');
    fd.append('device_type', form.device_type);
    fd.append('product_name', form.product_name || '');
    fd.append('order_id', form.order_id || '');
    if (form.invoice_date) fd.append('invoice_date', form.invoice_date);
    if (form.invoice_amount) fd.append('invoice_amount', form.invoice_amount);
    fd.append('product_photo', photo, photo.name || `${sn}.jpg`);
    if (geo) { fd.append('geo_lat', geo.lat); fd.append('geo_lng', geo.lng); if (geo.accuracy != null) fd.append('geo_accuracy', geo.accuracy); }
    fd.append('captured_at', new Date().toISOString());
    fd.append('location_denied', geoState === 'denied' ? 'true' : 'false');

    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/public/warranty/register`, fd);
      setDone(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Could not activate the warranty. Please try again.');
    } finally { setSubmitting(false); }
  };

  // ---------- success ----------
  if (done) {
    return (
      <Shell>
        <div style={{ fontSize: 52 }}>✅</div>
        <h1 style={{ fontSize: 22, margin: '10px 0 4px' }}>Warranty activated!</h1>
        <p style={{ color: MUT, fontSize: 14, margin: '0 0 6px' }}>
          Warranty no. <b style={{ color: '#fff', fontFamily: 'monospace' }}>{done.warranty_number}</b>
        </p>
        {done.bonus_months > 0 && (
          <div style={{ background: '#14321f', color: '#7ee2a8', border: '1px solid #1f5133', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, margin: '10px 0' }}>
            🎉 You’ve earned <b>+{done.bonus_months} months</b> extra warranty for registering.
          </div>
        )}
        {done.is_battery && done.app_unlock_url ? (
          <>
            <p style={{ color: '#c7c7cc', fontSize: 13.5, lineHeight: 1.55, margin: '14px 0 10px' }}>
              Your battery app is now unlocked. Install it to monitor & control your battery over Bluetooth.
            </p>
            <a href={done.app_unlock_url} style={btn(ORANGE)}>📲 Unlock & download the Battery App</a>
          </>
        ) : (
          <p style={{ color: MUT, fontSize: 13, marginTop: 14 }}>We’ll review & confirm your warranty shortly. Keep your invoice handy.</p>
        )}
        <a href="https://wa.me/919999036254" style={btn('#111', true)}>💬 Need help? WhatsApp us</a>
      </Shell>
    );
  }

  const already = prefill?.already_registered;

  // ---------- form ----------
  return (
    <Shell>
      <div style={{ fontWeight: 800, fontSize: 22 }}>Register your warranty</div>
      <p style={{ color: MUT, fontSize: 13.5, margin: '6px 0 16px' }}>Activate protection & unlock your product app in under a minute.</p>

      {already && (
        <div style={{ background: '#2a2410', color: '#e8c766', border: '1px solid #4a3f16', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
          This product is already registered ({prefill.warranty_number}). You don’t need to register again.
        </div>
      )}

      <Field label="Serial number">
        <input value={serial} onChange={(e) => setSerial(e.target.value)} onBlur={(e) => loadPrefill(e.target.value.trim())}
          placeholder="e.g. MGLIB2607…" style={inp} readOnly={!!serialParam} />
      </Field>
      {prefill?.found && prefill?.product_name && (
        <div style={{ color: '#8ad2ff', fontSize: 12.5, margin: '-6px 0 10px' }}>✓ {prefill.product_name}</div>
      )}

      <Row>
        <Field label="First name"><input value={form.first_name} onChange={set('first_name')} style={inp} /></Field>
        <Field label="Last name"><input value={form.last_name} onChange={set('last_name')} style={inp} /></Field>
      </Row>
      <Row>
        <Field label="Phone"><input value={form.phone} onChange={set('phone')} inputMode="numeric" style={inp} /></Field>
        <Field label="Email (optional)"><input value={form.email} onChange={set('email')} style={inp} /></Field>
      </Row>
      <Field label="Product type">
        <select value={form.device_type} onChange={set('device_type')} style={inp}>
          <option value="">Select…</option>
          {DEVICE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>

      {/* Mandatory geo-tagged product photo */}
      <div style={{ border: `1px dashed ${photo ? '#1f5133' : LINE}`, borderRadius: 12, padding: 14, margin: '6px 0 4px', background: '#141416' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📸 Photo of your product <span style={{ color: ORANGE }}>*</span></div>
        <div style={{ color: MUT, fontSize: 12, margin: '4px 0 10px' }}>Required to activate. Please click a clear photo of the installed product.</div>
        {photoUrl && <img src={photoUrl} alt="product" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
        <button type="button" onClick={() => fileRef.current?.click()} style={btn('#26262b')}>
          {photo ? 'Retake photo' : '📷 Take / choose photo'}
        </button>
        <div style={{ fontSize: 11.5, marginTop: 8, color: geoState === 'ok' ? '#7ee2a8' : geoState === 'denied' ? '#e8a06a' : MUT }}>
          {geoState === 'ok' && `📍 Location captured (±${Math.round(geo?.accuracy || 0)}m)`}
          {geoState === 'asking' && '📍 Getting your location…'}
          {geoState === 'denied' && '📍 Location off — that’s okay, we’ll record the time only.'}
          {geoState === 'idle' && '📍 Location will be captured with your photo.'}
        </div>
      </div>

      {err && <div style={{ color: '#ff8a8a', fontSize: 13, margin: '10px 0' }}>{err}</div>}

      <button type="button" onClick={submit} disabled={submitting || already} style={btn(already ? '#3a3a3f' : ORANGE, true)}>
        {submitting ? 'Activating…' : 'Activate warranty'}
      </button>
      <div style={{ color: '#71717a', fontSize: 11, marginTop: 14, textAlign: 'center' }}>service@musclegrid.in · Powered by MuscleGrid</div>
    </Shell>
  );
}

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: DARK, color: '#f4f4f5', fontFamily: '-apple-system,Segoe UI,Roboto,Inter,sans-serif', display: 'flex', justifyContent: 'center', padding: '22px 16px' }}>
    <div style={{ maxWidth: 440, width: '100%' }}>
      <div style={{ fontWeight: 800, fontSize: 20, textAlign: 'center', marginBottom: 14 }}>Muscle<span style={{ color: ORANGE }}>Grid</span></div>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 22 }}>{children}</div>
    </div>
  </div>
);
const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginBottom: 12 }}>
    <div style={{ fontSize: 11.5, color: MUT, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    {children}
  </label>
);
const Row = ({ children }) => <div style={{ display: 'flex', gap: 10 }}>{React.Children.map(children, (c) => <div style={{ flex: 1 }}>{c}</div>)}</div>;
const inp = { width: '100%', background: '#0f0f10', border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 12px', color: '#f4f4f5', fontSize: 14.5, outline: 'none' };
const btn = (bg, mt) => ({ display: 'block', width: '100%', background: bg, color: '#fff', border: 'none', textDecoration: 'none', textAlign: 'center', borderRadius: 12, padding: '14px 0', fontWeight: 800, fontSize: 15.5, marginTop: mt ? 12 : 0, cursor: 'pointer' });
