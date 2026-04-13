import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { 
  Plus, Battery, Zap, Activity, Download, Eye, Pencil, Trash2, 
  Copy, ExternalLink, FileText, Search, LayoutGrid, List, Loader2,
  ShoppingBag, Sparkles, RefreshCw
} from 'lucide-react';

// Template Components
import BatteryDatasheet from '@/components/datasheets/BatteryDatasheet';
import InverterDatasheet from '@/components/datasheets/InverterDatasheet';
import StabilizerDatasheet from '@/components/datasheets/StabilizerDatasheet';

export default function ProductDatasheets() {
  const { token } = useAuth();
  const [datasheets, setDatasheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDatasheet, setSelectedDatasheet] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // ASIN lookup state
  const [asinInput, setAsinInput] = useState('');
  const [asinLoading, setAsinLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'inverter',
    model_name: '',
    subtitle: '',
    image_url: '',
    amazon_asin: '',
    specifications: {},
    features: [],
    warranty: '2 Years',
    certifications: ['BIS', 'ISO 9001']
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDatasheets();
  }, []);

  const fetchDatasheets = async () => {
    try {
      const res = await axios.get(`${API}/product-datasheets`, { headers });
      setDatasheets(res.data.datasheets || []);
    } catch (err) {
      console.error('Error fetching datasheets:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // ASIN Lookup from Amazon
  const handleAsinLookup = async () => {
    if (!asinInput.trim()) {
      toast.error('Please enter an ASIN or Amazon product URL');
      return;
    }
    
    // Extract ASIN from URL if needed
    let asin = asinInput.trim();
    if (asin.includes('amazon.in') || asin.includes('amazon.com')) {
      const match = asin.match(/\/dp\/([A-Z0-9]{10})/i) || asin.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (match) {
        asin = match[1];
      }
    }
    
    if (!/^[A-Z0-9]{10}$/i.test(asin)) {
      toast.error('Invalid ASIN format. Should be 10 characters (e.g., B0GSVVGW4K)');
      return;
    }
    
    setAsinLoading(true);
    try {
      const res = await axios.get(`${API}/amazon/scrape-product/${asin}`, { headers });
      const data = res.data;
      
      if (data.success) {
        // Pre-fill form with Amazon data
        setFormData(prev => ({
          ...prev,
          category: data.category || prev.category,
          model_name: data.model_name || '',
          subtitle: data.subtitle || '',
          image_url: data.image_url || '',
          amazon_asin: asin,
          specifications: { ...prev.specifications, ...data.specifications },
          features: data.features?.length > 0 ? data.features : prev.features,
          warranty: data.warranty || prev.warranty,
          certifications: data.certifications || prev.certifications
        }));
        
        toast.success(`Fetched data for: ${data.model_name?.substring(0, 50)}...`);
      }
    } catch (err) {
      console.error('ASIN lookup error:', err);
      toast.error(err.response?.data?.detail || 'Failed to fetch Amazon product data');
    } finally {
      setAsinLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.model_name.trim()) {
      toast.error('Model name is required');
      return;
    }
    try {
      const res = await axios.post(`${API}/product-datasheets`, formData, { headers });
      toast.success('Datasheet created successfully!');
      setShowCreateDialog(false);
      resetForm();
      fetchDatasheets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create datasheet');
    }
  };

  const handleUpdate = async () => {
    try {
      await axios.put(`${API}/product-datasheets/${selectedDatasheet.id}`, formData, { headers });
      toast.success('Datasheet updated successfully!');
      setShowCreateDialog(false);
      setEditMode(false);
      resetForm();
      fetchDatasheets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update datasheet');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this datasheet?')) return;
    try {
      await axios.delete(`${API}/product-datasheets/${id}`, { headers });
      toast.success('Datasheet deleted');
      fetchDatasheets();
    } catch (err) {
      toast.error('Failed to delete datasheet');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'inverter',
      model_name: '',
      subtitle: '',
      image_url: '',
      amazon_asin: '',
      specifications: {},
      features: [],
      warranty: '2 Years',
      certifications: ['BIS', 'ISO 9001']
    });
    setSelectedDatasheet(null);
    setEditMode(false);
    setAsinInput('');
  };

  const openEditDialog = (datasheet) => {
    setFormData({
      category: datasheet.category,
      model_name: datasheet.model_name,
      subtitle: datasheet.subtitle || '',
      image_url: datasheet.image_url || '',
      specifications: datasheet.specifications || {},
      features: datasheet.features || [],
      warranty: datasheet.warranty || '2 Years',
      certifications: datasheet.certifications || ['BIS', 'ISO 9001']
    });
    setSelectedDatasheet(datasheet);
    setEditMode(true);
    setShowCreateDialog(true);
  };

  const openPreview = (datasheet) => {
    setSelectedDatasheet(datasheet);
    setShowPreviewDialog(true);
  };

  const copyPublicLink = (datasheet) => {
    const url = `${window.location.origin}/datasheet/${datasheet.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied to clipboard!');
  };

  const filteredDatasheets = datasheets.filter(ds => {
    const matchesTab = activeTab === 'all' || ds.category === activeTab;
    const matchesSearch = ds.model_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const categoryIcons = {
    battery: <Battery className="w-5 h-5" />,
    inverter: <Zap className="w-5 h-5" />,
    stabilizer: <Activity className="w-5 h-5" />
  };

  const categoryColors = {
    battery: 'bg-green-500/20 text-green-400 border-green-500/30',
    inverter: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    stabilizer: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  };

  return (
    <DashboardLayout title="Product Datasheets">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Product Datasheets</h1>
            <p className="text-slate-400 text-sm mt-1">Create beautiful catalogue pages for your products</p>
          </div>
          <Button 
            onClick={() => { resetForm(); setShowCreateDialog(true); }}
            className="bg-cyan-600 hover:bg-cyan-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Datasheet
          </Button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="bg-slate-800 border border-slate-700">
              <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">
                All ({datasheets.length})
              </TabsTrigger>
              <TabsTrigger value="battery" className="data-[state=active]:bg-green-600">
                <Battery className="w-4 h-4 mr-1" /> Batteries
              </TabsTrigger>
              <TabsTrigger value="inverter" className="data-[state=active]:bg-orange-600">
                <Zap className="w-4 h-4 mr-1" /> Inverters
              </TabsTrigger>
              <TabsTrigger value="stabilizer" className="data-[state=active]:bg-blue-600">
                <Activity className="w-4 h-4 mr-1" /> Stabilizers
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 w-48"
              />
            </div>
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700' : ''}`}
              >
                <LayoutGrid className="w-4 h-4 text-slate-400" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700' : ''}`}
              >
                <List className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Datasheets Grid/List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading datasheets...</div>
        ) : filteredDatasheets.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No datasheets yet</h3>
              <p className="text-slate-400 mb-4">Create your first product datasheet to get started</p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-cyan-600 hover:bg-cyan-500">
                <Plus className="w-4 h-4 mr-2" /> Create Datasheet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-3"
          }>
            {filteredDatasheets.map((ds) => (
              <Card key={ds.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all">
                <CardContent className={viewMode === 'grid' ? 'p-4' : 'p-4 flex items-center gap-4'}>
                  {viewMode === 'grid' ? (
                    <>
                      {/* Thumbnail */}
                      <div className="h-32 bg-slate-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {ds.image_url ? (
                          <img src={ds.image_url} alt={ds.model_name} className="h-full object-contain" />
                        ) : (
                          <div className={`p-4 rounded-full ${categoryColors[ds.category]}`}>
                            {categoryIcons[ds.category]}
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[ds.category]}`}>
                            {ds.category.charAt(0).toUpperCase() + ds.category.slice(1)}
                          </span>
                          <h3 className="text-white font-semibold mt-2">{ds.model_name}</h3>
                          {ds.subtitle && <p className="text-slate-400 text-sm">{ds.subtitle}</p>}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 border-slate-600" onClick={() => openPreview(ds)}>
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600" onClick={() => openEditDialog(ds)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600" onClick={() => copyPublicLink(ds)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/10" onClick={() => handleDelete(ds.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* List view */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${categoryColors[ds.category]}`}>
                        {categoryIcons[ds.category]}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-semibold">{ds.model_name}</h3>
                        <p className="text-slate-400 text-sm">{ds.subtitle || ds.category}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-slate-600" onClick={() => openPreview(ds)}>
                          <Eye className="w-3 h-3 mr-1" /> Preview
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600" onClick={() => openEditDialog(ds)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600" onClick={() => copyPublicLink(ds)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                {editMode ? <Pencil className="w-5 h-5 text-cyan-400" /> : <Plus className="w-5 h-5 text-cyan-400" />}
                {editMode ? 'Edit Datasheet' : 'Create New Datasheet'}
              </DialogTitle>
            </DialogHeader>
            
            <DatasheetForm 
              formData={formData}
              setFormData={setFormData}
              onSubmit={editMode ? handleUpdate : handleCreate}
              editMode={editMode}
              asinInput={asinInput}
              setAsinInput={setAsinInput}
              asinLoading={asinLoading}
              handleAsinLookup={handleAsinLookup}
            />
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="bg-white max-w-4xl max-h-[95vh] overflow-y-auto p-0">
            {selectedDatasheet && (
              <DatasheetPreview datasheet={selectedDatasheet} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Form Component
function DatasheetForm({ formData, setFormData, onSubmit, editMode, asinInput, setAsinInput, asinLoading, handleAsinLookup }) {
  const updateSpec = (key, value) => {
    setFormData(prev => ({
      ...prev,
      specifications: { ...prev.specifications, [key]: value }
    }));
  };

  const updateFeature = (index, value) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({ ...prev, features: newFeatures }));
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev.features, ''] }));
  };

  const removeFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  // Enhanced specification fields based on category (matching the APSolway catalog format)
  const specFields = {
    battery: [
      // Battery Specifications
      { key: 'type', label: 'Battery Type', placeholder: 'LiFePO4 (Lithium Iron Phosphate)', section: 'Battery Specifications' },
      { key: 'voltage', label: 'Nominal Voltage (V)', placeholder: '48 / 51.2' },
      { key: 'capacity_ah', label: 'Capacity (Ah)', placeholder: '120' },
      { key: 'energy_wh', label: 'Energy (Wh)', placeholder: '5760' },
      { key: 'cycle_life', label: 'Cycle Life', placeholder: '6000+ Cycles' },
      { key: 'cell_grade', label: 'Cell Grade', placeholder: 'A+ Grade' },
      // BMS Section
      { key: 'bms_type', label: 'BMS Type', placeholder: 'JK Smart BMS', section: 'BMS (Battery Management System)' },
      { key: 'active_balancer', label: 'Active Balancer', placeholder: 'Yes' },
      { key: 'communication', label: 'Communication', placeholder: 'RS485 / Bluetooth' },
      { key: 'overcharge_protection', label: 'Overcharge Protection (V)', placeholder: '58.4' },
      { key: 'overdischarge_protection', label: 'Over-discharge Protection (V)', placeholder: '40' },
      { key: 'max_discharge_current', label: 'Max Continuous Discharge (A)', placeholder: '100' },
      { key: 'max_charge_current', label: 'Max Charge Current (A)', placeholder: '100' },
      // Physical Specs
      { key: 'dimensions', label: 'Dimensions (L x W x H mm)', placeholder: '480 x 200 x 450', section: 'Physical Specifications' },
      { key: 'weight', label: 'Weight (kg)', placeholder: '42' },
      { key: 'terminals', label: 'Terminal Type', placeholder: 'M8 Bolt' },
      { key: 'enclosure', label: 'Enclosure', placeholder: 'IP65 Rated Metal' },
      { key: 'display', label: 'Display', placeholder: 'LCD Screen' },
      // Operating Conditions
      { key: 'operating_temp', label: 'Operating Temperature', placeholder: '-10°C to 55°C', section: 'Operating Conditions' },
      { key: 'storage_temp', label: 'Storage Temperature', placeholder: '-20°C to 60°C' },
      { key: 'humidity', label: 'Humidity', placeholder: '0-95% (Non-condensing)' },
      { key: 'self_discharge', label: 'Self-Discharge Rate', placeholder: '< 3% per month' },
    ],
    inverter: [
      // AC Input Section
      { key: 'rated_input_voltage', label: 'Rated Input Voltage (VAC)', placeholder: '220 / 230 / 240; L + N + PE', section: 'AC Input' },
      { key: 'voltage_range', label: 'Voltage Range (VAC)', placeholder: '90~280±3 (normal); 170~280±3 (UPS)' },
      { key: 'input_frequency', label: 'Frequency (Hz)', placeholder: '50 / 60 (Auto Adaptive)' },
      // AC Output Section  
      { key: 'rated_capacity_kw', label: 'Rated Capacity (kW)', placeholder: '10', section: 'AC Output' },
      { key: 'surge_power_kva', label: 'Surge Power (kVA)', placeholder: '20' },
      { key: 'output_voltage', label: 'Output Voltage (VAC)', placeholder: '220 / 230 / 240' },
      { key: 'power_factor', label: 'Power Factor (PF)', placeholder: '1' },
      { key: 'output_frequency', label: 'Frequency', placeholder: '50/60Hz±0.1%' },
      { key: 'switch_time', label: 'Switch Time (ms)', placeholder: '10 (APP/UPS) / 20 (GEN)' },
      { key: 'wave_form', label: 'Wave Form', placeholder: 'Pure Sine Wave' },
      { key: 'overload_capacity', label: 'Overload Capacity', placeholder: '1min@102%~125%Load' },
      { key: 'max_efficiency', label: 'Max. Efficiency', placeholder: '94%@48VDC' },
      { key: 'parallel_quantity', label: 'Parallel Quantity', placeholder: 'NA' },
      // Charger (PV/AC) Section
      { key: 'solar_charger_type', label: 'Solar Charger Type', placeholder: 'Dual MPPTs', section: 'Charger (PV/AC)' },
      { key: 'max_pv_input', label: 'Max PV Input Current/Power', placeholder: '27A/9kW (One MPPT)' },
      { key: 'mppt_range', label: 'MPPT Range (VDC)', placeholder: '60~450' },
      { key: 'max_pv_voc', label: 'Max PV Open Circuit (VOC)', placeholder: '500' },
      { key: 'max_pv_charge', label: 'Max PV Charge Current (A)', placeholder: '160' },
      { key: 'max_ac_charge', label: 'Max AC Charge Current (A)', placeholder: '160' },
      { key: 'max_total_charge', label: 'Max Total Charge (PV+AC) (A)', placeholder: '160' },
      // Battery Section
      { key: 'battery_voltage', label: 'Rated Battery Voltage (VDC)', placeholder: '48', section: 'Battery' },
      { key: 'float_charge_voltage', label: 'Floating Charge Voltage (VDC)', placeholder: '54' },
      { key: 'overcharge_protection', label: 'Overcharge Protection (VDC)', placeholder: '61' },
      { key: 'battery_type', label: 'Battery Type', placeholder: 'LiFePO4 (Lithium)' },
      // Interface Section
      { key: 'hmi', label: 'HMI', placeholder: 'LCD', section: 'Interface' },
      { key: 'interface', label: 'Interface', placeholder: 'RS485 / RS232 / USB' },
      { key: 'monitoring', label: 'Monitoring', placeholder: 'WiFi (built-in)' },
      // General Data Section
      { key: 'ingress_protection', label: 'Ingress Protection', placeholder: 'IP43', section: 'General Data' },
      { key: 'operating_temp', label: 'Operating Temperature', placeholder: '-10°C ~ 60°C' },
      { key: 'relative_humidity', label: 'Relative Humidity', placeholder: '5% ~ 95% (Non-condensing)' },
      { key: 'storage_temp', label: 'Storage Temperature', placeholder: '-15°C ~ 60°C' },
      { key: 'weight', label: 'Net Weight (kg)', placeholder: '12.4' },
      { key: 'dimensions', label: 'Dimensions (W*H*D mm)', placeholder: '480*410*120' },
      { key: 'max_altitude', label: 'Max. Operating Altitude', placeholder: '4000m (Derating above 1000m)' },
    ],
    stabilizer: [
      { key: 'capacity_kva', label: 'Capacity (kVA)', placeholder: '5' },
      { key: 'input_range', label: 'Input Range (V)', placeholder: '90-300' },
      { key: 'output_voltage', label: 'Output Voltage (V)', placeholder: '220 ± 3%' },
      { key: 'phase', label: 'Phase', placeholder: 'Single Phase' },
      { key: 'frequency', label: 'Frequency (Hz)', placeholder: '50' },
      { key: 'correction_time', label: 'Correction Time (ms)', placeholder: '< 10' },
      { key: 'mounting', label: 'Mounting Type', placeholder: 'Wall Mount' },
      { key: 'protection', label: 'Protection', placeholder: 'Overload, Short Circuit' },
      { key: 'dimensions', label: 'Dimensions (mm)', placeholder: '350 x 280 x 150' },
      { key: 'weight', label: 'Weight (kg)', placeholder: '12' },
    ]
  };

  const currentSpecs = specFields[formData.category] || [];
  
  // Group specs by section for better organization
  const groupedSpecs = currentSpecs.reduce((acc, spec) => {
    const section = spec.section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(spec);
    return acc;
  }, {});

  return (
    <div className="space-y-6 py-4">
      {/* ASIN Lookup - Premium Feature */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-white font-medium">Import from Amazon</h4>
            <p className="text-slate-400 text-xs">Enter ASIN or Amazon product URL to auto-fill specifications</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={asinInput}
            onChange={(e) => setAsinInput(e.target.value)}
            placeholder="e.g., B0GSVVGW4K or https://www.amazon.in/dp/B0GSVVGW4K"
            className="bg-slate-800 border-slate-700 flex-1"
          />
          <Button 
            onClick={handleAsinLookup} 
            disabled={asinLoading}
            className="bg-orange-500 hover:bg-orange-600 min-w-[120px]"
          >
            {asinLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Auto-Fill
              </>
            )}
          </Button>
        </div>
        {formData.amazon_asin && (
          <p className="text-xs text-green-400 mt-2">
            Linked to ASIN: {formData.amazon_asin}
          </p>
        )}
      </div>

      {/* Category Selection */}
      <div className="grid grid-cols-3 gap-4">
        {['battery', 'inverter', 'stabilizer'].map(cat => (
          <button
            key={cat}
            onClick={() => setFormData(prev => ({ ...prev, category: cat, specifications: {} }))}
            className={`p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.02] ${
              formData.category === cat 
                ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20' 
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {cat === 'battery' && <Battery className={`w-5 h-5 ${formData.category === cat ? 'text-green-400' : 'text-green-400/60'}`} />}
              {cat === 'inverter' && <Zap className={`w-5 h-5 ${formData.category === cat ? 'text-orange-400' : 'text-orange-400/60'}`} />}
              {cat === 'stabilizer' && <Activity className={`w-5 h-5 ${formData.category === cat ? 'text-blue-400' : 'text-blue-400/60'}`} />}
              <span className="text-white capitalize font-medium">{cat}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300">Model Name *</Label>
          <Input
            value={formData.model_name}
            onChange={(e) => setFormData(prev => ({ ...prev, model_name: e.target.value }))}
            placeholder="e.g., MG-INV-5KW or 6.2kW Hybrid Solar Inverter"
            className="bg-slate-800 border-slate-700 mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300">Subtitle</Label>
          <Input
            value={formData.subtitle}
            onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
            placeholder="e.g., Heavy Duty Solar Inverter"
            className="bg-slate-800 border-slate-700 mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300">Product Image URL</Label>
          <Input
            value={formData.image_url}
            onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
            placeholder="https://example.com/product.png"
            className="bg-slate-800 border-slate-700 mt-1"
          />
          {formData.image_url && (
            <div className="mt-2 h-20 w-20 bg-slate-900 rounded-lg overflow-hidden">
              <img src={formData.image_url} alt="Preview" className="h-full w-full object-contain" />
            </div>
          )}
        </div>
        <div>
          <Label className="text-slate-300">Warranty</Label>
          <Input
            value={formData.warranty}
            onChange={(e) => setFormData(prev => ({ ...prev, warranty: e.target.value }))}
            placeholder="2 Years"
            className="bg-slate-800 border-slate-700 mt-1"
          />
        </div>
      </div>

      {/* Specifications - Grouped by Section */}
      <div>
        <Label className="text-slate-300 text-lg font-semibold mb-3 block">Specifications</Label>
        {Object.entries(groupedSpecs).map(([section, specs]) => (
          <div key={section} className="mb-4">
            {section !== 'General' && (
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px bg-gradient-to-r from-orange-500/50 to-transparent flex-1"></div>
                <span className="text-xs text-orange-400 font-medium uppercase tracking-wider">{section}</span>
                <div className="h-px bg-gradient-to-l from-orange-500/50 to-transparent flex-1"></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {specs.map(spec => (
                <div key={spec.key}>
                  <Label className="text-slate-400 text-sm">{spec.label}</Label>
                  <Input
                    value={formData.specifications[spec.key] || ''}
                    onChange={(e) => updateSpec(spec.key, e.target.value)}
                    placeholder={spec.placeholder}
                    className="bg-slate-800 border-slate-700 mt-1"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-slate-300 text-lg font-semibold">Key Features</Label>
          <Button size="sm" variant="outline" onClick={addFeature} className="border-slate-600">
            <Plus className="w-3 h-3 mr-1" /> Add Feature
          </Button>
        </div>
        <div className="space-y-2">
          {formData.features.map((feature, index) => (
            <div key={index} className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Input
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder="e.g., Pure Sine Wave Output"
                className="bg-slate-800 border-slate-700"
              />
              <Button size="icon" variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/10" onClick={() => removeFeature(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {formData.features.length === 0 && (
            <p className="text-slate-500 text-sm italic">No features added. Click "Add Feature" to add product highlights.</p>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
        <Button variant="outline" className="border-slate-600">Cancel</Button>
        <Button onClick={onSubmit} className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500">
          {editMode ? 'Update Datasheet' : 'Create Datasheet'}
        </Button>
      </div>
    </div>
  );
}

// Preview Component
function DatasheetPreview({ datasheet }) {
  const componentRef = useRef(null);
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `${datasheet.model_name}_Datasheet`,
    pageStyle: `
      @page {
        size: A4;
        margin: 0;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-hidden {
          display: none !important;
        }
      }
    `
  });

  const handleOpenPublic = () => {
    window.open(`/datasheet/${datasheet.id}`, '_blank');
  };

  return (
    <div>
      {/* Preview Header */}
      <div className="sticky top-0 bg-slate-900 p-4 flex justify-between items-center border-b border-slate-700 z-10 print-hidden">
        <h3 className="text-white font-semibold">Preview: {datasheet.model_name}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenPublic}>
            <ExternalLink className="w-3 h-3 mr-1" /> Open Public Page
          </Button>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={handlePrint}>
            <Download className="w-3 h-3 mr-1" /> Download PDF
          </Button>
        </div>
      </div>
      
      {/* Datasheet Content */}
      <div className="p-0" ref={componentRef}>
        {datasheet.category === 'battery' && <BatteryDatasheet data={datasheet} />}
        {datasheet.category === 'inverter' && <InverterDatasheet data={datasheet} />}
        {datasheet.category === 'stabilizer' && <StabilizerDatasheet data={datasheet} />}
      </div>
    </div>
  );
}
