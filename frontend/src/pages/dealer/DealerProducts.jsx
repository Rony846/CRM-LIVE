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

const badgeBase = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground">Product Catalogue</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Browse our complete product range with specifications</p>
          </div>
          <Link to="/dealer/orders/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Place Order
            </Button>
          </Link>
        </div>

        {/* Search & Filter */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="product-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => {
                const IconComponent = cat !== 'all' ? CATEGORY_ICONS[cat] || Package : Package;
                const isActive = selectedCategory === cat;
                return (
                  <Button
                    key={cat}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={isActive ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}
                    data-testid={`category-${cat}`}
                  >
                    <IconComponent className="w-4 h-4 mr-1" />
                    {cat === 'all' ? 'All' : cat}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Products Found</h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm ? 'Try a different search term' : 'No products available in this category'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const hasDatasheet = !!product.datasheet;
              const productImage = product.images?.[0] || product.datasheet?.images?.[0] || product.datasheet?.image_url;
              const CategoryIcon = CATEGORY_ICONS[product.category] || Package;

              return (
                <div
                  key={product.id}
                  className="mg-card group rounded-lg border border-border bg-card hover:border-primary/40 transition-all cursor-pointer overflow-hidden"
                  onClick={() => openProductDetail(product)}
                  data-testid={`product-card-${product.id}`}
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={product.name}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CategoryIcon className="w-20 h-20 text-muted-foreground/20" />
                      </div>
                    )}
                    {hasDatasheet && (
                      <span className={`${badgeBase} bg-emerald-500/15 text-emerald-400 ring-emerald-500/25 absolute top-2 right-2`}>
                        Full Specs Available
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors line-clamp-2 text-sm">
                          {product.name}
                        </h3>
                        <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">{product.sku}</p>
                      </div>
                      {product.category && (
                        <span className={`${badgeBase} bg-muted text-muted-foreground ring-border ml-2 flex-shrink-0`}>
                          {product.category}
                        </span>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <p className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
                          List: <span className="line-through">{formatCurrency(product.selling_price)}</span>
                        </p>
                        <p className="font-mono text-xl font-bold tabular-nums text-primary">
                          {formatCurrency(product.dealer_price)}
                        </p>
                        <p className="font-mono text-[11px] text-emerald-400 tabular-nums">
                          Save {product.dealer_discount_percent}% ({formatCurrency(product.savings)})
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:text-primary hover:bg-primary/10"
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
                </div>
              );
            })}
          </div>
        )}

        {/* Product Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-popover border border-border max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground text-xl">
                    {selectedProduct.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  {/* Images */}
                  <div className="space-y-4">
                    {(selectedProduct.images?.length > 0 || selectedProduct.datasheet?.images?.length > 0) ? (
                      <>
                        <div className="bg-muted rounded-lg p-4 h-64 flex items-center justify-center">
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
                                className="w-16 h-16 object-cover rounded border border-border hover:border-primary/50 cursor-pointer transition-colors"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-muted rounded-lg p-4 h-64 flex items-center justify-center">
                        <ImageIcon className="w-20 h-20 text-muted-foreground/20" />
                      </div>
                    )}

                    {/* Pricing Card */}
                    <div className="mg-card rounded-lg border border-border bg-card p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Dealer Pricing</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Customer Price</span>
                          <span className="font-mono tabular-nums text-muted-foreground/50 line-through">{formatCurrency(selectedProduct.selling_price)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Your Discount</span>
                          <span className="font-mono tabular-nums text-emerald-400 font-semibold">{selectedProduct.dealer_discount_percent}% OFF</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Your Price</span>
                          <span className="font-mono tabular-nums text-primary font-bold text-base">{formatCurrency(selectedProduct.dealer_price)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">You Save</span>
                          <span className="font-mono tabular-nums text-emerald-400">{formatCurrency(selectedProduct.savings)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">GST ({selectedProduct.gst_rate}%)</span>
                          <span className="font-mono tabular-nums text-foreground">{formatCurrency(selectedProduct.dealer_price * selectedProduct.gst_rate / 100)}</span>
                        </div>
                        <div className="flex justify-between pt-2">
                          <span className="text-foreground font-semibold">Total (incl. GST)</span>
                          <span className="font-mono tabular-nums text-emerald-400 font-bold text-base">
                            {formatCurrency(selectedProduct.dealer_price * (1 + selectedProduct.gst_rate / 100))}
                          </span>
                        </div>
                      </div>
                      <Link to="/dealer/orders/new">
                        <Button className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add to Order
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="mg-card rounded-lg border border-border bg-card p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Product Details</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">SKU</span>
                          <span className="text-foreground font-mono">{selectedProduct.sku}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Category</span>
                          <span className="text-foreground">{selectedProduct.category}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Warranty</span>
                          <span className="text-foreground">{selectedProduct.warranty_months || 12} months</span>
                        </div>
                        {selectedProduct.master_sku && (
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">HSN Code</span>
                            <span className="text-foreground font-mono">{selectedProduct.master_sku.hsn_code || '-'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Specifications from Datasheet */}
                    {selectedProduct.datasheet?.specifications && Object.keys(selectedProduct.datasheet.specifications).length > 0 && (
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Specifications</p>
                        <div className="space-y-3">
                          {Object.entries(selectedProduct.datasheet.specifications).map(([section, specs]) => (
                            <div key={section}>
                              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">{section}</p>
                              <div className="space-y-1 text-sm">
                                {Object.entries(specs || {}).map(([key, value]) => (
                                  <div key={key} className="flex justify-between py-0.5 border-b border-border/40">
                                    <span className="text-muted-foreground">{key}</span>
                                    <span className="text-foreground">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Features from Datasheet */}
                    {selectedProduct.datasheet?.features && selectedProduct.datasheet.features.length > 0 && (
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Key Features</p>
                        <ul className="space-y-2">
                          {selectedProduct.datasheet.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Link to full datasheet */}
                    {selectedProduct.datasheet?.id && (
                      <a
                        href={`/datasheet/${selectedProduct.datasheet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Full Product Datasheet
                        </Button>
                      </a>
                    )}

                    {/* No datasheet message */}
                    {!selectedProduct.datasheet && (
                      <div className="mg-card rounded-lg border border-amber-400/25 bg-amber-400/5 p-4 text-center">
                        <p className="text-amber-400 text-sm">
                          Detailed specifications not yet available for this product.
                        </p>
                      </div>
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
