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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Send, Loader2, Package, IndianRupee, Percent, Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (v) => parseFloat(v) || 0;

const today = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  date: today(),
  supplier_name: '',
  invoice_number: '',
  supplier_payments: [{ amount: '', type: 'advance', percent: '', date: today(), reference: '' }],
  customs_bcd: '', customs_surcharge: '', customs_igst: '',
  shipping_charges: '',
  expenses: [],
  commission_percent: 5,
  boe_number: '',
  notes: '',
  line_items: [{ description: '', quantity: 1 }],
  attachments: [],
};

const EXPENSE_CATS = [
  { value: 'courier', label: 'Courier' },
  { value: 'clearing', label: 'Clearing agent' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

const PAY_TYPES = [
  { value: 'advance', label: 'Advance' },
  { value: 'balance', label: 'Balance (post-BoE)' },
  { value: 'other', label: 'Other' },
];

const DOC_KINDS = [
  { kind: 'boe', label: 'Bill of Entry', required: true },
  { kind: 'bank_proof', label: 'Bank Payment Proof', required: false },
  { kind: 'supplier_invoice', label: 'Supplier Invoice', required: false },
];

export default function ImporterPortal() {
  const { token } = useAuth();
  const [consignments, setConsignments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);   // kind currently uploading

  const h = { headers: { Authorization: `Bearer ${token}` } };

  const hasBoe = (form.attachments || []).some(a => a.kind === 'boe');

  const uploadDoc = async (kind, fileObj) => {
    if (!fileObj) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', fileObj);
      const r = await axios.post(`${API}/importer/upload`, fd,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, attachments: [...(f.attachments || []), r.data] }));
      toast.success(`${r.data.name} uploaded`);
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(null); }
  };

  const removeDoc = (i) => setForm(f => ({ ...f, attachments: f.attachments.filter((_, x) => x !== i) }));

  const boeAtt = (c) => (c.attachments || []).find(a => a.kind === 'boe');

  const fetchData = async () => {
    try {
      const r = await axios.get(`${API}/importer/consignments`, h);
      setConsignments(r.data.consignments || []);
      setSummary(r.data.summary || null);
    } catch (e) { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchData(); }, [token]);

  // live landed-cost + commission + total (mirrors the backend, commission on FULL landed cost)
  const supplierTotal = useMemo(
    () => (form.supplier_payments || []).reduce((s, p) => s + num(p.amount), 0), [form.supplier_payments]);
  const expensesTotal = useMemo(
    () => (form.expenses || []).reduce((s, e) => s + num(e.amount), 0), [form.expenses]);
  const calc = useMemo(() => {
    const customs = num(form.customs_bcd) + num(form.customs_surcharge) + num(form.customs_igst);
    const landed = supplierTotal + customs + num(form.shipping_charges) + expensesTotal;
    const commission = landed * num(form.commission_percent) / 100;
    return { customs, landed, commission, total: landed + commission };
  }, [form, supplierTotal, expensesTotal]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => {
    const li = [...f.line_items]; li[i] = { ...li[i], [k]: v }; return { ...f, line_items: li };
  });
  const addItem = () => setForm(f => ({ ...f, line_items: [...f.line_items, { description: '', quantity: 1 }] }));
  const delItem = (i) => setForm(f => ({ ...f, line_items: f.line_items.filter((_, x) => x !== i) }));

  const setPay = (i, k, v) => setForm(f => {
    const sp = [...f.supplier_payments]; sp[i] = { ...sp[i], [k]: v }; return { ...f, supplier_payments: sp };
  });
  const addPay = () => setForm(f => ({ ...f, supplier_payments: [...f.supplier_payments, { amount: '', type: 'balance', percent: '', date: today(), reference: '' }] }));
  const delPay = (i) => setForm(f => ({ ...f, supplier_payments: f.supplier_payments.filter((_, x) => x !== i) }));

  const setExp = (i, k, v) => setForm(f => {
    const ex = [...f.expenses]; ex[i] = { ...ex[i], [k]: v }; return { ...f, expenses: ex };
  });
  const addExp = () => setForm(f => ({ ...f, expenses: [...f.expenses, { description: '', amount: '', category: 'courier' }] }));
  const delExp = (i) => setForm(f => ({ ...f, expenses: f.expenses.filter((_, x) => x !== i) }));

  const payload = () => ({
    date: form.date, supplier_name: form.supplier_name, invoice_number: form.invoice_number,
    supplier_payments: (form.supplier_payments || []).filter(p => num(p.amount) > 0).map(p => ({
      amount: num(p.amount), type: p.type || 'other', percent: num(p.percent) || null,
      date: p.date || null, reference: p.reference || null,
    })),
    expenses: (form.expenses || []).filter(e => num(e.amount) > 0 || (e.description || '').trim()).map(e => ({
      description: e.description || (EXPENSE_CATS.find(c => c.value === e.category)?.label || 'Expense'),
      amount: num(e.amount), category: e.category || 'other',
    })),
    customs_bcd: num(form.customs_bcd), customs_surcharge: num(form.customs_surcharge),
    customs_igst: num(form.customs_igst), shipping_charges: num(form.shipping_charges),
    commission_percent: num(form.commission_percent), boe_number: form.boe_number, notes: form.notes,
    attachments: form.attachments || [],
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
    if (!(form.invoice_number || '').trim()) { toast.error('Enter the supplier invoice number before billing MGIPL'); return; }
    if (!hasBoe) { toast.error('Upload the Bill of Entry before billing MGIPL'); return; }
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setField('date', e.target.value)} /></div>
              <div><Label>Supplier</Label><Input value={form.supplier_name} onChange={e => setField('supplier_name', e.target.value)} placeholder="Supplier paid from your bank" /></div>
              <div><Label>Supplier Invoice No. <span className="text-rose-400">*</span></Label><Input value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} placeholder="Bill is raised against this" /></div>
              <div><Label>Bill of Entry No. (optional)</Label><Input value={form.boe_number} onChange={e => setField('boe_number', e.target.value)} /></div>
            </div>

            {/* Supplier payments — supports staged payments e.g. 30% advance + 70% post-BoE */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Supplier Payments — bank debits</Label>
                <span className="text-xs text-muted-foreground">Total paid to supplier: <span className="font-semibold text-foreground">{fmt(supplierTotal)}</span></span>
              </div>
              <div className="space-y-2 mt-1">
                {form.supplier_payments.map((p, i) => (
                  <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-3"><Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
                      <Input type="number" value={p.amount} onChange={e => setPay(i, 'amount', e.target.value)} /></div>
                    <div className="md:col-span-3"><Label className="text-[11px] text-muted-foreground">Type</Label>
                      <Select value={p.type} onValueChange={v => setPay(i, 'type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div className="md:col-span-2"><Label className="text-[11px] text-muted-foreground">%</Label>
                      <Input type="number" placeholder="e.g. 30" value={p.percent} onChange={e => setPay(i, 'percent', e.target.value)} /></div>
                    <div className="md:col-span-2"><Label className="text-[11px] text-muted-foreground">Date</Label>
                      <Input type="date" value={p.date} onChange={e => setPay(i, 'date', e.target.value)} /></div>
                    <div className="md:col-span-2 flex gap-1">
                      <Input placeholder="UTR/ref" value={p.reference} onChange={e => setPay(i, 'reference', e.target.value)} />
                      {form.supplier_payments.length > 1 && (
                        <Button variant="outline" size="icon" onClick={() => delPay(i)} className="text-rose-400 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addPay}><Plus className="w-4 h-4 mr-1" /> Add payment (e.g. post-BoE balance)</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div><Label>Customs — BCD (₹)</Label><Input type="number" value={form.customs_bcd} onChange={e => setField('customs_bcd', e.target.value)} /></div>
              <div><Label>Customs — Surcharge (₹)</Label><Input type="number" value={form.customs_surcharge} onChange={e => setField('customs_surcharge', e.target.value)} /></div>
              <div><Label>Customs — IGST (₹)</Label><Input type="number" value={form.customs_igst} onChange={e => setField('customs_igst', e.target.value)} /></div>
              <div><Label>Shipping (₹)</Label><Input type="number" value={form.shipping_charges} onChange={e => setField('shipping_charges', e.target.value)} /></div>
              <div><Label>Commission %</Label><Input type="number" value={form.commission_percent} onChange={e => setField('commission_percent', e.target.value)} /></div>
            </div>

            {/* Other expenses — courier, clearing agent, transport, etc. (roll into landed cost) */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Other Expenses — courier & misc</Label>
                <span className="text-xs text-muted-foreground">Total: <span className="font-semibold text-foreground">{fmt(expensesTotal)}</span></span>
              </div>
              <div className="space-y-2 mt-1">
                {(form.expenses || []).map((e, i) => (
                  <div key={i} className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-3"><Label className="text-[11px] text-muted-foreground">Category</Label>
                      <Select value={e.category} onValueChange={v => setExp(i, 'category', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div className="md:col-span-6"><Label className="text-[11px] text-muted-foreground">Description</Label>
                      <Input placeholder="e.g. Courier — DHL AWB 12345" value={e.description} onChange={ev => setExp(i, 'description', ev.target.value)} /></div>
                    <div className="md:col-span-2"><Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
                      <Input type="number" value={e.amount} onChange={ev => setExp(i, 'amount', ev.target.value)} /></div>
                    <div className="md:col-span-1">
                      <Button variant="outline" size="icon" onClick={() => delExp(i)} className="text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addExp}><Plus className="w-4 h-4 mr-1" /> Add expense (courier, clearing, transport…)</Button>
              </div>
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

            {/* Documents */}
            <div>
              <Label>Documents <span className="text-rose-400">— Bill of Entry required to bill</span></Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
                {DOC_KINDS.map(d => {
                  const done = (form.attachments || []).some(a => a.kind === d.kind);
                  return (
                    <label key={d.kind} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors ${done ? 'border-emerald-500/40 bg-emerald-500/5' : d.required ? 'border-rose-500/40 bg-rose-500/5' : 'border-border bg-muted/30'}`}>
                      {uploading === d.kind ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> :
                        done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> :
                        d.required ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> : <Upload className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1 truncate">{d.label}{d.required && !done ? ' *' : ''}</span>
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                        disabled={!!uploading}
                        onChange={e => { uploadDoc(d.kind, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  );
                })}
              </div>
              {(form.attachments || []).length > 0 && (
                <div className="mt-2 space-y-1">
                  {form.attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-medium text-foreground">{DOC_KINDS.find(d => d.kind === a.kind)?.label || a.kind}:</span>
                      <span className="truncate flex-1">{a.name}</span>
                      <button type="button" onClick={() => removeDoc(i)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live reconciliation */}
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Supplier payment{(form.supplier_payments || []).filter(p => num(p.amount) > 0).length > 1 ? ` (${(form.supplier_payments || []).filter(p => num(p.amount) > 0).length} payments)` : ''}</span><span>{fmt(supplierTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Customs duty (BCD + surcharge + IGST)</span><span>{fmt(calc.customs)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{fmt(num(form.shipping_charges))}</span></div>
              {expensesTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Other expenses (courier &amp; misc)</span><span>{fmt(expensesTotal)}</span></div>
              )}
              <div className="flex justify-between font-medium border-t border-border pt-1.5"><span>Landed cost</span><span>{fmt(calc.landed)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Commission ({form.commission_percent || 0}% of landed)</span><span className="text-amber-500">{fmt(calc.commission)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-1.5"><span>Total billed to MGIPL</span><span className="text-emerald-500">{fmt(calc.total)}</span></div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={saveDraft} disabled={saving || !calc.total}>Save draft</Button>
              <Button onClick={saveAndBill} disabled={saving || !calc.total || !hasBoe || !(form.invoice_number || '').trim()} title={!(form.invoice_number || '').trim() ? 'Enter the supplier invoice number first' : !hasBoe ? 'Upload the Bill of Entry first' : ''} className="bg-emerald-600 hover:bg-emerald-500 text-white">
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
                  <TableHead>Consignment</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Supplier ₹</TableHead><TableHead className="text-right">Customs ₹</TableHead>
                  <TableHead className="text-right">Shipping ₹</TableHead><TableHead className="text-right">Landed ₹</TableHead>
                  <TableHead className="text-right">Comm.</TableHead><TableHead className="text-right">Billed ₹</TableHead>
                  <TableHead>BoE</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {consignments.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.consignment_number}</TableCell>
                      <TableCell className="text-xs font-medium">{c.invoice_number || '—'}</TableCell>
                      <TableCell className="text-xs">{c.date}</TableCell>
                      <TableCell className="text-xs">{c.supplier_name || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(c.supplier_payment_inr)}</TableCell>
                      <TableCell className="text-right">{fmt(c.customs_total)}</TableCell>
                      <TableCell className="text-right">{fmt(c.shipping_charges)}</TableCell>
                      <TableCell className="text-right">{fmt(c.landed_cost)}</TableCell>
                      <TableCell className="text-right text-amber-500">{c.commission_percent}% · {fmt(c.commission_amount)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{fmt(c.total_billed)}</TableCell>
                      <TableCell>{boeAtt(c)
                        ? <a href={boeAtt(c).url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><FileText className="w-3.5 h-3.5" />View</a>
                        : <span className="text-xs text-rose-400">missing</span>}</TableCell>
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
