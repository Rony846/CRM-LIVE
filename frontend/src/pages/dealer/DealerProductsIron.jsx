import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Package, Search, Loader2, ShoppingCart, Eye,
  Battery, Zap, Sun, Settings, ChevronRight, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const CATEGORY_ICONS = {
  'Battery': Battery,
  'Inverter': Zap,
  'Solar Inverter': Sun,
  'Solar Panel': Sun,
  'Accessories': Settings
};

const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const headerRight = (
    <Link to="/dealer/orders/new" style={{ textDecoration: 'none' }}>
      <button style={primaryBtn}>
        <ShoppingCart size={15} strokeWidth={2} />
        Place Order
      </button>
    </Link>
  );

  return (
    <IronShell title="Products" subtitle="DEALER PORTAL · PRODUCT CATALOGUE" onRefresh={fetchProducts} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Intro */}
          <div style={{ marginBottom: 16 }}>
            <Caps size={9} color={T.iron400}>Browse our complete product range with specifications</Caps>
          </div>

          {/* Search & Filter */}
          <IronCard pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: 10 }} />
                <input
                  placeholder="Search products by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="product-search"
                  style={{ ...inputStyle, paddingLeft: 32, width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {categories.map(cat => {
                  const IconComponent = cat !== 'all' ? CATEGORY_ICONS[cat] || Package : Package;
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      data-testid={`category-${cat}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${isActive ? T.orange : T.iron200}`, background: isActive ? T.orange : T.white, color: isActive ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
                    >
                      <IconComponent size={14} strokeWidth={2} />
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </IronCard>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <IronCard pad={14} style={{ padding: '60px 0', textAlign: 'center', color: T.iron400 }}>
              <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron700, marginBottom: 4 }}>No Products Found</div>
              <div style={{ fontSize: 12.5 }}>{searchTerm ? 'Try a different search term' : 'No products available in this category'}</div>
            </IronCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filteredProducts.map((product) => {
                const hasDatasheet = !!product.datasheet;
                const productImage = product.images?.[0] || product.datasheet?.images?.[0] || product.datasheet?.image_url;
                const CategoryIcon = CATEGORY_ICONS[product.category] || Package;

                return (
                  <div
                    key={product.id}
                    onClick={() => openProductDetail(product)}
                    data-testid={`product-card-${product.id}`}
                    style={{ background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8, boxShadow: '0 1px 2px rgba(15,15,15,.06)', overflow: 'hidden', cursor: 'pointer' }}
                  >
                    {/* Product Image */}
                    <div style={{ position: 'relative', height: 180, background: T.iron50, borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={product.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16 }}
                        />
                      ) : (
                        <CategoryIcon size={72} color={T.iron200} />
                      )}
                      {hasDatasheet && (
                        <span style={{ position: 'absolute', top: 8, right: 8, background: T.greenTint, color: T.green, border: '1px solid #CBE5D6', padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase' }}>
                          Full Specs Available
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, lineHeight: 1.35 }}>{product.name}</div>
                          <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{product.sku}</div>
                        </div>
                        {product.category && (
                          <span style={{ flexShrink: 0, background: T.iron100, color: T.iron700, border: `1px solid ${T.iron200}`, padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                            {product.category}
                          </span>
                        )}
                      </div>

                      {/* Pricing */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
                        <div>
                          <div style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>
                            List: <span style={{ textDecoration: 'line-through' }}>{formatCurrency(product.selling_price)}</span>
                          </div>
                          <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.orangeDeep }}>
                            {formatCurrency(product.dealer_price)}
                          </div>
                          <div style={{ ...mono, fontSize: 10.5, color: T.green }}>
                            Save {product.dealer_discount_percent}% ({formatCurrency(product.savings)})
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(product);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                        >
                          <Eye size={13} />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Product Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedProduct.name}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Images */}
                <div className="space-y-4">
                  {(selectedProduct.images?.length > 0 || selectedProduct.datasheet?.images?.length > 0) ? (
                    <>
                      <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 16, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={selectedProduct.images?.[0] || selectedProduct.datasheet?.images?.[0]}
                          alt={selectedProduct.name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      {(selectedProduct.images?.length > 1 || selectedProduct.datasheet?.images?.length > 1) && (
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                          {(selectedProduct.images || selectedProduct.datasheet?.images || []).map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`${selectedProduct.name} ${idx + 1}`}
                              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.iron200}`, cursor: 'pointer', flexShrink: 0 }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 16, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={72} color={T.iron200} />
                    </div>
                  )}

                  {/* Pricing Card */}
                  <IronCard pad={14}>
                    <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 10 }}>Dealer Pricing</Caps>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>Customer Price</span>
                        <span style={{ ...mono, fontSize: 12.5, color: T.iron400, textDecoration: 'line-through' }}>{formatCurrency(selectedProduct.selling_price)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>Your Discount</span>
                        <span style={{ ...mono, fontSize: 12.5, color: T.green, fontWeight: 700 }}>{selectedProduct.dealer_discount_percent}% OFF</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>Your Price</span>
                        <span style={{ ...mono, fontSize: 14, color: T.orangeDeep, fontWeight: 700 }}>{formatCurrency(selectedProduct.dealer_price)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>You Save</span>
                        <span style={{ ...mono, fontSize: 12.5, color: T.green }}>{formatCurrency(selectedProduct.savings)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>GST ({selectedProduct.gst_rate}%)</span>
                        <span style={{ ...mono, fontSize: 12.5, color: T.iron900 }}>{formatCurrency(selectedProduct.dealer_price * selectedProduct.gst_rate / 100)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
                        <span style={{ fontSize: 12.5, color: T.iron900, fontWeight: 700 }}>Total (incl. GST)</span>
                        <span style={{ ...mono, fontSize: 14, color: T.green, fontWeight: 700 }}>
                          {formatCurrency(selectedProduct.dealer_price * (1 + selectedProduct.gst_rate / 100))}
                        </span>
                      </div>
                    </div>
                    <Link to="/dealer/orders/new" style={{ textDecoration: 'none' }}>
                      <button style={{ ...primaryBtn, width: '100%', justifyContent: 'center', marginTop: 14 }}>
                        <ShoppingCart size={15} strokeWidth={2} />
                        Add to Order
                      </button>
                    </Link>
                  </IronCard>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {/* Basic Info */}
                  <IronCard pad={14}>
                    <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 10 }}>Product Details</Caps>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>SKU</span>
                        <span style={{ ...mono, fontSize: 12.5, color: T.iron900 }}>{selectedProduct.sku}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>Category</span>
                        <span style={{ fontSize: 12.5, color: T.iron900 }}>{selectedProduct.category}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ fontSize: 12.5, color: T.iron500 }}>Warranty</span>
                        <span style={{ fontSize: 12.5, color: T.iron900 }}>{selectedProduct.warranty_months || 12} months</span>
                      </div>
                      {selectedProduct.master_sku && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                          <span style={{ fontSize: 12.5, color: T.iron500 }}>HSN Code</span>
                          <span style={{ ...mono, fontSize: 12.5, color: T.iron900 }}>{selectedProduct.master_sku.hsn_code || '-'}</span>
                        </div>
                      )}
                    </div>
                  </IronCard>

                  {/* Specifications from Datasheet */}
                  {selectedProduct.datasheet?.specifications && Object.keys(selectedProduct.datasheet.specifications).length > 0 && (
                    <IronCard pad={14}>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 10 }}>Specifications</Caps>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Object.entries(selectedProduct.datasheet.specifications).map(([section, specs]) => (
                          <div key={section}>
                            <Caps size={8.5} color={T.orangeDeep} style={{ display: 'block', marginBottom: 4 }}>{section}</Caps>
                            <div>
                              {Object.entries(specs || {}).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${T.iron100}` }}>
                                  <span style={{ fontSize: 12, color: T.iron500 }}>{key}</span>
                                  <span style={{ fontSize: 12, color: T.iron900 }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </IronCard>
                  )}

                  {/* Features from Datasheet */}
                  {selectedProduct.datasheet?.features && selectedProduct.datasheet.features.length > 0 && (
                    <IronCard pad={14}>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 10 }}>Key Features</Caps>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedProduct.datasheet.features.map((feature, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <ChevronRight size={15} color={T.orange} style={{ marginTop: 1, flexShrink: 0 }} />
                            <span style={{ fontSize: 12.5, color: T.iron700 }}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </IronCard>
                  )}

                  {/* Link to full datasheet */}
                  {selectedProduct.datasheet?.id && (
                    <a
                      href={`/datasheet/${selectedProduct.datasheet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <button style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '9px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                        <ExternalLink size={15} strokeWidth={2} />
                        View Full Product Datasheet
                      </button>
                    </a>
                  )}

                  {/* No datasheet message */}
                  {!selectedProduct.datasheet && (
                    <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, color: T.voltageText }}>
                        Detailed specifications not yet available for this product.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
