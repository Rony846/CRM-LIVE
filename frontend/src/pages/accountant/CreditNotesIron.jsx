import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ReceiptText, Plus, Loader2, Eye, Search, IndianRupee, Trash2
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

const REASON_CONFIG = {
  sales_return:      { label: 'Sales Return',      tone: 'info' },
  discount:          { label: 'Discount',          tone: 'ok' },
  price_difference:  { label: 'Price Difference',  tone: 'warn' },
  damaged_goods:     { label: 'Damaged Goods',     tone: 'bad' },
  other:             { label: 'Other',             tone: 'slate' }
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  tone: 'warn' },
  adjusted: { label: 'Adjusted', tone: 'ok' },
  refunded: { label: 'Refunded', tone: 'info' }
};

const GST_RATES = [0, 5, 12, 18, 28];

const ReasonBadge = ({ reason }) => {
  const cfg = REASON_CONFIG[reason] || REASON_CONFIG.other;
  return <span style={badgeStyle(cfg.tone)}>{cfg.label}</span>;
};

const StatusBadgeLocal = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, tone: 'slate' };
  return <span style={badgeStyle(cfg.tone)}>{cfg.label}</span>;
};

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

export default function CreditNotes() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState([]);
  const [firms, setFirms] = useState([]);
  const [parties, setParties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [skus, setSkus] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    original_invoice_id: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    items: [],
    reason: 'sales_return',
    notes: ''
  });

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAllData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [notesRes, firmsRes, partiesRes, skusRes] = await Promise.all([
        axios.get(`${API}/credit-notes`, { headers }),
        axios.get(`${API}/firms`, { headers }),
        axios.get(`${API}/parties`, { headers, params: { party_type: 'customer' } }),
        axios.get(`${API}/master-skus`, { headers })
      ]);

      setCreditNotes(notesRes.data || []);
      setFirms(firmsRes.data || []);
      setParties(partiesRes.data || []);
      setSkus(skusRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartyInvoices = async (partyId) => {
    if (!partyId) {
      setInvoices([]);
      return;
    }

    try {
      const res = await axios.get(`${API}/sales-invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { party_id: partyId }
      });
      setInvoices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices');
    }
  };

  const resetForm = () => {
    setForm({
      firm_id: '', party_id: '', original_invoice_id: '',
      credit_note_date: new Date().toISOString().split('T')[0],
      items: [], reason: 'sales_return', notes: ''
    });
    setInvoices([]);
  };

  const handlePartyChange = (partyId) => {
    setForm({ ...form, party_id: partyId, original_invoice_id: '' });
    fetchPartyInvoices(partyId);
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        master_sku_id: '',
        sku_code: '',
        name: '',
        hsn_code: '',
        quantity: 1,
        rate: 0,
        gst_rate: 18,
        reason: ''
      }]
    }));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;

    if (field === 'master_sku_id' && value) {
      const sku = skus.find(s => s.id === value);
      if (sku) {
        newItems[index].sku_code = sku.sku_code;
        newItems[index].name = sku.name;
        newItems[index].hsn_code = sku.hsn_code || '';
        newItems[index].gst_rate = sku.gst_rate || 18;
        newItems[index].rate = sku.cost_price || 0;
      }
    }

    setForm(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;

    form.items.forEach(item => {
      const taxable = item.quantity * item.rate;
      const gst = taxable * (item.gst_rate / 100);
      subtotal += taxable;
      totalGst += gst;
    });

    return { subtotal, totalGst, grandTotal: subtotal + totalGst };
  };

  const handleCreate = async () => {
    if (!form.firm_id || !form.party_id || form.items.length === 0) {
      toast.error('Firm, Party and at least one item are required');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/credit-notes`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Credit note created successfully');
      setCreateOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create credit note');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter credit notes
  const filteredNotes = creditNotes.filter(cn => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      cn.credit_note_number?.toLowerCase().includes(search) ||
      cn.party_name?.toLowerCase().includes(search)
    );
  });

  // Stats
  const stats = {
    total: creditNotes.length,
    totalValue: creditNotes.reduce((sum, cn) => sum + cn.grand_total, 0),
    pending: creditNotes.filter(cn => cn.status === 'pending').length,
    pendingValue: creditNotes.filter(cn => cn.status === 'pending').reduce((sum, cn) => sum + cn.grand_total, 0)
  };

  const statCards = [
    { label: 'Total Notes', value: stats.total.toLocaleString('en-IN'), icon: ReceiptText, tone: T.blue },
    { label: 'Total Value', value: inr(stats.totalValue), icon: IndianRupee, tone: T.orange },
    { label: 'Pending', value: stats.pending.toLocaleString('en-IN'), icon: ReceiptText, tone: T.voltageText },
    { label: 'Pending Value', value: inr(stats.pendingValue), icon: IndianRupee, tone: T.voltageText },
  ];

  const totals = calculateTotals();

  const H = ['CN Number', 'Date', 'Firm', 'Party', 'Reason', 'Amount', 'Status', ''];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

  const dlgLabel = { fontFamily: T.headline, fontWeight: 700, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: T.iron400 };

  return (
    <IronShell title="Credit Notes" subtitle={`${stats.total.toLocaleString('en-IN')} NOTES · ${inr(stats.totalValue)} TOTAL`} onRefresh={fetchAllData}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Filter bar + table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search credit notes…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 300 }} />
              </div>
              <button data-testid="create-credit-note-btn" onClick={() => { resetForm(); setCreateOpen(true); }} style={primaryBtn}>
                <Plus size={15} strokeWidth={2.2} /> New Credit Note
              </button>
            </div>

            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <ReceiptText size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No credit notes found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Create a credit note to get started.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {H.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : (i === H.length - 1 ? 'right' : 'left') }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{filteredNotes.map((cn) => (
                    <tr key={cn.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}><span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{cn.credit_note_number}</span></td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{new Date(cn.credit_note_date).toLocaleDateString('en-IN')}</td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron900 }}>{cn.firm_name}</td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron900 }}>{cn.party_name}</td>
                      <td style={tdCell}><ReasonBadge reason={cn.reason} /></td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.orangeDeep }}>{inr(cn.grand_total)}</td>
                      <td style={tdCell}><StatusBadgeLocal status={cn.status} /></td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button onClick={() => { setSelectedNote(cn); setViewOpen(true); }} title="View" style={rowActionStyle}><Eye size={13} /></button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create Credit Note Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white text-slate-900 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Create Credit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label style={dlgLabel}>Firm *</Label>
                <Select value={form.firm_id} onValueChange={(v) => setForm({ ...form, firm_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={dlgLabel}>Party *</Label>
                <Select value={form.party_id} onValueChange={handlePartyChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={dlgLabel}>Date *</Label>
                <Input
                  type="date"
                  value={form.credit_note_date}
                  onChange={(e) => setForm({ ...form, credit_note_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label style={dlgLabel}>Original Invoice (Optional)</Label>
                <Select value={form.original_invoice_id} onValueChange={(v) => setForm({ ...form, original_invoice_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-40">
                    <SelectItem value="">No specific invoice</SelectItem>
                    {invoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} - ₹{inv.grand_total?.toLocaleString('en-IN')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={dlgLabel}>Reason *</Label>
                <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, background: T.iron50 }}>
              <div className="flex justify-between items-center mb-3">
                <Caps size={10} color={T.orangeDeep}>Line Items</Caps>
                <button onClick={addItem} style={{ ...outlineBtn, padding: '6px 11px', fontSize: 11 }}>
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {form.items.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '16px 0', ...mono, fontSize: 11, color: T.iron400 }}>No items added</p>
              ) : (
                <div className="space-y-3">
                  {form.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end" style={{ background: T.white, padding: 12, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                      <div className="col-span-3">
                        <Label style={dlgLabel}>SKU</Label>
                        <Select
                          value={item.master_sku_id}
                          onValueChange={(v) => updateItem(index, 'master_sku_id', v)}
                        >
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue placeholder="Select SKU" />
                          </SelectTrigger>
                          <SelectContent className="max-h-40">
                            {skus.map(s => (
                              <SelectItem key={s.id} value={s.id} className="text-sm">
                                {s.sku_code} - {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label style={dlgLabel}>HSN</Label>
                        <Input
                          value={item.hsn_code}
                          onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label style={dlgLabel}>Qty</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="mt-1 text-sm font-mono tabular-nums"
                          min="1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label style={dlgLabel}>Rate</Label>
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="mt-1 text-sm font-mono tabular-nums"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label style={dlgLabel}>GST%</Label>
                        <Select
                          value={item.gst_rate.toString()}
                          onValueChange={(v) => updateItem(index, 'gst_rate', parseFloat(v))}
                        >
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GST_RATES.map(r => (
                              <SelectItem key={r} value={r.toString()}>{r}%</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label style={dlgLabel}>Total</Label>
                        <div className="mt-1" style={{ ...mono, background: T.iron50, border: `1px solid ${T.iron200}`, color: T.iron900, padding: 8, borderRadius: 6, fontSize: 13 }}>
                          ₹{(item.quantity * item.rate).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <button onClick={() => removeItem(index)} title="Remove" style={{ ...rowActionStyle, border: `1px solid ${T.iron200}`, padding: '7px 9px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-4" style={{ padding: 14, background: T.iron50, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
              <div>
                <Caps size={9} color={T.iron400}>Subtotal</Caps>
                <p style={{ ...mono, fontSize: 20, color: T.iron900, marginTop: 4 }}>₹{totals.subtotal.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <Caps size={9} color={T.iron400}>GST</Caps>
                <p style={{ ...mono, fontSize: 20, color: '#6D4AB0', marginTop: 4 }}>₹{totals.totalGst.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <Caps size={9} color={T.iron400}>Total</Caps>
                <p style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.orangeDeep, marginTop: 4 }}>₹{totals.grandTotal.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div>
              <Label style={dlgLabel}>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <button onClick={() => setCreateOpen(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleCreate} disabled={actionLoading} style={{ ...primaryBtn, opacity: actionLoading ? 0.6 : 1 }}>
              {actionLoading && <Loader2 className="animate-spin" size={14} />}
              Create Credit Note
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Credit Note Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-white text-slate-900 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Credit Note Details</DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Caps size={9} color={T.iron400}>CN Number</Caps>
                  <p style={{ ...mono, color: T.orangeDeep, fontSize: 17, marginTop: 2 }}>{selectedNote.credit_note_number}</p>
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Date</Caps>
                  <p style={{ color: T.iron900, marginTop: 2 }}>{new Date(selectedNote.credit_note_date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Caps size={9} color={T.iron400}>Firm</Caps>
                  <p style={{ color: T.iron900, marginTop: 2 }}>{selectedNote.firm_name}</p>
                </div>
                <div>
                  <Caps size={9} color={T.iron400}>Party</Caps>
                  <p style={{ color: T.iron900, marginTop: 2 }}>{selectedNote.party_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>Reason</Caps>
                  <ReasonBadge reason={selectedNote.reason} />
                </div>
                <div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 4 }}>Status</Caps>
                  <StatusBadgeLocal status={selectedNote.status} />
                </div>
              </div>

              {selectedNote.original_invoice_number && (
                <div>
                  <Caps size={9} color={T.iron400}>Original Invoice</Caps>
                  <p style={{ ...mono, color: T.orangeDeep, marginTop: 2 }}>{selectedNote.original_invoice_number}</p>
                </div>
              )}

              <div style={{ padding: 14, background: T.iron50, borderRadius: 8, border: `1px solid ${T.iron200}` }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Caps size={9} color={T.iron400}>Subtotal</Caps>
                    <p style={{ ...mono, color: T.iron900, marginTop: 2 }}>₹{selectedNote.subtotal?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <Caps size={9} color={T.iron400}>{selectedNote.is_igst ? 'IGST' : 'CGST+SGST'}</Caps>
                    <p style={{ ...mono, color: '#6D4AB0', marginTop: 2 }}>₹{selectedNote.total_gst?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                  <Caps size={9} color={T.iron400}>Total</Caps>
                  <p style={{ ...mono, color: T.orangeDeep, fontSize: 24, fontWeight: 700, marginTop: 2 }}>₹{selectedNote.grand_total?.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setViewOpen(false)} style={outlineBtn}>Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
