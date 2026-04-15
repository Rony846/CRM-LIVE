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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { 
  Plus, Battery, Zap, Activity, Download, Eye, Pencil, Trash2, 
  Copy, ExternalLink, FileText, Search, LayoutGrid, List, Loader2,
  ShoppingBag, Sparkles, RefreshCw, Globe, ImagePlus, Package,
  Upload, CheckCircle2, XCircle, ArrowRight, ChevronRight, IndianRupee,
  Percent, Calculator, Send, AlertCircle, Wand2
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
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    category: 'inverter',
    model_name: '',
    subtitle: '',
    image_url: '',
    images: [],
    amazon_asin: '',
    master_sku_id: '',
    specifications: {},
    features: [],
    warranty: '2 Years',
    certifications: ['BIS', 'ISO 9001']
  });
  
  // Master SKU list for dropdown
  const [masterSkus, setMasterSkus] = useState([]);
  
  // Import Wizard State
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importMode, setImportMode] = useState('bulk'); // 'bulk' or 'single'
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [singleProductUrl, setSingleProductUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedProducts, setScrapedProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [globalMargin, setGlobalMargin] = useState(70);
  const [importing, setImporting] = useState(false);
  const [importedProducts, setImportedProducts] = useState([]);
  const [pushingToAmazon, setPushingToAmazon] = useState({});
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('');
  // Manual entry state
  const [manualProduct, setManualProduct] = useState({
    name: '',
    price: 0,
    images: [],
    description: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDatasheets();
    fetchMasterSkus();
    fetchFirms();
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
  
  const fetchMasterSkus = async () => {
    try {
      const res = await axios.get(`${API}/master-skus`, { headers });
      setMasterSkus(res.data.master_skus || []);
    } catch (err) {
      console.error('Error fetching master SKUs:', err);
    }
  };
  
  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data.firms || []);
      // Auto-select first firm
      if (res.data.firms?.length > 0) {
        setSelectedFirm(res.data.firms[0].id);
      }
    } catch (err) {
      console.error('Error fetching firms:', err);
    }
  };
  
  // Scrape products from website
  const handleScrapeWebsite = async () => {
    if (!scrapeUrl.trim()) {
      toast.error('Please enter a website URL');
      return;
    }
    
    setScraping(true);
    try {
      const formData = new FormData();
      formData.append('base_url', scrapeUrl);
      formData.append('max_products', '30');
      
      const res = await axios.post(`${API}/catalogue/scrape-website`, formData, { headers });
      
      if (res.data.products && res.data.products.length > 0) {
        // Initialize products with default margin and calculated prices
        const productsWithPricing = res.data.products.map((p, idx) => ({
          ...p,
          id: `scraped-${idx}`,
          margin: globalMargin,
          amazonPrice: calculateAmazonPrice(p.price, globalMargin)
        }));
        setScrapedProducts(productsWithPricing);
        toast.success(`Found ${res.data.products_found} products!`);
        setImportStep(2);
      } else {
        toast.error('No products found on this website');
      }
    } catch (err) {
      console.error('Scrape error:', err);
      toast.error(err.response?.data?.detail || 'Failed to scrape website');
    } finally {
      setScraping(false);
    }
  };
  
  // Scrape a single product from URL
  const handleScrapeSingleProduct = async () => {
    if (!singleProductUrl.trim()) {
      toast.error('Please enter a product URL');
      return;
    }
    
    setScraping(true);
    try {
      const formData = new FormData();
      formData.append('product_url', singleProductUrl);
      
      const res = await axios.post(`${API}/catalogue/scrape-product-url`, formData, { headers });
      
      if (res.data.success && res.data.product) {
        const product = {
          ...res.data.product,
          id: `scraped-single-${Date.now()}`,
          margin: globalMargin,
          amazonPrice: calculateAmazonPrice(res.data.product.price, globalMargin)
        };
        // Add to scraped products list
        setScrapedProducts(prev => [...prev, product]);
        toast.success(`Added: ${res.data.product.name?.substring(0, 50)}...`);
        setSingleProductUrl('');
      } else {
        toast.error('Failed to scrape product');
      }
    } catch (err) {
      console.error('Single scrape error:', err);
      toast.error(err.response?.data?.detail || 'Failed to scrape product');
    } finally {
      setScraping(false);
    }
  };
  
  // Add manual product to list
  const handleAddManualProduct = () => {
    if (!manualProduct.name.trim()) {
      toast.error('Please enter a product name');
      return;
    }
    if (manualProduct.price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    
    const product = {
      ...manualProduct,
      id: `manual-${Date.now()}`,
      margin: globalMargin,
      amazonPrice: calculateAmazonPrice(manualProduct.price, globalMargin),
      source_url: ''
    };
    
    setScrapedProducts(prev => [...prev, product]);
    setManualProduct({ name: '', price: 0, images: [], description: '' });
    toast.success(`Added: ${product.name.substring(0, 50)}`);
  };
  
  // Calculate Amazon price: (Website Price + Margin%) + 18% GST
  const calculateAmazonPrice = (websitePrice, marginPercent) => {
    const priceWithMargin = websitePrice + (websitePrice * marginPercent / 100);
    const amazonPrice = priceWithMargin + (priceWithMargin * 0.18); // 18% GST
    return Math.round(amazonPrice);
  };
  
  // Update margin for a specific product
  const updateProductMargin = (productId, newMargin) => {
    setScrapedProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          margin: newMargin,
          amazonPrice: calculateAmazonPrice(p.price, newMargin)
        };
      }
      return p;
    }));
  };
  
  // Apply global margin to all selected products
  const applyGlobalMargin = () => {
    setScrapedProducts(prev => prev.map(p => ({
      ...p,
      margin: globalMargin,
      amazonPrice: calculateAmazonPrice(p.price, globalMargin)
    })));
    toast.success(`Applied ${globalMargin}% margin to all products`);
  };
  
  // Toggle product selection
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };
  
  // Select/Deselect all products
  const toggleSelectAll = () => {
    const allSelected = scrapedProducts.every(p => selectedProducts[p.id]);
    if (allSelected) {
      setSelectedProducts({});
    } else {
      const newSelected = {};
      scrapedProducts.forEach(p => { newSelected[p.id] = true; });
      setSelectedProducts(newSelected);
    }
  };
  
  // Import selected products to catalogue
  const handleImportProducts = async () => {
    const selected = scrapedProducts.filter(p => selectedProducts[p.id]);
    if (selected.length === 0) {
      toast.error('Please select at least one product to import');
      return;
    }
    
    setImporting(true);
    const imported = [];
    
    for (const product of selected) {
      try {
        const formData = new FormData();
        formData.append('name', product.name);
        formData.append('price', product.price.toString());
        formData.append('description', product.description || '');
        formData.append('images', JSON.stringify(product.images || []));
        formData.append('source_url', product.source_url || '');
        formData.append('category', 'accessories');
        formData.append('margin_percent', product.margin.toString());
        formData.append('gst_percent', '18');
        
        const res = await axios.post(`${API}/catalogue/import-product`, formData, { headers });
        
        if (res.data.success) {
          imported.push({
            ...res.data.datasheet,
            pricing: res.data.pricing
          });
        }
      } catch (err) {
        console.error(`Failed to import: ${product.name}`, err);
      }
    }
    
    setImporting(false);
    
    if (imported.length > 0) {
      setImportedProducts(imported);
      toast.success(`Imported ${imported.length} products to catalogue!`);
      setImportStep(3);
      fetchDatasheets(); // Refresh main list
    } else {
      toast.error('Failed to import products');
    }
  };
  
  // Push single product to Amazon
  const handlePushToAmazon = async (datasheetId) => {
    if (!selectedFirm) {
      toast.error('Please select a firm with Amazon credentials');
      return;
    }
    
    setPushingToAmazon(prev => ({ ...prev, [datasheetId]: true }));
    
    try {
      const formData = new FormData();
      formData.append('firm_id', selectedFirm);
      
      const res = await axios.post(`${API}/catalogue/push-to-amazon/${datasheetId}`, formData, { headers });
      
      if (res.data.success) {
        toast.success(`Product pushed to Amazon! SKU: ${res.data.sku}`);
        
        // Update imported products list
        setImportedProducts(prev => prev.map(p => {
          if (p.id === datasheetId) {
            return { ...p, amazon_sku: res.data.sku, amazon_status: 'pending_review' };
          }
          return p;
        }));
      } else {
        toast.error(`Amazon error: ${res.data.issues?.[0]?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Push to Amazon error:', err);
      toast.error(err.response?.data?.detail || 'Failed to push to Amazon');
    } finally {
      setPushingToAmazon(prev => ({ ...prev, [datasheetId]: false }));
    }
  };
  
  // Reset Import Wizard
  const resetImportWizard = () => {
    setImportStep(1);
    setImportMode('bulk');
    setScrapeUrl('');
    setSingleProductUrl('');
    setScrapedProducts([]);
    setSelectedProducts({});
    setImportedProducts([]);
    setGlobalMargin(70);
    setManualProduct({ name: '', price: 0, images: [], description: '' });
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
        // Use all images from scrape if available
        const allImages = data.images || (data.image_url ? [data.image_url] : []);
        
        setFormData(prev => ({
          ...prev,
          category: data.category || prev.category,
          model_name: data.model_name || '',
          subtitle: data.subtitle || '',
          image_url: allImages[0] || '',
          images: allImages,  // Set all images
          amazon_asin: asin,
          specifications: { ...prev.specifications, ...data.specifications },
          features: data.features?.length > 0 ? data.features : prev.features,
          warranty: data.warranty || prev.warranty,
          certifications: data.certifications || prev.certifications
        }));
        
        const imgCount = allImages.length;
        toast.success(`Fetched data for: ${data.model_name?.substring(0, 50)}... (${imgCount} image${imgCount !== 1 ? 's' : ''} found)`);
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
      images: [],
      amazon_asin: '',
      master_sku_id: '',
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
      images: datasheet.images || [],
      amazon_asin: datasheet.amazon_asin || '',
      master_sku_id: datasheet.master_sku_id || '',
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
          <div className="flex gap-2">
            <Button 
              onClick={() => { resetImportWizard(); setShowImportWizard(true); }}
              variant="outline"
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              data-testid="import-wizard-btn"
            >
              <Globe className="w-4 h-4 mr-2" />
              Import from Website
            </Button>
            <Button 
              onClick={() => { resetForm(); setShowCreateDialog(true); }}
              className="bg-cyan-600 hover:bg-cyan-500"
              data-testid="create-datasheet-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Datasheet
            </Button>
          </div>
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

        {/* Import Wizard Dialog */}
        <Dialog open={showImportWizard} onOpenChange={setShowImportWizard}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-400" />
                Import Products from Website
              </DialogTitle>
            </DialogHeader>
            
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 py-4 border-b border-slate-700">
              {[
                { num: 1, label: 'Scrape', icon: Globe },
                { num: 2, label: 'Select & Price', icon: Calculator },
                { num: 3, label: 'Push to Amazon', icon: Send }
              ].map((step, idx) => (
                <React.Fragment key={step.num}>
                  <div 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      importStep === step.num 
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
                        : importStep > step.num
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {importStep > step.num ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                  {idx < 2 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                </React.Fragment>
              ))}
            </div>
            
            {/* Step Content */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* Step 1: Add Products */}
              {importStep === 1 && (
                <div className="space-y-6 px-2">
                  {/* Import Mode Tabs */}
                  <div className="flex gap-2 p-1 bg-slate-800 rounded-lg">
                    {[
                      { id: 'bulk', label: 'Bulk Scrape', icon: Globe },
                      { id: 'single', label: 'Single URL', icon: ExternalLink },
                      { id: 'manual', label: 'Manual Entry', icon: Plus }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setImportMode(mode.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          importMode === mode.id
                            ? 'bg-orange-500 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        <mode.icon className="w-4 h-4" />
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Bulk Scrape Mode */}
                  {importMode === 'bulk' && (
                    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Scrape Products from E-commerce Website
                      </h3>
                      <p className="text-slate-400 text-sm mb-4">
                        Enter a website URL to automatically fetch product listings. Works with WooCommerce, Shopify, and similar platforms.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input
                          value={scrapeUrl}
                          onChange={(e) => setScrapeUrl(e.target.value)}
                          placeholder="https://example.com/shop"
                          className="bg-slate-800 border-slate-700 flex-1"
                          data-testid="scrape-url-input"
                        />
                        <Button 
                          onClick={handleScrapeWebsite}
                          disabled={scraping}
                          className="bg-orange-500 hover:bg-orange-600 min-w-[140px]"
                          data-testid="scrape-btn"
                        >
                          {scraping ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Scraping...
                            </>
                          ) : (
                            <>
                              <Globe className="w-4 h-4 mr-2" />
                              Scrape Products
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                        <AlertCircle className="w-4 h-4" />
                        Max 30 products per scrape. Works best with WooCommerce & Shopify stores.
                      </div>
                    </div>
                  )}
                  
                  {/* Single URL Mode */}
                  {importMode === 'single' && (
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Add Single Product by URL
                      </h3>
                      <p className="text-slate-400 text-sm mb-4">
                        Paste a direct product page URL to fetch its details.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input
                          value={singleProductUrl}
                          onChange={(e) => setSingleProductUrl(e.target.value)}
                          placeholder="https://example.com/product/product-name"
                          className="bg-slate-800 border-slate-700 flex-1"
                          data-testid="single-url-input"
                        />
                        <Button 
                          onClick={handleScrapeSingleProduct}
                          disabled={scraping}
                          className="bg-cyan-500 hover:bg-cyan-600 min-w-[140px]"
                          data-testid="single-scrape-btn"
                        >
                          {scraping ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Fetching...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Add Product
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Manual Entry Mode */}
                  {importMode === 'manual' && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Add Product Manually
                      </h3>
                      <p className="text-slate-400 text-sm mb-4">
                        Enter product details manually when scraping doesn't work.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-slate-300 text-sm">Product Name *</Label>
                          <Input
                            value={manualProduct.name}
                            onChange={(e) => setManualProduct(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Product name"
                            className="bg-slate-800 border-slate-700 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-slate-300 text-sm">Website Price (₹) *</Label>
                          <Input
                            type="number"
                            value={manualProduct.price || ''}
                            onChange={(e) => setManualProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                            placeholder="0"
                            className="bg-slate-800 border-slate-700 mt-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-slate-300 text-sm">Description</Label>
                          <Input
                            value={manualProduct.description}
                            onChange={(e) => setManualProduct(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Product description (optional)"
                            className="bg-slate-800 border-slate-700 mt-1"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-slate-300 text-sm">Image URL</Label>
                          <Input
                            value={manualProduct.images?.[0] || ''}
                            onChange={(e) => setManualProduct(prev => ({ ...prev, images: e.target.value ? [e.target.value] : [] }))}
                            placeholder="https://example.com/image.jpg"
                            className="bg-slate-800 border-slate-700 mt-1"
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleAddManualProduct}
                        className="mt-4 bg-purple-500 hover:bg-purple-600"
                        data-testid="add-manual-btn"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add to List
                      </Button>
                    </div>
                  )}
                  
                  {/* Scraped Products Preview */}
                  {scrapedProducts.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-medium">
                          Products Ready ({scrapedProducts.length})
                        </h4>
                        <Button 
                          size="sm"
                          onClick={() => setImportStep(2)}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          Continue to Pricing
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {scrapedProducts.slice(0, 6).map((p, i) => (
                          <div key={p.id} className="relative group">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                            ) : (
                              <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-500" />
                              </div>
                            )}
                            <button
                              onClick={() => setScrapedProducts(prev => prev.filter(pr => pr.id !== p.id))}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {scrapedProducts.length > 6 && (
                          <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 text-sm">
                            +{scrapedProducts.length - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Step 2: Select Products & Set Pricing */}
              {importStep === 2 && (
                <div className="space-y-4 px-2">
                  {/* Global Margin Control */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={scrapedProducts.every(p => selectedProducts[p.id])}
                            onCheckedChange={toggleSelectAll}
                            data-testid="select-all-checkbox"
                          />
                          <span className="text-sm text-slate-300">
                            Select All ({Object.values(selectedProducts).filter(Boolean).length}/{scrapedProducts.length})
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Label className="text-slate-400 text-sm">Global Margin:</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={globalMargin}
                            onChange={(e) => setGlobalMargin(Number(e.target.value))}
                            className="w-20 bg-slate-800 border-slate-700"
                            data-testid="global-margin-input"
                          />
                          <Percent className="w-4 h-4 text-slate-400" />
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={applyGlobalMargin}
                          className="border-slate-600"
                          data-testid="apply-margin-btn"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Apply to All
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                      <Calculator className="w-3 h-3" />
                      Formula: Amazon Price = (Website Price + Margin%) + 18% GST
                    </div>
                  </div>
                  
                  {/* Products List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {scrapedProducts.map((product) => (
                      <div 
                        key={product.id}
                        className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${
                          selectedProducts[product.id] 
                            ? 'border-orange-500/50 bg-orange-500/5' 
                            : 'border-slate-700'
                        }`}
                      >
                        <div className="flex gap-4">
                          {/* Checkbox */}
                          <div className="flex items-start pt-1">
                            <Checkbox 
                              checked={selectedProducts[product.id] || false}
                              onCheckedChange={() => toggleProductSelection(product.id)}
                              data-testid={`product-checkbox-${product.id}`}
                            />
                          </div>
                          
                          {/* Product Image */}
                          <div className="w-20 h-20 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0">
                            {product.images?.[0] ? (
                              <img 
                                src={product.images[0]} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-8 h-8 text-slate-600" />
                              </div>
                            )}
                          </div>
                          
                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium text-sm line-clamp-2">
                              {product.name}
                            </h4>
                            {product.description && (
                              <p className="text-slate-400 text-xs mt-1 line-clamp-1">
                                {product.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <a 
                                href={product.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Source
                              </a>
                            </div>
                          </div>
                          
                          {/* Pricing */}
                          <div className="flex flex-col items-end gap-2 min-w-[200px]">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">Website:</span>
                              <span className="text-white font-medium flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {product.price?.toLocaleString() || 0}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-sm">Margin:</span>
                              <Input
                                type="number"
                                value={product.margin}
                                onChange={(e) => updateProductMargin(product.id, Number(e.target.value))}
                                className="w-16 h-7 text-sm bg-slate-900 border-slate-700"
                              />
                              <Percent className="w-3 h-3 text-slate-400" />
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">Amazon:</span>
                              <span className="text-orange-400 font-semibold flex items-center">
                                <IndianRupee className="w-3 h-3" />
                                {product.amazonPrice?.toLocaleString() || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Import Button */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                    <Button 
                      variant="outline" 
                      onClick={() => setImportStep(1)}
                      className="border-slate-600"
                    >
                      Back
                    </Button>
                    <Button 
                      onClick={handleImportProducts}
                      disabled={importing || Object.values(selectedProducts).filter(Boolean).length === 0}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                      data-testid="import-products-btn"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Import {Object.values(selectedProducts).filter(Boolean).length} Products
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 3: Push to Amazon */}
              {importStep === 3 && (
                <div className="space-y-4 px-2">
                  {/* Firm Selection */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <Label className="text-slate-300">Amazon Seller Account:</Label>
                      <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                        <SelectTrigger className="w-64 bg-slate-800 border-slate-700">
                          <SelectValue placeholder="Select firm with Amazon credentials" />
                        </SelectTrigger>
                        <SelectContent>
                          {firms.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Imported Products */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {importedProducts.map((product) => (
                      <div 
                        key={product.id}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
                      >
                        <div className="flex gap-4 items-center">
                          {/* Product Image */}
                          <div className="w-16 h-16 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.model_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-600" />
                              </div>
                            )}
                          </div>
                          
                          {/* Product Info */}
                          <div className="flex-1">
                            <h4 className="text-white font-medium text-sm line-clamp-1">
                              {product.model_name}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                              <span>MRP: ₹{product.amazon_fields?.mrp?.toLocaleString()}</span>
                              <span>•</span>
                              <span className="text-orange-400">
                                Selling: ₹{product.amazon_fields?.selling_price?.toLocaleString()}
                              </span>
                            </div>
                            {product.amazon_sku && (
                              <div className="mt-1 text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                SKU: {product.amazon_sku}
                              </div>
                            )}
                          </div>
                          
                          {/* Action */}
                          <div className="flex-shrink-0">
                            {product.amazon_sku ? (
                              <div className="text-green-400 text-sm font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Pushed
                              </div>
                            ) : (
                              <Button 
                                size="sm"
                                onClick={() => handlePushToAmazon(product.id)}
                                disabled={pushingToAmazon[product.id] || !selectedFirm}
                                className="bg-orange-500 hover:bg-orange-600"
                                data-testid={`push-amazon-${product.id}`}
                              >
                                {pushingToAmazon[product.id] ? (
                                  <>
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    Pushing...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3 mr-1" />
                                    Push to Amazon
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Done Button */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                    <div className="text-sm text-slate-400">
                      {importedProducts.filter(p => p.amazon_sku).length}/{importedProducts.length} pushed to Amazon
                    </div>
                    <Button 
                      onClick={() => setShowImportWizard(false)}
                      className="bg-cyan-600 hover:bg-cyan-500"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

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
              masterSkus={masterSkus}
              selectedDatasheet={selectedDatasheet}
              token={token}
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
function DatasheetForm({ formData, setFormData, onSubmit, editMode, asinInput, setAsinInput, asinLoading, handleAsinLookup, masterSkus, selectedDatasheet, token }) {
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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { id: 'inverter', icon: Zap, color: 'text-orange-400' },
          { id: 'battery', icon: Battery, color: 'text-green-400' },
          { id: 'stabilizer', icon: Activity, color: 'text-blue-400' },
          { id: 'servo', icon: Activity, color: 'text-purple-400' },
          { id: 'solar', icon: Zap, color: 'text-yellow-400' },
          { id: 'accessories', icon: FileText, color: 'text-slate-400' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFormData(prev => ({ ...prev, category: cat.id, specifications: {} }))}
            className={`p-3 rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.02] ${
              formData.category === cat.id 
                ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20' 
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <cat.icon className={`w-5 h-5 ${formData.category === cat.id ? cat.color : cat.color + '/60'}`} />
              <span className="text-white capitalize text-xs font-medium">{cat.id}</span>
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
          <Label className="text-slate-300">Product Images (PNG/JPEG)</Label>
          <div className="mt-1 space-y-2">
            {/* File Upload */}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  const authHeaders = { Authorization: `Bearer ${token}` };
                  for (const file of files) {
                    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
                      toast.error('Only PNG and JPEG files are allowed');
                      continue;
                    }
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', file);
                    try {
                      const res = await axios.post(`${API}/upload`, formDataUpload, { headers: authHeaders });
                      const url = res.data.url;
                      setFormData(prev => ({
                        ...prev,
                        images: [...(prev.images || []), url],
                        image_url: prev.image_url || url
                      }));
                      toast.success('Image uploaded');
                    } catch (err) {
                      console.error('Upload error:', err);
                      const errorMsg = err.response?.data?.detail || err.message || 'Unknown error';
                      toast.error(`Upload failed: ${errorMsg}`);
                    }
                  }
                  e.target.value = '';
                }}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-dashed border-slate-500 rounded-lg text-slate-300 text-sm">
                  <Plus className="w-4 h-4" /> Upload Images
                </div>
              </label>
            </div>
            
            {/* URL Input */}
            <Input
              value={formData.image_url}
              onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
              placeholder="Or paste image URL"
              className="bg-slate-800 border-slate-700"
            />
            
            {/* Image Preview Grid */}
            {(formData.images?.length > 0 || formData.image_url) && (
              <div className="flex gap-2 flex-wrap mt-2">
                {[...(formData.images || []), formData.image_url].filter((url, i, arr) => url && arr.indexOf(url) === i).map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="h-16 w-16 object-cover rounded-lg border border-slate-600" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        images: (prev.images || []).filter(u => u !== url),
                        image_url: prev.image_url === url ? '' : prev.image_url
                      }))}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      
      {/* Master SKU Link */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-slate-300">Link to Master SKU (for PI Integration)</Label>
          <Select
            value={formData.master_sku_id || ''}
            onValueChange={(value) => setFormData(prev => ({ ...prev, master_sku_id: value === 'none' ? '' : value }))}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
              <SelectValue placeholder="Select Master SKU (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-- No Link --</SelectItem>
              {masterSkus.map(sku => (
                <SelectItem key={sku.id} value={sku.id}>
                  {sku.sku_code} - {sku.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-1">Link this catalogue to a Master SKU so agents can view it from Proforma Invoice</p>
        </div>
        <div>
          <Label className="text-slate-300">Public Catalogue Link</Label>
          {selectedDatasheet?.id ? (
            <div className="mt-1 flex items-center gap-2">
              <Input
                value={`${window.location.origin}/datasheet/${selectedDatasheet.id}`}
                readOnly
                className="bg-slate-800 border-slate-700 text-slate-400"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/datasheet/${selectedDatasheet.id}`);
                  toast.success('Link copied!');
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-3">Save the datasheet first to get a shareable link</p>
          )}
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
