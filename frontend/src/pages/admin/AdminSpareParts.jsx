import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Wrench, Loader2, Plus, Search, Filter, Package, IndianRupee, AlertTriangle,
  Edit2, ImageIcon, RefreshCw, ArrowUp, ArrowDown, Save, X,
} from 'lucide-react';

const CATEGORY_LABELS = {
  pcb: 'PCB', battery_post: 'Battery Post', fan: 'Fan', fuse: 'Fuse', mosfet: 'MOSFET',
  transformer: 'Transformer', capacitor: 'Capacitor', relay: 'Relay', display: 'Display',
  cable: 'Cable', casing: 'Casing', accessory: 'Accessory', other: 'Other',
};

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

  return (
    <DashboardLayout title="Spare Parts Catalog">
      <div className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Wrench} label="Total Spares" value={stats.total} tone="text-primary bg-primary/15" />
          <StatCard icon={Package} label="Active" value={stats.active} tone="text-emerald-400 bg-emerald-500/15" />
          <StatCard icon={AlertTriangle} label="Low Stock" value={stats.low_stock} tone="text-amber-400 bg-amber-400/15" />
          <StatCard icon={AlertTriangle} label="Out of Stock" value={stats.out_of_stock} tone="text-rose-400 bg-rose-500/15" />
        </div>

        {/* Filters + add */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or part code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
                  Active only
                </label>
                <Button size="sm" variant="outline" onClick={fetchParts} className="border-border">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
                </Button>
                <Button onClick={() => setEditPart({})} className="bg-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Spare
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>All</FilterChip>
              {categories.map(c => (
                <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
                  {CATEGORY_LABELS[c] || c}
                </FilterChip>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spares grid */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              {loading ? 'Loading…' : `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading && parts.length === 0 ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : parts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-foreground mb-1">No spare parts in the catalog yet</p>
                <p className="text-sm">Add PCBs, fans, MOSFETs, fuses — anything dealers will need for service.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {parts.map(p => (
                  <SparePartCard
                    key={p.id}
                    part={p}
                    onEdit={() => setEditPart(p)}
                    onAdjustStock={() => setStockEdit({ part: p, delta: 0 })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="mg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${tone}`}><Icon className="w-5 h-5" /></div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold text-foreground">{value || 0}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
        ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
      {children}
    </button>
  );
}

function SparePartCard({ part, onEdit, onAdjustStock }) {
  const lowStock = (part.stock_qty || 0) <= (part.low_stock_threshold || 5);
  const outOfStock = (part.stock_qty || 0) === 0;
  return (
    <div className="border border-border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors p-3">
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {part.image_url ? (
            <img src={part.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-foreground text-sm truncate">{part.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{part.part_code}</div>
            </div>
            {!part.is_active && (
              <Badge className="bg-muted text-muted-foreground font-mono text-[9px] uppercase">Inactive</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 font-mono text-[10px] uppercase">
              {CATEGORY_LABELS[part.category] || part.category}
            </Badge>
            <span className="text-sm text-foreground flex items-center font-semibold">
              <IndianRupee className="w-3 h-3" />{Number(part.dealer_price || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Badge className={outOfStock
            ? 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25 font-mono text-[10px] uppercase'
            : lowStock
              ? 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25 font-mono text-[10px] uppercase'
              : 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[10px] uppercase'}>
            {outOfStock ? 'OUT OF STOCK' : lowStock ? 'LOW STOCK' : 'IN STOCK'}
          </Badge>
          <span className="font-mono text-foreground">{part.stock_qty || 0} units</span>
        </div>
        <div className="flex gap-1">
          <button onClick={onAdjustStock} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Adjust stock">
            <Package className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
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
      <DialogContent className="bg-popover border border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" /> {isNew ? 'Add Spare Part' : `Edit ${part.part_code}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Name *" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} />
          <Field label="Part Code *" value={form.part_code} onChange={(v) => setForm(f => ({ ...f, part_code: v }))} mono disabled={!isNew} />
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Category *</label>
            <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                  <SelectItem key={id} value={id} className="text-foreground">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      className="mt-1 bg-background border-border text-foreground min-h-[60px]" />
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
                     className="mt-1 bg-background border-border text-foreground file:text-primary file:bg-primary/10 file:border-0 file:mr-3 file:rounded-md file:px-3 file:py-1.5" />
            </div>
          )}
          {!isNew && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              Active (visible to dealers)
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-primary text-primary-foreground">
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
      <DialogContent className="bg-popover border border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Adjust Stock — {edit.part.part_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-foreground bg-muted/30 border border-border rounded-md p-3">
            Current stock: <span className="font-mono font-semibold">{edit.part.stock_qty}</span> units
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Adjustment</label>
            <div className="flex items-center gap-2 mt-1">
              <Button size="sm" variant="outline" onClick={() => setDelta((d) => parseInt(d || 0) - 1)} className="border-border">
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Input type="number" value={delta} onChange={(e) => setDelta(e.target.value)}
                     className="bg-background border-border text-foreground font-mono text-center" />
              <Button size="sm" variant="outline" onClick={() => setDelta((d) => parseInt(d || 0) + 1)} className="border-border">
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
                   className="mt-1 bg-background border-border text-foreground" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-primary text-primary-foreground">
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
             className={`mt-1 bg-background border-border text-foreground ${mono ? 'font-mono' : ''} ${disabled ? 'opacity-60' : ''}`} />
    </div>
  );
}
