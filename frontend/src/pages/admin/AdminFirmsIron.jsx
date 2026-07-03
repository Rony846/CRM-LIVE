import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2, Plus, Loader2, Edit2, CheckCircle, XCircle, Eye
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statCards = [
    { label: 'Total Firms', value: stats.total, icon: Building2, tone: T.blue },
    { label: 'Active Firms', value: stats.active, icon: CheckCircle, tone: T.green },
    { label: 'Inactive Firms', value: stats.inactive, icon: XCircle, tone: T.orangeDeep },
  ];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const rowNeutralStyle = { ...rowActionStyle, border: `1px solid ${T.iron200}`, color: T.iron700 };

  const headers = ['FIRM NAME', 'GSTIN', 'STATE', 'CONTACT', 'STATUS', ''];

  const headerRight = (
    <Button
      onClick={() => { resetForm(); setCreateOpen(true); }}
      style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      data-testid="create-firm-btn"
    >
      <Plus className="w-4 h-4" />
      Add New Firm
    </Button>
  );

  return (
    <IronShell
      title="Firms"
      subtitle={`${stats.total.toLocaleString('en-IN')} FIRMS · GST REGISTERED ENTITIES`}
      onRefresh={fetchFirms}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Table card */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Caps size={10} color={T.iron700}>Registered Firms</Caps>
              <label htmlFor="showInactive" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="showInactive"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: T.orange }}
                />
                <span style={{ fontSize: 12.5, color: T.iron700, fontFamily: T.body }}>Show inactive firms</span>
              </label>
            </div>

            {firms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Building2 size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No firms registered yet</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Click "Add New Firm" to create your first firm</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {headers.map((h, i) => (
                        <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {firms.map((firm) => (
                      <tr key={firm.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`firm-row-${firm.id}`}>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{firm.name}</div>
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron700 }}>{firm.gstin}</td>
                        <td style={{ ...tdCell, fontSize: 12, color: T.iron700 }}>{firm.state}</td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12, color: T.iron900 }}>{firm.contact_person}</div>
                          {firm.phone && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{firm.phone}</div>}
                        </td>
                        <td style={tdCell}>
                          <span style={badgeStyle(firm.is_active ? 'ok' : 'bad')}>{firm.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => openViewDialog(firm)} title="View" style={rowActionStyle} data-testid={`view-firm-${firm.id}`}><Eye size={13} /></button>
                            <button onClick={() => openEditDialog(firm)} title="Edit" style={rowNeutralStyle} data-testid={`edit-firm-${firm.id}`}><Edit2 size={13} /></button>
                            <button
                              onClick={() => handleToggleStatus(firm)}
                              title={firm.is_active ? 'Deactivate' : 'Activate'}
                              style={{ ...rowNeutralStyle, color: firm.is_active ? T.orangeDeep : T.green }}
                              data-testid={`toggle-firm-${firm.id}`}
                            >
                              {firm.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create Firm Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Firm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Firm Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter firm name"
                  data-testid="firm-name-input"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>GSTIN *</Label>
                <Input
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g., 27AABCU9603R1ZM"
                  className="font-mono"
                  maxLength={15}
                  data-testid="firm-gstin-input"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>GST Registered Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter registered address"
                  data-testid="firm-address-input"
                />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger data-testid="firm-state-select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pincode *</Label>
                <Input
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="6 digits"
                  maxLength={6}
                  data-testid="firm-pincode-input"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Contact Person *</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Enter contact person name"
                  data-testid="firm-contact-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10 digits"
                  maxLength={10}
                  data-testid="firm-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  type="email"
                  data-testid="firm-email-input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFirm}
              disabled={actionLoading}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Firm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Firm Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>GSTIN *</Label>
                <Input
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="font-mono"
                  maxLength={15}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>GST Registered Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pincode *</Label>
                <Input
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  maxLength={6}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Contact Person *</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  type="email"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFirm}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Firm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Firm Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" style={{ color: T.orange }} />
              {selectedFirm?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedFirm && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs" style={{ color: T.iron400 }}>GSTIN</Label>
                  <p className="font-mono" style={{ color: T.iron900 }}>{selectedFirm.gstin}</p>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: T.iron400 }}>Status</Label>
                  <div><span style={badgeStyle(selectedFirm.is_active ? 'ok' : 'bad')}>{selectedFirm.is_active ? 'Active' : 'Inactive'}</span></div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs" style={{ color: T.iron400 }}>Registered Address</Label>
                  <p style={{ color: T.iron900 }}>{selectedFirm.address}</p>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: T.iron400 }}>State</Label>
                  <p style={{ color: T.iron900 }}>{selectedFirm.state}</p>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: T.iron400 }}>Pincode</Label>
                  <p style={{ color: T.iron900 }}>{selectedFirm.pincode}</p>
                </div>
                <div className="col-span-2 pt-2" style={{ borderTop: `1px solid ${T.iron200}` }}>
                  <Label className="text-xs" style={{ color: T.iron400 }}>Contact Person</Label>
                  <p style={{ color: T.iron900 }}>{selectedFirm.contact_person}</p>
                </div>
                {selectedFirm.phone && (
                  <div>
                    <Label className="text-xs" style={{ color: T.iron400 }}>Phone</Label>
                    <p style={{ color: T.iron900 }}>{selectedFirm.phone}</p>
                  </div>
                )}
                {selectedFirm.email && (
                  <div>
                    <Label className="text-xs" style={{ color: T.iron400 }}>Email</Label>
                    <p style={{ color: T.iron900 }}>{selectedFirm.email}</p>
                  </div>
                )}
                <div className="col-span-2 pt-2" style={{ borderTop: `1px solid ${T.iron200}` }}>
                  <Label className="text-xs" style={{ color: T.iron400 }}>Created</Label>
                  <p className="text-sm" style={{ color: T.iron700 }}>
                    {new Date(selectedFirm.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => { setViewOpen(false); openEditDialog(selectedFirm); }}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
