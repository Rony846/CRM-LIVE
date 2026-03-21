import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Building2, Plus, Loader2, Edit2, Trash2, CheckCircle, XCircle, Eye
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

export default function AdminFirms() {
  const { token } = useAuth();
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    gstin: '',
    address: '',
    state: '',
    pincode: '',
    contact_person: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchFirms();
  }, [token, showInactive]);

  const fetchFirms = async () => {
    try {
      const params = showInactive ? {} : { is_active: true };
      const response = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setFirms(response.data);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
      toast.error('Failed to load firms');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gstin: '',
      address: '',
      state: '',
      pincode: '',
      contact_person: '',
      phone: '',
      email: ''
    });
  };

  const validateGSTIN = (gstin) => {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin.toUpperCase());
  };

  const handleCreateFirm = async () => {
    if (!formData.name || !formData.gstin || !formData.address || !formData.state || !formData.pincode || !formData.contact_person) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!validateGSTIN(formData.gstin)) {
      toast.error('Invalid GSTIN format');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/firms`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Firm created successfully');
      setCreateOpen(false);
      resetForm();
      fetchFirms();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create firm');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (firm) => {
    setSelectedFirm(firm);
    setFormData({
      name: firm.name,
      gstin: firm.gstin,
      address: firm.address,
      state: firm.state,
      pincode: firm.pincode,
      contact_person: firm.contact_person,
      phone: firm.phone || '',
      email: firm.email || ''
    });
    setEditOpen(true);
  };

  const handleUpdateFirm = async () => {
    if (!formData.name || !formData.gstin || !formData.address || !formData.state || !formData.pincode || !formData.contact_person) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      await axios.patch(`${API}/firms/${selectedFirm.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Firm updated successfully');
      setEditOpen(false);
      resetForm();
      fetchFirms();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update firm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (firm) => {
    setActionLoading(true);
    try {
      await axios.patch(`${API}/firms/${firm.id}`, { is_active: !firm.is_active }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Firm ${firm.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchFirms();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update firm status');
    } finally {
      setActionLoading(false);
    }
  };

  const openViewDialog = (firm) => {
    setSelectedFirm(firm);
    setViewOpen(true);
  };

  // Calculate stats
  const stats = {
    total: firms.length,
    active: firms.filter(f => f.is_active).length,
    inactive: firms.filter(f => !f.is_active).length
  };

  if (loading) {
    return (
      <DashboardLayout title="Firms Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Firms Management">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Total Firms" 
            value={stats.total}
            icon={Building2}
            color="cyan"
          />
          <StatCard 
            title="Active Firms" 
            value={stats.active}
            icon={CheckCircle}
            color="green"
          />
          <StatCard 
            title="Inactive Firms" 
            value={stats.inactive}
            icon={XCircle}
            color="red"
          />
        </div>

        {/* Actions Bar */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showInactive"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <Label htmlFor="showInactive" className="text-slate-300 cursor-pointer">
                  Show inactive firms
                </Label>
              </div>
              <Button 
                onClick={() => { resetForm(); setCreateOpen(true); }}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="create-firm-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Firm
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Firms Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Registered Firms</CardTitle>
          </CardHeader>
          <CardContent>
            {firms.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No firms registered yet</p>
                <p className="text-sm mt-2">Click "Add New Firm" to create your first firm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Firm Name</TableHead>
                      <TableHead className="text-slate-300">GSTIN</TableHead>
                      <TableHead className="text-slate-300">State</TableHead>
                      <TableHead className="text-slate-300">Contact</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firms.map((firm) => (
                      <TableRow key={firm.id} className="border-slate-700" data-testid={`firm-row-${firm.id}`}>
                        <TableCell className="text-white font-medium">{firm.name}</TableCell>
                        <TableCell className="text-slate-300 font-mono text-sm">{firm.gstin}</TableCell>
                        <TableCell className="text-slate-300">{firm.state}</TableCell>
                        <TableCell className="text-slate-300">
                          <div>{firm.contact_person}</div>
                          {firm.phone && <div className="text-xs text-slate-400">{firm.phone}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge className={firm.is_active ? 'bg-green-600' : 'bg-red-600'}>
                            {firm.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(firm)}
                              className="text-slate-400 hover:text-white"
                              data-testid={`view-firm-${firm.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(firm)}
                              className="text-slate-400 hover:text-white"
                              data-testid={`edit-firm-${firm.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStatus(firm)}
                              className={firm.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
                              data-testid={`toggle-firm-${firm.id}`}
                            >
                              {firm.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </Button>
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

        {/* Create Firm Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-slate-300">Firm Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter firm name"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="firm-name-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">GSTIN *</Label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                    placeholder="e.g., 27AABCU9603R1ZM"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    maxLength={15}
                    data-testid="firm-gstin-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">GST Registered Address *</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Enter registered address"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="firm-address-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({...formData, state: value})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="firm-state-select">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {INDIAN_STATES.map(state => (
                        <SelectItem key={state} value={state} className="text-white">
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Pincode *</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                    placeholder="6 digits"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    maxLength={6}
                    data-testid="firm-pincode-input"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Contact Person *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    placeholder="Enter contact person name"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="firm-contact-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    placeholder="10 digits"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    maxLength={10}
                    data-testid="firm-phone-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="email@example.com"
                    type="email"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="firm-email-input"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateFirm} 
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="save-firm-btn"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Firm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Firm Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Firm</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-slate-300">Firm Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">GSTIN *</Label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    maxLength={15}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">GST Registered Address *</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({...formData, state: value})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {INDIAN_STATES.map(state => (
                        <SelectItem key={state} value={state} className="text-white">
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Pincode *</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    maxLength={6}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300">Contact Person *</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email</Label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    type="email"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateFirm} 
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Firm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Firm Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-500" />
                {selectedFirm?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedFirm && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">GSTIN</Label>
                    <p className="text-white font-mono">{selectedFirm.gstin}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Status</Label>
                    <Badge className={selectedFirm.is_active ? 'bg-green-600' : 'bg-red-600'}>
                      {selectedFirm.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-slate-400 text-xs">Registered Address</Label>
                    <p className="text-white">{selectedFirm.address}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">State</Label>
                    <p className="text-white">{selectedFirm.state}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Pincode</Label>
                    <p className="text-white">{selectedFirm.pincode}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-700">
                    <Label className="text-slate-400 text-xs">Contact Person</Label>
                    <p className="text-white">{selectedFirm.contact_person}</p>
                  </div>
                  {selectedFirm.phone && (
                    <div>
                      <Label className="text-slate-400 text-xs">Phone</Label>
                      <p className="text-white">{selectedFirm.phone}</p>
                    </div>
                  )}
                  {selectedFirm.email && (
                    <div>
                      <Label className="text-slate-400 text-xs">Email</Label>
                      <p className="text-white">{selectedFirm.email}</p>
                    </div>
                  )}
                  <div className="col-span-2 pt-2 border-t border-slate-700">
                    <Label className="text-slate-400 text-xs">Created</Label>
                    <p className="text-slate-300 text-sm">
                      {new Date(selectedFirm.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setViewOpen(false)} className="text-slate-300">
                Close
              </Button>
              <Button 
                onClick={() => { setViewOpen(false); openEditDialog(selectedFirm); }}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
