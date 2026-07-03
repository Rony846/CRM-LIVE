import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Wrench, Loader2, Plus, Search, Package, AlertTriangle,
  Edit2, ImageIcon, Save, ArrowUp, ArrowDown,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const CATEGORY_LABELS = {
  pcb: 'PCB', battery_post: 'Battery Post', fan: 'Fan', fuse: 'Fuse', mosfet: 'MOSFET',
  transformer: 'Transformer', capacitor: 'Capacitor', relay: 'Relay', display: 'Display',
  cable: 'Cable', casing: 'Casing', accessory: 'Accessory', other: 'Other',
};

const inr = (v) => Number(v || 0).toLocaleString('en-IN');

export default function AdminSpareParts() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [editPart, setEditPart] = useState(null);  // null | {} for new | full spare object for edit
  const [stockEdit, setStockEdit] = useState(null);  // { part, delta }

  const fetchParts = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (activeOnly) params.is_active = true;
      if (search.trim()) params.q = search.trim();
      const resp = await axios.get(`${API}/admin/spare-parts`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setParts(resp.data.parts || []);
      setCategories(resp.data.categories || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load spare parts');
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter, activeOnly, search]);

  useEffect(() => { if (token) fetchParts(); }, [token, fetchParts]);
  useEffect(() => { const t = setTimeout(fetchParts, 300); return () => clearTimeout(t); }, [search]); // eslint-disable-line

  const stats = useMemo(() => ({
    total: parts.length,
    active: parts.filter(p => p.is_active).length,
    low_stock: parts.filter(p => (p.stock_qty || 0) <= (p.low_stock_threshold || 5)).length,
    out_of_stock: parts.filter(p => (p.stock_qty || 0) === 0).length,
  }), [parts]);

  const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

  const headerRight = (
    <button onClick={() => setEditPart({})} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
      <Plus size={14} /> Add Spare
    </button>
  );

  const headers = ['PART', 'CATEGORY', 'DEALER PRICE', 'STOCK', 'STATUS', ''];

  return (
    <IronShell title="Spare Parts" subtitle={`${stats.total} SPARES · DEALER SERVICE CATALOG`} onRefresh={fetchParts} headerRight={headerRight}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Wrench} label="Total Spares" value={stats.total} accent={T.orange} />
        <StatCard icon={Package} label="Active" value={stats.active} accent={T.green} />
        <StatCard icon={AlertTriangle} label="Low Stock" value={stats.low_stock} accent={T.voltageText} />
        <StatCard icon={AlertTriangle} label="Out of Stock" value={stats.out_of_stock} accent={T.orangeDeep} />
      </div>

      {/* Filters */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or part code…" style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </div>
          <button
            onClick={() => setActiveOnly(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              border: `1px solid ${activeOnly ? T.orange : T.iron200}`, background: activeOnly ? '#FDEEE6' : T.white,
              color: activeOnly ? T.orangeDeep : T.iron700, borderRadius: 6, padding: '7px 12px',
              fontFamily: T.headline, fontWeight: 700, fontSize: 12,
            }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: activeOnly ? T.orange : T.iron400 }} />
            Active only
          </button>
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</FilterChip>
          {categories.map(c => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
              {CATEGORY_LABELS[c] || c}
            </FilterChip>
          ))}
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading && parts.length === 0 ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : parts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Wrench size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No spare parts in the catalog yet</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Add PCBs, fans, MOSFETs, fuses — anything dealers will need for service.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{parts.map((p) => {
                const qty = p.stock_qty || 0;
                const lowStock = qty <= (p.low_stock_threshold || 5);
                const outOfStock = qty === 0;
                const tone = outOfStock ? 'bad' : lowStock ? 'warn' : 'ok';
                const label = outOfStock ? 'OUT OF STOCK' : lowStock ? 'LOW STOCK' : 'IN STOCK';
                return (
                  <tr key={p.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 6, background: T.iron100, border: `1px solid ${T.iron200}`, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {p.image_url
                            ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <ImageIcon size={16} color={T.iron400} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{p.name}</div>
                          <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{p.part_code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdCell}>
                      <span style={badgeStyle('slate')}>{CATEGORY_LABELS[p.category] || p.category}</span>
                    </td>
                    <td style={tdCell}>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>₹{inr(p.dealer_price)}</span>
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <span style={badgeStyle(tone)}>{label}</span>
                        <span style={{ ...mono, fontSize: 11, color: T.iron700 }}>{qty} units</span>
                      </div>
                    </td>
                    <td style={tdCell}>
                      {p.is_active
                        ? <span style={badgeStyle('ok')}>Active</span>
                        : <span style={badgeStyle('slate')}>Inactive</span>}
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setStockEdit({ part: p, delta: 0 })} title="Adjust stock"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11, marginRight: 6 }}>
                        <Package size={13} /> Stock
                      </button>
                      <button onClick={() => setEditPart(p)} title="Edit"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                        <Edit2 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {!loading && parts.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9} color={T.iron400}>{parts.length} {parts.length === 1 ? 'part' : 'parts'}</Caps>
          </div>
        )}
      </IronCard>

      <EditSpareDialog
        part={editPart}
        token={token}
        onClose={() => setEditPart(null)}
        onSaved={() => { setEditPart(null); fetchParts(); }}
      />
      <StockAdjustDialog
        edit={stockEdit}
        token={token}
        onClose={() => setStockEdit(null)}
        onSaved={() => { setStockEdit(null); fetchParts(); }}
      />
    </IronShell>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <IronCard pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 8, background: T.iron100, display: 'grid', placeItems: 'center', color: accent, flexShrink: 0 }}>
          <Icon size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Caps size={9} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, fontWeight: 700, fontSize: 22, color: T.iron900, lineHeight: 1.1, marginTop: 2 }}>{value || 0}</div>
        </div>
      </div>
    </IronCard>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        border: `1px solid ${active ? T.orange : T.iron200}`,
        background: active ? T.orange : T.white,
        color: active ? '#fff' : T.iron700,
        borderRadius: 999, padding: '4px 12px', cursor: 'pointer',
        fontFamily: T.headline, fontWeight: 700, fontSize: 10.5, letterSpacing: '.04em', textTransform: 'uppercase',
      }}>
      {children}
    </button>
  );
}

