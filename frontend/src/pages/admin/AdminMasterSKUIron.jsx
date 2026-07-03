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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Package, Plus, Loader2, Edit2, Eye, Tag, Factory,
  Trash2, Box
} from 'lucide-react';
import AuthedImage from '@/components/ui/AuthedImage';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const CATEGORIES = ['Inverter', 'Battery', 'Stabilizer', 'Spare Part', 'Accessory', 'Other'];
const PLATFORMS = ['Amazon', 'Flipkart', 'Website', 'Distributor', 'B2B', 'Other'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function AdminMasterSKU() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [masterSKUs, setMasterSKUs] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [firms, setFirms] = useState([]);

  // Filter states
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterManufactured, setFilterManufactured] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [skuForm, setSkuForm] = useState({
    name: '', sku_code: '', category: '', hsn_code: '', unit: 'pcs',
    is_manufactured: false, product_type: '', manufacturing_role: '',
    production_charge_per_unit: '', reorder_level: 10, description: '', image_url: '',
    gst_rate: '', cost_price: '', selling_price: '', mrp: '', dealer_discount_percent: '',
    // LBH and Weight for shipping
    length_cm: '', breadth_cm: '', height_cm: '', weight_kg: ''
  });

  const [bomForm, setBomForm] = useState([]);
  const [aliasForm, setAliasForm] = useState({ alias_code: '', platform: '', notes: '' });
  const [uploadingSkuImage, setUploadingSkuImage] = useState(false);

  const handleSkuImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingSkuImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/master-skus/upload-image`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSkuForm((prev) => ({ ...prev, image_url: res.data.image_url || res.data.url }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setUploadingSkuImage(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [skusRes, rawMatsRes, firmsRes] = await Promise.all([
        axios.get(`${API}/master-skus`, { headers }),
        axios.get(`${API}/raw-materials`, { headers }),
        axios.get(`${API}/firms`, { headers, params: { is_active: true } })
      ]);
      setMasterSKUs(skusRes.data || []);
      setRawMaterials(rawMatsRes.data || []);
      setFirms(firmsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetSkuForm = () => {
    setSkuForm({
      name: '', sku_code: '', category: '', hsn_code: '', unit: 'pcs',
      is_manufactured: false, product_type: '', manufacturing_role: '',
      production_charge_per_unit: '', reorder_level: 10, description: '', image_url: '',
      gst_rate: '', cost_price: '', selling_price: '', mrp: '', dealer_discount_percent: '',
      length_cm: '', breadth_cm: '', height_cm: '', weight_kg: ''
    });
  };

  const handleCreateSKU = async () => {
    if (!skuForm.name || !skuForm.sku_code || !skuForm.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate mandatory financial fields
    if (!skuForm.hsn_code || !skuForm.hsn_code.trim()) {
      toast.error('HSN Code is mandatory');
      return;
    }
    // Validate HSN is 6 digits
    const hsnClean = String(skuForm.hsn_code).trim().replace('.0', '');
    if (hsnClean.length < 6) {
      toast.error('HSN Code must be at least 6 digits');
      return;
    }
    if (!/^\d+$/.test(hsnClean)) {
      toast.error('HSN Code must contain only digits');
      return;
    }
    if (skuForm.gst_rate === '' || skuForm.gst_rate === null || skuForm.gst_rate === undefined) {
      toast.error('GST Rate is mandatory');
      return;
    }
    if (skuForm.cost_price === '' || skuForm.cost_price === null || skuForm.cost_price === undefined) {
      toast.error('Cost Price is mandatory');
      return;
    }

    setActionLoading(true);
    try {
      // Clean form data - remove empty strings and convert numbers properly
      const reorderLevel = skuForm.reorder_level === '' || skuForm.reorder_level === null || skuForm.reorder_level === undefined
        ? 10
        : parseInt(skuForm.reorder_level) || 10;

      const productionCharge = skuForm.production_charge_per_unit === '' || skuForm.production_charge_per_unit === null || skuForm.production_charge_per_unit === undefined
        ? null
        : parseInt(skuForm.production_charge_per_unit) || null;

      const cleanedForm = {
        name: skuForm.name,
        sku_code: skuForm.sku_code,
        category: skuForm.category,
        hsn_code: skuForm.hsn_code ? String(skuForm.hsn_code) : '',  // Ensure string
        gst_rate: parseFloat(skuForm.gst_rate),
        cost_price: parseFloat(skuForm.cost_price),
        selling_price: skuForm.selling_price !== '' ? parseFloat(skuForm.selling_price) : null,
        mrp: skuForm.mrp !== '' ? parseFloat(skuForm.mrp) : null,
        dealer_discount_percent: skuForm.dealer_discount_percent !== '' ? parseFloat(skuForm.dealer_discount_percent) : null,
        unit: skuForm.unit || 'pcs',
        is_manufactured: skuForm.is_manufactured || false,
        product_type: skuForm.product_type || null,
        manufacturing_role: skuForm.manufacturing_role || null,
        production_charge_per_unit: productionCharge,
        reorder_level: reorderLevel,
        description: skuForm.description || null,
        image_url: skuForm.image_url || null,
        // LBH and Weight for shipping
        length_cm: skuForm.length_cm !== '' ? parseFloat(skuForm.length_cm) : null,
        breadth_cm: skuForm.breadth_cm !== '' ? parseFloat(skuForm.breadth_cm) : null,
        height_cm: skuForm.height_cm !== '' ? parseFloat(skuForm.height_cm) : null,
        weight_kg: skuForm.weight_kg !== '' ? parseFloat(skuForm.weight_kg) : null
      };

      await axios.post(`${API}/master-skus`, cleanedForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Master SKU created successfully');
      setCreateDialogOpen(false);
      resetSkuForm();
      fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail :
                       Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') :
                       'Failed to create Master SKU';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSKU = async () => {
    if (!skuForm.name || !skuForm.sku_code || !skuForm.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      // Clean form data - remove empty strings and convert numbers properly
      const reorderLevel = skuForm.reorder_level === '' || skuForm.reorder_level === null || skuForm.reorder_level === undefined
        ? 10
        : parseInt(skuForm.reorder_level) || 10;

      const productionCharge = skuForm.production_charge_per_unit === '' || skuForm.production_charge_per_unit === null || skuForm.production_charge_per_unit === undefined
        ? null
        : parseInt(skuForm.production_charge_per_unit) || null;

      const cleanedForm = {
        name: skuForm.name,
        sku_code: skuForm.sku_code,
        category: skuForm.category,
        hsn_code: skuForm.hsn_code ? String(skuForm.hsn_code) : null,  // Ensure string
        gst_rate: skuForm.gst_rate !== '' ? parseFloat(skuForm.gst_rate) : null,
        cost_price: skuForm.cost_price !== '' ? parseFloat(skuForm.cost_price) : null,
        selling_price: skuForm.selling_price !== '' ? parseFloat(skuForm.selling_price) : null,
        mrp: skuForm.mrp !== '' ? parseFloat(skuForm.mrp) : null,
        dealer_discount_percent: skuForm.dealer_discount_percent !== '' ? parseFloat(skuForm.dealer_discount_percent) : null,
        unit: skuForm.unit || 'pcs',
        is_manufactured: skuForm.is_manufactured || false,
        product_type: skuForm.product_type || null,
        manufacturing_role: skuForm.manufacturing_role || null,
        production_charge_per_unit: productionCharge,
        reorder_level: reorderLevel,
        description: skuForm.description || null,
        image_url: skuForm.image_url || null,
        // LBH and Weight for shipping
        length_cm: skuForm.length_cm !== '' ? parseFloat(skuForm.length_cm) : null,
        breadth_cm: skuForm.breadth_cm !== '' ? parseFloat(skuForm.breadth_cm) : null,
        height_cm: skuForm.height_cm !== '' ? parseFloat(skuForm.height_cm) : null,
        weight_kg: skuForm.weight_kg !== '' ? parseFloat(skuForm.weight_kg) : null
      };

      await axios.patch(`${API}/master-skus/${selectedSKU.id}`, cleanedForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Master SKU updated successfully');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail :
                       Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') :
                       'Failed to update Master SKU';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBOM = async () => {
    const validBOM = bomForm.filter(b => b.raw_material_id && b.quantity > 0);

    setActionLoading(true);
    try {
      await axios.patch(`${API}/master-skus/${selectedSKU.id}`, {
        is_manufactured: true,
        bill_of_materials: validBOM
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Bill of Materials saved successfully');
      setBomDialogOpen(false);
      fetchData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail :
                       Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') :
                       'Failed to save BOM';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!aliasForm.alias_code || !aliasForm.platform) {
      toast.error('Please fill alias code and platform');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/master-skus/${selectedSKU.id}/aliases`, aliasForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Alias added successfully');
      setAliasForm({ alias_code: '', platform: '', notes: '' });
      fetchData();
      // Refresh selected SKU
      const res = await axios.get(`${API}/master-skus/${selectedSKU.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedSKU(res.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail :
                       Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') :
                       'Failed to add alias';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAlias = async (aliasCode) => {
    setActionLoading(true);
    try {
      await axios.delete(`${API}/master-skus/${selectedSKU.id}/aliases/${aliasCode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Alias removed');
      fetchData();
      const res = await axios.get(`${API}/master-skus/${selectedSKU.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedSKU(res.data);
    } catch (error) {
      const detail = error.response?.data?.detail;
      const errorMsg = typeof detail === 'string' ? detail :
                       Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') :
                       'Failed to remove alias';
      toast.error(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (sku) => {
    setSelectedSKU(sku);
    setSkuForm({
      name: sku.name,
      sku_code: sku.sku_code,
      category: sku.category,
      hsn_code: sku.hsn_code || '',
      gst_rate: sku.gst_rate !== null && sku.gst_rate !== undefined ? sku.gst_rate : '',
      cost_price: sku.cost_price !== null && sku.cost_price !== undefined ? sku.cost_price : '',
      selling_price: sku.selling_price !== null && sku.selling_price !== undefined ? sku.selling_price : '',
      mrp: sku.mrp !== null && sku.mrp !== undefined ? sku.mrp : '',
      dealer_discount_percent: sku.dealer_discount_percent !== null && sku.dealer_discount_percent !== undefined ? sku.dealer_discount_percent : '',
      unit: sku.unit || 'pcs',
      is_manufactured: sku.is_manufactured || false,
      product_type: sku.product_type || '',
      manufacturing_role: sku.manufacturing_role || '',
      production_charge_per_unit: sku.production_charge_per_unit || '',
      reorder_level: sku.reorder_level || 10,
      description: sku.description || '',
      image_url: sku.image_url || '',
      // LBH and Weight for shipping
      length_cm: sku.length_cm !== null && sku.length_cm !== undefined ? sku.length_cm : '',
      breadth_cm: sku.breadth_cm !== null && sku.breadth_cm !== undefined ? sku.breadth_cm : '',
      height_cm: sku.height_cm !== null && sku.height_cm !== undefined ? sku.height_cm : '',
      weight_kg: sku.weight_kg !== null && sku.weight_kg !== undefined ? sku.weight_kg : ''
    });
    setEditDialogOpen(true);
  };

  const openBOMDialog = (sku) => {
    setSelectedSKU(sku);
    setBomForm(sku.bill_of_materials || [{ raw_material_id: '', quantity: 1 }]);
    setBomDialogOpen(true);
  };

  const openAliasDialog = (sku) => {
    setSelectedSKU(sku);
    setAliasForm({ alias_code: '', platform: '', notes: '' });
    setAliasDialogOpen(true);
  };

  const addBOMRow = () => {
    setBomForm([...bomForm, { raw_material_id: '', quantity: 1 }]);
  };

  const removeBOMRow = (index) => {
    if (bomForm.length > 1) {
      setBomForm(bomForm.filter((_, i) => i !== index));
    }
  };

  const updateBOMRow = (index, field, value) => {
    setBomForm(bomForm.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  // Filter SKUs
  const filteredSKUs = masterSKUs.filter(sku => {
    if (filterCategory !== 'all' && sku.category !== filterCategory) return false;
    if (filterManufactured === 'yes' && !sku.is_manufactured) return false;
    if (filterManufactured === 'no' && sku.is_manufactured) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesName = sku.name?.toLowerCase().includes(search);
      const matchesSKU = sku.sku_code?.toLowerCase().includes(search);
      const matchesAlias = sku.aliases?.some(a => a.alias_code?.toLowerCase().includes(search));
      if (!matchesName && !matchesSKU && !matchesAlias) return false;
    }
    return true;
  });

  // Stats
  const totalSKUs = masterSKUs.length;
  const manufacturedSKUs = masterSKUs.filter(s => s.is_manufactured).length;
  const withBOM = masterSKUs.filter(s => s.bill_of_materials?.length > 0).length;
  const withAliases = masterSKUs.filter(s => s.aliases?.length > 0).length;

  const statCards = [
    { label: 'Total Master SKUs', value: totalSKUs, icon: Package, tone: T.orange },
    { label: 'Manufactured Products', value: manufacturedSKUs, icon: Factory, tone: T.green },
    { label: 'With BOM Defined', value: withBOM, icon: Box, tone: T.blue },
    { label: 'With Platform Aliases', value: withAliases, icon: Tag, tone: '#6D4AB0' },
  ];

  // Light dialog form control classes (Iron Console theme)
  const dLabel = 'text-slate-700';
  const dLabelSm = 'text-slate-500';
  const dInput = 'mt-1';

  const headers = ['IMAGE', 'SKU CODE', 'NAME', 'CATEGORY', 'TYPE', 'LBH (CM)', 'WEIGHT', 'STATUS', 'ACTIONS'];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };

  return (
    <IronShell
      title="Master SKUs"
      subtitle={`${totalSKUs.toLocaleString('en-IN')} SKUS · BOM + PLATFORM ALIASES`}
      onRefresh={fetchData}
      headerRight={
        <button onClick={() => { resetSkuForm(); setCreateDialogOpen(true); }} data-testid="create-sku-btn" style={primaryBtn}>
          <Plus size={14} strokeWidth={2.2} /> Create Master SKU
        </button>
      }
    >
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
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Filters + table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, SKU, or alias…"
                  data-testid="search-input"
                  style={{ ...inputStyle, width: 250 }}
                />
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={filterManufactured} onChange={(e) => setFilterManufactured(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="all">All Types</option>
                  <option value="yes">Manufactured</option>
                  <option value="no">Not Manufactured</option>
                </select>
              </div>
              <Caps size={9} color={T.iron400}>{filteredSKUs.length} shown</Caps>
            </div>

            {filteredSKUs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No Master SKUs found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Create your first Master SKU to get started.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                  </tr></thead>
                  <tbody>{filteredSKUs.map((sku) => (
                    <tr key={sku.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        {sku.image_url ? (
                          <img src={sku.image_url} alt={sku.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.iron200}` }} />
                        ) : sku.images && sku.images.length > 0 ? (
                          <AuthedImage path={sku.images[0]} token={token} apiBase={API} alt={sku.name} className="w-11 h-11 object-cover rounded-md border border-slate-200" />
                        ) : (
                          <div title="No image — upload one so it shows in the app shop" style={{ width: 44, height: 44, borderRadius: 6, border: `1px dashed ${T.orange}`, background: T.iron50, display: 'grid', placeItems: 'center' }}>
                            <Package size={18} color={T.orange} strokeWidth={1.8} />
                          </div>
                        )}
                      </td>
                      <td style={tdCell}><span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{sku.sku_code}</span></td>
                      <td style={{ ...tdCell, maxWidth: 240 }}><span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{sku.name}</span></td>
                      <td style={tdCell}><span style={badgeStyle('slate')}>{sku.category}</span></td>
                      <td style={tdCell}>
                        {sku.is_manufactured
                          ? <span style={badgeStyle('ok')}>Manufactured</span>
                          : <span style={badgeStyle('slate')}>Purchased</span>}
                      </td>
                      <td style={tdCell}>
                        {sku.length_cm && sku.breadth_cm && sku.height_cm
                          ? <span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{sku.length_cm}x{sku.breadth_cm}x{sku.height_cm}</span>
                          : <span style={{ fontSize: 11, color: T.orangeDeep }}>Not set</span>}
                      </td>
                      <td style={tdCell}>
                        {sku.weight_kg
                          ? <span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{sku.weight_kg} kg</span>
                          : <span style={{ fontSize: 11, color: T.orangeDeep }}>Not set</span>}
                      </td>
                      <td style={tdCell}>
                        {sku.is_active
                          ? <span style={badgeStyle('ok')}>Active</span>
                          : <span style={badgeStyle('bad')}>Inactive</span>}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setSelectedSKU(sku); setViewDialogOpen(true); }} title="View" style={rowActionStyle}><Eye size={13} /></button>
                          <button onClick={() => openEditDialog(sku)} title="Edit" style={{ ...rowActionStyle, color: T.blue, borderColor: T.iron200 }}><Edit2 size={13} /></button>
                          <button onClick={() => openBOMDialog(sku)} title="Manage BOM" style={{ ...rowActionStyle, color: T.green, borderColor: T.iron200 }}><Factory size={13} /></button>
                          <button onClick={() => openAliasDialog(sku)} title="Manage Aliases" style={{ ...rowActionStyle, color: '#6D4AB0', borderColor: T.iron200 }}><Tag size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create Master SKU Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Master SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>Name *</Label>
                <Input
                  value={skuForm.name}
                  onChange={(e) => setSkuForm({...skuForm, name: e.target.value})}
                  placeholder="e.g., MuscleGrid 1000VA Inverter"
                  className={dInput}
                  data-testid="sku-name-input"
                />
              </div>
              <div>
                <Label className={dLabel}>SKU Code *</Label>
                <Input
                  value={skuForm.sku_code}
                  onChange={(e) => setSkuForm({...skuForm, sku_code: e.target.value.toUpperCase()})}
                  placeholder="e.g., MG-INV-1000"
                  className="mt-1 font-mono"
                  data-testid="sku-code-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>Category *</Label>
                <Select
                  value={skuForm.category}
                  onValueChange={(v) => setSkuForm({...skuForm, category: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dLabel}>HSN Code * <span className="text-xs text-slate-400">(6 digits min)</span></Label>
                <Input
                  value={skuForm.hsn_code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSkuForm({...skuForm, hsn_code: val});
                  }}
                  placeholder="e.g., 850440"
                  className="mt-1 font-mono"
                  data-testid="sku-hsn-input"
                  maxLength={8}
                />
                <p className={`text-xs mt-1 ${skuForm.hsn_code?.length >= 6 ? 'text-green-600' : 'text-orange-600'}`}>
                  {skuForm.hsn_code?.length || 0}/6 digits {skuForm.hsn_code?.length >= 6 ? '✓' : '(minimum 6 required)'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>GST Rate (%) *</Label>
                <Select
                  value={skuForm.gst_rate?.toString() || ''}
                  onValueChange={(v) => setSkuForm({...skuForm, gst_rate: v})}
                >
                  <SelectTrigger className="mt-1" data-testid="sku-gst-select">
                    <SelectValue placeholder="Select GST rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dLabel}>Cost Price (₹) *</Label>
                <Input
                  type="number"
                  value={skuForm.cost_price}
                  onChange={(e) => setSkuForm({...skuForm, cost_price: e.target.value})}
                  placeholder="e.g., 5000"
                  className={dInput}
                  min="0"
                  step="0.01"
                  data-testid="sku-cost-input"
                />
              </div>
            </div>

            {/* Selling Prices Section */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Label className="text-orange-700 text-sm font-medium">Selling Prices (optional - for Sales Invoices)</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className={dLabel}>Selling Price (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.selling_price}
                    onChange={(e) => setSkuForm({...skuForm, selling_price: e.target.value})}
                    placeholder="e.g., 7500"
                    className={dInput}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className={dLabel}>MRP (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.mrp}
                    onChange={(e) => setSkuForm({...skuForm, mrp: e.target.value})}
                    placeholder="e.g., 9999"
                    className={dInput}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Note: Dispatches usually carry their own invoice value. These are used only for manual invoices.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>Unit</Label>
                <Select
                  value={skuForm.unit}
                  onValueChange={(v) => setSkuForm({...skuForm, unit: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                    <SelectItem value="set">Set</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dLabel}>Reorder Level</Label>
                <Input
                  type="number"
                  value={skuForm.reorder_level}
                  onChange={(e) => setSkuForm({...skuForm, reorder_level: parseInt(e.target.value) || 10})}
                  className={dInput}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Switch
                checked={skuForm.is_manufactured}
                onCheckedChange={(v) => setSkuForm({...skuForm, is_manufactured: v})}
                data-testid="is-manufactured-switch"
              />
              <div>
                <Label className={dLabel}>This product is Manufactured</Label>
                <p className="text-xs text-slate-500">Enable to define Bill of Materials (BOM) after creation</p>
              </div>
            </div>

            {/* Production Settings */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <Label className="text-orange-700 font-medium">Production Settings</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={`${dLabel} text-sm`}>Product Type</Label>
                  <Select
                    value={skuForm.product_type}
                    onValueChange={(v) => setSkuForm({...skuForm, product_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufactured">Manufactured</SelectItem>
                      <SelectItem value="traded">Traded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Manufacturing Role</Label>
                  <Select
                    value={skuForm.manufacturing_role}
                    onValueChange={(v) => setSkuForm({...skuForm, manufacturing_role: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">Supervisor (Battery)</SelectItem>
                      <SelectItem value="technician">Technician (Inverter)</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {skuForm.manufacturing_role === 'supervisor' && (
                <div>
                  <Label className={`${dLabel} text-sm`}>Production Charge per Unit (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.production_charge_per_unit}
                    onChange={(e) => setSkuForm({...skuForm, production_charge_per_unit: parseFloat(e.target.value) || ''})}
                    placeholder="e.g., 2000"
                    className={dInput}
                  />
                  <p className="text-xs text-slate-500 mt-1">Contractor charge paid to supervisor per unit produced</p>
                </div>
              )}
            </div>

            {/* Shipping Dimensions - LBH & Weight */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <Label className="text-orange-700 font-medium">Shipping Dimensions (for Courier Labels)</Label>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className={`${dLabel} text-sm`}>Length (cm)</Label>
                  <Input type="number" value={skuForm.length_cm} onChange={(e) => setSkuForm({...skuForm, length_cm: e.target.value})} placeholder="L" className={dInput} data-testid="input-length" />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Breadth (cm)</Label>
                  <Input type="number" value={skuForm.breadth_cm} onChange={(e) => setSkuForm({...skuForm, breadth_cm: e.target.value})} placeholder="B" className={dInput} data-testid="input-breadth" />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Height (cm)</Label>
                  <Input type="number" value={skuForm.height_cm} onChange={(e) => setSkuForm({...skuForm, height_cm: e.target.value})} placeholder="H" className={dInput} data-testid="input-height" />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Weight (kg)</Label>
                  <Input type="number" step="0.1" value={skuForm.weight_kg} onChange={(e) => setSkuForm({...skuForm, weight_kg: e.target.value})} placeholder="KG" className={dInput} data-testid="input-weight" />
                </div>
              </div>
              <p className="text-xs text-slate-500">Used for automatic shipping rate calculation</p>
            </div>

            <div>
              <Label className={dLabel}>Description</Label>
              <Textarea
                value={skuForm.description}
                onChange={(e) => setSkuForm({...skuForm, description: e.target.value})}
                placeholder="Product description..."
                className={dInput}
                rows={2}
              />
            </div>

            <div>
              <Label className={dLabel}>Product image <span className="text-slate-400">(shown to customers in the app shop)</span></Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={skuForm.image_url}
                  onChange={(e) => setSkuForm({...skuForm, image_url: e.target.value})}
                  placeholder="Paste an image URL, or upload →"
                />
                <label className="shrink-0">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSkuImageUpload} disabled={uploadingSkuImage} />
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm cursor-pointer whitespace-nowrap">
                    {uploadingSkuImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Upload
                  </span>
                </label>
              </div>
              {skuForm.image_url ? (
                <img src={skuForm.image_url} alt="" className="mt-2 h-20 w-20 object-cover rounded border border-slate-200" />
              ) : null}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSKU}
              disabled={actionLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="create-sku-submit"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Master SKU'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Master SKU Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Master SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>Name *</Label>
                <Input
                  value={skuForm.name}
                  onChange={(e) => setSkuForm({...skuForm, name: e.target.value})}
                  className={dInput}
                />
              </div>
              <div>
                <Label className={dLabel}>SKU Code *</Label>
                <Input
                  value={skuForm.sku_code}
                  onChange={(e) => setSkuForm({...skuForm, sku_code: e.target.value.toUpperCase()})}
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>Category *</Label>
                <Select
                  value={skuForm.category}
                  onValueChange={(v) => setSkuForm({...skuForm, category: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dLabel}>HSN Code * <span className="text-xs text-slate-400">(6 digits min)</span></Label>
                <Input
                  value={skuForm.hsn_code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSkuForm({...skuForm, hsn_code: val});
                  }}
                  placeholder="e.g., 850440"
                  className="mt-1 font-mono"
                  maxLength={8}
                />
                <p className={`text-xs mt-1 ${skuForm.hsn_code?.length >= 6 ? 'text-green-600' : 'text-orange-600'}`}>
                  {skuForm.hsn_code?.length || 0}/6 digits {skuForm.hsn_code?.length >= 6 ? '✓' : '(minimum 6 required)'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className={dLabel}>GST Rate (%)</Label>
                <Select
                  value={skuForm.gst_rate?.toString() || ''}
                  onValueChange={(v) => setSkuForm({...skuForm, gst_rate: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select GST rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={dLabel}>Cost Price (₹)</Label>
                <Input
                  type="number"
                  value={skuForm.cost_price}
                  onChange={(e) => setSkuForm({...skuForm, cost_price: e.target.value})}
                  placeholder="e.g., 5000"
                  className={dInput}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <Label className="text-orange-700 text-sm font-medium">Selling Prices (for Sales Invoices)</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label className={dLabel}>Selling Price (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.selling_price}
                    onChange={(e) => setSkuForm({...skuForm, selling_price: e.target.value})}
                    placeholder="e.g., 7500"
                    className={dInput}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-slate-500 mt-1">Used for manual sales invoices</p>
                </div>
                <div>
                  <Label className={dLabel}>MRP (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.mrp}
                    onChange={(e) => setSkuForm({...skuForm, mrp: e.target.value})}
                    placeholder="e.g., 9999"
                    className={dInput}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-slate-500 mt-1">Maximum retail price</p>
                </div>
              </div>
              <div className="mt-3">
                <Label className={dLabel}>Dealer Discount (%)</Label>
                <Input
                  type="number"
                  value={skuForm.dealer_discount_percent}
                  onChange={(e) => setSkuForm({...skuForm, dealer_discount_percent: e.target.value})}
                  placeholder="e.g., 15"
                  className={dInput}
                  min="0"
                  max="50"
                  step="1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Discount for dealers (e.g., 15 = 15% off selling price)
                  {skuForm.selling_price && skuForm.dealer_discount_percent && (
                    <span className="text-green-600 ml-2">
                      → Dealer price: ₹{(skuForm.selling_price * (1 - skuForm.dealer_discount_percent / 100)).toFixed(0)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <Label className={dLabel}>Reorder Level</Label>
              <Input
                type="number"
                value={skuForm.reorder_level}
                onChange={(e) => setSkuForm({...skuForm, reorder_level: parseInt(e.target.value) || 10})}
                className={dInput}
              />
            </div>

            {/* Shipping Dimensions - LBH & Weight (Edit) */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <Label className="text-orange-700 font-medium">Shipping Dimensions (for Courier Labels)</Label>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className={`${dLabel} text-sm`}>Length (cm)</Label>
                  <Input type="number" value={skuForm.length_cm} onChange={(e) => setSkuForm({...skuForm, length_cm: e.target.value})} placeholder="L" className={dInput} />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Breadth (cm)</Label>
                  <Input type="number" value={skuForm.breadth_cm} onChange={(e) => setSkuForm({...skuForm, breadth_cm: e.target.value})} placeholder="B" className={dInput} />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Height (cm)</Label>
                  <Input type="number" value={skuForm.height_cm} onChange={(e) => setSkuForm({...skuForm, height_cm: e.target.value})} placeholder="H" className={dInput} />
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Weight (kg)</Label>
                  <Input type="number" step="0.1" value={skuForm.weight_kg} onChange={(e) => setSkuForm({...skuForm, weight_kg: e.target.value})} placeholder="KG" className={dInput} />
                </div>
              </div>
              <p className="text-xs text-slate-500">Used for automatic shipping rate calculation</p>
            </div>

            <div>
              <Label className={dLabel}>Description</Label>
              <Textarea
                value={skuForm.description}
                onChange={(e) => setSkuForm({...skuForm, description: e.target.value})}
                className={dInput}
                rows={2}
              />
            </div>

            <div>
              <Label className={dLabel}>Product image <span className="text-slate-400">(shown to customers in the app shop)</span></Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={skuForm.image_url}
                  onChange={(e) => setSkuForm({...skuForm, image_url: e.target.value})}
                  placeholder="Paste an image URL, or upload →"
                />
                <label className="shrink-0">
                  <input type="file" accept="image/*" className="hidden" onChange={handleSkuImageUpload} disabled={uploadingSkuImage} />
                  <span className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm cursor-pointer whitespace-nowrap">
                    {uploadingSkuImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Upload
                  </span>
                </label>
              </div>
              {skuForm.image_url ? (
                <img src={skuForm.image_url} alt="" className="mt-2 h-20 w-20 object-cover rounded border border-slate-200" />
              ) : null}
            </div>

            {/* Production Settings in Edit */}
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <Label className="text-orange-700 font-medium">Production Settings</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={`${dLabel} text-sm`}>Product Type</Label>
                  <Select
                    value={skuForm.product_type}
                    onValueChange={(v) => setSkuForm({...skuForm, product_type: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufactured">Manufactured</SelectItem>
                      <SelectItem value="traded">Traded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={`${dLabel} text-sm`}>Manufacturing Role</Label>
                  <Select
                    value={skuForm.manufacturing_role}
                    onValueChange={(v) => setSkuForm({...skuForm, manufacturing_role: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supervisor">Supervisor (Battery)</SelectItem>
                      <SelectItem value="technician">Technician (Inverter)</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {skuForm.manufacturing_role === 'supervisor' && (
                <div>
                  <Label className={`${dLabel} text-sm`}>Production Charge per Unit (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.production_charge_per_unit}
                    onChange={(e) => setSkuForm({...skuForm, production_charge_per_unit: parseFloat(e.target.value) || ''})}
                    placeholder="e.g., 2000"
                    className={dInput}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSKU}
              disabled={actionLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Master SKU Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Master SKU Details</DialogTitle>
          </DialogHeader>
          {selectedSKU && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 text-xs">Name</Label>
                  <p className="text-slate-900 font-medium">{selectedSKU.name}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">SKU Code</Label>
                  <p className="font-mono" style={{ color: T.orangeDeep }}>{selectedSKU.sku_code}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Category</Label>
                  <p className="text-slate-900">{selectedSKU.category}</p>
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Type</Label>
                  <p>
                    {selectedSKU.is_manufactured ? (
                      <Badge className="bg-emerald-600">Manufactured</Badge>
                    ) : (
                      <Badge className="bg-slate-500">Purchased</Badge>
                    )}
                  </p>
                </div>
              </div>

              {selectedSKU.bill_of_materials?.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <Label className="text-emerald-600 font-medium">Bill of Materials</Label>
                  <div className="mt-2 space-y-2">
                    {selectedSKU.bill_of_materials.map((bom, i) => {
                      const rm = rawMaterials.find(r => r.id === bom.raw_material_id);
                      return (
                        <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                          <span className="text-slate-900">{rm?.name || bom.raw_material_id}</span>
                          <Badge className="bg-pink-600">{bom.quantity} {rm?.unit || 'pcs'}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedSKU.aliases?.length > 0 && (
                <div className="border border-slate-200 rounded-lg p-4">
                  <Label className="text-purple-600 font-medium">Platform Aliases</Label>
                  <div className="mt-2 space-y-2">
                    {selectedSKU.aliases.map((alias, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <div>
                          <span className="font-mono" style={{ color: T.orangeDeep }}>{alias.alias_code}</span>
                          <span className="text-slate-500 text-sm ml-2">({alias.platform})</span>
                        </div>
                        {alias.notes && <span className="text-slate-500 text-xs">{alias.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM Management Dialog */}
      <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-emerald-600" />
              Bill of Materials - {selectedSKU?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-500 text-sm">
              Define the raw materials needed to manufacture 1 unit of this product.
            </p>

            <div className="space-y-3">
              {bomForm.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-7">
                    <Label className="text-slate-400 text-xs">Raw Material</Label>
                    <Select
                      value={item.raw_material_id}
                      onValueChange={(v) => updateBOMRow(index, 'raw_material_id', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select raw material" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {rawMaterials.map(rm => (
                          <SelectItem key={rm.id} value={rm.id}>
                            {rm.name} ({rm.sku_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-slate-400 text-xs">Qty per unit</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateBOMRow(index, 'quantity', parseInt(e.target.value) || 1)}
                      className={dInput}
                    />
                  </div>
                  <div className="col-span-2">
                    {bomForm.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeBOMRow(index)}
                        className="text-red-500 hover:text-red-600 w-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={addBOMRow} className="w-full border-dashed">
              <Plus className="w-4 h-4 mr-2" />
              Add Material
            </Button>

            <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-500">
              <p>• Each row defines how much raw material is needed for 1 unit of finished product</p>
              <p>• During production, quantities will be multiplied by the output quantity</p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBomDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBOM}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alias Management Dialog */}
      <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              Platform Aliases - {selectedSKU?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Aliases */}
            {selectedSKU?.aliases?.length > 0 && (
              <div className="space-y-2">
                <Label className={dLabel}>Current Aliases</Label>
                {selectedSKU.aliases.map((alias, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <div>
                      <span className="font-mono" style={{ color: T.orangeDeep }}>{alias.alias_code}</span>
                      <Badge className="ml-2 bg-purple-600/70">{alias.platform}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveAlias(alias.alias_code)}
                      className="text-red-500 hover:text-red-600"
                      disabled={actionLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Alias */}
            <div className="border border-slate-200 rounded-lg p-4">
              <Label className={`${dLabel} font-medium`}>Add New Alias</Label>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-slate-400 text-xs">Alias Code *</Label>
                  <Input
                    value={aliasForm.alias_code}
                    onChange={(e) => setAliasForm({...aliasForm, alias_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., AMZ-INV-001"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-slate-400 text-xs">Platform *</Label>
                  <Select
                    value={aliasForm.platform}
                    onValueChange={(v) => setAliasForm({...aliasForm, platform: v})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Label className="text-slate-400 text-xs">Notes (Optional)</Label>
                <Input
                  value={aliasForm.notes}
                  onChange={(e) => setAliasForm({...aliasForm, notes: e.target.value})}
                  placeholder="e.g., Amazon FBA SKU"
                  className={dInput}
                />
              </div>
              <Button
                onClick={handleAddAlias}
                disabled={actionLoading || !aliasForm.alias_code || !aliasForm.platform}
                className="bg-purple-600 hover:bg-purple-700 text-white mt-3 w-full"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Alias'}
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAliasDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
