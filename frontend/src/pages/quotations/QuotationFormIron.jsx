import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Loader2, Building2, Package,
  Search, User, IndianRupee, Save, Send,
  AlertTriangle, ExternalLink
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const GST_RATES = [0, 5, 12, 18, 28];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Lakshadweep'
];

const inputStyle = {
  width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px',
  fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none',
};
const labelStyle = {
  display: 'block', marginBottom: 4, fontFamily: T.headline, fontWeight: 700,
  fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: T.iron400,
};
const primaryBtn = {
  border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 14px',
  fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const outlineBtn = {
  border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
  padding: '8px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

// Type-to-search product picker: type any part of a product name/SKU (e.g. "12kw")
// and pick from the live matches — no scrolling a 125-item dropdown.
function ProductTypeahead({ skus, selectedLabel, onSelect }) {
  const [q, setQ] = useState(selectedLabel || '');
  const [open, setOpen] = useState(false);
  useEffect(() => { setQ(selectedLabel || ''); }, [selectedLabel]);
  const ql = q.trim().toLowerCase();
  // Space/punctuation-insensitive: "12kw" matches "12 KW", "12-kw"; multi-word matches all tokens.
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const nq = norm(ql);
  const toks = ql.split(/\s+/).filter(Boolean);
  const matches = ql.length === 0 ? [] : (skus || []).filter(s => {
    const raw = `${s.name || ''} ${s.sku_code || ''} ${s.category || ''}`.toLowerCase();
    return norm(raw).includes(nq) || toks.every(t => raw.includes(t));
  }).slice(0, 30);
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder='Type to search… e.g. "12kw", "lithium", "GOOTU"'
        style={inputStyle}
      />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 30, marginTop: 4, width: '100%', maxHeight: 288, overflow: 'auto', background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, boxShadow: '0 8px 24px rgba(15,15,15,.12)' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${T.iron200}`, position: 'sticky', top: 0, background: T.white }}>
            <Caps size={9}>{matches.length} match{matches.length > 1 ? 'es' : ''}</Caps>
          </div>
          {matches.map(s => (
            <button
              type="button" key={s.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s.id); setQ(`${s.name} (${s.sku_code})`); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: `1px solid ${T.iron200}`, background: T.white, cursor: 'pointer' }}
              className="iron-row"
            >
              <div style={{ fontSize: 12.5, color: T.iron900, lineHeight: 1.3 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: T.iron500, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={mono}>{s.sku_code}</span>
                {s.category && <span style={{ padding: '0 6px', borderRadius: 4, background: T.iron100, color: T.iron700 }}>{s.category}</span>}
                <span style={{ marginLeft: 'auto', color: T.green, ...mono }}>₹{Number(s.selling_price || s.mrp || 0).toLocaleString('en-IN')}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && ql.length > 0 && matches.length === 0 && (
        <div style={{ position: 'absolute', zIndex: 30, marginTop: 4, width: '100%', background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: T.iron500 }}>
          No product matches “{q}”.
        </div>
      )}
    </div>
  );
}

const SectionHead = ({ icon: Icon, children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={15} color={T.orange} strokeWidth={2} />}
      <Caps size={10} color={T.iron700}>{children}</Caps>
    </div>
    {right}
  </div>
);

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();
  const isEdit = Boolean(id);
  // Dealer-PI mode: launched from a dealer profile's "Create PI". Lines are priced
  // at the dealer's discounted rate (dealer's contracted discount if set, else the
  // product's dealer_discount_percent, else 15%).
  const dealerMode = Boolean(location.state?.prefillPartyId);
  const dealerDiscount = (location.state?.dealerDiscount ?? null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [firms, setFirms] = useState([]);
  const [masterSkus, setMasterSkus] = useState([]);
  const [parties, setParties] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [linkedDatasheets, setLinkedDatasheets] = useState({}); // { master_sku_id: datasheet_id }

  const [form, setForm] = useState({
    firm_id: '',
    party_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_pincode: '',
    customer_gstin: '',
    items: [{ master_sku_id: '', name: '', sku_code: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0, discount_amount: 0, current_stock: 0 }],
    validity_days: 15,
    remarks: '',
    terms_and_conditions: "1. Prices are subject to change without notice.\n2. Delivery within 7-10 working days.\n3. Payment terms: 100% advance.\n4. GST extra as applicable.\n5. Warranty as per product terms.",
    save_as_draft: true
  });

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  useEffect(() => {
    if (isEdit && token) {
      fetchQuotation();
    }
  }, [id, token]);

  // Pre-fill the party when launched from the Dealer Profile "Create PI" action.
  useEffect(() => {
    const prefillId = location.state?.prefillPartyId;
    if (!prefillId || isEdit || parties.length === 0) return;
    const match = parties.find((p) => p.id === prefillId);
    if (match) {
      handleCustomerSelect(match);
    } else if (location.state?.prefillParty) {
      const p = location.state.prefillParty;
      setForm((f) => ({
        ...f, party_id: p.id, customer_name: p.name || '', customer_phone: p.phone || '',
        customer_email: p.email || '', customer_city: p.city || '', customer_state: p.state || '',
        customer_pincode: p.pincode || '', customer_gstin: p.gstin || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parties]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [firmsRes, skusRes, partiesRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers, params: { is_active: true } }),
        axios.get(`${API}/master-skus`, { headers }),
        axios.get(`${API}/parties`, { headers })
      ]);

      setFirms(firmsRes.data || []);
      setMasterSkus(skusRes.data || []);
      setParties(partiesRes.data || []);

      // Pre-fetch linked datasheets for all SKUs
      const skuList = skusRes.data || [];
      const linkedDsMap = {};
      for (const sku of skuList) {
        try {
          const dsRes = await axios.get(`${API}/product-datasheets/by-sku/${sku.id}`, { headers });
          if (dsRes.data.found && dsRes.data.datasheet) {
            linkedDsMap[sku.id] = dsRes.data.datasheet.id;
          }
        } catch (e) {
          // Ignore - SKU has no linked datasheet
        }
      }
      setLinkedDatasheets(linkedDsMap);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotation = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/${id}`, { headers });
      const q = response.data;

      if (q.status !== 'draft') {
        toast.error('Only draft quotations can be edited');
        navigate('/quotations');
        return;
      }

      setForm({
        ...form,
        firm_id: q.firm_id,
        party_id: q.party_id,
        customer_name: q.customer_name,
        customer_phone: q.customer_phone,
        customer_email: q.customer_email || '',
        customer_address: q.customer_address || '',
        customer_city: q.customer_city || '',
        customer_state: q.customer_state || '',
        customer_pincode: q.customer_pincode || '',
        customer_gstin: q.customer_gstin || '',
        items: q.items.map(item => ({
          master_sku_id: item.master_sku_id,
          name: item.name,
          sku_code: item.sku_code,
          quantity: item.quantity,
          rate: item.rate,
          gst_rate: item.gst_rate,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          current_stock: item.stock_at_creation || 0
        })),
        validity_days: q.validity_days,
        remarks: q.remarks || '',
        terms_and_conditions: q.terms_and_conditions || ''
      });
    } catch (error) {
      toast.error('Failed to load quotation');
      navigate('/quotations');
    }
  };

  const handleCustomerSelect = (party) => {
    setForm({
      ...form,
      party_id: party.id,
      customer_name: party.name,
      customer_phone: party.phone || '',
      customer_email: party.email || '',
      customer_address: party.address || '',
      customer_city: party.city || '',
      customer_state: party.state || '',
      customer_pincode: party.pincode || '',
      customer_gstin: party.gstin || ''
    });
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

  const handleSkuSelect = async (index, skuId) => {
    const sku = masterSkus.find(s => s.id === skuId);
    if (!sku) return;

    // Get stock for selected firm
    const newItems = [...form.items];
    // In dealer-PI mode, price the line at the dealer's discounted rate: list price
    // (selling_price) as the rate + the dealer/product discount % on the line, so the
    // PI transparently shows list rate and the dealer discount.
    const dealerLineDiscount = dealerMode
      ? (dealerDiscount != null ? dealerDiscount
        : (sku.dealer_discount_percent != null ? sku.dealer_discount_percent : 15))
      : null;
    newItems[index] = {
      ...newItems[index],
      master_sku_id: skuId,
      name: sku.name,
      sku_code: sku.sku_code,
      rate: dealerMode
        ? (sku.selling_price || sku.mrp || sku.cost_price || 0)
        : (sku.mrp || sku.cost_price || 0),
      gst_rate: sku.gst_rate || 18,
      current_stock: sku.stock_quantity || 0,
      ...(dealerMode ? { discount_percent: dealerLineDiscount } : {}),
    };
    setForm({ ...form, items: newItems });

    // Check if this SKU has a linked datasheet
    if (!linkedDatasheets[skuId]) {
      try {
        const res = await axios.get(`${API}/product-datasheets/by-sku/${skuId}`, { headers });
        if (res.data.found && res.data.datasheet) {
          setLinkedDatasheets(prev => ({ ...prev, [skuId]: res.data.datasheet.id }));
        }
      } catch (err) {
        // Silently ignore - just means no linked datasheet
      }
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { master_sku_id: '', name: '', sku_code: '', quantity: 1, rate: 0, gst_rate: 18, discount_percent: 0, discount_amount: 0, current_stock: 0 }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length === 1) {
      toast.error('At least one item is required');
      return;
    }
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;

    form.items.forEach(item => {
      const lineTotal = item.quantity * item.rate;
      const lineDiscount = item.discount_amount > 0 ? item.discount_amount : (lineTotal * item.discount_percent / 100);
      const taxableValue = lineTotal - lineDiscount;
      const gst = taxableValue * item.gst_rate / 100;

      subtotal += lineTotal;
      totalDiscount += lineDiscount;
      totalGst += gst;
    });

    const taxableValue = subtotal - totalDiscount;
    const grandTotal = taxableValue + totalGst;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      taxableValue: Math.round(taxableValue * 100) / 100,
      totalGst: Math.round(totalGst * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  };

  const handleSubmit = async (sendImmediately = false) => {
    // Validation
    if (!form.firm_id) {
      toast.error('Please select a firm');
      return;
    }
    if (!form.customer_name || !form.customer_phone) {
      toast.error('Customer name and phone are required');
      return;
    }
    if (form.items.some(item => !item.master_sku_id || !item.quantity || !item.rate)) {
      toast.error('Please fill all item details');
      return;
    }

    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...form,
        save_as_draft: !sendImmediately
      };

      let response;
      if (isEdit) {
        response = await axios.put(`${API}/quotations/${id}`, payload, { headers });
        toast.success('Quotation updated');
      } else {
        response = await axios.post(`${API}/quotations`, payload, { headers });
        toast.success(`Quotation ${sendImmediately ? 'created and sent' : 'saved as draft'}`);
      }

      if (sendImmediately && response.data?.id) {
        // Send the quotation
        const sendRes = await axios.post(`${API}/quotations/${response.data.id}/send`, {}, { headers });
        if (sendRes.data.share_link) {
          navigator.clipboard.writeText(sendRes.data.share_link);
          toast.success('Share link copied to clipboard!');
        }
      }

      navigate('/quotations');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save quotation');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const totals = calculateTotals();
  const filteredParties = parties.filter(p =>
    p.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    p.phone?.includes(customerSearch)
  ).slice(0, 10);

  const headerRight = (
    <button onClick={() => navigate('/quotations')} style={outlineBtn}>
      <ArrowLeft size={14} /> Back
    </button>
  );

  if (loading) {
    return (
      <IronShell title={isEdit ? 'Edit Quotation' : 'Create Quotation'} subtitle="PROFORMA INVOICE" headerRight={headerRight}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell
      title={isEdit ? 'Edit Quotation' : 'Create Quotation'}
      subtitle={isEdit ? 'EDIT DRAFT PI' : 'NEW PROFORMA INVOICE'}
      onRefresh={fetchInitialData}
      headerRight={headerRight}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>
          {isEdit ? 'Edit Quotation' : 'Create New Quotation'}
        </div>
        <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>Fill in the details to create a proforma invoice</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        {/* Main Form column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* Firm Selection */}
          <IronCard pad={0}>
            <SectionHead icon={Building2}>Firm Details</SectionHead>
            <div style={{ padding: 14 }}>
              <label style={labelStyle}>Select Firm *</label>
              <select
                value={form.firm_id}
                onChange={(e) => setForm({ ...form, firm_id: e.target.value })}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Select firm</option>
                {firms.map(firm => (
                  <option key={firm.id} value={firm.id}>
                    {firm.name} {firm.gstin ? `(${firm.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </IronCard>

          {/* Customer Details */}
          <IronCard pad={0}>
            <SectionHead icon={User}>Customer Details</SectionHead>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Customer Search */}
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Search Existing Customer</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                    style={{ ...inputStyle, paddingLeft: 32 }}
                  />
                </div>

                {showCustomerSearch && customerSearch && filteredParties.length > 0 && (
                  <div style={{ position: 'absolute', zIndex: 10, width: '100%', marginTop: 4, background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(15,15,15,.12)', maxHeight: 240, overflowY: 'auto' }}>
                    {filteredParties.map(party => (
                      <div
                        key={party.id}
                        className="iron-row"
                        style={{ padding: 12, cursor: 'pointer', borderBottom: `1px solid ${T.iron200}` }}
                        onClick={() => handleCustomerSelect(party)}
                      >
                        <div style={{ color: T.iron900, fontSize: 12.5 }}>{party.name}</div>
                        <div style={{ color: T.iron500, fontSize: 11, ...mono }}>{party.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Customer Name *</label>
                  <input
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Enter customer name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="Enter phone number"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    placeholder="Enter email"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>GSTIN</label>
                  <input
                    value={form.customer_gstin}
                    onChange={(e) => setForm({ ...form, customer_gstin: e.target.value.toUpperCase() })}
                    placeholder="Enter GSTIN"
                    style={{ ...inputStyle, ...mono }}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Address</label>
                  <input
                    value={form.customer_address}
                    onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                    placeholder="Enter address"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    value={form.customer_city}
                    onChange={(e) => setForm({ ...form, customer_city: e.target.value })}
                    placeholder="Enter city"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <select
                    value={form.customer_state}
                    onChange={(e) => setForm({ ...form, customer_state: e.target.value })}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Pincode</label>
                  <input
                    value={form.customer_pincode}
                    onChange={(e) => setForm({ ...form, customer_pincode: e.target.value })}
                    placeholder="Enter pincode"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </IronCard>

          {/* Items */}
          <IronCard pad={0}>
            <SectionHead
              icon={Package}
              right={
                <button onClick={addItem} style={{ ...primaryBtn, padding: '6px 12px' }}>
                  <Plus size={14} /> Add Item
                </button>
              }
            >
              Items
            </SectionHead>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {dealerMode && (
                <div style={{ borderRadius: 6, border: `1px solid ${T.orange}55`, background: '#FDEEE6', padding: '8px 12px', fontSize: 12.5, color: T.orangeDeep }}>
                  Dealer pricing active — each item you add is priced at the dealer rate
                  {dealerDiscount != null ? ` (${dealerDiscount}% dealer discount)` : ' (per-product dealer discount)'}.
                  Rate shows list price; the discount is applied on the line.
                </div>
              )}
              {form.items.map((item, index) => (
                <div key={index} style={{ padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Caps size={9.5} color={T.iron500}>Item #{index + 1}</Caps>
                    <button
                      onClick={() => removeItem(index)}
                      title="Remove item"
                      style={{ border: 'none', background: 'transparent', color: T.rose, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Select Product *</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <ProductTypeahead
                          skus={masterSkus}
                          selectedLabel={item.name ? `${item.name} (${item.sku_code})` : ''}
                          onSelect={(skuId) => handleSkuSelect(index, skuId)}
                        />
                        {/* View Catalogue Link */}
                        {item.master_sku_id && linkedDatasheets[item.master_sku_id] && (
                          <button
                            type="button"
                            style={{ ...outlineBtn, borderColor: T.orange, color: T.orange, padding: '0 10px' }}
                            onClick={() => window.open(`/datasheet/${linkedDatasheets[item.master_sku_id]}`, '_blank')}
                            title="View product catalogue"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        style={inputStyle}
                      />
                      {item.current_stock > 0 && (
                        <p style={{ fontSize: 11, marginTop: 4, color: item.quantity > item.current_stock ? T.rose : T.green }}>
                          Stock: {item.current_stock}
                          {item.quantity > item.current_stock && ' (Insufficient)'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label style={labelStyle}>Rate (per unit) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>GST Rate %</label>
                      <select
                        value={item.gst_rate.toString()}
                        onChange={(e) => updateItem(index, 'gst_rate', parseFloat(e.target.value))}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        {GST_RATES.map(rate => (
                          <option key={rate} value={rate.toString()}>{rate}%</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_percent}
                        onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Line Total */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${T.iron200}` }}>
                    <div style={{ textAlign: 'right' }}>
                      <Caps size={9} color={T.iron400}>Line Total</Caps>
                      <div style={{ color: T.iron900, fontWeight: 700, fontSize: 14, ...mono }}>
                        {formatCurrency(item.quantity * item.rate * (1 - item.discount_percent / 100) * (1 + item.gst_rate / 100))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </IronCard>

          {/* Terms & Remarks */}
          <IronCard pad={0}>
            <SectionHead>Additional Details</SectionHead>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.validity_days}
                  onChange={(e) => setForm({ ...form, validity_days: parseInt(e.target.value) || 15 })}
                  style={{ ...inputStyle, width: 128 }}
                />
              </div>
              <div>
                <label style={labelStyle}>Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Any special remarks..."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: T.body }}
                />
              </div>
              <div>
                <label style={labelStyle}>Terms &amp; Conditions</label>
                <textarea
                  value={form.terms_and_conditions}
                  onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: T.body }}
                />
              </div>
            </div>
          </IronCard>
        </div>

        {/* Summary Sidebar */}
        <div style={{ position: 'sticky', top: 78 }}>
          <IronCard pad={0}>
            <SectionHead icon={IndianRupee}>Summary</SectionHead>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: T.iron500, fontSize: 12.5 }}>
                  <span>Subtotal</span>
                  <span style={mono}>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: T.green, fontSize: 12.5 }}>
                    <span>Discount</span>
                    <span style={mono}>-{formatCurrency(totals.totalDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: T.iron500, fontSize: 12.5 }}>
                  <span>Taxable Value</span>
                  <span style={mono}>{formatCurrency(totals.taxableValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: T.iron500, fontSize: 12.5 }}>
                  <span>GST</span>
                  <span style={mono}>{formatCurrency(totals.totalGst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTop: `1px solid ${T.iron200}` }}>
                  <Caps size={10} color={T.iron700}>Grand Total</Caps>
                  <span style={{ fontSize: 24, fontWeight: 800, color: T.iron900, ...mono }}>{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>

              {/* Stock Warnings */}
              {form.items.some(item => item.master_sku_id && item.quantity > item.current_stock) && (
                <div style={{ padding: 12, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 8 }}>
                  <p style={{ color: T.voltageText, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <AlertTriangle size={14} />
                    Some items have insufficient stock
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  style={{ ...outlineBtn, width: '100%', opacity: submitting ? 0.6 : 1 }}
                  data-testid="save-draft-btn"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  style={{ ...primaryBtn, width: '100%', background: T.green, opacity: submitting ? 0.6 : 1 }}
                  data-testid="send-btn"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save &amp; Send
                </button>
              </div>
            </div>
          </IronCard>
        </div>
      </div>
    </IronShell>
  );
}
