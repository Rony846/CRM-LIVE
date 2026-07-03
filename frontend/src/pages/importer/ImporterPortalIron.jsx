import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
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

// Iron form-control styles
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%' };
const labelStyle = { fontFamily: T.headline, fontWeight: 700, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: T.iron500, display: 'block', marginBottom: 4 };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnGreen = { ...btnPrimary, background: T.green };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, width: 34, height: 34, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 };

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

  const HIST_H = ['Consignment', 'Invoice', 'Date', 'Supplier', 'Supplier ₹', 'Customs ₹', 'Shipping ₹', 'Landed ₹', 'Comm.', 'Billed ₹', 'BoE', 'Status', ''];
  const paidPays = (form.supplier_payments || []).filter(p => num(p.amount) > 0).length;

  const kpis = [
    { label: 'Consignments', value: summary?.count || 0, icon: Package, tone: T.iron700, isMoney: false },
    { label: 'Total Billed to MGIPL', value: summary?.total_billed, icon: IndianRupee, tone: T.green, isMoney: true },
    { label: 'Total Commission', value: summary?.total_commission, icon: Percent, tone: T.voltageText, isMoney: true },
  ];

  return (
    <IronShell title="Importer Portal" subtitle="IMPORT COSTING · MGIPL BILLING" onRefresh={fetchData}>
      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <IronCard key={k.label} pad={14}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>{k.label}</Caps>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: k.isMoney ? k.tone : T.iron900, lineHeight: 1 }}>
                    {k.isMoney ? fmt(k.value) : Number(k.value || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <Icon size={18} color={k.tone} strokeWidth={1.9} />
                </div>
              </div>
            </IronCard>
          );
        })}
      </div>

      {/* New consignment */}
      <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>New Import Consignment</div>
          <div style={{ fontSize: 12, color: T.iron500, marginTop: 3 }}>
            Enter exactly what your bank paid + Bill-of-Entry customs duty + shipping. Commission ({form.commission_percent || 0}%) applies on the full landed cost. Everything is transparent to MGIPL.
          </div>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div><label style={labelStyle}>Date</label><input type="date" style={inputStyle} value={form.date} onChange={e => setField('date', e.target.value)} /></div>
            <div><label style={labelStyle}>Supplier</label><input style={inputStyle} value={form.supplier_name} onChange={e => setField('supplier_name', e.target.value)} placeholder="Supplier paid from your bank" /></div>
            <div><label style={labelStyle}>Supplier Invoice No. <span style={{ color: T.orangeDeep }}>*</span></label><input style={inputStyle} value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} placeholder="Bill is raised against this" /></div>
            <div><label style={labelStyle}>Bill of Entry No. (optional)</label><input style={inputStyle} value={form.boe_number} onChange={e => setField('boe_number', e.target.value)} /></div>
          </div>

          {/* Supplier payments — supports staged payments e.g. 30% advance + 70% post-BoE */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={labelStyle}>Supplier Payments — bank debits</label>
              <span style={{ fontSize: 11.5, color: T.iron500 }}>Total paid to supplier: <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{fmt(supplierTotal)}</span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.supplier_payments.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 3fr 2fr 2fr 2fr', gap: 8, alignItems: 'end' }}>
                  <div><label style={labelStyle}>Amount (₹)</label>
                    <input type="number" style={inputStyle} value={p.amount} onChange={e => setPay(i, 'amount', e.target.value)} /></div>
                  <div><label style={labelStyle}>Type</label>
                    <Select value={p.type} onValueChange={v => setPay(i, 'type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PAY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><label style={labelStyle}>%</label>
                    <input type="number" placeholder="e.g. 30" style={inputStyle} value={p.percent} onChange={e => setPay(i, 'percent', e.target.value)} /></div>
                  <div><label style={labelStyle}>Date</label>
                    <input type="date" style={inputStyle} value={p.date} onChange={e => setPay(i, 'date', e.target.value)} /></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input placeholder="UTR/ref" style={inputStyle} value={p.reference} onChange={e => setPay(i, 'reference', e.target.value)} />
                    {form.supplier_payments.length > 1 && (
                      <button style={iconBtn} onClick={() => delPay(i)}><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
              ))}
              <div><button style={btnOutline} onClick={addPay}><Plus size={14} /> Add payment (e.g. post-BoE balance)</button></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div><label style={labelStyle}>Customs — BCD (₹)</label><input type="number" style={inputStyle} value={form.customs_bcd} onChange={e => setField('customs_bcd', e.target.value)} /></div>
            <div><label style={labelStyle}>Customs — Surcharge (₹)</label><input type="number" style={inputStyle} value={form.customs_surcharge} onChange={e => setField('customs_surcharge', e.target.value)} /></div>
            <div><label style={labelStyle}>Customs — IGST (₹)</label><input type="number" style={inputStyle} value={form.customs_igst} onChange={e => setField('customs_igst', e.target.value)} /></div>
            <div><label style={labelStyle}>Shipping (₹)</label><input type="number" style={inputStyle} value={form.shipping_charges} onChange={e => setField('shipping_charges', e.target.value)} /></div>
            <div><label style={labelStyle}>Commission %</label><input type="number" style={inputStyle} value={form.commission_percent} onChange={e => setField('commission_percent', e.target.value)} /></div>
          </div>

          {/* Other expenses — courier, clearing agent, transport, etc. (roll into landed cost) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={labelStyle}>Other Expenses — courier & misc</label>
              <span style={{ fontSize: 11.5, color: T.iron500 }}>Total: <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{fmt(expensesTotal)}</span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(form.expenses || []).map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 6fr 2fr auto', gap: 8, alignItems: 'end' }}>
                  <div><label style={labelStyle}>Category</label>
                    <Select value={e.category} onValueChange={v => setExp(i, 'category', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{EXPENSE_CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div><label style={labelStyle}>Description</label>
                    <input placeholder="e.g. Courier — DHL AWB 12345" style={inputStyle} value={e.description} onChange={ev => setExp(i, 'description', ev.target.value)} /></div>
                  <div><label style={labelStyle}>Amount (₹)</label>
                    <input type="number" style={inputStyle} value={e.amount} onChange={ev => setExp(i, 'amount', ev.target.value)} /></div>
                  <div>
                    <button style={iconBtn} onClick={() => delExp(i)}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              <div><button style={btnOutline} onClick={addExp}><Plus size={14} /> Add expense (courier, clearing, transport…)</button></div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <label style={labelStyle}>Items (SKD / SKU + quantity)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.line_items.map((li, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder='e.g. "SKD 6.2kW"' value={li.description} onChange={e => setItem(i, 'description', e.target.value)} />
                  <input style={{ ...inputStyle, width: 112 }} type="number" placeholder="Qty" value={li.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                  <button style={iconBtn} onClick={() => delItem(i)}><Trash2 size={15} /></button>
                </div>
              ))}
              <div><button style={btnOutline} onClick={addItem}><Plus size={14} /> Add item</button></div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <label style={labelStyle}>Documents <span style={{ color: T.orangeDeep }}>— Bill of Entry required to bill</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {DOC_KINDS.map(d => {
                const done = (form.attachments || []).some(a => a.kind === d.kind);
                const bg = done ? T.greenTint : d.required ? '#FDEEE6' : T.iron50;
                const bd = done ? '#CBE5D6' : d.required ? '#F6D8BA' : T.iron200;
                return (
                  <label key={d.kind} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, border: `1px solid ${bd}`, background: bg, padding: '10px 12px', cursor: 'pointer', fontSize: 12.5, color: T.iron700 }}>
                    {uploading === d.kind ? <Loader2 className="animate-spin" size={16} style={{ flexShrink: 0 }} /> :
                      done ? <CheckCircle2 size={16} color={T.green} style={{ flexShrink: 0 }} /> :
                      d.required ? <AlertCircle size={16} color={T.orangeDeep} style={{ flexShrink: 0 }} /> : <Upload size={16} color={T.iron400} style={{ flexShrink: 0 }} />}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}{d.required && !done ? ' *' : ''}</span>
                    <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
                      disabled={!!uploading}
                      onChange={e => { uploadDoc(d.kind, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                );
              })}
            </div>
            {(form.attachments || []).length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {form.attachments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: T.iron500 }}>
                    <FileText size={14} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: T.iron900 }}>{DOC_KINDS.find(d => d.kind === a.kind)?.label || a.kind}:</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.name}</span>
                    <button type="button" onClick={() => removeDoc(i)} style={{ border: 'none', background: 'none', color: T.orangeDeep, cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live reconciliation */}
          <div style={{ borderRadius: 8, border: `1px solid ${T.iron200}`, background: T.iron50, padding: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.iron500 }}>Supplier payment{paidPays > 1 ? ` (${paidPays} payments)` : ''}</span><span style={mono}>{fmt(supplierTotal)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.iron500 }}>Customs duty (BCD + surcharge + IGST)</span><span style={mono}>{fmt(calc.customs)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.iron500 }}>Shipping</span><span style={mono}>{fmt(num(form.shipping_charges))}</span></div>
            {expensesTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.iron500 }}>Other expenses (courier &amp; misc)</span><span style={mono}>{fmt(expensesTotal)}</span></div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: `1px solid ${T.iron200}`, paddingTop: 6 }}><span>Landed cost</span><span style={mono}>{fmt(calc.landed)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: T.iron500 }}>Commission ({form.commission_percent || 0}% of landed)</span><span style={{ ...mono, color: T.voltageText }}>{fmt(calc.commission)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 700, borderTop: `1px solid ${T.iron200}`, paddingTop: 6 }}><span>Total billed to MGIPL</span><span style={{ ...mono, color: T.green }}>{fmt(calc.total)}</span></div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={{ ...btnOutline, opacity: (saving || !calc.total) ? 0.5 : 1, cursor: (saving || !calc.total) ? 'not-allowed' : 'pointer' }} onClick={saveDraft} disabled={saving || !calc.total}>Save draft</button>
            <button style={{ ...btnGreen, opacity: (saving || !calc.total || !hasBoe || !(form.invoice_number || '').trim()) ? 0.5 : 1, cursor: (saving || !calc.total || !hasBoe || !(form.invoice_number || '').trim()) ? 'not-allowed' : 'pointer' }} onClick={saveAndBill} disabled={saving || !calc.total || !hasBoe || !(form.invoice_number || '').trim()} title={!(form.invoice_number || '').trim() ? 'Enter the supplier invoice number first' : !hasBoe ? 'Upload the Bill of Entry first' : ''}>
              {saving ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />} Save &amp; Bill MGIPL
            </button>
          </div>
        </div>
      </IronCard>

      {/* Consignment history / reconciliation */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>My Consignments</div>
          <div style={{ fontSize: 12, color: T.iron500, marginTop: 3 }}>Full reconciliation — what you paid, your commission, and what MGIPL is billed.</div>
        </div>
        {loading ? <div style={{ padding: 16, fontSize: 12.5, color: T.iron500 }}>Loading…</div> :
          consignments.length === 0 ? <div style={{ padding: 16, fontSize: 12.5, color: T.iron500 }}>No consignments yet.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {HIST_H.map((hd, i) => (
                  <th key={i} style={{ ...thCell, textAlign: (i >= 4 && i <= 9) ? 'right' : 'left' }}><Caps size={8.5}>{hd}</Caps></th>
                ))}
              </tr></thead>
              <tbody>
                {consignments.map(c => (
                  <tr key={c.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron900 }}>{c.consignment_number}</td>
                    <td style={{ ...tdCell, fontWeight: 600 }}>{c.invoice_number || '—'}</td>
                    <td style={{ ...tdCell, ...mono }}>{c.date}</td>
                    <td style={tdCell}>{c.supplier_name || '—'}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{fmt(c.supplier_payment_inr)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{fmt(c.customs_total)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{fmt(c.shipping_charges)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{fmt(c.landed_cost)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.voltageText }}>{c.commission_percent}% · {fmt(c.commission_amount)}</td>
                    <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.green }}>{fmt(c.total_billed)}</td>
                    <td style={tdCell}>{boeAtt(c)
                      ? <a href={boeAtt(c).url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.blue, textDecoration: 'none' }}><FileText size={14} />View</a>
                      : <span style={{ fontSize: 11.5, color: T.orangeDeep }}>missing</span>}</td>
                    <td style={tdCell}><span style={badgeStyle(c.status === 'draft' ? 'warn' : 'ok')}>{c.status}</span></td>
                    <td style={tdCell}>{c.status === 'draft' && (
                      <button style={{ ...btnGreen, padding: '6px 12px', fontSize: 11 }} onClick={() => billExisting(c.id)}>Bill</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}
