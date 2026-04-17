import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield, Loader2, Plus, Search, CheckCircle2, Clock, XCircle,
  Calendar, User, Phone, MapPin, Package, FileText, Eye, AlertCircle
} from 'lucide-react';

const WARRANTY_STATUSES = {
  active: { label: 'Active', color: 'bg-green-600', icon: CheckCircle2 },
  pending: { label: 'Pending Verification', color: 'bg-yellow-600', icon: Clock },
  expired: { label: 'Expired', color: 'bg-slate-600', icon: XCircle },
  rejected: { label: 'Rejected', color: 'bg-red-600', icon: XCircle }
};

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
    // Validate required fields
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
    total: registrations.length,
    active: registrations.filter(r => r.status === 'active').length,
    pending: registrations.filter(r => r.status === 'pending').length
  };

  if (loading) {
    return (
      <DashboardLayout title="Warranty Registration">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Warranty Registration">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-cyan-400" />
              Warranty Registration
            </h1>
            <p className="text-slate-400">Register warranties for products sold to customers</p>
          </div>
          <Button 
            className="bg-cyan-600 hover:bg-cyan-700"
            onClick={() => setShowRegisterModal(true)}
            data-testid="register-warranty-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Warranty
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Registrations</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Warranties</p>
                  <p className="text-2xl font-bold text-green-400">{stats.active}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Verification</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by customer name, serial number, or product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600 text-white"
                data-testid="warranty-search"
              />
            </div>
          </CardContent>
        </Card>

        {/* Registrations List */}
        {filteredRegistrations.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">No Warranty Registrations</h3>
              <p className="text-slate-400 mb-4">
                {searchTerm ? 'No registrations match your search' : 'Start by registering a warranty for a product sold'}
              </p>
              <Button 
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={() => setShowRegisterModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Register First Warranty
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRegistrations.map((reg) => {
              const statusConfig = WARRANTY_STATUSES[reg.status] || WARRANTY_STATUSES.pending;
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card 
                  key={reg.id} 
                  className="bg-slate-800 border-slate-700 hover:border-cyan-600/50 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedRegistration(reg);
                    setShowDetailModal(true);
                  }}
                  data-testid={`warranty-card-${reg.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg ${statusConfig.color} flex items-center justify-center flex-shrink-0`}>
                          <StatusIcon className="w-5 h-5 text-white" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold">{reg.product_name}</h3>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </div>
                          <p className="text-slate-500 text-sm font-mono">SN: {reg.serial_number}</p>
                          <div className="flex items-center gap-4 mt-2 text-slate-400 text-sm">
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
                      
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">Purchased</p>
                        <p className="text-white text-sm">{formatDate(reg.purchase_date)}</p>
                        {reg.warranty_expires && (
                          <>
                            <p className="text-slate-500 text-xs mt-1">Expires</p>
                            <p className="text-cyan-400 text-sm">{formatDate(reg.warranty_expires)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Register Warranty Modal */}
        <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white text-xl flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                Register New Warranty
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Fill in the details to register a warranty for a product sold to a customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label className="text-white">Product *</Label>
                <Select value={formData.product_id} onValueChange={(v) => handleInputChange('product_id', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-white hover:bg-slate-700">
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Serial Number *</Label>
                  <Input
                    value={formData.serial_number}
                    onChange={(e) => handleInputChange('serial_number', e.target.value)}
                    placeholder="Enter serial number"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Purchase Date *</Label>
                  <Input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => handleInputChange('purchase_date', e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Invoice Number</Label>
                <Input
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  placeholder="Your invoice number (optional)"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  Customer Details
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">Customer Name *</Label>
                    <Input
                      value={formData.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e.target.value)}
                      placeholder="Full name"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Phone Number *</Label>
                    <Input
                      value={formData.customer_phone}
                      onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                      placeholder="10-digit mobile"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-white">Email (Optional)</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                    placeholder="email@example.com"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-white">Address</Label>
                  <Input
                    value={formData.customer_address}
                    onChange={(e) => handleInputChange('customer_address', e.target.value)}
                    placeholder="Street address"
                    className="bg-slate-800 border-slate-600 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-white">City</Label>
                    <Input
                      value={formData.customer_city}
                      onChange={(e) => handleInputChange('customer_city', e.target.value)}
                      placeholder="City"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">State</Label>
                    <Input
                      value={formData.customer_state}
                      onChange={(e) => handleInputChange('customer_state', e.target.value)}
                      placeholder="State"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">Pincode</Label>
                    <Input
                      value={formData.customer_pincode}
                      onChange={(e) => handleInputChange('customer_pincode', e.target.value)}
                      placeholder="Pincode"
                      className="bg-slate-800 border-slate-600 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                <Button 
                  variant="outline" 
                  onClick={() => setShowRegisterModal(false)}
                  className="border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-cyan-600 hover:bg-cyan-700"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                  Register Warranty
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
            {selectedRegistration && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-xl">Warranty Details</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <Package className="w-8 h-8 text-cyan-400" />
                    <div>
                      <p className="text-white font-semibold">{selectedRegistration.product_name}</p>
                      <p className="text-slate-500 text-sm font-mono">SN: {selectedRegistration.serial_number}</p>
                    </div>
                    <Badge className={WARRANTY_STATUSES[selectedRegistration.status]?.color || 'bg-slate-600'} style={{marginLeft: 'auto'}}>
                      {WARRANTY_STATUSES[selectedRegistration.status]?.label || selectedRegistration.status}
                    </Badge>
                  </div>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-white font-semibold mb-2">Customer Information</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Name</p>
                          <p className="text-white">{selectedRegistration.customer_name}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Phone</p>
                          <p className="text-white">{selectedRegistration.customer_phone}</p>
                        </div>
                        {selectedRegistration.customer_email && (
                          <div className="col-span-2">
                            <p className="text-slate-500">Email</p>
                            <p className="text-white">{selectedRegistration.customer_email}</p>
                          </div>
                        )}
                        {selectedRegistration.customer_address && (
                          <div className="col-span-2">
                            <p className="text-slate-500">Address</p>
                            <p className="text-white">
                              {selectedRegistration.customer_address}
                              {selectedRegistration.customer_city && `, ${selectedRegistration.customer_city}`}
                              {selectedRegistration.customer_state && `, ${selectedRegistration.customer_state}`}
                              {selectedRegistration.customer_pincode && ` - ${selectedRegistration.customer_pincode}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="text-white font-semibold mb-2">Warranty Period</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Purchase Date</p>
                          <p className="text-white">{formatDate(selectedRegistration.purchase_date)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Warranty Expires</p>
                          <p className="text-cyan-400 font-semibold">{formatDate(selectedRegistration.warranty_expires)}</p>
                        </div>
                        {selectedRegistration.invoice_number && (
                          <div className="col-span-2">
                            <p className="text-slate-500">Invoice Number</p>
                            <p className="text-white">{selectedRegistration.invoice_number}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedRegistration.rejection_reason && (
                    <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg">
                      <p className="text-red-400 text-sm flex items-start gap-2">
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
