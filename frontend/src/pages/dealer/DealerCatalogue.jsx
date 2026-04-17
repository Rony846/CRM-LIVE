import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Package, Search, Loader2, ShoppingCart, Eye, ExternalLink, Image as ImageIcon,
  Battery, Zap, Sun, Settings, ChevronRight, FileText, Download, Share2,
  Boxes, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';

const CATEGORY_ICONS = {
  'Battery': Battery,
  'Inverter': Zap,
  'Solar Inverter': Sun,
  'Solar Panel': Sun,
  'Stabilizer': Zap,
  'Accessories': Settings
};

const STOCK_STATUS = {
  in_stock: { label: 'In Stock', color: 'bg-green-600', icon: CheckCircle2 },
  low_stock: { label: 'Low Stock', color: 'bg-yellow-600', icon: AlertCircle },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-600', icon: Clock }
};

export default function DealerCatalogue() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [datasheets, setDatasheets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDatasheet, setSelectedDatasheet] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCatalogue();
    }
  }, [token]);

  const fetchCatalogue = async () => {
    try {
      const response = await axios.get(`${API}/dealer/catalogue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDatasheets(response.data.datasheets || []);
    } catch (error) {
      console.error('Failed to fetch catalogue:', error);
      toast.error('Failed to load product catalogue');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const categories = ['all', ...new Set(datasheets.map(d => d.category).filter(Boolean))];

  const filteredDatasheets = datasheets.filter(ds => {
    const matchesSearch = !searchTerm || 
      ds.model_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ds.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ds.sku_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ds.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openDatasheetDetail = (datasheet) => {
    setSelectedDatasheet(datasheet);
    setShowDetailModal(true);
  };

  const getStockStatus = (stock) => {
    if (!stock || stock <= 0) return 'out_of_stock';
    if (stock < 10) return 'low_stock';
    return 'in_stock';
  };

  if (loading) {
    return (
      <DashboardLayout title="Product Catalogue">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Product Catalogue">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Product Catalogue</h1>
            <p className="text-slate-400">Browse complete product datasheets with live stock visibility</p>
          </div>
          <Link to="/dealer/orders/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="place-order-btn">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Place Order
            </Button>
          </Link>
        </div>

        {/* Search & Filter */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by model, name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-600 text-white"
                  data-testid="catalogue-search"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => {
                  const IconComponent = cat !== 'all' ? CATEGORY_ICONS[cat] || Package : Package;
                  return (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className={selectedCategory === cat 
                        ? 'bg-cyan-600 hover:bg-cyan-700' 
                        : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                      data-testid={`category-filter-${cat}`}
                    >
                      <IconComponent className="w-4 h-4 mr-1" />
                      {cat === 'all' ? 'All Categories' : cat}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">
            Showing {filteredDatasheets.length} of {datasheets.length} products
          </p>
        </div>

        {/* Products Grid */}
        {filteredDatasheets.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">No Products Found</h3>
              <p className="text-slate-400">
                {searchTerm ? 'Try a different search term' : 'No products available in this category'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDatasheets.map((datasheet) => {
              const stockStatus = getStockStatus(datasheet.stock_available);
              const StatusIcon = STOCK_STATUS[stockStatus].icon;
              const CategoryIcon = CATEGORY_ICONS[datasheet.category] || Package;
              const productImage = datasheet.images?.[0] || datasheet.image_url;
              
              return (
                <Card 
                  key={datasheet.id} 
                  className="bg-slate-800 border-slate-700 hover:border-cyan-600/50 transition-all group cursor-pointer overflow-hidden"
                  onClick={() => openDatasheetDetail(datasheet)}
                  data-testid={`datasheet-card-${datasheet.id}`}
                >
                  <CardContent className="p-0">
                    {/* Product Image */}
                    <div className="relative h-40 bg-slate-900 overflow-hidden">
                      {productImage ? (
                        <img 
                          src={productImage} 
                          alt={datasheet.model_name}
                          className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CategoryIcon className="w-16 h-16 text-slate-700" />
                        </div>
                      )}
                      
                      {/* Stock Badge */}
                      <Badge className={`absolute top-2 right-2 ${STOCK_STATUS[stockStatus].color} text-white text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {datasheet.stock_available > 0 ? `${datasheet.stock_available} units` : 'Out of Stock'}
                      </Badge>
                      
                      {/* Category Badge */}
                      <Badge variant="outline" className="absolute top-2 left-2 border-slate-600 bg-slate-900/80 text-slate-300 text-xs">
                        {datasheet.category}
                      </Badge>
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-3">
                      <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors line-clamp-1 text-sm">
                        {datasheet.model_name}
                      </h3>
                      {datasheet.subtitle && (
                        <p className="text-slate-500 text-xs line-clamp-1 mt-0.5">{datasheet.subtitle}</p>
                      )}
                      <p className="text-slate-600 text-xs font-mono mt-1">{datasheet.sku_code}</p>
                      
                      {/* Pricing */}
                      {datasheet.dealer_price && (
                        <div className="mt-2 flex items-end justify-between">
                          <div>
                            {datasheet.mrp && (
                              <p className="text-slate-600 text-xs line-through">
                                MRP: {formatCurrency(datasheet.mrp)}
                              </p>
                            )}
                            <p className="text-cyan-400 font-bold">
                              {formatCurrency(datasheet.dealer_price)}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950 h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDatasheetDetail(datasheet);
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Datasheet Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-5xl max-h-[90vh] overflow-y-auto">
            {selectedDatasheet && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-xl flex items-center gap-2">
                    {selectedDatasheet.model_name}
                    {selectedDatasheet.stock_available > 0 && (
                      <Badge className="bg-green-600 text-xs ml-2">
                        {selectedDatasheet.stock_available} in stock
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  {/* Left Column - Images & Actions */}
                  <div className="space-y-4">
                    {/* Main Image */}
                    {(selectedDatasheet.images?.length > 0 || selectedDatasheet.image_url) ? (
                      <>
                        <div className="bg-slate-800 rounded-lg p-4 h-72 flex items-center justify-center">
                          <img 
                            src={selectedDatasheet.images?.[0] || selectedDatasheet.image_url}
                            alt={selectedDatasheet.model_name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        {selectedDatasheet.images?.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {selectedDatasheet.images.map((img, idx) => (
                              <img 
                                key={idx}
                                src={img}
                                alt={`${selectedDatasheet.model_name} ${idx + 1}`}
                                className="w-16 h-16 object-cover rounded border border-slate-700 hover:border-cyan-500 cursor-pointer flex-shrink-0"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-slate-800 rounded-lg p-4 h-72 flex items-center justify-center">
                        <ImageIcon className="w-20 h-20 text-slate-700" />
                      </div>
                    )}

                    {/* Stock & Pricing Card */}
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-white font-semibold">Stock & Pricing</h4>
                          <Badge className={`${STOCK_STATUS[getStockStatus(selectedDatasheet.stock_available)].color}`}>
                            {selectedDatasheet.stock_available > 0 
                              ? `${selectedDatasheet.stock_available} available` 
                              : 'Out of Stock'}
                          </Badge>
                        </div>
                        
                        {selectedDatasheet.dealer_price && (
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-slate-400">MRP</span>
                              <span className="text-slate-500 line-through">{formatCurrency(selectedDatasheet.mrp)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Dealer Price</span>
                              <span className="text-cyan-400 font-bold text-lg">{formatCurrency(selectedDatasheet.dealer_price)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">GST ({selectedDatasheet.gst_rate || 18}%)</span>
                              <span className="text-slate-300">{formatCurrency(selectedDatasheet.dealer_price * (selectedDatasheet.gst_rate || 18) / 100)}</span>
                            </div>
                            <div className="border-t border-slate-700 pt-2 flex justify-between">
                              <span className="text-white font-semibold">Total</span>
                              <span className="text-green-400 font-bold text-lg">
                                {formatCurrency(selectedDatasheet.dealer_price * (1 + (selectedDatasheet.gst_rate || 18) / 100))}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex gap-2 mt-4">
                          <Link to="/dealer/orders/new" className="flex-1">
                            <Button className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={selectedDatasheet.stock_available <= 0}>
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {selectedDatasheet.stock_available > 0 ? 'Place Order' : 'Out of Stock'}
                            </Button>
                          </Link>
                          {selectedDatasheet.public_url && (
                            <a href={selectedDatasheet.public_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                                <Share2 className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Quick Links */}
                    <div className="flex gap-2">
                      <a 
                        href={`/datasheet/${selectedDatasheet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full border-cyan-600 text-cyan-400 hover:bg-cyan-950">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Full Datasheet
                        </Button>
                      </a>
                      {selectedDatasheet.pdf_url && (
                        <a href={selectedDatasheet.pdf_url} download className="flex-1">
                          <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Details */}
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="p-4">
                        <h4 className="text-white font-semibold mb-3">Product Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">SKU Code</span>
                            <span className="text-white font-mono">{selectedDatasheet.sku_code}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Category</span>
                            <span className="text-white">{selectedDatasheet.category}</span>
                          </div>
                          {selectedDatasheet.warranty && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Warranty</span>
                              <span className="text-white">{selectedDatasheet.warranty}</span>
                            </div>
                          )}
                          {selectedDatasheet.hsn_code && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">HSN Code</span>
                              <span className="text-white">{selectedDatasheet.hsn_code}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Specifications */}
                    {selectedDatasheet.specifications && Object.keys(selectedDatasheet.specifications).length > 0 && (
                      <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-4">
                          <h4 className="text-white font-semibold mb-3">Technical Specifications</h4>
                          <div className="space-y-4 max-h-64 overflow-y-auto">
                            {Object.entries(selectedDatasheet.specifications).map(([section, specs]) => (
                              <div key={section}>
                                <p className="text-cyan-400 text-xs font-semibold uppercase mb-2">{section}</p>
                                <div className="space-y-1 text-sm">
                                  {Object.entries(specs || {}).map(([key, value]) => (
                                    <div key={key} className="flex justify-between py-1 border-b border-slate-700/50">
                                      <span className="text-slate-400">{key}</span>
                                      <span className="text-white text-right max-w-[60%]">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Features */}
                    {selectedDatasheet.features && selectedDatasheet.features.length > 0 && (
                      <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-4">
                          <h4 className="text-white font-semibold mb-3">Key Features</h4>
                          <ul className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedDatasheet.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
