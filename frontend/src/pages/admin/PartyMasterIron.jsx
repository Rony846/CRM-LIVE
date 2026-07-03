import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Users, Plus, Loader2, Edit2, Eye, ShoppingCart,
  Truck, Wrench, Search, Upload, IndianRupee, Calculator,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Jammu and Kashmir", "Ladakh",
];

const PARTY_TYPE_CONFIG = {
  customer: { label: 'Customer', icon: ShoppingCart, tone: 'info' },
  supplier: { label: 'Supplier', icon: Truck, tone: 'ok' },
  contractor: { label: 'Contractor', icon: Wrench, tone: 'violet' },
};

const inr = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

// Light-theme classNames for shadcn form controls inside the (portal-rendered) dialogs.
const dlgInput = 'bg-white border-slate-300 text-slate-900 mt-1';
const dlgLabel = 'text-slate-600';

const StatTile = ({ label, value, icon: Icon, accent }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Caps size={9}>{label}</Caps>
      <Icon size={16} color={accent || T.iron400} strokeWidth={1.9} />
    </div>
    <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, marginTop: 8 }}>{value}</div>
  </IronCard>
);

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
    tds_exemption_valid_till: '',
  });
  const [tdsSections, setTdsSections] = useState([]);

  const isAdmin = user?.role === 'admin' || user?.role === 'accountant';

  useEffect(() => {
    fetchParties();
    fetchTdsSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchParties = async () => {
    try {
      const res = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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
      tds_exemption: false, tds_exemption_certificate: '', tds_exemption_valid_till: '',
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
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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
      tds_exemption_valid_till: party.tds_exemption_valid_till?.split('T')[0] || '',
    });
    setEditOpen(true);
  };

  const togglePartyType = (type) => {
    setForm(prev => ({
      ...prev,
      party_types: prev.party_types.includes(type)
        ? prev.party_types.filter(t => t !== type)
        : [...prev.party_types, type],
    }));
  };

  // Filter parties (handle both party_types array and legacy party_type string)
  const filteredParties = parties.filter(p => {
    const partyTypes = p.party_types || (p.party_type ? [p.party_type] : []);
    if (activeTab !== 'all' && !partyTypes.includes(activeTab)) return false;
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

  // Stats (handle both party_types array and legacy party_type string)
  const stats = {
    total: parties.length,
    customers: parties.filter(p => (p.party_types || (p.party_type ? [p.party_type] : [])).includes('customer')).length,
    suppliers: parties.filter(p => (p.party_types || (p.party_type ? [p.party_type] : [])).includes('supplier')).length,
    contractors: parties.filter(p => (p.party_types || (p.party_type ? [p.party_type] : [])).includes('contractor')).length,
    totalReceivable: parties.reduce((sum, p) => sum + (p.total_receivable || 0), 0),
    totalPayable: parties.reduce((sum, p) => sum + (p.total_payable || 0), 0),
  };

  const TABS = [
    ['all', `All (${stats.total})`, null],
    ['customer', `Customers (${stats.customers})`, ShoppingCart],
    ['supplier', `Suppliers (${stats.suppliers})`, Truck],
    ['contractor', `Contractors (${stats.contractors})`, Wrench],
  ];

  const headerRight = isAdmin ? (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => setMigrateOpen(true)} style={outlineBtn} data-testid="migrate-btn">
        <Upload size={14} /> Migrate Customers
      </button>
      <button onClick={() => { resetForm(); setCreateOpen(true); }} style={primaryBtn} data-testid="create-party-btn">
        <Plus size={14} /> Add Party
      </button>
    </div>
  ) : null;

  const partyTones = (p) => (p.party_types || (p.party_type ? [p.party_type] : []));

  const balanceCell = (bal) => {
    const v = Number(bal || 0);
    const color = v > 0 ? T.green : v < 0 ? T.orangeDeep : T.iron400;
    return (
      <span style={{ ...mono, fontWeight: 700, color }}>
        {inr(Math.abs(v))}
        {v > 0 && <span style={{ fontSize: 9, marginLeft: 3 }}>DR</span>}
        {v < 0 && <span style={{ fontSize: 9, marginLeft: 3 }}>CR</span>}
      </span>
    );
  };

  const headers = ['NAME', 'TYPE', 'GSTIN', 'STATE', 'PHONE', 'BALANCE', 'SOURCE', 'ACTIONS'];

  return (
    <IronShell
      title="Party Master"
      subtitle={`${stats.total.toLocaleString('en-IN')} PARTIES`}
      onRefresh={fetchParties}
      headerRight={headerRight}
    >
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatTile label="Total Parties" value={stats.total} icon={Users} accent={T.orange} />
        <StatTile label="Customers" value={stats.customers} icon={ShoppingCart} accent={T.blue} />
        <StatTile label="Suppliers" value={stats.suppliers} icon={Truck} accent={T.green} />
        <StatTile label="Contractors" value={stats.contractors} icon={Wrench} accent="#6D4AB0" />
        <StatTile label="Total Receivable" value={inr(stats.totalReceivable)} icon={IndianRupee} accent={T.green} />
        <StatTile label="Total Payable" value={inr(stats.totalPayable)} icon={IndianRupee} accent={T.orange} />
      </div>

      {/* Search + Tabs */}
      <IronCard pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: 320 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input
              placeholder="Search by name, phone, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="party-search"
              style={{ ...inputStyle, paddingLeft: 30, width: 340 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TABS.map(([val, label, Icon]) => {
              const active = activeTab === val;
              return (
                <button
                  key={val}
                  onClick={() => setActiveTab(val)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    border: `1px solid ${active ? T.iron900 : T.iron200}`,
                    background: active ? T.iron900 : T.white,
                    color: active ? '#fff' : T.iron700,
                    borderRadius: 6, padding: '7px 12px', cursor: 'pointer',
                    fontFamily: T.headline, fontWeight: 700, fontSize: 11.5,
                  }}
                >
                  {Icon && <Icon size={13} />} {label}
                </button>
              );
            })}
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <Caps size={10} color={T.iron700}>Parties ({filteredParties.length})</Caps>
        </div>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        ) : filteredParties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Users size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No parties found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : 'left' }}>
                      <Caps size={8.5}>{h}</Caps>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredParties.map((party) => (
                  <tr key={party.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{party.name}</div>
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {partyTones(party).map(type => (
                          <span key={type} style={badgeStyle(PARTY_TYPE_CONFIG[type]?.tone || 'slate')}>
                            {PARTY_TYPE_CONFIG[type]?.label || type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron700 }}>{party.gstin || '-'}</td>
                    <td style={tdCell}>{party.state}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron700 }}>{party.phone || '-'}</td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>{balanceCell(party.current_balance)}</td>
                    <td style={tdCell}>
                      <span style={badgeStyle(party.source === 'migrated_from_tickets' ? 'warn' : 'slate')}>
                        {party.source === 'migrated_from_tickets' ? 'Migrated' : 'Manual'}
                      </span>
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setSelectedParty(party); setViewOpen(true); }}
                          title="View"
                          style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Eye size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openEdit(party)}
                            title="Edit"
                            style={{ border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'inline-flex' }}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || editOpen} onOpenChange={(open) => {
        if (!open) { setCreateOpen(false); setEditOpen(false); }
      }}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOpen ? 'Edit Party' : 'Create New Party'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Party Types */}
            <div>
              <Label className={dlgLabel}>Party Types *</Label>
              <div className="flex gap-4 mt-2">
                {Object.entries(PARTY_TYPE_CONFIG).map(([type, config]) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.party_types.includes(type)}
                      onCheckedChange={() => togglePartyType(type)}
                      className="border-slate-400"
                    />
                    <span className="text-slate-700">{config.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dlgLabel}>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={dlgInput}
                  data-testid="party-name-input"
                />
              </div>
              <div>
                <Label className={dlgLabel}>Contact Person</Label>
                <Input
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  className={dlgInput}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dlgLabel}>GSTIN</Label>
                <Input
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g., 27AABCU9603R1ZM"
                  className={`${dlgInput} font-mono`}
                  maxLength={15}
                />
              </div>
              <div>
                <Label className={dlgLabel}>PAN</Label>
                <Input
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g., AABCU9603R"
                  className={`${dlgInput} font-mono`}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dlgLabel}>State *</Label>
                <Select
                  value={form.state}
                  onValueChange={(v) => setForm({ ...form, state: v })}
                >
                  <SelectTrigger className={dlgInput}>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {STATES.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dlgLabel}>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={dlgInput}
                />
              </div>
            </div>

            <div>
              <Label className={dlgLabel}>Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={dlgInput}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className={dlgLabel}>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={dlgInput}
                />
              </div>
              <div>
                <Label className={dlgLabel}>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={dlgInput}
                />
              </div>
              <div>
                <Label className={dlgLabel}>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  className={dlgInput}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dlgLabel}>Credit Limit (₹)</Label>
                <Input
                  type="number"
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
                  className={dlgInput}
                />
              </div>
              {!editOpen && (
                <div>
                  <Label className={dlgLabel}>Opening Balance (₹)</Label>
                  <Input
                    type="number"
                    value={form.opening_balance}
                    onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                    className={dlgInput}
                  />
                  <p className="text-xs text-slate-500 mt-1">+ve = Receivable, -ve = Payable</p>
                </div>
              )}
            </div>

            <div>
              <Label className={dlgLabel}>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={dlgInput}
                rows={2}
              />
            </div>

            {/* TDS Configuration Section */}
            {form.party_types.includes('supplier') && (
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="w-5 h-5" style={{ color: T.orange }} />
                  <span className="font-semibold text-slate-900">TDS Configuration</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <Checkbox
                    id="tds_applicable"
                    checked={form.tds_applicable}
                    onCheckedChange={(checked) => setForm({ ...form, tds_applicable: checked })}
                  />
                  <Label htmlFor="tds_applicable" className="text-slate-700 cursor-pointer">
                    TDS Applicable for this party
                  </Label>
                </div>

                {form.tds_applicable && (
                  <div className="space-y-4 pl-6 border-l-2" style={{ borderColor: 'rgba(245,130,32,0.3)' }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className={dlgLabel}>TDS Section</Label>
                        <Select
                          value={form.tds_section || 'none'}
                          onValueChange={(v) => setForm({ ...form, tds_section: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className={dlgInput}>
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
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
                        <Label className={dlgLabel}>Party Type (for TDS)</Label>
                        <Select
                          value={form.tds_party_type || 'none'}
                          onValueChange={(v) => setForm({ ...form, tds_party_type: v === 'none' ? '' : v })}
                        >
                          <SelectTrigger className={dlgInput}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
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
                        onCheckedChange={(checked) => setForm({ ...form, tds_exemption: checked })}
                      />
                      <Label htmlFor="tds_exemption" className="text-slate-700 cursor-pointer">
                        TDS Exemption Certificate
                      </Label>
                    </div>

                    {form.tds_exemption && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className={dlgLabel}>Certificate Number</Label>
                          <Input
                            value={form.tds_exemption_certificate}
                            onChange={(e) => setForm({ ...form, tds_exemption_certificate: e.target.value })}
                            placeholder="Certificate/Reference No."
                            className={dlgInput}
                          />
                        </div>
                        <div>
                          <Label className={dlgLabel}>Valid Till</Label>
                          <Input
                            type="date"
                            value={form.tds_exemption_valid_till}
                            onChange={(e) => setForm({ ...form, tds_exemption_valid_till: e.target.value })}
                            className={dlgInput}
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
              style={primaryBtn}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editOpen ? 'Save Changes' : 'Create Party'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-lg">
          <DialogHeader>
            <DialogTitle>Party Details</DialogTitle>
          </DialogHeader>
          {selectedParty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs">Name</Label>
                  <p className="text-slate-900 font-medium">{selectedParty.name}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Types</Label>
                  <div className="flex gap-1 mt-1">
                    {partyTones(selectedParty).map(type => (
                      <span key={type} style={badgeStyle(PARTY_TYPE_CONFIG[type]?.tone || 'slate')}>
                        {PARTY_TYPE_CONFIG[type]?.label || type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs">GSTIN</Label>
                  <p className="text-slate-900 font-mono">{selectedParty.gstin || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">State</Label>
                  <p className="text-slate-900">{selectedParty.state}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs">Phone</Label>
                  <p className="text-slate-900">{selectedParty.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs">Email</Label>
                  <p className="text-slate-900">{selectedParty.email || '-'}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-slate-500 text-xs">Current Balance</p>
                    <p className="text-xl font-bold" style={{
                      ...mono,
                      color: selectedParty.current_balance > 0 ? T.green
                        : selectedParty.current_balance < 0 ? T.orangeDeep : T.iron400,
                    }}>
                      {inr(Math.abs(selectedParty.current_balance || 0))}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedParty.current_balance > 0 ? 'Receivable' : selectedParty.current_balance < 0 ? 'Payable' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Credit Limit</p>
                    <p className="text-xl font-bold text-slate-900" style={mono}>
                      {inr(selectedParty.credit_limit || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Last Transaction</p>
                    <p className="text-sm text-slate-900" style={mono}>
                      {selectedParty.last_transaction_date
                        ? new Date(selectedParty.last_transaction_date).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedParty.address && (
                <div>
                  <Label className="text-slate-500 text-xs">Address</Label>
                  <p className="text-slate-900 text-sm">
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
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md">
          <DialogHeader>
            <DialogTitle>Migrate Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-700">
              This will import existing customers from tickets and dispatches into the Party Master.
            </p>
            <div className="p-3 rounded-lg" style={{ background: T.blueTint, border: `1px solid #CBE0F0` }}>
              <p className="text-sm font-semibold" style={{ color: T.blue }}>
                Deduplication Rules:
              </p>
              <ul className="text-sm mt-2 list-disc list-inside" style={{ color: T.blue }}>
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
              style={primaryBtn}
            >
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Migration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
