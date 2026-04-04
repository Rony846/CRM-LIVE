import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Users, Plus, Loader2, Edit2, Eye, Building2, ShoppingCart, 
  Truck, Wrench, Search, Download, Upload, IndianRupee, Calculator
} from 'lucide-react';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Jammu and Kashmir", "Ladakh"
];

const PARTY_TYPE_CONFIG = {
  customer: { label: 'Customer', icon: ShoppingCart, color: 'bg-blue-600' },
  supplier: { label: 'Supplier', icon: Truck, color: 'bg-green-600' },
  contractor: { label: 'Contractor', icon: Wrench, color: 'bg-purple-600' }
};

export default function PartyMaster() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    party_types: [],
    gstin: '',
    pan: '',
    state: '',
    address: '',
    city: '',
    pincode: '',
    phone: '',
    email: '',
    contact_person: '',
    credit_limit: 0,
    opening_balance: 0,
    notes: '',
    // TDS fields
    tds_applicable: false,
    tds_section: '',
    tds_party_type: '',
    tds_exemption: false,
    tds_exemption_certificate: '',
    tds_exemption_valid_till: ''
  });
  const [tdsSections, setTdsSections] = useState([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchParties();
    fetchTdsSections();
  }, [token]);

  const fetchParties = async () => {
    try {
      const res = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(res.data || []);
    } catch (error) {
      console.error('Failed to fetch parties:', error);
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const fetchTdsSections = async () => {
    try {
      const res = await axios.get(`${API}/tds/sections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTdsSections(res.data || []);
    } catch (error) {
      console.error('Failed to fetch TDS sections:', error);
    }
  };

  const resetForm = () => {
    setForm({
      name: '', party_types: [], gstin: '', pan: '', state: '',
      address: '', city: '', pincode: '', phone: '', email: '',
      contact_person: '', credit_limit: 0, opening_balance: 0, notes: '',
      tds_applicable: false, tds_section: '', tds_party_type: '',
      tds_exemption: false, tds_exemption_certificate: '', tds_exemption_valid_till: ''
    });
  };

  const handleCreate = async () => {
    if (!form.name || !form.state || form.party_types.length === 0) {
      toast.error('Name, State, and at least one Party Type are required');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/parties`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Party created successfully');
      setCreateOpen(false);
      resetForm();
      fetchParties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create party');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.name || !form.state) {
      toast.error('Name and State are required');
      return;
    }

    setActionLoading(true);
    try {
      await axios.patch(`${API}/parties/${selectedParty.id}`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Party updated successfully');
      setEditOpen(false);
      fetchParties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update party');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMigrate = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API}/parties/migrate-customers`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      setMigrateOpen(false);
      fetchParties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Migration failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (party) => {
    setSelectedParty(party);
    setForm({
      name: party.name || '',
      party_types: party.party_types || [],
      gstin: party.gstin || '',
      pan: party.pan || party.pan_number || '',
      state: party.state || '',
      address: party.address || '',
      city: party.city || '',
      pincode: party.pincode || '',
      phone: party.phone || '',
      email: party.email || '',
      contact_person: party.contact_person || '',
      credit_limit: party.credit_limit || 0,
      opening_balance: party.opening_balance || 0,
      notes: party.notes || '',
      tds_applicable: party.tds_applicable || false,
      tds_section: party.tds_section || '',
      tds_party_type: party.tds_party_type || '',
      tds_exemption: party.tds_exemption || false,
      tds_exemption_certificate: party.tds_exemption_certificate || '',
      tds_exemption_valid_till: party.tds_exemption_valid_till?.split('T')[0] || ''
    });
    setEditOpen(true);
  };

  const togglePartyType = (type) => {
    setForm(prev => ({
      ...prev,
      party_types: prev.party_types.includes(type)
        ? prev.party_types.filter(t => t !== type)
        : [...prev.party_types, type]
    }));
  };

  // Filter parties
  const filteredParties = parties.filter(p => {
    if (activeTab !== 'all' && !p.party_types.includes(activeTab)) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(search) ||
        p.phone?.toLowerCase().includes(search) ||
        p.gstin?.toLowerCase().includes(search) ||
        p.email?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    total: parties.length,
    customers: parties.filter(p => p.party_types.includes('customer')).length,
    suppliers: parties.filter(p => p.party_types.includes('supplier')).length,
    contractors: parties.filter(p => p.party_types.includes('contractor')).length,
    totalReceivable: parties.reduce((sum, p) => sum + (p.total_receivable || 0), 0),
    totalPayable: parties.reduce((sum, p) => sum + (p.total_payable || 0), 0)
  };

  if (loading) {
    return (
      <DashboardLayout title="Party Master">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Party Master">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard title="Total Parties" value={stats.total} icon={Users} color="cyan" />
          <StatCard title="Customers" value={stats.customers} icon={ShoppingCart} color="blue" />
          <StatCard title="Suppliers" value={stats.suppliers} icon={Truck} color="green" />
          <StatCard title="Contractors" value={stats.contractors} icon={Wrench} color="purple" />
          <StatCard 
            title="Total Receivable" 
            value={`₹${stats.totalReceivable.toLocaleString()}`} 
            icon={IndianRupee} 
            color="emerald" 
          />
          <StatCard 
            title="Total Payable" 
            value={`₹${stats.totalPayable.toLocaleString()}`} 
            icon={IndianRupee} 
            color="orange" 
          />
        </div>

        {/* Actions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, phone, GSTIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-80 pl-10 bg-slate-700 border-slate-600 text-white"
                    data-testid="party-search"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setMigrateOpen(true)}
                      className="border-slate-600"
                      data-testid="migrate-btn"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Migrate Customers
                    </Button>
                    <Button
                      onClick={() => { resetForm(); setCreateOpen(true); }}
                      className="bg-cyan-600 hover:bg-cyan-700"
                      data-testid="create-party-btn"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Party
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">
              All ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="customer" className="data-[state=active]:bg-blue-600">
              <ShoppingCart className="w-4 h-4 mr-1" />
              Customers ({stats.customers})
            </TabsTrigger>
            <TabsTrigger value="supplier" className="data-[state=active]:bg-green-600">
              <Truck className="w-4 h-4 mr-1" />
              Suppliers ({stats.suppliers})
            </TabsTrigger>
            <TabsTrigger value="contractor" className="data-[state=active]:bg-purple-600">
              <Wrench className="w-4 h-4 mr-1" />
              Contractors ({stats.contractors})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Parties ({filteredParties.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredParties.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No parties found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-300">Name</TableHead>
                          <TableHead className="text-slate-300">Type</TableHead>
                          <TableHead className="text-slate-300">GSTIN</TableHead>
                          <TableHead className="text-slate-300">State</TableHead>
                          <TableHead className="text-slate-300">Phone</TableHead>
                          <TableHead className="text-slate-300 text-right">Balance</TableHead>
                          <TableHead className="text-slate-300">Source</TableHead>
                          <TableHead className="text-slate-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredParties.map((party) => (
                          <TableRow key={party.id} className="border-slate-700">
                            <TableCell className="text-white font-medium">{party.name}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {party.party_types.map(type => (
                                  <Badge key={type} className={PARTY_TYPE_CONFIG[type]?.color}>
                                    {PARTY_TYPE_CONFIG[type]?.label}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300 font-mono text-sm">
                              {party.gstin || '-'}
                            </TableCell>
                            <TableCell className="text-slate-300">{party.state}</TableCell>
                            <TableCell className="text-slate-300">{party.phone || '-'}</TableCell>
                            <TableCell className={`text-right font-medium ${
                              party.current_balance > 0 ? 'text-green-400' : 
                              party.current_balance < 0 ? 'text-red-400' : 'text-slate-400'
                            }`}>
                              ₹{Math.abs(party.current_balance || 0).toLocaleString()}
                              {party.current_balance > 0 && <span className="text-xs ml-1">DR</span>}
                              {party.current_balance < 0 && <span className="text-xs ml-1">CR</span>}
                            </TableCell>
                            <TableCell>
                              <Badge className={party.source === 'migrated_from_tickets' ? 'bg-yellow-600' : 'bg-slate-600'}>
                                {party.source === 'migrated_from_tickets' ? 'Migrated' : 'Manual'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setSelectedParty(party); setViewOpen(true); }}
                                  className="text-slate-400 hover:text-white"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEdit(party)}
                                    className="text-blue-400 hover:text-blue-300"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={createOpen || editOpen} onOpenChange={(open) => {
          if (!open) { setCreateOpen(false); setEditOpen(false); }
        }}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editOpen ? 'Edit Party' : 'Create New Party'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Party Types */}
              <div>
                <Label className="text-slate-300">Party Types *</Label>
                <div className="flex gap-4 mt-2">
                  {Object.entries(PARTY_TYPE_CONFIG).map(([type, config]) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={form.party_types.includes(type)}
                        onCheckedChange={() => togglePartyType(type)}
                        className="border-slate-500"
                      />
                      <span className="text-slate-300">{config.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="party-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Contact Person</Label>
                  <Input
                    value={form.contact_person}
                    onChange={(e) => setForm({...form, contact_person: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">GSTIN</Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) => setForm({...form, gstin: e.target.value.toUpperCase()})}
                    placeholder="e.g., 27AABCU9603R1ZM"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label className="text-slate-300">PAN</Label>
                  <Input
                    value={form.pan}
                    onChange={(e) => setForm({...form, pan: e.target.value.toUpperCase()})}
                    placeholder="e.g., AABCU9603R"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">State *</Label>
                  <Select
                    value={form.state}
                    onValueChange={(v) => setForm({...form, state: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                      {STATES.map(state => (
                        <SelectItem key={state} value={state} className="text-white">
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({...form, city: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Address</Label>
                <Textarea
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({...form, phone: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Pincode</Label>
                  <Input
                    value={form.pincode}
                    onChange={(e) => setForm({...form, pincode: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Credit Limit (₹)</Label>
                  <Input
                    type="number"
                    value={form.credit_limit}
                    onChange={(e) => setForm({...form, credit_limit: parseFloat(e.target.value) || 0})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                {!editOpen && (
                  <div>
                    <Label className="text-slate-300">Opening Balance (₹)</Label>
                    <Input
                      type="number"
                      value={form.opening_balance}
                      onChange={(e) => setForm({...form, opening_balance: parseFloat(e.target.value) || 0})}
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                    <p className="text-xs text-slate-400 mt-1">+ve = Receivable, -ve = Payable</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-slate-300">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>

              {/* TDS Configuration Section */}
              {form.party_types.includes('supplier') && (
                <div className="border-t border-slate-600 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-orange-400" />
                    <span className="font-semibold text-white">TDS Configuration</span>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <Checkbox
                      id="tds_applicable"
                      checked={form.tds_applicable}
                      onCheckedChange={(checked) => setForm({...form, tds_applicable: checked})}
                    />
                    <Label htmlFor="tds_applicable" className="text-slate-300 cursor-pointer">
                      TDS Applicable for this party
                    </Label>
                  </div>

                  {form.tds_applicable && (
                    <div className="space-y-4 pl-6 border-l-2 border-orange-600/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300">TDS Section</Label>
                          <Select
                            value={form.tds_section || 'none'}
                            onValueChange={(v) => setForm({...form, tds_section: v === 'none' ? '' : v})}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                              <SelectValue placeholder="Select section" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem value="none">Select Section</SelectItem>
                              {tdsSections.filter(s => s.is_active).map(sec => (
                                <SelectItem key={sec.id} value={sec.section}>
                                  {sec.section} - {sec.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-slate-300">Party Type (for TDS)</Label>
                          <Select
                            value={form.tds_party_type || 'none'}
                            onValueChange={(v) => setForm({...form, tds_party_type: v === 'none' ? '' : v})}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              <SelectItem value="none">Select Type</SelectItem>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="proprietor">Proprietor</SelectItem>
                              <SelectItem value="huf">HUF</SelectItem>
                              <SelectItem value="firm">Partnership Firm</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                              <SelectItem value="aop">AOP/BOI</SelectItem>
                              <SelectItem value="others">Others</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="tds_exemption"
                          checked={form.tds_exemption}
                          onCheckedChange={(checked) => setForm({...form, tds_exemption: checked})}
                        />
                        <Label htmlFor="tds_exemption" className="text-slate-300 cursor-pointer">
                          TDS Exemption Certificate
                        </Label>
                      </div>

                      {form.tds_exemption && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-300">Certificate Number</Label>
                            <Input
                              value={form.tds_exemption_certificate}
                              onChange={(e) => setForm({...form, tds_exemption_certificate: e.target.value})}
                              placeholder="Certificate/Reference No."
                              className="bg-slate-700 border-slate-600 text-white mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-slate-300">Valid Till</Label>
                            <Input
                              type="date"
                              value={form.tds_exemption_valid_till}
                              onChange={(e) => setForm({...form, tds_exemption_valid_till: e.target.value})}
                              className="bg-slate-700 border-slate-600 text-white mt-1"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditOpen(false); }}>
                Cancel
              </Button>
              <Button
                onClick={editOpen ? handleUpdate : handleCreate}
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editOpen ? 'Save Changes' : 'Create Party'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Party Details</DialogTitle>
            </DialogHeader>
            {selectedParty && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Name</Label>
                    <p className="text-white font-medium">{selectedParty.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Types</Label>
                    <div className="flex gap-1 mt-1">
                      {selectedParty.party_types.map(type => (
                        <Badge key={type} className={PARTY_TYPE_CONFIG[type]?.color}>
                          {PARTY_TYPE_CONFIG[type]?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">GSTIN</Label>
                    <p className="text-white font-mono">{selectedParty.gstin || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">State</Label>
                    <p className="text-white">{selectedParty.state}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Phone</Label>
                    <p className="text-white">{selectedParty.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Email</Label>
                    <p className="text-white">{selectedParty.email || '-'}</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-slate-400 text-xs">Current Balance</p>
                      <p className={`text-xl font-bold ${
                        selectedParty.current_balance > 0 ? 'text-green-400' : 
                        selectedParty.current_balance < 0 ? 'text-red-400' : 'text-slate-400'
                      }`}>
                        ₹{Math.abs(selectedParty.current_balance || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">
                        {selectedParty.current_balance > 0 ? 'Receivable' : selectedParty.current_balance < 0 ? 'Payable' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Credit Limit</p>
                      <p className="text-xl font-bold text-white">
                        ₹{(selectedParty.credit_limit || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Last Transaction</p>
                      <p className="text-sm text-white">
                        {selectedParty.last_transaction_date 
                          ? new Date(selectedParty.last_transaction_date).toLocaleDateString()
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedParty.address && (
                  <div>
                    <Label className="text-slate-400 text-xs">Address</Label>
                    <p className="text-white text-sm">
                      {selectedParty.address}
                      {selectedParty.city && `, ${selectedParty.city}`}
                      {selectedParty.pincode && ` - ${selectedParty.pincode}`}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Migrate Confirmation Dialog */}
        <Dialog open={migrateOpen} onOpenChange={setMigrateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Migrate Customers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-300">
                This will import existing customers from tickets and dispatches into the Party Master.
              </p>
              <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <strong>Deduplication Rules:</strong>
                </p>
                <ul className="text-blue-300 text-sm mt-2 list-disc list-inside">
                  <li>Phone number (primary key)</li>
                  <li>Existing parties will be skipped</li>
                  <li>Migrated entries marked as "migrated_from_tickets"</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMigrateOpen(false)}>Cancel</Button>
              <Button
                onClick={handleMigrate}
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Start Migration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
