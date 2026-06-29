import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Send, Loader2, Package, IndianRupee, Percent } from 'lucide-react';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (v) => parseFloat(v) || 0;

const EMPTY = {
  date: new Date().toISOString().split('T')[0],
  supplier_name: '',
  supplier_payment_inr: '',
  customs_bcd: '', customs_surcharge: '', customs_igst: '',
  shipping_charges: '',
  commission_percent: 5,
  boe_number: '',
  notes: '',
  line_items: [{ description: '', quantity: 1 }],
};

export default function ImporterPortal() {
  const { token } = useAuth();
  const [consignments, setConsignments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const h = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    try {
      const r = await axios.get(`${API}/importer/consignments`, h);
      setConsignments(r.data.consignments || []);
      setSummary(r.data.summary || null);
    } catch (e) { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchData(); }, [token]);

  // live landed-cost + commission + total (mirrors the backend, commission on FULL landed cost)
  const calc = useMemo(() => {
    const customs = num(form.customs_bcd) + num(form.customs_surcharge) + num(form.customs_igst);
    const landed = num(form.supplier_payment_inr) + customs + num(form.shipping_charges);
    const commission = landed * num(form.commission_percent) / 100;
    return { customs, landed, commission, total: landed + commission };
  }, [form]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => {
    const li = [...f.line_items]; li[i] = { ...li[i], [k]: v }; return { ...f, line_items: li };
  });
  const addItem = () => setForm(f => ({ ...f, line_items: [...f.line_items, { description: '', quantity: 1 }] }));
  const delItem = (i) => setForm(f => ({ ...f, line_items: f.line_items.filter((_, x) => x !== i) }));

  const payload = () => ({
    date: form.date, supplier_name: form.supplier_name,
    supplier_payment_inr: num(form.supplier_payment_inr),
    customs_bcd: num(form.customs_bcd), customs_surcharge: num(form.customs_surcharge),
    customs_igst: num(form.customs_igst), shipping_charges: num(form.shipping_charges),
    commission_percent: num(form.commission_percent), boe_number: form.boe_number, notes: form.notes,
    line_items: form.line_items.filter(li => (li.description || '').trim())
      .map(li => ({ description: li.description, quantity: num(li.quantity) || 1 })),
  });

  const saveDraft = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/importer/consignments`, payload(), h);
      toast.success('Consignment draft saved');
      setForm(EMPTY); fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); } finally { setSaving(false); }
  };

  const saveAndBill = async () => {
    setSaving(true);
    try {
      const r = await axios.post(`${API}/importer/consignments`, payload(), h);
      const sr = await axios.post(`${API}/importer/consignments/${r.data.id}/submit`, {}, h);
      toast.success(`Billed to MGIPL: ${sr.data.purchase_number} (${fmt(sr.data.total_billed)})`);
      setForm(EMPTY); fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Billing failed'); } finally { setSaving(false); }
  };

  const billExisting = async (cid) => {
    try {
      const sr = await axios.post(`${API}/importer/consignments/${cid}/submit`, {}, h);
      toast.success(`Billed: ${sr.data.purchase_number}`); fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <DashboardLayout title="Importer Portal">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Consignments</p>
            <p className="text-2xl font-bold">{summary?.count || 0}</p></div><Package className="w-7 h-7 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Total Billed to MGIPL</p>
            <p className="text-2xl font-bold text-emerald-500">{fmt(summary?.total_billed)}</p></div><IndianRupee className="w-7 h-7 text-emerald-500" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Total Commission</p>
            <p className="text-2xl font-bold text-amber-500">{fmt(summary?.total_commission)}</p></div><Percent className="w-7 h-7 text-amber-500" /></div></CardContent></Card>
        </div>

        {/* New consignment */}
        <Card>
          <CardHeader>
            <CardTitle>New Import Consignment</CardTitle>
            <CardDescription>Enter exactly what your bank paid + Bill-of-Entry customs duty + shipping. Commission ({form.commission_percent || 0}%) applies on the full landed cost. Everything is transparent to MGIPL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
              <div><Label>Supplier</Label><Input value={form.supplier_name} onChange={e => setField('supplier_name', e.target.value)} placeholder="Supplier paid from your bank" /></div>
              <div><Label>Bill of Entry No. (optional)</Label><Input value={form.boe_number} onChange={e => setField('boe_number', e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><Label>Supplier Payment (₹) — bank debit</Label><Input type="number" value={form.supplier_payment_inr} onChange={e => setField('supplier_payment_inr', e.target.value)} /></div>
              <div><Label>Customs — BCD (₹)</Label><Input type="number" value={form.customs_bcd} onChange={e => setField('customs_bcd', e.target.value)} /></div>
              <div><Label>Customs — Surcharge (₹)</Label><Input type="number" value={form.customs_surcharge} onChange={e => setField('customs_surcharge', e.target.value)} /></div>
              <div><Label>Customs — IGST (₹)</Label><Input type="number" value={form.customs_igst} onChange={e => setField('customs_igst', e.target.value)} /></div>
              <div><Label>Shipping (₹)</Label><Input type="number" value={form.shipping_charges} onChange={e => setField('shipping_charges', e.target.value)} /></div>
              <div><Label>Commission %</Label><Input type="number" value={form.commission_percent} onChange={e => setField('commission_percent', e.target.value)} /></div>
            </div>

            {/* Line items */}
            <div>
              <Label>Items (SKD / SKU + quantity)</Label>
              <div className="space-y-2 mt-1">
                {form.line_items.map((li, i) => (
                  <div key={i} className="flex gap-2">
                    <Input className="flex-1" placeholder='e.g. "SKD 6.2kW"' value={li.description} onChange={e => setItem(i, 'description', e.target.value)} />
                    <Input className="w-28" type="number" placeholder="Qty" value={li.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                    <Button variant="outline" size="icon" onClick={() => delItem(i)} className="text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add item</Button>
              </div>
            </div>

            {/* Live reconciliation */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Supplier payment</span><span>{fmt(num(form.supplier_payment_inr))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Customs duty (BCD + surcharge + IGST)</span><span>{fmt(calc.customs)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{fmt(num(form.shipping_charges))}</span></div>
              <div className="flex justify-between font-medium border-t border-border pt-1.5"><span>Landed cost</span><span>{fmt(calc.landed)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Commission ({form.commission_percent || 0}% of landed)</span><span className="text-amber-500">{fmt(calc.commission)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-1.5"><span>Total billed to MGIPL</span><span className="text-emerald-500">{fmt(calc.total)}</span></div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={saveDraft} disabled={saving || !calc.total}>Save draft</Button>
              <Button onClick={saveAndBill} disabled={saving || !calc.total} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Save &amp; Bill MGIPL
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Consignment history / reconciliation */}
        <Card>
          <CardHeader><CardTitle>My Consignments</CardTitle>
            <CardDescription>Full reconciliation — what you paid, your commission, and what MGIPL is billed.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              consignments.length === 0 ? <p className="text-muted-foreground text-sm">No consignments yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Consignment</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Supplier ₹</TableHead><TableHead className="text-right">Customs ₹</TableHead>
                  <TableHead className="text-right">Shipping ₹</TableHead><TableHead className="text-right">Landed ₹</TableHead>
                  <TableHead className="text-right">Comm.</TableHead><TableHead className="text-right">Billed ₹</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {consignments.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.consignment_number}</TableCell>
                      <TableCell className="text-xs">{c.date}</TableCell>
                      <TableCell className="text-xs">{c.supplier_name || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(c.supplier_payment_inr)}</TableCell>
                      <TableCell className="text-right">{fmt(c.customs_total)}</TableCell>
                      <TableCell className="text-right">{fmt(c.shipping_charges)}</TableCell>
                      <TableCell className="text-right">{fmt(c.landed_cost)}</TableCell>
                      <TableCell className="text-right text-amber-500">{c.commission_percent}% · {fmt(c.commission_amount)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{fmt(c.total_billed)}</TableCell>
                      <TableCell><Badge variant="outline" className={c.status === 'draft' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}>{c.status}</Badge></TableCell>
                      <TableCell>{c.status === 'draft' && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => billExisting(c.id)}>Bill</Button>
                      )}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
