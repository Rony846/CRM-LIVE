import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Package, Search, Loader2, IndianRupee, ShoppingCart, Eye,
  Battery, Zap, Sun, Settings, ChevronRight, ExternalLink, Image as ImageIcon
} from 'lucide-react';

const CATEGORY_ICONS = {
  'Battery': Battery,
  'Inverter': Zap,
  'Solar Inverter': Sun,
  'Solar Panel': Sun,
  'Accessories': Settings
};

export default function DealerProducts() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (token) {
      fetchProducts();
    }
  }, [token]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/dealer/products-catalogue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
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

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
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
            <p className="text-slate-400">Browse our complete product range with specifications</p>
          </div>
          <Link to="/dealer/orders/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
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
                  placeholder="Search products by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-600 text-white"
                  data-testid="product-search"
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
                      data-testid={`category-${cat}`}
                    >
                      <IconComponent className="w-4 h-4 mr-1" />
                      {cat === 'all' ? 'All' : cat}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const hasDatasheet = !!product.datasheet;
              const productImage = product.images?.[0] || product.datasheet?.images?.[0] || product.datasheet?.image_url;
              const CategoryIcon = CATEGORY_ICONS[product.category] || Package;
              
              return (
                <Card 
                  key={product.id} 
                  className="bg-slate-800 border-slate-700 hover:border-cyan-600/50 transition-all group cursor-pointer"
                  onClick={() => openProductDetail(product)}
                  data-testid={`product-card-${product.id}`}
                >
                  <CardContent className="p-0">
                    {/* Product Image */}
                    <div className="relative h-48 bg-slate-900 rounded-t-lg overflow-hidden">
                      {productImage ? (
                        <img 
                          src={productImage} 
                          alt={product.name}
                          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CategoryIcon className="w-20 h-20 text-slate-700" />
                        </div>
                      )}
                      {hasDatasheet && (
                        <Badge className="absolute top-2 right-2 bg-green-600/90 text-white text-xs">
                          Full Specs Available
                        </Badge>
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-slate-500 text-sm font-mono">{product.sku}</p>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs ml-2">
                          {product.category}
                        </Badge>
                      </div>
                      
                      {/* Pricing */}
                      <div className="flex items-end justify-between mt-4">
                        <div>
                          <p className="text-slate-500 text-xs">
                            Customer Price: <span className="line-through">{formatCurrency(product.selling_price)}</span>
                          </p>
                          <p className="text-cyan-400 font-bold text-xl">
                            {formatCurrency(product.dealer_price)}
                          </p>
                          <p className="text-green-400 text-xs">
                            You save {product.dealer_discount_percent}% ({formatCurrency(product.savings)})
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(product);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Product Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white text-xl">
                    {selectedProduct.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {/* Images */}
                  <div className="space-y-4">
                    {(selectedProduct.images?.length > 0 || selectedProduct.datasheet?.images?.length > 0) ? (
                      <>
                        <div className="bg-slate-800 rounded-lg p-4 h-64 flex items-center justify-center">
                          <img 
                            src={selectedProduct.images?.[0] || selectedProduct.datasheet?.images?.[0]}
                            alt={selectedProduct.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        {(selectedProduct.images?.length > 1 || selectedProduct.datasheet?.images?.length > 1) && (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {(selectedProduct.images || selectedProduct.datasheet?.images || []).map((img, idx) => (
                              <img 
                                key={idx}
                                src={img}
                                alt={`${selectedProduct.name} ${idx + 1}`}
                                className="w-16 h-16 object-cover rounded border border-slate-700 hover:border-cyan-500 cursor-pointer"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-slate-800 rounded-lg p-4 h-64 flex items-center justify-center">
                        <ImageIcon className="w-20 h-20 text-slate-700" />
                      </div>
                    )}
                    
                    {/* Pricing Card */}
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="p-4">
                        <h4 className="text-white font-semibold mb-3">Dealer Pricing</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Customer Price</span>
                            <span className="text-slate-500 line-through">{formatCurrency(selectedProduct.selling_price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Your Discount</span>
                            <span className="text-green-400 font-semibold">{selectedProduct.dealer_discount_percent}% OFF</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Your Price</span>
                            <span className="text-cyan-400 font-bold text-lg">{formatCurrency(selectedProduct.dealer_price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">You Save</span>
                            <span className="text-green-400">{formatCurrency(selectedProduct.savings)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">GST ({selectedProduct.gst_rate}%)</span>
                            <span className="text-slate-300">{formatCurrency(selectedProduct.dealer_price * selectedProduct.gst_rate / 100)}</span>
                          </div>
                          <div className="border-t border-slate-700 pt-2 flex justify-between">
                            <span className="text-white font-semibold">Total (incl. GST)</span>
                            <span className="text-green-400 font-bold text-lg">
                              {formatCurrency(selectedProduct.dealer_price * (1 + selectedProduct.gst_rate / 100))}
                            </span>
                          </div>
                        </div>
                        <Link to="/dealer/orders/new">
                          <Button className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Add to Order
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="p-4">
                        <h4 className="text-white font-semibold mb-3">Product Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">SKU</span>
                            <span className="text-white font-mono">{selectedProduct.sku}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Category</span>
                            <span className="text-white">{selectedProduct.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Warranty</span>
                            <span className="text-white">{selectedProduct.warranty_months || 12} months</span>
                          </div>
                          {selectedProduct.master_sku && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">HSN Code</span>
                              <span className="text-white">{selectedProduct.master_sku.hsn_code || '-'}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Specifications from Datasheet */}
                    {selectedProduct.datasheet?.specifications && Object.keys(selectedProduct.datasheet.specifications).length > 0 && (
                      <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-4">
                          <h4 className="text-white font-semibold mb-3">Specifications</h4>
                          <div className="space-y-3">
                            {Object.entries(selectedProduct.datasheet.specifications).map(([section, specs]) => (
                              <div key={section}>
                                <p className="text-cyan-400 text-xs font-semibold uppercase mb-1">{section}</p>
                                <div className="space-y-1 text-sm">
                                  {Object.entries(specs || {}).map(([key, value]) => (
                                    <div key={key} className="flex justify-between">
                                      <span className="text-slate-400">{key}</span>
                                      <span className="text-white">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Features from Datasheet */}
                    {selectedProduct.datasheet?.features && selectedProduct.datasheet.features.length > 0 && (
                      <Card className="bg-slate-800 border-slate-700">
                        <CardContent className="p-4">
                          <h4 className="text-white font-semibold mb-3">Key Features</h4>
                          <ul className="space-y-2">
                            {selectedProduct.datasheet.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-300">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Link to full datasheet */}
                    {selectedProduct.datasheet?.id && (
                      <a 
                        href={`/datasheet/${selectedProduct.datasheet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full border-cyan-600 text-cyan-400 hover:bg-cyan-950">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Full Product Datasheet
                        </Button>
                      </a>
                    )}

                    {/* No datasheet message */}
                    {!selectedProduct.datasheet && (
                      <Card className="bg-yellow-900/20 border-yellow-600/50">
                        <CardContent className="p-4 text-center">
                          <p className="text-yellow-400 text-sm">
                            Detailed specifications not yet available for this product.
                          </p>
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
