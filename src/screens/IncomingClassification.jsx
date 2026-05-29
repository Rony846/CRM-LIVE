import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Icon from '../lib/icon';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { ReadOnlyBadge } from '../components/Glass';
import { WRITE_ENABLED, READONLY_MSG } from '../lib/flags';

// LIVE classify: POST /api/incoming-queue/{id}/classify. Writes an immutable
// party_ledger entry for the inventory paths — so it's behind a confirm modal.
const TYPES = [
  { key: 'return_inventory', label: 'RETURN → INVENTORY', icon: 'check_circle', needs: ['firm', 'sku', 'qty'] },
  { key: 'repair_item', label: 'REPAIR (TICKET)', icon: 'build', needs: ['ticket'] },
  { key: 'repair_yard', label: 'REPAIR YARD', icon: 'precision_manufacturing', needs: ['firm', 'sku', 'qty', 'reason'] },
  { key: 'scrap', label: 'SCRAP / WASTE', icon: 'delete_sweep', needs: ['scrap_reason'] },
];

export default function IncomingClassification() {
  const navigate = useNavigate();
  const { id } = useParams();
  const entry = useLocation().state?.entry || null;

  const [type, setType] = useState('return_inventory');
  const [firms, setFirms] = useState([]);
  const [skus, setSkus] = useState([]);
  const [form, setForm] = useState({ firm_id: '', item_type: 'finished_good', sku_code: '', quantity: 1, reason: '', scrap_reason: '', remarks: '' });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try { const f = await api('/firms'); setFirms(Array.isArray(f) ? f : f?.firms || []); } catch { /* */ }
      try { const s = await api('/admin/skus'); setSkus(Array.isArray(s) ? s : s?.skus || []); } catch { /* */ }
    })();
  }, []);

  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));
  const meta = TYPES.find((t) => t.key === type);
  const needs = (n) => meta.needs.includes(n);

  if (!id) {
    return (
      <div className="px-margin-mobile py-stack-lg text-center text-text-secondary font-mono-data text-mono-data">
        Pick an entry to classify from the Incoming Queue.
        <div className="mt-stack-md"><button onClick={() => navigate('/accountant/inventory')} className="text-primary font-label-caps">Go to queue →</button></div>
      </div>
    );
  }

  const validate = () => {
    if (needs('ticket') && !entry?.linked_ticket_id) return 'This entry has no linked ticket, so it cannot be classified as a repair item.';
    if (needs('firm') && !form.firm_id) return 'Select a firm.';
    if (needs('sku') && !form.sku_code) return 'Select a SKU.';
    if (needs('qty') && (!form.quantity || form.quantity < 1)) return 'Enter a valid quantity.';
    if (needs('reason') && !form.reason.trim()) return 'Enter a reason.';
    if (needs('scrap_reason') && !form.scrap_reason.trim()) return 'Enter a scrap reason.';
    return '';
  };

  const openConfirm = () => {
    if (!WRITE_ENABLED) { setErr(READONLY_MSG); return; }
    const e = validate(); if (e) { setErr(e); return; } setErr(''); setConfirm(true);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    const body = { classification_type: type, remarks: form.remarks || undefined };
    if (needs('ticket')) body.ticket_id = entry.linked_ticket_id;
    if (needs('firm')) { body.firm_id = form.firm_id; body.item_type = form.item_type; body.sku_code = form.sku_code; }
    if (needs('qty')) body.quantity = Number(form.quantity);
    if (needs('reason')) body.reason = form.reason;
    if (needs('scrap_reason')) body.scrap_reason = form.scrap_reason;
    try {
      await api(`/incoming-queue/${id}/classify`, { method: 'POST', body });
      setConfirm(false); setDone(true);
      setTimeout(() => navigate('/accountant/inventory'), 1400);
    } catch (e) {
      setConfirm(false);
      setErr(e.data?.detail || e.message || 'Classification failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="px-margin-mobile flex flex-col gap-stack-lg">
      {/* Tracking header (real entry) */}
      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md">
        <div className="flex justify-between items-start mb-stack-sm">
          <div>
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">Tracking ID</span>
            <p className="font-mono-data text-headline-card text-primary">{entry?.tracking_id || id}</p>
          </div>
          <span className="bg-info/15 text-info px-2 py-1 rounded font-label-caps text-label-caps uppercase">{entry?.status || 'pending'}</span>
        </div>
        <div className="grid grid-cols-2 gap-stack-md border-t border-border-subtle pt-stack-md">
          <div className="flex items-center gap-stack-sm">
            <Icon name="local_shipping" className="text-text-secondary" />
            <div><p className="font-label-caps text-label-caps text-text-secondary">Courier</p><p className="font-body-bold text-on-surface">{entry?.courier || '—'}</p></div>
          </div>
          <div className="flex items-center gap-stack-sm">
            <Icon name="person" className="text-text-secondary" />
            <div><p className="font-label-caps text-label-caps text-text-secondary">Customer</p><p className="font-body-bold text-on-surface truncate">{entry?.customer_name || '—'}</p></div>
          </div>
        </div>
      </section>

      <section className="bg-surface-card border border-border-subtle rounded-xl p-stack-md flex flex-col gap-stack-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-card text-headline-card text-text-primary">Classification</h2>
          <ReadOnlyBadge />
        </div>

        {/* type grid (real types) */}
        <div className="grid grid-cols-2 gap-stack-sm">
          {TYPES.map((t) => {
            const active = type === t.key;
            return (
              <button key={t.key} onClick={() => setType(t.key)}
                className={`h-touch-target flex flex-col items-center justify-center rounded-lg border transition-colors active:scale-95 ${active ? 'border-success/30 bg-success/10 text-success' : 'border-border-subtle bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}`}>
                <Icon name={t.icon} />
                <span className="font-label-caps text-label-caps text-center px-1">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* dynamic fields */}
        {needs('ticket') && (
          <div className="rounded-lg border border-border-subtle bg-surface-container-lowest p-stack-md">
            <span className="font-label-caps text-label-caps text-text-secondary uppercase">Linked Ticket</span>
            <p className={`font-mono-data text-body-bold ${entry?.linked_ticket_number ? 'text-primary' : 'text-error'}`}>{entry?.linked_ticket_number || 'None — cannot classify as repair'}</p>
          </div>
        )}
        {needs('firm') && (
          <>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary ml-1">FIRM</label>
              <select value={form.firm_id} onChange={(e) => set('firm_id', e.target.value)}
                className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary">
                <option value="">Select firm…</option>
                {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-stack-md">
              <div className="flex flex-col gap-unit">
                <label className="font-label-caps text-label-caps text-text-secondary ml-1">ITEM TYPE</label>
                <select value={form.item_type} onChange={(e) => set('item_type', e.target.value)}
                  className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary">
                  <option value="finished_good">Finished good</option>
                  <option value="raw_material">Raw material</option>
                </select>
              </div>
              {needs('qty') && (
                <div className="flex flex-col gap-unit">
                  <label className="font-label-caps text-label-caps text-text-secondary ml-1">QUANTITY</label>
                  <input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                    className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface font-mono-data outline-none focus:border-primary" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-unit">
              <label className="font-label-caps text-label-caps text-text-secondary ml-1">SKU</label>
              <select value={form.sku_code} onChange={(e) => set('sku_code', e.target.value)}
                className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary">
                <option value="">Select SKU…</option>
                {skus.map((s) => <option key={s.id} value={s.sku_code}>{s.sku_code}{s.model_name ? ` — ${s.model_name}` : ''}</option>)}
              </select>
            </div>
          </>
        )}
        {needs('reason') && (
          <div className="flex flex-col gap-unit">
            <label className="font-label-caps text-label-caps text-text-secondary ml-1">REASON</label>
            <input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Repair-yard reason"
              className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary" />
          </div>
        )}
        {needs('scrap_reason') && (
          <div className="flex flex-col gap-unit">
            <label className="font-label-caps text-label-caps text-text-secondary ml-1">SCRAP REASON</label>
            <input value={form.scrap_reason} onChange={(e) => set('scrap_reason', e.target.value)} placeholder="Why is this scrap?"
              className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary" />
          </div>
        )}
        <div className="flex flex-col gap-unit">
          <label className="font-label-caps text-label-caps text-text-secondary ml-1">REMARKS (optional)</label>
          <input value={form.remarks} onChange={(e) => set('remarks', e.target.value)}
            className="h-touch-target bg-surface-container-lowest border border-border-subtle rounded-lg px-stack-md text-on-surface outline-none focus:border-primary" />
        </div>

        {err && <div className="flex items-center gap-2 text-error font-mono-data text-mono-data"><Icon name="error" style={{ fontSize: 16 }} />{err}</div>}
        {done ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-stack-md text-success">
            <Icon name="check_circle" /> Classified — updating queue…
          </div>
        ) : (
          <button onClick={openConfirm}
            className="h-touch-target bg-primary-container text-on-primary-container font-body-bold rounded-lg flex items-center justify-center gap-stack-sm active:scale-[0.98] transition-transform">
            <Icon name="fact_check" /> CONFIRM CLASSIFICATION
          </button>
        )}
      </section>

      <button onClick={() => navigate('/accountant/inventory')} className="text-on-surface-variant font-label-caps text-label-caps flex items-center gap-1 self-start">
        <Icon name="arrow_back" style={{ fontSize: 16 }} /> Back to queue
      </button>

      <Modal
        open={confirm} onClose={() => !busy && setConfirm(false)} title="Confirm classification" icon="warning"
        footer={
          <>
            <button onClick={() => setConfirm(false)} disabled={busy} className="flex-1 h-touch-target rounded-lg bg-surface-container-high text-text-primary font-body-bold disabled:opacity-50">Cancel</button>
            <button onClick={submit} disabled={busy} className="flex-1 h-touch-target rounded-lg bg-gradient-to-r from-primary-container to-inverse-primary text-on-primary-container font-body-bold disabled:opacity-50">{busy ? 'Posting…' : 'Confirm'}</button>
          </>
        }
      >
        <p className="font-body-base text-text-secondary text-sm">
          Classify <span className="text-primary font-mono-data">{entry?.tracking_id || id}</span> as <span className="text-text-primary font-bold">{meta.label}</span>.
          {(type === 'return_inventory' || type === 'repair_yard') && ' This writes a permanent (immutable) ledger entry.'}
        </p>
      </Modal>
    </div>
  );
}
