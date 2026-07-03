import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield, Loader2, Plus, Search, CheckCircle2, Clock, XCircle,
  User, Phone, Package, AlertCircle,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

// Warranty status -> Iron pill tone + icon.
const WARRANTY_STATUS = {
  active:   { label: 'Active',               tone: 'ok',    icon: CheckCircle2 },
  pending:  { label: 'Pending Verification', tone: 'warn',  icon: Clock },
  expired:  { label: 'Expired',              tone: 'slate', icon: XCircle },
  rejected: { label: 'Rejected',             tone: 'bad',   icon: XCircle },
};

const TONE_MAP = {
  ok:    [T.greenTint, T.green, '#CBE5D6'],
  warn:  [T.voltageTint, T.voltageText, '#EDDFA6'],
  slate: [T.iron100, T.iron700, T.iron200],
  bad:   ['#FDEEE6', T.orangeDeep, '#F6D8BA'],
  info:  [T.blueTint, T.blue, '#CBE0F0'],
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '8px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const labelStyle = { fontFamily: T.headline, fontWeight: 700, fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: T.iron500, display: 'block', marginBottom: 5 };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

function StatusPill({ status }) {
  const cfg = WARRANTY_STATUS[status] || WARRANTY_STATUS.pending;
  const [bg, fg, bd] = TONE_MAP[cfg.tone] || TONE_MAP.slate;
  const Icon = cfg.icon;
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${bd}`, padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cfg.label}
    </span>
  );
}

export default function DealerWarrantyRegistration() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    product_id: '',
    serial_number: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_pincode: '',
    purchase_date: '',
    invoice_number: '',
  });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [regRes, prodRes] = await Promise.all([
        axios.get(`${API}/dealer/warranty-registrations`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/products-catalogue`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setRegistrations(regRes.data.registrations || []);
      setProducts(prodRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load warranty registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const required = ['product_id', 'serial_number', 'customer_name', 'customer_phone', 'purchase_date'];
    const missing = required.filter((f) => !formData[f]);
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/dealer/warranty-registrations`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Warranty registration submitted successfully');
      setShowRegisterModal(false);
      setFormData({
        product_id: '', serial_number: '', customer_name: '', customer_phone: '',
        customer_email: '', customer_address: '', customer_city: '', customer_state: '',
        customer_pincode: '', purchase_date: '', invoice_number: '',
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit warranty registration');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const filteredRegistrations = registrations.filter((reg) =>
    !searchTerm ||
    reg.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total:   registrations.length,
    active:  registrations.filter((r) => r.status === 'active').length,
    pending: registrations.filter((r) => r.status === 'pending').length,
  };

  const headerRight = (
    <button style={btnPrimary} onClick={() => setShowRegisterModal(true)} data-testid="register-warranty-btn">
      <Plus style={{ width: 15, height: 15 }} />
      Register Warranty
    </button>
  );

  const KPI = [
    { label: 'Total Registrations',   value: stats.total,   tone: 'info', Icon: Shield },
    { label: 'Active Warranties',     value: stats.active,  tone: 'ok',   Icon: CheckCircle2 },
    { label: 'Pending Verification',  value: stats.pending, tone: 'warn', Icon: Clock },
  ];

  return (
    <IronShell title="Warranty Registration" subtitle="DEALER · WARRANTY" onRefresh={fetchData} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: T.iron400 }}>
          <Loader2 style={{ width: 30, height: 30 }} className="animate-spin" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1180 }}>

          {/* Intro line */}
          <div>
            <Caps size={10} color={T.iron400}>Dealer Portal</Caps>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
              Register warranties for products sold to customers
            </div>
          </div>

          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {KPI.map(({ label, value, tone, Icon }) => {
              const [bg, fg] = TONE_MAP[tone] || TONE_MAP.slate;
              return (
                <IronCard key={label} pad={16}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <Caps size={9.5} color={T.iron400}>{label}</Caps>
                      <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.iron900, marginTop: 6 }}>{value}</div>
                    </div>
                    <div style={{ height: 40, width: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: bg, color: fg }}>
                      <Icon style={{ width: 20, height: 20 }} />
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Search */}
          <IronCard pad={10}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: T.iron400 }} />
              <input
                placeholder="Search by customer name, serial number, or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 34 }}
                data-testid="warranty-search"
              />
            </div>
          </IronCard>

          {/* List */}
          {filteredRegistrations.length === 0 ? (
            <IronCard pad={0}>
              <div style={{ padding: '54px 24px', textAlign: 'center' }}>
                <div style={{ height: 60, width: 60, display: 'grid', placeItems: 'center', borderRadius: 10, background: T.iron100, margin: '0 auto 16px' }}>
                  <Shield style={{ width: 28, height: 28, color: T.iron400 }} />
                </div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900, marginBottom: 6 }}>No Warranty Registrations</div>
                <div style={{ fontSize: 12.5, color: T.iron500, marginBottom: 16 }}>
                  {searchTerm ? 'No registrations match your search' : 'Start by registering a warranty for a product sold'}
                </div>
                <button style={btnPrimary} onClick={() => setShowRegisterModal(true)}>
                  <Plus style={{ width: 15, height: 15 }} />
                  Register First Warranty
                </button>
              </div>
            </IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredRegistrations.map((reg) => {
                const cfg = WARRANTY_STATUS[reg.status] || WARRANTY_STATUS.pending;
                const [bg, fg] = TONE_MAP[cfg.tone] || TONE_MAP.slate;
                const StatusIcon = cfg.icon;
                return (
                  <IronCard
                    key={reg.id}
                    pad={16}
                    style={{ cursor: 'pointer' }}
                    data-testid={`warranty-card-${reg.id}`}
                  >
                    <div
                      onClick={() => { setSelectedRegistration(reg); setShowDetailModal(true); }}
                      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                        <div style={{ height: 40, width: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: bg, color: fg }}>
                          <StatusIcon style={{ width: 20, height: 20 }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{reg.product_name}</span>
                            <StatusPill status={reg.status} />
                          </div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron400, marginTop: 3 }}>SN: {reg.serial_number}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, color: T.iron500, fontSize: 12.5 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <User style={{ width: 12, height: 12 }} />
                              {reg.customer_name}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Phone style={{ width: 12, height: 12 }} />
                              {reg.customer_phone}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Caps size={8.5} color={T.iron400}>Purchased</Caps>
                        <div style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: T.iron900, marginTop: 2 }}>{formatDate(reg.purchase_date)}</div>
                        {reg.warranty_expires && (
                          <>
                            <div style={{ marginTop: 8 }}><Caps size={8.5} color={T.iron400}>Expires</Caps></div>
                            <div style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: T.orange, marginTop: 2 }}>{formatDate(reg.warranty_expires)}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </IronCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Register Warranty Modal ── */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline }}>
              <Shield style={{ width: 18, height: 18, color: T.orange }} />
              Register New Warranty
            </DialogTitle>
            <DialogDescription>
              Fill in the details to register a warranty for a product sold to a customer
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
            {/* Product Selection */}
            <div>
              <label style={labelStyle}>Product *</label>
              <Select value={formData.product_id} onValueChange={(v) => handleInputChange('product_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
              <div>
                <label style={labelStyle}>Serial Number *</label>
                <input
                  value={formData.serial_number}
                  onChange={(e) => handleInputChange('serial_number', e.target.value)}
                  placeholder="Enter serial number"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Purchase Date *</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Invoice Number</label>
              <input
                value={formData.invoice_number}
                onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                placeholder="Your invoice number (optional)"
                style={inputStyle}
              />
            </div>

            <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>
                <User style={{ width: 15, height: 15, color: T.orange }} />
                Customer Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Customer Name *</label>
                  <input
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    placeholder="Full name"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    placeholder="10-digit mobile"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Email (Optional)</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => handleInputChange('customer_email', e.target.value)}
                  placeholder="email@example.com"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Address</label>
                <input
                  value={formData.customer_address}
                  onChange={(e) => handleInputChange('customer_address', e.target.value)}
                  placeholder="Street address"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 14 }}>
                {[
                  { field: 'customer_city',    label: 'City',    placeholder: 'City' },
                  { field: 'customer_state',   label: 'State',   placeholder: 'State' },
                  { field: 'customer_pincode', label: 'Pincode', placeholder: 'Pincode' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      value={formData[field]}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      placeholder={placeholder}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 14, borderTop: `1px solid ${T.iron200}` }}>
              <button style={btnOutline} onClick={() => setShowRegisterModal(false)}>
                Cancel
              </button>
              <button style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }} onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                  : <Shield style={{ width: 14, height: 14 }} />}
                Register Warranty
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail Modal ── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          {selectedRegistration && (
            <>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: T.headline }}>Warranty Details</DialogTitle>
              </DialogHeader>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                {/* Product row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                  <div style={{ height: 40, width: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: T.blueTint, color: T.blue }}>
                    <Package style={{ width: 20, height: 20 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRegistration.product_name}</div>
                    <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>SN: {selectedRegistration.serial_number}</div>
                  </div>
                  <StatusPill status={selectedRegistration.status} />
                </div>

                {/* Customer info */}
                <IronCard pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Caps size={9.5} color={T.iron400}>Customer Information</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: T.iron400 }}>Name</div>
                      <div style={{ fontWeight: 600, color: T.iron900, marginTop: 2 }}>{selectedRegistration.customer_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: T.iron400 }}>Phone</div>
                      <div style={{ fontWeight: 600, color: T.iron900, marginTop: 2 }}>{selectedRegistration.customer_phone}</div>
                    </div>
                    {selectedRegistration.customer_email && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 10.5, color: T.iron400 }}>Email</div>
                        <div style={{ fontWeight: 600, color: T.iron900, marginTop: 2 }}>{selectedRegistration.customer_email}</div>
                      </div>
                    )}
                    {selectedRegistration.customer_address && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 10.5, color: T.iron400 }}>Address</div>
                        <div style={{ fontWeight: 600, color: T.iron900, marginTop: 2 }}>
                          {selectedRegistration.customer_address}
                          {selectedRegistration.customer_city && `, ${selectedRegistration.customer_city}`}
                          {selectedRegistration.customer_state && `, ${selectedRegistration.customer_state}`}
                          {selectedRegistration.customer_pincode && ` - ${selectedRegistration.customer_pincode}`}
                        </div>
                      </div>
                    )}
                  </div>
                </IronCard>

                {/* Warranty period */}
                <IronCard pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Caps size={9.5} color={T.iron400}>Warranty Period</Caps>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: T.iron400 }}>Purchase Date</div>
                      <div style={{ ...mono, fontWeight: 600, color: T.iron900, marginTop: 2 }}>{formatDate(selectedRegistration.purchase_date)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: T.iron400 }}>Warranty Expires</div>
                      <div style={{ ...mono, fontWeight: 800, color: T.orange, marginTop: 2 }}>{formatDate(selectedRegistration.warranty_expires)}</div>
                    </div>
                    {selectedRegistration.invoice_number && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 10.5, color: T.iron400 }}>Invoice Number</div>
                        <div style={{ ...mono, fontWeight: 600, color: T.iron900, marginTop: 2 }}>{selectedRegistration.invoice_number}</div>
                      </div>
                    )}
                  </div>
                </IronCard>

                {selectedRegistration.rejection_reason && (
                  <div style={{ padding: 12, background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8 }}>
                    <div style={{ color: T.orangeDeep, fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <AlertCircle style={{ width: 15, height: 15, marginTop: 1, flexShrink: 0 }} />
                      <span><strong>Rejection Reason:</strong> {selectedRegistration.rejection_reason}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
