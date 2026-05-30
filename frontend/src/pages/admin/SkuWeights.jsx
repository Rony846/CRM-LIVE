import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Scale, Loader2, RefreshCw, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';

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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              SKU Shipping Weights
            </h1>
            <p className="text-muted-foreground">
              Fill the weight + box for any SKU the order bot can’t resolve. Saved here, it
              applies to the next order automatically — the bot reads this layer first.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? 'Hide resolved' : 'Show resolved'}
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {unresolved > 0 ? (
                <span className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-5 w-5" /> {unresolved} SKU{unresolved === 1 ? '' : 's'} need a weight
                </span>
              ) : (
                <span className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" /> All SKUs have a weight
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && gaps.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : visible.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nothing to fill — every SKU has a shipping weight.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((g) => (
                    <TableRow key={g.sku}>
                      <TableCell className="font-mono text-sm">{g.sku}</TableCell>
                      <TableCell className="text-sm max-w-[320px] truncate" title={g.title || ''}>
                        {g.title || '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{g.orders || 0}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(g.sources || []).map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] capitalize">{s}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {g.resolved ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Resolved</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">Needs weight</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {g.resolved && g.override ? (
                          <button
                            onClick={() => setEdit(g)}
                            className="text-sm text-primary hover:underline"
                            title="Edit weight"
                          >
                            {g.override.weight_kg} kg
                          </button>
                        ) : (
                          <Button size="sm" onClick={() => setEdit(g)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add weight
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <WeightDialog
        row={edit}
        headers={headers}
        onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); load(); }}
      />
    </DashboardLayout>
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
            <Scale className="h-5 w-5 text-primary" /> Shipping weight
          </DialogTitle>
          <DialogDescription>
            {row?.sku}{row?.title ? ` — ${row.title}` : ''}
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Weight (kg) *</label>
              <Input
                type="number" min="0" step="0.1" autoFocus
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                placeholder="e.g. 12.5" className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['length_cm', 'Length cm'], ['width_cm', 'Width cm'], ['height_cm', 'Height cm']].map(([k, label]) => (
                <div key={k}>
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <Input
                    type="number" min="1"
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Box defaults are fine if you’re unsure — weight is what drives routing &amp; freight.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Save weight
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
