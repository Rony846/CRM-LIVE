import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../lib/icon';

// Faithful port of stitch incoming_classification_1/code.html — the disposition
// form. NOTE: the real classify call (POST /api/incoming-queue/{id}/classify)
// writes an immutable party_ledger entry (Rule 1-6). We do NOT fire it from this
// demo against production — CONFIRM shows the intent and is wired in the next pass.
const DISPOSITIONS = [
  { key: 'good_stock', label: 'GOOD INVENTORY', icon: 'check_circle' },
  { key: 'service_return', label: 'SERVICE RETURN', icon: 'assignment_return' },
  { key: 'scrap', label: 'SCRAP / WASTE', icon: 'delete_sweep' },
  { key: 'wrong_delivery', label: 'WRONG DELIVERY', icon: 'wrong_location' },
];

export default function IncomingClassification() {
  const navigate = useNavigate();
  const [disp, setDisp] = useState('good_stock');
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);

  return (
    <div className="px-margin-mobile flex flex-col gap-stack-lg">
      {/* Tracking header */}
      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md">
        <div className="flex justify-between items-start mb-stack-sm">
          <div>
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">Tracking ID</span>
            <p className="font-mono-data text-headline-card text-primary">TRK-99284-AX7</p>
          </div>
          <span className="bg-info/15 text-info px-2 py-1 rounded font-label-caps text-label-caps">PENDING REVIEW</span>
        </div>
        <div className="grid grid-cols-2 gap-stack-md border-t border-border-subtle pt-stack-md">
          <div className="flex items-center gap-stack-sm">
            <Icon name="local_shipping" className="text-text-secondary" />
            <div>
              <p className="font-label-caps text-label-caps text-text-secondary">Courier</p>
              <p className="font-body-bold text-on-surface">Delhivery Surface</p>
            </div>
          </div>
          <div className="flex items-center gap-stack-sm">
            <Icon name="calendar_today" className="text-text-secondary" />
            <div>
              <p className="font-label-caps text-label-caps text-text-secondary">Gate Scan Time</p>
              <p className="font-body-bold text-on-surface">May 29, 09:12 AM</p>
            </div>
          </div>
        </div>
      </section>

      {/* Media (placeholders for gate-scan photos) */}
      <section className="flex flex-col gap-stack-sm">
        <h2 className="font-headline-card text-headline-card text-text-primary flex items-center gap-2">
          <Icon name="photo_camera" /> Gate Scan Media
        </h2>
        <div className="flex gap-stack-md overflow-x-auto">
          {['Exterior view', 'Unloading clip'].map((cap, i) => (
            <div key={cap} className="flex-none w-56 h-72 bg-surface-container rounded-xl border border-border-subtle relative flex items-center justify-center">
              <Icon name={i ? 'play_circle' : 'image'} className="text-on-surface-variant" style={{ fontSize: 48 }} fill={!!i} />
              <div className="absolute bottom-0 inset-x-0 p-stack-sm bg-gradient-to-t from-black/80 to-transparent">
                <p className="font-label-caps text-label-caps text-white uppercase">{cap}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Classification form */}
      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md flex flex-col gap-stack-lg">
        <h2 className="font-headline-card text-headline-card text-text-primary">Classification Details</h2>
        <div className="flex flex-col gap-stack-md">
          <div className="flex flex-col gap-unit">
            <label className="font-label-caps text-label-caps text-text-secondary ml-1">SKU SELECTION</label>
            <div className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg flex items-center px-stack-md gap-stack-md">
              <Icon name="qr_code_2" className="text-text-secondary" />
              <select className="bg-transparent border-none text-on-surface w-full focus:ring-0 font-body-base outline-none">
                <option>MG-INV-2KVA Inverter</option>
                <option>MG-BAT-150AH Battery</option>
                <option>MG-STB-5KVA Stabilizer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-stack-md">
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary ml-1">QUANTITY</label>
              <input
                type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface focus:ring-2 focus:ring-primary/15 focus:border-primary font-mono-data outline-none"
              />
            </div>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary ml-1">WAREHOUSE</label>
              <select className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface focus:ring-2 focus:ring-primary/15 focus:border-primary outline-none">
                <option>Central-01</option>
                <option>North-Docks</option>
                <option>Returns-QC</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-unit">
            <label className="font-label-caps text-label-caps text-text-secondary ml-1">DISPOSITION CATEGORY</label>
            <div className="grid grid-cols-2 gap-stack-sm">
              {DISPOSITIONS.map((d) => {
                const active = disp === d.key;
                return (
                  <button
                    key={d.key} onClick={() => setDisp(d.key)}
                    className={`h-touch-target flex flex-col items-center justify-center rounded-lg border transition-colors active:scale-95 duration-200 ${
                      active ? 'border-success/30 bg-success/10 text-success' : 'border-border-subtle bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <Icon name={d.icon} />
                    <span className="font-label-caps text-label-caps">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => setDone(true)}
            className="h-touch-target mt-stack-md bg-primary-container text-on-primary-container font-body-bold rounded-lg flex items-center justify-center gap-stack-sm active:scale-[0.98] transition-transform"
          >
            <Icon name="fact_check" /> CONFIRM CLASSIFICATION
          </button>

          {done && (
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-stack-sm text-info">
              <Icon name="info" style={{ fontSize: 18 }} />
              <p className="font-mono-data text-mono-data">
                Demo: would POST classify ({disp}, qty {qty}) → immutable party_ledger entry. Live mutation is wired in the next pass (kept off against production).
              </p>
            </div>
          )}
        </div>
      </section>

      <button onClick={() => navigate('/accountant/inventory')} className="text-on-surface-variant font-label-caps text-label-caps flex items-center gap-1 self-start">
        <Icon name="arrow_back" style={{ fontSize: 16 }} /> Back to queue
      </button>
    </div>
  );
}
