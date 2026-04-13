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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Package, Plus, Loader2, Edit2, Eye, Tag, Factory, 
  Trash2, AlertTriangle, Box, Link as LinkIcon
} from 'lucide-react';

const CATEGORIES = ['Inverter', 'Battery', 'Stabilizer', 'Spare Part', 'Accessory', 'Other'];
const PLATFORMS = ['Amazon', 'Flipkart', 'Website', 'Distributor', 'B2B', 'Other'];

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
    production_charge_per_unit: '', reorder_level: 10, description: '',
    gst_rate: '', cost_price: '', selling_price: '', mrp: '',
    // LBH and Weight for shipping
    length_cm: '', breadth_cm: '', height_cm: '', weight_kg: ''
  });
  
  const [bomForm, setBomForm] = useState([]);
  const [aliasForm, setAliasForm] = useState({ alias_code: '', platform: '', notes: '' });

  useEffect(() => {
    fetchData();
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
      production_charge_per_unit: '', reorder_level: 10, description: '',
      gst_rate: '', cost_price: '', selling_price: '', mrp: '',
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
        unit: skuForm.unit || 'pcs',
        is_manufactured: skuForm.is_manufactured || false,
        product_type: skuForm.product_type || null,
        manufacturing_role: skuForm.manufacturing_role || null,
        production_charge_per_unit: productionCharge,
        reorder_level: reorderLevel,
        description: skuForm.description || null,
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
        unit: skuForm.unit || 'pcs',
        is_manufactured: skuForm.is_manufactured || false,
        product_type: skuForm.product_type || null,
        manufacturing_role: skuForm.manufacturing_role || null,
        production_charge_per_unit: productionCharge,
        reorder_level: reorderLevel,
        description: skuForm.description || null,
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
      unit: sku.unit || 'pcs',
      is_manufactured: sku.is_manufactured || false,
      product_type: sku.product_type || '',
      manufacturing_role: sku.manufacturing_role || '',
      production_charge_per_unit: sku.production_charge_per_unit || '',
      reorder_level: sku.reorder_level || 10,
      description: sku.description || '',
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

  if (loading) {
    return (
      <DashboardLayout title="Master SKU Management">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Master SKU Management">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Master SKUs" value={totalSKUs} icon={Package} color="cyan" />
          <StatCard title="Manufactured Products" value={manufacturedSKUs} icon={Factory} color="emerald" />
          <StatCard title="With BOM Defined" value={withBOM} icon={Box} color="blue" />
          <StatCard title="With Platform Aliases" value={withAliases} icon={Tag} color="purple" />
        </div>

        {/* Filters and Actions */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  placeholder="Search by name, SKU, or alias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 bg-slate-700 border-slate-600 text-white"
                  data-testid="search-input"
                />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Categories</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-white">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterManufactured} onValueChange={setFilterManufactured}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="all" className="text-white">All Types</SelectItem>
                    <SelectItem value="yes" className="text-white">Manufactured</SelectItem>
                    <SelectItem value="no" className="text-white">Not Manufactured</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => { resetSkuForm(); setCreateDialogOpen(true); }}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="create-sku-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Master SKU
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Master SKUs Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Master SKUs ({filteredSKUs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSKUs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No Master SKUs found</p>
                <p className="text-sm mt-2">Create your first Master SKU to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">SKU Code</TableHead>
                      <TableHead className="text-slate-300">Name</TableHead>
                      <TableHead className="text-slate-300">Category</TableHead>
                      <TableHead className="text-slate-300">Type</TableHead>
                      <TableHead className="text-slate-300">LBH (cm)</TableHead>
                      <TableHead className="text-slate-300">Weight</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSKUs.map((sku) => (
                      <TableRow key={sku.id} className="border-slate-700">
                        <TableCell className="text-cyan-400 font-mono">{sku.sku_code}</TableCell>
                        <TableCell className="text-white">{sku.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-slate-600">{sku.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {sku.is_manufactured ? (
                            <Badge className="bg-emerald-600">Manufactured</Badge>
                          ) : (
                            <Badge className="bg-slate-600">Purchased</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {sku.length_cm && sku.breadth_cm && sku.height_cm ? (
                            <span className="text-slate-300 text-sm font-mono">
                              {sku.length_cm}x{sku.breadth_cm}x{sku.height_cm}
                            </span>
                          ) : (
                            <span className="text-orange-400 text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sku.weight_kg ? (
                            <span className="text-slate-300">{sku.weight_kg} kg</span>
                          ) : (
                            <span className="text-orange-400 text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {sku.is_active ? (
                            <Badge className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge className="bg-red-600">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => { setSelectedSKU(sku); setViewDialogOpen(true); }}
                              className="text-slate-400 hover:text-white"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openEditDialog(sku)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openBOMDialog(sku)}
                              className="text-emerald-400 hover:text-emerald-300"
                              title="Manage BOM"
                            >
                              <Factory className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => openAliasDialog(sku)}
                              className="text-purple-400 hover:text-purple-300"
                              title="Manage Aliases"
                            >
                              <Tag className="w-4 h-4" />
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

        {/* Create Master SKU Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Master SKU</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={skuForm.name}
                    onChange={(e) => setSkuForm({...skuForm, name: e.target.value})}
                    placeholder="e.g., MuscleGrid 1000VA Inverter"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    data-testid="sku-name-input"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">SKU Code *</Label>
                  <Input
                    value={skuForm.sku_code}
                    onChange={(e) => setSkuForm({...skuForm, sku_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., MG-INV-1000"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    data-testid="sku-code-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Category *</Label>
                  <Select
                    value={skuForm.category}
                    onValueChange={(v) => setSkuForm({...skuForm, category: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-white">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">HSN Code * <span className="text-xs text-slate-500">(6 digits min)</span></Label>
                  <Input
                    value={skuForm.hsn_code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setSkuForm({...skuForm, hsn_code: val});
                    }}
                    placeholder="e.g., 850440"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    data-testid="sku-hsn-input"
                    maxLength={8}
                  />
                  <p className={`text-xs mt-1 ${skuForm.hsn_code?.length >= 6 ? 'text-green-400' : 'text-orange-400'}`}>
                    {skuForm.hsn_code?.length || 0}/6 digits {skuForm.hsn_code?.length >= 6 ? '✓' : '(minimum 6 required)'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">GST Rate (%) *</Label>
                  <Select
                    value={skuForm.gst_rate?.toString() || ''}
                    onValueChange={(v) => setSkuForm({...skuForm, gst_rate: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1" data-testid="sku-gst-select">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="0" className="text-white">0%</SelectItem>
                      <SelectItem value="5" className="text-white">5%</SelectItem>
                      <SelectItem value="12" className="text-white">12%</SelectItem>
                      <SelectItem value="18" className="text-white">18%</SelectItem>
                      <SelectItem value="28" className="text-white">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Cost Price (₹) *</Label>
                  <Input
                    type="number"
                    value={skuForm.cost_price}
                    onChange={(e) => setSkuForm({...skuForm, cost_price: e.target.value})}
                    placeholder="e.g., 5000"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="0"
                    step="0.01"
                    data-testid="sku-cost-input"
                  />
                </div>
              </div>
              
              {/* Selling Prices Section */}
              <div className="p-3 bg-cyan-900/20 border border-cyan-600 rounded-lg">
                <Label className="text-cyan-400 text-sm font-medium">Selling Prices (optional - for Sales Invoices)</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-slate-300">Selling Price (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.selling_price}
                      onChange={(e) => setSkuForm({...skuForm, selling_price: e.target.value})}
                      placeholder="e.g., 7500"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">MRP (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.mrp}
                      onChange={(e) => setSkuForm({...skuForm, mrp: e.target.value})}
                      placeholder="e.g., 9999"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Note: Dispatches usually carry their own invoice value. These are used only for manual invoices.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Unit</Label>
                  <Select
                    value={skuForm.unit}
                    onValueChange={(v) => setSkuForm({...skuForm, unit: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="pcs" className="text-white">Pieces (pcs)</SelectItem>
                      <SelectItem value="set" className="text-white">Set</SelectItem>
                      <SelectItem value="box" className="text-white">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Reorder Level</Label>
                  <Input
                    type="number"
                    value={skuForm.reorder_level}
                    onChange={(e) => setSkuForm({...skuForm, reorder_level: parseInt(e.target.value) || 10})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
                <Switch
                  checked={skuForm.is_manufactured}
                  onCheckedChange={(v) => setSkuForm({...skuForm, is_manufactured: v})}
                  data-testid="is-manufactured-switch"
                />
                <div>
                  <Label className="text-slate-300">This product is Manufactured</Label>
                  <p className="text-xs text-slate-400">Enable to define Bill of Materials (BOM) after creation</p>
                </div>
              </div>
              
              {/* Production Settings */}
              <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                <Label className="text-cyan-400 font-medium">Production Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm">Product Type</Label>
                    <Select
                      value={skuForm.product_type}
                      onValueChange={(v) => setSkuForm({...skuForm, product_type: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="manufactured" className="text-white">Manufactured</SelectItem>
                        <SelectItem value="traded" className="text-white">Traded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Manufacturing Role</Label>
                    <Select
                      value={skuForm.manufacturing_role}
                      onValueChange={(v) => setSkuForm({...skuForm, manufacturing_role: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="supervisor" className="text-white">Supervisor (Battery)</SelectItem>
                        <SelectItem value="technician" className="text-white">Technician (Inverter)</SelectItem>
                        <SelectItem value="none" className="text-white">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {skuForm.manufacturing_role === 'supervisor' && (
                  <div>
                    <Label className="text-slate-300 text-sm">Production Charge per Unit (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.production_charge_per_unit}
                      onChange={(e) => setSkuForm({...skuForm, production_charge_per_unit: parseFloat(e.target.value) || ''})}
                      placeholder="e.g., 2000"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                    <p className="text-xs text-slate-400 mt-1">Contractor charge paid to supervisor per unit produced</p>
                  </div>
                )}
              </div>
              
              {/* Shipping Dimensions - LBH & Weight */}
              <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                <Label className="text-cyan-400 font-medium">Shipping Dimensions (for Courier Labels)</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-slate-300 text-sm">Length (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.length_cm}
                      onChange={(e) => setSkuForm({...skuForm, length_cm: e.target.value})}
                      placeholder="L"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      data-testid="input-length"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Breadth (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.breadth_cm}
                      onChange={(e) => setSkuForm({...skuForm, breadth_cm: e.target.value})}
                      placeholder="B"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      data-testid="input-breadth"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Height (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.height_cm}
                      onChange={(e) => setSkuForm({...skuForm, height_cm: e.target.value})}
                      placeholder="H"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      data-testid="input-height"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={skuForm.weight_kg}
                      onChange={(e) => setSkuForm({...skuForm, weight_kg: e.target.value})}
                      placeholder="KG"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      data-testid="input-weight"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Used for automatic shipping rate calculation</p>
              </div>
              
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={skuForm.description}
                  onChange={(e) => setSkuForm({...skuForm, description: e.target.value})}
                  placeholder="Product description..."
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateSKU} 
                disabled={actionLoading}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="create-sku-submit"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Master SKU'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Master SKU Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Master SKU</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Name *</Label>
                  <Input
                    value={skuForm.name}
                    onChange={(e) => setSkuForm({...skuForm, name: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">SKU Code *</Label>
                  <Input
                    value={skuForm.sku_code}
                    onChange={(e) => setSkuForm({...skuForm, sku_code: e.target.value.toUpperCase()})}
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Category *</Label>
                  <Select
                    value={skuForm.category}
                    onValueChange={(v) => setSkuForm({...skuForm, category: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat} className="text-white">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">HSN Code * <span className="text-xs text-slate-500">(6 digits min)</span></Label>
                  <Input
                    value={skuForm.hsn_code}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setSkuForm({...skuForm, hsn_code: val});
                    }}
                    placeholder="e.g., 850440"
                    className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    maxLength={8}
                  />
                  <p className={`text-xs mt-1 ${skuForm.hsn_code?.length >= 6 ? 'text-green-400' : 'text-orange-400'}`}>
                    {skuForm.hsn_code?.length || 0}/6 digits {skuForm.hsn_code?.length >= 6 ? '✓' : '(minimum 6 required)'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">GST Rate (%)</Label>
                  <Select
                    value={skuForm.gst_rate?.toString() || ''}
                    onValueChange={(v) => setSkuForm({...skuForm, gst_rate: v})}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="0" className="text-white">0%</SelectItem>
                      <SelectItem value="5" className="text-white">5%</SelectItem>
                      <SelectItem value="12" className="text-white">12%</SelectItem>
                      <SelectItem value="18" className="text-white">18%</SelectItem>
                      <SelectItem value="28" className="text-white">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Cost Price (₹)</Label>
                  <Input
                    type="number"
                    value={skuForm.cost_price}
                    onChange={(e) => setSkuForm({...skuForm, cost_price: e.target.value})}
                    placeholder="e.g., 5000"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              
              {/* Pricing Section */}
              <div className="p-3 bg-cyan-900/20 border border-cyan-600 rounded-lg">
                <Label className="text-cyan-400 text-sm font-medium">Selling Prices (for Sales Invoices)</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-slate-300">Selling Price (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.selling_price}
                      onChange={(e) => setSkuForm({...skuForm, selling_price: e.target.value})}
                      placeholder="e.g., 7500"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-slate-400 mt-1">Used for manual sales invoices</p>
                  </div>
                  <div>
                    <Label className="text-slate-300">MRP (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.mrp}
                      onChange={(e) => setSkuForm({...skuForm, mrp: e.target.value})}
                      placeholder="e.g., 9999"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-slate-400 mt-1">Maximum retail price</p>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-slate-300">Reorder Level</Label>
                <Input
                  type="number"
                  value={skuForm.reorder_level}
                  onChange={(e) => setSkuForm({...skuForm, reorder_level: parseInt(e.target.value) || 10})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              
              {/* Shipping Dimensions - LBH & Weight (Edit) */}
              <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                <Label className="text-cyan-400 font-medium">Shipping Dimensions (for Courier Labels)</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label className="text-slate-300 text-sm">Length (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.length_cm}
                      onChange={(e) => setSkuForm({...skuForm, length_cm: e.target.value})}
                      placeholder="L"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Breadth (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.breadth_cm}
                      onChange={(e) => setSkuForm({...skuForm, breadth_cm: e.target.value})}
                      placeholder="B"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Height (cm)</Label>
                    <Input
                      type="number"
                      value={skuForm.height_cm}
                      onChange={(e) => setSkuForm({...skuForm, height_cm: e.target.value})}
                      placeholder="H"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Weight (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={skuForm.weight_kg}
                      onChange={(e) => setSkuForm({...skuForm, weight_kg: e.target.value})}
                      placeholder="KG"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Used for automatic shipping rate calculation</p>
              </div>
              
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={skuForm.description}
                  onChange={(e) => setSkuForm({...skuForm, description: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  rows={2}
                />
              </div>
              
              {/* Production Settings in Edit */}
              <div className="p-3 bg-slate-700/50 rounded-lg space-y-3">
                <Label className="text-cyan-400 font-medium">Production Settings</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300 text-sm">Product Type</Label>
                    <Select
                      value={skuForm.product_type}
                      onValueChange={(v) => setSkuForm({...skuForm, product_type: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="manufactured" className="text-white">Manufactured</SelectItem>
                        <SelectItem value="traded" className="text-white">Traded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-sm">Manufacturing Role</Label>
                    <Select
                      value={skuForm.manufacturing_role}
                      onValueChange={(v) => setSkuForm({...skuForm, manufacturing_role: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="supervisor" className="text-white">Supervisor (Battery)</SelectItem>
                        <SelectItem value="technician" className="text-white">Technician (Inverter)</SelectItem>
                        <SelectItem value="none" className="text-white">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {skuForm.manufacturing_role === 'supervisor' && (
                  <div>
                    <Label className="text-slate-300 text-sm">Production Charge per Unit (₹)</Label>
                    <Input
                      type="number"
                      value={skuForm.production_charge_per_unit}
                      onChange={(e) => setSkuForm({...skuForm, production_charge_per_unit: parseFloat(e.target.value) || ''})}
                      placeholder="e.g., 2000"
                      className="bg-slate-700 border-slate-600 text-white mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateSKU} 
                disabled={actionLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Master SKU Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle>Master SKU Details</DialogTitle>
            </DialogHeader>
            {selectedSKU && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-400 text-xs">Name</Label>
                    <p className="text-white font-medium">{selectedSKU.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">SKU Code</Label>
                    <p className="text-cyan-400 font-mono">{selectedSKU.sku_code}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Category</Label>
                    <p className="text-white">{selectedSKU.category}</p>
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Type</Label>
                    <p className="text-white">
                      {selectedSKU.is_manufactured ? (
                        <Badge className="bg-emerald-600">Manufactured</Badge>
                      ) : (
                        <Badge className="bg-slate-600">Purchased</Badge>
                      )}
                    </p>
                  </div>
                </div>

                {selectedSKU.bill_of_materials?.length > 0 && (
                  <div className="border border-slate-600 rounded-lg p-4">
                    <Label className="text-emerald-400 font-medium">Bill of Materials</Label>
                    <div className="mt-2 space-y-2">
                      {selectedSKU.bill_of_materials.map((bom, i) => {
                        const rm = rawMaterials.find(r => r.id === bom.raw_material_id);
                        return (
                          <div key={i} className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                            <span className="text-white">{rm?.name || bom.raw_material_id}</span>
                            <Badge className="bg-pink-600">{bom.quantity} {rm?.unit || 'pcs'}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedSKU.aliases?.length > 0 && (
                  <div className="border border-slate-600 rounded-lg p-4">
                    <Label className="text-purple-400 font-medium">Platform Aliases</Label>
                    <div className="mt-2 space-y-2">
                      {selectedSKU.aliases.map((alias, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                          <div>
                            <span className="text-cyan-400 font-mono">{alias.alias_code}</span>
                            <span className="text-slate-400 text-sm ml-2">({alias.platform})</span>
                          </div>
                          {alias.notes && <span className="text-slate-400 text-xs">{alias.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setViewDialogOpen(false)} className="text-slate-300">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BOM Management Dialog */}
        <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-emerald-500" />
                Bill of Materials - {selectedSKU?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">
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
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                          <SelectValue placeholder="Select raw material" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600 max-h-[200px]">
                          {rawMaterials.map(rm => (
                            <SelectItem key={rm.id} value={rm.id} className="text-white">
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
                        className="bg-slate-700 border-slate-600 text-white mt-1"
                      />
                    </div>
                    <div className="col-span-2">
                      {bomForm.length > 1 && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => removeBOMRow(index)}
                          className="text-red-400 hover:text-red-300 w-full"
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
              
              <div className="bg-slate-700/50 p-3 rounded-lg text-sm text-slate-400">
                <p>• Each row defines how much raw material is needed for 1 unit of finished product</p>
                <p>• During production, quantities will be multiplied by the output quantity</p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setBomDialogOpen(false)} className="text-slate-300">
                Cancel
              </Button>
              <Button 
                onClick={handleSaveBOM} 
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save BOM'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alias Management Dialog */}
        <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-500" />
                Platform Aliases - {selectedSKU?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Existing Aliases */}
              {selectedSKU?.aliases?.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Current Aliases</Label>
                  {selectedSKU.aliases.map((alias, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg">
                      <div>
                        <span className="text-cyan-400 font-mono">{alias.alias_code}</span>
                        <Badge className="ml-2 bg-purple-600/50">{alias.platform}</Badge>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleRemoveAlias(alias.alias_code)}
                        className="text-red-400 hover:text-red-300"
                        disabled={actionLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add New Alias */}
              <div className="border border-slate-600 rounded-lg p-4">
                <Label className="text-slate-300 font-medium">Add New Alias</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label className="text-slate-400 text-xs">Alias Code *</Label>
                    <Input
                      value={aliasForm.alias_code}
                      onChange={(e) => setAliasForm({...aliasForm, alias_code: e.target.value.toUpperCase()})}
                      placeholder="e.g., AMZ-INV-001"
                      className="bg-slate-700 border-slate-600 text-white mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs">Platform *</Label>
                    <Select
                      value={aliasForm.platform}
                      onValueChange={(v) => setAliasForm({...aliasForm, platform: v})}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {PLATFORMS.map(p => (
                          <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>
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
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <Button 
                  onClick={handleAddAlias} 
                  disabled={actionLoading || !aliasForm.alias_code || !aliasForm.platform}
                  className="bg-purple-600 hover:bg-purple-700 mt-3 w-full"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Alias'}
                </Button>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={() => setAliasDialogOpen(false)} className="text-slate-300">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
