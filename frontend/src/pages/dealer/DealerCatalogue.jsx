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

// Obsidian-Elite stock status chips
const STOCK_STATUS = {
  in_stock:     { label: 'In Stock',     badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25', icon: CheckCircle2 },
  low_stock:    { label: 'Low Stock',    badge: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',     icon: AlertCircle },
  out_of_stock: { label: 'Out of Stock', badge: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',        icon: Clock }
};

const badgeBase = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

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
            <p className="text-muted-foreground text-sm mt-0.5">Browse complete product datasheets with live stock visibility</p>
          </div>
          <Link to="/dealer/orders/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="place-order-btn">
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
                placeholder="Search by model, name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="catalogue-search"
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
                    data-testid={`category-filter-${cat}`}
                  >
                    <IconComponent className="w-4 h-4 mr-1" />
                    {cat === 'all' ? 'All Categories' : cat}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {filteredDatasheets.length} of {datasheets.length} products
          </p>
        </div>

        {/* Products Grid */}
        {filteredDatasheets.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Products Found</h3>
            <p className="text-muted-foreground text-sm">
              {searchTerm ? 'Try a different search term' : 'No products available in this category'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDatasheets.map((datasheet) => {
              const stockKey = getStockStatus(datasheet.stock_available);
              const stockCfg = STOCK_STATUS[stockKey];
              const StatusIcon = stockCfg.icon;
              const CategoryIcon = CATEGORY_ICONS[datasheet.category] || Package;
              const productImage = datasheet.images?.[0] || datasheet.image_url;

              return (
                <div
                  key={datasheet.id}
                  className="mg-card group rounded-lg border border-border bg-card hover:border-primary/40 transition-all cursor-pointer overflow-hidden"
                  onClick={() => openDatasheetDetail(datasheet)}
                  data-testid={`datasheet-card-${datasheet.id}`}
                >
                  {/* Product Image */}
                  <div className="relative h-40 bg-muted overflow-hidden">
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={datasheet.model_name}
                        className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <CategoryIcon className="w-16 h-16 text-muted-foreground/20" />
                      </div>
                    )}

                    {/* Stock Badge */}
                    <span className={`${badgeBase} ${stockCfg.badge} absolute top-2 right-2`}>
                      <StatusIcon className="w-3 h-3" />
                      {datasheet.stock_available > 0 ? `${datasheet.stock_available} units` : 'Out of Stock'}
                    </span>

                    {/* Category Badge */}
                    {datasheet.category && (
                      <span className="absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 bg-muted/80 text-muted-foreground ring-border backdrop-blur-sm">
                        {datasheet.category}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors line-clamp-1 text-sm">
                      {datasheet.model_name}
                    </h3>
                    {datasheet.subtitle && (
                      <p className="text-muted-foreground text-xs line-clamp-1 mt-0.5">{datasheet.subtitle}</p>
                    )}
                    <p className="font-mono text-[11px] text-muted-foreground/60 mt-1">{datasheet.sku_code}</p>

                    {/* Pricing */}
                    {datasheet.dealer_price && (
                      <div className="mt-2 flex items-end justify-between">
                        <div>
                          {datasheet.mrp && (
                            <p className="font-mono text-[11px] text-muted-foreground/50 line-through tabular-nums">
                              MRP: {formatCurrency(datasheet.mrp)}
                            </p>
                          )}
                          <p className="font-mono text-sm font-bold tabular-nums text-primary">
                            {formatCurrency(datasheet.dealer_price)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
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
                </div>
              );
            })}
          </div>
        )}

        {/* Datasheet Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-popover border border-border max-w-5xl max-h-[90vh] overflow-y-auto">
            {selectedDatasheet && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground text-xl flex items-center gap-2">
                    {selectedDatasheet.model_name}
                    {selectedDatasheet.stock_available > 0 && (
                      <span className={`${badgeBase} ${STOCK_STATUS.in_stock.badge} ml-2`}>
                        {selectedDatasheet.stock_available} in stock
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  {/* Left Column - Images & Actions */}
                  <div className="space-y-4">
                    {/* Main Image */}
                    {(selectedDatasheet.images?.length > 0 || selectedDatasheet.image_url) ? (
                      <>
                        <div className="bg-muted rounded-lg p-4 h-72 flex items-center justify-center">
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
                                className="w-16 h-16 object-cover rounded border border-border hover:border-primary/50 cursor-pointer flex-shrink-0 transition-colors"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-muted rounded-lg p-4 h-72 flex items-center justify-center">
                        <ImageIcon className="w-20 h-20 text-muted-foreground/20" />
                      </div>
                    )}

                    {/* Stock & Pricing Card */}
                    <div className="mg-card rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Stock & Pricing</p>
                        {(() => {
                          const sk = getStockStatus(selectedDatasheet.stock_available);
                          const sc = STOCK_STATUS[sk];
                          return (
                            <span className={`${badgeBase} ${sc.badge}`}>
                              {selectedDatasheet.stock_available > 0
                                ? `${selectedDatasheet.stock_available} available`
                                : 'Out of Stock'}
                            </span>
                          );
                        })()}
                      </div>

                      {selectedDatasheet.dealer_price && (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">MRP</span>
                            <span className="font-mono tabular-nums text-muted-foreground/50 line-through">{formatCurrency(selectedDatasheet.mrp)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dealer Price</span>
                            <span className="font-mono tabular-nums text-primary font-bold text-base">{formatCurrency(selectedDatasheet.dealer_price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">GST ({selectedDatasheet.gst_rate || 18}%)</span>
                            <span className="font-mono tabular-nums text-foreground">{formatCurrency(selectedDatasheet.dealer_price * (selectedDatasheet.gst_rate || 18) / 100)}</span>
                          </div>
                          <div className="border-t border-border pt-2 flex justify-between">
                            <span className="text-foreground font-semibold">Total</span>
                            <span className="font-mono tabular-nums text-emerald-400 font-bold text-base">
                              {formatCurrency(selectedDatasheet.dealer_price * (1 + (selectedDatasheet.gst_rate || 18) / 100))}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <Link to="/dealer/orders/new" className="flex-1">
                          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={selectedDatasheet.stock_available <= 0}>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {selectedDatasheet.stock_available > 0 ? 'Place Order' : 'Out of Stock'}
                          </Button>
                        </Link>
                        {selectedDatasheet.public_url && (
                          <a href={selectedDatasheet.public_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground hover:bg-muted">
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Quick Links */}
                    <div className="flex gap-2">
                      <a
                        href={`/datasheet/${selectedDatasheet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full border-primary/40 text-primary hover:bg-primary/10">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Full Datasheet
                        </Button>
                      </a>
                      {selectedDatasheet.pdf_url && (
                        <a href={selectedDatasheet.pdf_url} download className="flex-1">
                          <Button variant="outline" className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-muted">
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
                    <div className="mg-card rounded-lg border border-border bg-card p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Product Information</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">SKU Code</span>
                          <span className="text-foreground font-mono">{selectedDatasheet.sku_code}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Category</span>
                          <span className="text-foreground">{selectedDatasheet.category}</span>
                        </div>
                        {selectedDatasheet.warranty && (
                          <div className="flex justify-between py-1 border-b border-border/50">
                            <span className="text-muted-foreground">Warranty</span>
                            <span className="text-foreground">{selectedDatasheet.warranty}</span>
                          </div>
                        )}
                        {selectedDatasheet.hsn_code && (
                          <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">HSN Code</span>
                            <span className="text-foreground font-mono">{selectedDatasheet.hsn_code}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Specifications */}
                    {selectedDatasheet.specifications && Object.keys(selectedDatasheet.specifications).length > 0 && (
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Technical Specifications</p>
                        <div className="space-y-4 max-h-64 overflow-y-auto">
                          {Object.entries(selectedDatasheet.specifications).map(([section, specs]) => (
                            <div key={section}>
                              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-primary mb-2">{section}</p>
                              <div className="space-y-1 text-sm">
                                {Object.entries(specs || {}).map(([key, value]) => (
                                  <div key={key} className="flex justify-between py-1 border-b border-border/40">
                                    <span className="text-muted-foreground">{key}</span>
                                    <span className="text-foreground text-right max-w-[60%]">{value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Features */}
                    {selectedDatasheet.features && selectedDatasheet.features.length > 0 && (
                      <div className="mg-card rounded-lg border border-border bg-card p-4">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-3">Key Features</p>
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedDatasheet.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
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
