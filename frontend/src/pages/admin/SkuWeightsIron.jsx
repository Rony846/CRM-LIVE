import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Scale, Loader2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSmall = { ...btnPrimary, padding: '5px 10px', fontSize: 11 };

const H = ['SKU', 'Product', 'Orders', 'Source', 'Status', 'Weight'];

export default function SkuWeights() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unresolved, setUnresolved] = useState(0);
  const [showResolved, setShowResolved] = useState(false);
  const [edit, setEdit] = useState(null); // row being edited

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/sku-weights/gaps`, { headers });
      setGaps(r.data.gaps || []);
      setUnresolved(r.data.unresolved || 0);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load SKU list');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const visible = showResolved ? gaps : gaps.filter((g) => !g.resolved);

  const headerRight = (
    <button style={btnOutline} onClick={() => setShowResolved((v) => !v)}>
      {showResolved ? 'Hide resolved' : 'Show resolved'}
    </button>
  );

  return (
    <IronShell title="SKU Weights" subtitle="SHIPPING WEIGHT OVERRIDES" onRefresh={load} headerRight={headerRight}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <IronCard>
          <p style={{ fontSize: 12.5, color: T.iron500, lineHeight: 1.5, margin: 0 }}>
            Fill the weight + box for any SKU the order bot can’t resolve. Saved here, it applies to the
            next order automatically — the bot reads this layer first.
          </p>
        </IronCard>

        <IronCard pad={0}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
            {unresolved > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T.voltageText, fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>
                <AlertTriangle size={16} /> {unresolved} SKU{unresolved === 1 ? '' : 's'} need a weight
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: T.green, fontFamily: T.headline, fontWeight: 700, fontSize: 13 }}>
                <CheckCircle2 size={16} /> All SKUs have a weight
              </span>
            )}
          </div>

          {loading && gaps.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 size={30} className="animate-spin" color={T.iron400} />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
              <CheckCircle2 size={44} style={{ margin: '0 auto 10px', opacity: 0.5, display: 'block' }} />
              <p style={{ margin: 0, fontSize: 13 }}>Nothing to fill — every SKU has a shipping weight.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {H.map((h, i) => (
                    <th key={h} style={{ ...thCell, textAlign: i === 2 || i === 5 ? 'right' : 'left' }}>
                      <Caps size={8.5}>{h}</Caps>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <tr key={g.sku} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, color: T.iron900, fontWeight: 600 }}>{g.sku}</td>
                    <td style={{ ...tdCell, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.title || ''}>
                      {g.title || '—'}
                    </td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{g.orders || 0}</td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(g.sources || []).map((s) => (
                          <span key={s} style={{ ...badgeStyle('slate'), textTransform: 'capitalize' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={tdCell}>
                      {g.resolved ? (
                        <span style={badgeStyle('ok')}>Resolved</span>
                      ) : (
                        <span style={badgeStyle('warn')}>Needs weight</span>
                      )}
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      {g.resolved && g.override ? (
                        <button
                          onClick={() => setEdit(g)}
                          style={{ ...mono, background: 'none', border: 'none', color: T.orange, cursor: 'pointer', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}
                          title="Edit weight"
                        >
                          {g.override.weight_kg} kg
                        </button>
                      ) : (
                        <button style={btnSmall} onClick={() => setEdit(g)}>
                          <Plus size={13} /> Add weight
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </IronCard>
      </div>

      <WeightDialog
        row={edit}
        headers={headers}
        onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); load(); }}
      />
    </IronShell>
  );
}

function WeightDialog({ row, headers, onClose, onSaved }) {
  const [form, setForm] = useState({ weight_kg: '', length_cm: 30, width_cm: 25, height_cm: 20 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      const o = row.override || {};
      setForm({
        weight_kg: o.weight_kg ?? '',
        length_cm: o.length_cm ?? 30,
        width_cm: o.width_cm ?? 25,
        height_cm: o.height_cm ?? 20,
      });
    }
  }, [row]);

  const save = async () => {
    const w = parseFloat(form.weight_kg);
    if (!w || w <= 0) { toast.error('Enter a weight in kg'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/admin/sku-weights`, {
        sku: row.sku,
        weight_kg: w,
        length_cm: parseInt(form.length_cm, 10) || 30,
        width_cm: parseInt(form.width_cm, 10) || 25,
        height_cm: parseInt(form.height_cm, 10) || 20,
      }, { headers });
      toast.success(`Saved ${row.sku} · ${w} kg`);
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" style={{ color: T.orange }} /> Shipping weight
          </DialogTitle>
          <DialogDescription>
            {row?.sku}{row?.title ? ` — ${row.title}` : ''}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: T.iron700 }}>Weight (kg) *</label>
              <input
                type="number" min="0" step="0.1" autoFocus
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                placeholder="e.g. 12.5"
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['length_cm', 'Length cm'], ['width_cm', 'Width cm'], ['height_cm', 'Height cm']].map(([k, label]) => (
                <div key={k}>
                  <Caps size={9} color={T.iron400}>{label}</Caps>
                  <input
                    type="number" min="1"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.iron400, margin: 0 }}>
              Box defaults are fine if you’re unsure — weight is what drives routing &amp; freight.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button style={btnOutline} onClick={onClose}>Cancel</button>
              <button style={btnPrimary} onClick={save} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Save weight
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
