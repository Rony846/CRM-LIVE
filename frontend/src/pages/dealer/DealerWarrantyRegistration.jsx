import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield, Loader2, Plus, Search, CheckCircle2, Clock, XCircle,
  Calendar, User, Phone, MapPin, Package, FileText, Eye, AlertCircle
} from 'lucide-react';

// Obsidian status chip map
const WARRANTY_STATUS_TONES = {
  active:   { label: 'Active',               badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle2 },
  pending:  { label: 'Pending Verification', badge: 'bg-amber-400/15  text-amber-400  ring-amber-400/25',  icon: Clock },
  expired:  { label: 'Expired',              badge: 'bg-muted          text-muted-foreground ring-border',  icon: XCircle },
  rejected: { label: 'Rejected',             badge: 'bg-rose-500/15   text-rose-400   ring-rose-500/25',   icon: XCircle },
};

// Icon tile tones for stats
const STAT_TONES = {
  sky:    'bg-sky-400/15     text-sky-400',
  emerald:'bg-emerald-500/15 text-emerald-400',
  amber:  'bg-amber-400/15   text-amber-400',
};

const BADGE_BASE = 'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

function StatusBadge({ status }) {
  const cfg = WARRANTY_STATUS_TONES[status] || WARRANTY_STATUS_TONES.pending;
  const Icon = cfg.icon;
  return (
    <span className={`${BADGE_BASE} ${cfg.badge}`}>
      <Icon className="w-3 h-3 mr-1" />
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
    invoice_number: ''
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
        axios.get(`${API}/dealer/products-catalogue`, { headers: { Authorization: `Bearer ${token}` } })
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const required = ['product_id', 'serial_number', 'customer_name', 'customer_phone', 'purchase_date'];
    const missing = required.filter(f => !formData[f]);
    if (missing.length > 0) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/dealer/warranty-registrations`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Warranty registration submitted successfully');
      setShowRegisterModal(false);
      setFormData({
        product_id: '', serial_number: '', customer_name: '', customer_phone: '',
        customer_email: '', customer_address: '', customer_city: '', customer_state: '',
        customer_pincode: '', purchase_date: '', invoice_number: ''
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
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const filteredRegistrations = registrations.filter(reg =>
    !searchTerm ||
    reg.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total:   registrations.length,
    active:  registrations.filter(r => r.status === 'active').length,
    pending: registrations.filter(r => r.status === 'pending').length
  };

  if (loading) {
    return (
      <DashboardLayout title="Warranty Registration">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Warranty Registration">
      <div className="space-y-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Warranty Registration
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Register warranties for products sold to customers</p>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowRegisterModal(true)}
            data-testid="register-warranty-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Warranty
          </Button>
        </div>

        {/* ── KPI tiles ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Registrations', value: stats.total,   tone: 'sky',     Icon: Shield },
            { label: 'Active Warranties',   value: stats.active,  tone: 'emerald', Icon: CheckCircle2 },
            { label: 'Pending Verification',value: stats.pending, tone: 'amber',   Icon: Clock },
          ].map(({ label, value, tone, Icon }) => (
            <div key={label} className="mg-card rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
                </div>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${STAT_TONES[tone]}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="mg-card rounded-lg border border-border bg-card p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, serial number, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="warranty-search"
            />
          </div>
        </div>

        {/* ── List ────────────────────────────────────────────────── */}
        {filteredRegistrations.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Warranty Registrations</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchTerm ? 'No registrations match your search' : 'Start by registering a warranty for a product sold'}
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setShowRegisterModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Register First Warranty
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRegistrations.map((reg) => {
              const cfg = WARRANTY_STATUS_TONES[reg.status] || WARRANTY_STATUS_TONES.pending;
              const StatusIcon = cfg.icon;

              return (
                <div
                  key={reg.id}
                  className="mg-card rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedRegistration(reg);
                    setShowDetailModal(true);
                  }}
                  data-testid={`warranty-card-${reg.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* status icon tile */}
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${cfg.badge.split(' ').slice(0,2).join(' ')}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-foreground font-semibold">{reg.product_name}</span>
                          <StatusBadge status={reg.status} />
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">SN: {reg.serial_number}</p>
                        <div className="flex items-center gap-4 mt-2 text-muted-foreground text-sm">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {reg.customer_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {reg.customer_phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Purchased</p>
                      <p className="text-foreground text-sm font-semibold mt-0.5">{formatDate(reg.purchase_date)}</p>
                      {reg.warranty_expires && (
                        <>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mt-2">Expires</p>
                          <p className="text-primary text-sm font-semibold mt-0.5">{formatDate(reg.warranty_expires)}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Register Warranty Modal ──────────────────────────────── */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="bg-popover border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground text-xl flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Register New Warranty
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Fill in the details to register a warranty for a product sold to a customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Product *
                </Label>
                <Select value={formData.product_id} onValueChange={(v) => handleInputChange('product_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Serial Number *
                  </Label>
                  <Input
                    value={formData.serial_number}
                    onChange={(e) => handleInputChange('serial_number', e.target.value)}
                    placeholder="Enter serial number"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Purchase Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Invoice Number
                </Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  placeholder="Your invoice number (optional)"
                />
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Customer Details
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Customer Name *
                    </Label>
                    <Input
                      value={formData.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Phone Number *
                    </Label>
                    <Input
                      value={formData.customer_phone}
                      onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                      placeholder="10-digit mobile"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Email (Optional)
                  </Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Address
                  </Label>
                  <Input
                    value={formData.customer_address}
                    onChange={(e) => handleInputChange('customer_address', e.target.value)}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  {[
                    { field: 'customer_city',    label: 'City',    placeholder: 'City' },
                    { field: 'customer_state',   label: 'State',   placeholder: 'State' },
                    { field: 'customer_pincode', label: 'Pincode', placeholder: 'Pincode' },
                  ].map(({ field, label, placeholder }) => (
                    <div key={field} className="space-y-2">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </Label>
                      <Input
                        value={formData[field]}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowRegisterModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Shield className="w-4 h-4 mr-2" />}
                  Register Warranty
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Detail Modal ─────────────────────────────────────────── */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-popover border border-border max-w-lg">
            {selectedRegistration && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground text-xl">Warranty Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Product row */}
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-sky-400/15 text-sky-400">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold truncate">{selectedRegistration.product_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">SN: {selectedRegistration.serial_number}</p>
                    </div>
                    <StatusBadge status={selectedRegistration.status} />
                  </div>

                  {/* Customer info */}
                  <div className="mg-card rounded-lg border border-border bg-card p-4 space-y-3">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Customer Information
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Name</p>
                        <p className="text-foreground font-medium mt-0.5">{selectedRegistration.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Phone</p>
                        <p className="text-foreground font-medium mt-0.5">{selectedRegistration.customer_phone}</p>
                      </div>
                      {selectedRegistration.customer_email && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Email</p>
                          <p className="text-foreground font-medium mt-0.5">{selectedRegistration.customer_email}</p>
                        </div>
                      )}
                      {selectedRegistration.customer_address && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Address</p>
                          <p className="text-foreground font-medium mt-0.5">
                            {selectedRegistration.customer_address}
                            {selectedRegistration.customer_city && `, ${selectedRegistration.customer_city}`}
                            {selectedRegistration.customer_state && `, ${selectedRegistration.customer_state}`}
                            {selectedRegistration.customer_pincode && ` - ${selectedRegistration.customer_pincode}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warranty period */}
                  <div className="mg-card rounded-lg border border-border bg-card p-4 space-y-3">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Warranty Period
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Purchase Date</p>
                        <p className="text-foreground font-medium mt-0.5">{formatDate(selectedRegistration.purchase_date)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Warranty Expires</p>
                        <p className="text-primary font-bold mt-0.5">{formatDate(selectedRegistration.warranty_expires)}</p>
                      </div>
                      {selectedRegistration.invoice_number && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Invoice Number</p>
                          <p className="text-foreground font-medium mt-0.5">{selectedRegistration.invoice_number}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedRegistration.rejection_reason && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg">
                      <p className="text-rose-400 text-sm flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span><strong>Rejection Reason:</strong> {selectedRegistration.rejection_reason}</span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
