import React, { useState, useEffect } from 'react';
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
import { 
  Plus, Battery, Zap, Activity, Download, Eye, Pencil, Trash2, 
  Copy, ExternalLink, FileText, Search, LayoutGrid, List
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
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'battery',
    model_name: '',
    subtitle: '',
    image_url: '',
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
      const res = await axios.get(`${API}/api/product-datasheets`, { headers });
      setDatasheets(res.data.datasheets || []);
    } catch (err) {
      console.error('Error fetching datasheets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await axios.post(`${API}/api/product-datasheets`, formData, { headers });
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
      await axios.put(`${API}/api/product-datasheets/${selectedDatasheet.id}`, formData, { headers });
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
      await axios.delete(`${API}/api/product-datasheets/${id}`, { headers });
      toast.success('Datasheet deleted');
      fetchDatasheets();
    } catch (err) {
      toast.error('Failed to delete datasheet');
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'battery',
      model_name: '',
      subtitle: '',
      image_url: '',
      specifications: {},
      features: [],
      warranty: '2 Years',
      certifications: ['BIS', 'ISO 9001']
    });
    setSelectedDatasheet(null);
    setEditMode(false);
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
              <DialogTitle className="text-white">
                {editMode ? 'Edit Datasheet' : 'Create New Datasheet'}
              </DialogTitle>
            </DialogHeader>
            
            <DatasheetForm 
              formData={formData}
              setFormData={setFormData}
              onSubmit={editMode ? handleUpdate : handleCreate}
              editMode={editMode}
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
function DatasheetForm({ formData, setFormData, onSubmit, editMode }) {
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

  // Specification fields based on category
  const specFields = {
    battery: [
      { key: 'capacity_ah', label: 'Capacity (Ah)', placeholder: '150' },
      { key: 'voltage', label: 'Voltage (V)', placeholder: '12' },
      { key: 'type', label: 'Type', placeholder: 'Tubular Lead Acid' },
      { key: 'dimensions', label: 'Dimensions (LxWxH mm)', placeholder: '502 x 189 x 410' },
      { key: 'weight', label: 'Weight (kg)', placeholder: '52' },
      { key: 'electrolyte', label: 'Electrolyte Volume (L)', placeholder: '18' },
      { key: 'terminals', label: 'Terminal Type', placeholder: 'Threaded Stud' },
      { key: 'cycle_life', label: 'Cycle Life', placeholder: '1500+ cycles' },
    ],
    inverter: [
      { key: 'capacity_kva', label: 'Capacity (kVA)', placeholder: '5' },
      { key: 'capacity_kw', label: 'Capacity (kW)', placeholder: '4' },
      { key: 'pv_input_range', label: 'PV Input Range (V)', placeholder: '120-450' },
      { key: 'max_pv_power', label: 'Max PV Power (W)', placeholder: '6000' },
      { key: 'battery_voltage', label: 'Battery Voltage (V)', placeholder: '48' },
      { key: 'ac_output', label: 'AC Output (V)', placeholder: '230' },
      { key: 'frequency', label: 'Frequency (Hz)', placeholder: '50' },
      { key: 'efficiency', label: 'Efficiency (%)', placeholder: '93' },
      { key: 'display', label: 'Display Type', placeholder: 'LCD' },
      { key: 'dimensions', label: 'Dimensions (mm)', placeholder: '460 x 350 x 120' },
      { key: 'weight', label: 'Weight (kg)', placeholder: '18' },
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

  return (
    <div className="space-y-6 py-4">
      {/* Category Selection */}
      <div className="grid grid-cols-3 gap-4">
        {['battery', 'inverter', 'stabilizer'].map(cat => (
          <button
            key={cat}
            onClick={() => setFormData(prev => ({ ...prev, category: cat, specifications: {} }))}
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.category === cat 
                ? 'border-cyan-500 bg-cyan-500/10' 
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {cat === 'battery' && <Battery className="w-5 h-5 text-green-400" />}
              {cat === 'inverter' && <Zap className="w-5 h-5 text-orange-400" />}
              {cat === 'stabilizer' && <Activity className="w-5 h-5 text-blue-400" />}
              <span className="text-white capitalize">{cat}</span>
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
            placeholder="e.g., MG-INV-5KW"
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
          <Label className="text-slate-300">Image URL (optional)</Label>
          <Input
            value={formData.image_url}
            onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
            placeholder="https://example.com/product.png"
            className="bg-slate-800 border-slate-700 mt-1"
          />
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

      {/* Specifications */}
      <div>
        <Label className="text-slate-300 text-lg font-semibold mb-3 block">Specifications</Label>
        <div className="grid grid-cols-2 gap-3">
          {currentSpecs.map(spec => (
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
            <div key={index} className="flex gap-2">
              <Input
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder="e.g., Pure Sine Wave Output"
                className="bg-slate-800 border-slate-700"
              />
              <Button size="icon" variant="outline" className="border-red-600 text-red-400" onClick={() => removeFeature(index)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
        <Button variant="outline" className="border-slate-600">Cancel</Button>
        <Button onClick={onSubmit} className="bg-cyan-600 hover:bg-cyan-500">
          {editMode ? 'Update Datasheet' : 'Create Datasheet'}
        </Button>
      </div>
    </div>
  );
}

// Preview Component
function DatasheetPreview({ datasheet }) {
  const handleDownloadPDF = () => {
    window.print();
  };

  const handleOpenPublic = () => {
    window.open(`/datasheet/${datasheet.id}`, '_blank');
  };

  return (
    <div>
      {/* Preview Header */}
      <div className="sticky top-0 bg-slate-900 p-4 flex justify-between items-center border-b border-slate-700 z-10">
        <h3 className="text-white font-semibold">Preview: {datasheet.model_name}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenPublic}>
            <ExternalLink className="w-3 h-3 mr-1" /> Open Public Page
          </Button>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={handleDownloadPDF}>
            <Download className="w-3 h-3 mr-1" /> Download PDF
          </Button>
        </div>
      </div>
      
      {/* Datasheet Content */}
      <div className="p-0" id="datasheet-print">
        {datasheet.category === 'battery' && <BatteryDatasheet data={datasheet} />}
        {datasheet.category === 'inverter' && <InverterDatasheet data={datasheet} />}
        {datasheet.category === 'stabilizer' && <StabilizerDatasheet data={datasheet} />}
      </div>
    </div>
  );
}