function EditSpareDialog({ part, token, onClose, onSaved }) {
  const isNew = part && Object.keys(part).length === 0;
  const [form, setForm] = useState({
    name: '', part_code: '', category: 'pcb', description: '',
    dealer_price: 0, stock_qty: 0, low_stock_threshold: 5, warranty_months: 0,
    is_active: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!part) return;
    if (isNew) {
      setForm({
        name: '', part_code: '', category: 'pcb', description: '',
        dealer_price: 0, stock_qty: 0, low_stock_threshold: 5, warranty_months: 0,
        is_active: true,
      });
    } else {
      setForm({
        name: part.name || '', part_code: part.part_code || '', category: part.category || 'pcb',
        description: part.description || '', dealer_price: part.dealer_price || 0,
        stock_qty: part.stock_qty || 0, low_stock_threshold: part.low_stock_threshold || 5,
        warranty_months: part.warranty_months || 0, is_active: part.is_active !== false,
      });
    }
    setImageFile(null);
  }, [part, isNew]);

  if (!part) return null;

  const submit = async () => {
    if (!form.name.trim() || !form.part_code.trim()) {
      toast.error('Name and part code are required'); return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        if (imageFile) fd.append('image', imageFile);
        await axios.post(`${API}/admin/spare-parts`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Spare added');
      } else {
        const { part_code, ...rest } = form;  // part_code immutable after create
        await axios.patch(`${API}/admin/spare-parts/${part.id}`, rest, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Spare updated');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!part} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" /> {isNew ? 'Add Spare Part' : `Edit ${part.part_code}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Name *" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} />
          <Field label="Part Code *" value={form.part_code} onChange={(v) => setForm(f => ({ ...f, part_code: v }))} mono disabled={!isNew} />
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Category *</label>
            <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      className="mt-1 min-h-[60px]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dealer Price (₹) *" type="number" value={form.dealer_price} onChange={(v) => setForm(f => ({ ...f, dealer_price: parseFloat(v) || 0 }))} mono />
            <Field label="Warranty (months)" type="number" value={form.warranty_months} onChange={(v) => setForm(f => ({ ...f, warranty_months: parseInt(v) || 0 }))} mono />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={isNew ? "Initial Stock" : "Stock (use Adjust)"} type="number" value={form.stock_qty} onChange={(v) => setForm(f => ({ ...f, stock_qty: parseInt(v) || 0 }))} mono disabled={!isNew} />
            <Field label="Low-stock Threshold" type="number" value={form.low_stock_threshold} onChange={(v) => setForm(f => ({ ...f, low_stock_threshold: parseInt(v) || 0 }))} mono />
          </div>
          {isNew && (
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Image</label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                     className="mt-1 file:text-primary file:bg-primary/10 file:border-0 file:mr-3 file:rounded-md file:px-3 file:py-1.5" />
            </div>
          )}
          {!isNew && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              Active (visible to dealers)
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> {isNew ? 'Create' : 'Save'}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StockAdjustDialog({ edit, token, onClose, onSaved }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (edit) { setDelta(0); setReason(''); }
  }, [edit]);

  if (!edit) return null;

  const submit = async () => {
    if (delta === 0) { toast.error('Delta cannot be zero'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/admin/spare-parts/${edit.part.id}/adjust-stock`,
        { delta: parseInt(delta), reason: reason.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Stock adjusted');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock — {edit.part.part_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted/50 border border-border rounded-md p-3">
            Current stock: <span className="font-mono font-semibold">{edit.part.stock_qty}</span> units
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Adjustment</label>
            <div className="flex items-center gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={() => setDelta((d) => parseInt(d || 0) - 1)}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)}
                     className="font-mono text-center" />
              <Button size="sm" variant="outline" onClick={() => setDelta((d) => parseInt(d || 0) + 1)}>
                <ArrowUp className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              New stock will be: <span className="font-mono">{Math.max(0, edit.part.stock_qty + (parseInt(delta) || 0))}</span> units
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Reason</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Received from supplier / damaged in transit / cycle count"
                   className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text', mono, disabled }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
             className={`mt-1 ${mono ? 'font-mono' : ''} ${disabled ? 'opacity-60' : ''}`} />
    </div>
  );
}
