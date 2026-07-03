import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Package, Search, Loader2, ShoppingCart, Eye, ExternalLink, Image as ImageIcon,
  Battery, Zap, Sun, Settings, ChevronRight, Download, Share2,
  CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const CATEGORY_ICONS = {
  'Battery': Battery,
  'Inverter': Zap,
  'Solar Inverter': Sun,
  'Solar Panel': Sun,
  'Stabilizer': Zap,
  'Accessories': Settings
};

// Stock status -> Iron pill tone + icon
const STOCK_STATUS = {
  in_stock:     { label: 'In Stock',     tone: 'ok',   icon: CheckCircle2 },
  low_stock:    { label: 'Low Stock',    tone: 'warn', icon: AlertCircle },
  out_of_stock: { label: 'Out of Stock', tone: 'bad',  icon: Clock }
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const headerRight = (
    <Link to="/dealer/orders/new" data-testid="place-order-btn">
      <button style={primaryBtn}>
        <ShoppingCart size={14} strokeWidth={2} />
        Place Order
      </button>
    </Link>
  );

  return (
    <IronShell
      title="Product Catalogue"
      subtitle="DEALER PORTAL · LIVE STOCK + DATASHEETS"
      onRefresh={fetchCatalogue}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Search & Filter */}
          <IronCard pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input
                  placeholder="Search by model, name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
                  data-testid="catalogue-search"
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
                      data-testid={`category-filter-${cat}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        border: `1px solid ${isActive ? T.orange : T.iron200}`,
                        background: isActive ? T.orange : T.white,
                        color: isActive ? '#fff' : T.iron700,
                        borderRadius: 6, padding: '6px 11px', cursor: 'pointer',
                        fontFamily: T.headline, fontWeight: 700, fontSize: 11.5
                      }}
                    >
                      <IconComponent size={13} strokeWidth={2} />
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </IronCard>

          {/* Results Count */}
          <div style={{ marginBottom: 12 }}>
            <Caps size={9.5} color={T.iron400}>
              {filteredDatasheets.length} of {datasheets.length} products
            </Caps>
          </div>

          {/* Products Grid */}
          {filteredDatasheets.length === 0 ? (
            <IronCard pad={14} style={{ textAlign: 'center', padding: '60px 0' }}>
              <Package size={44} color={T.iron400} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron700 }}>No Products Found</div>
              <div style={{ fontSize: 12.5, marginTop: 4, color: T.iron400 }}>
                {searchTerm ? 'Try a different search term' : 'No products available in this category'}
              </div>
            </IronCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {filteredDatasheets.map((datasheet) => {
                const stockKey = getStockStatus(datasheet.stock_available);
                const stockCfg = STOCK_STATUS[stockKey];
                const StatusIcon = stockCfg.icon;
                const CategoryIcon = CATEGORY_ICONS[datasheet.category] || Package;
                const productImage = datasheet.images?.[0] || datasheet.image_url;

                return (
                  <div
                    key={datasheet.id}
                    className="iron-row"
                    onClick={() => openDatasheetDetail(datasheet)}
                    data-testid={`datasheet-card-${datasheet.id}`}
                    style={{
                      background: T.white, border: `1px solid ${T.iron200}`, borderRadius: 8,
                      boxShadow: '0 1px 2px rgba(15,15,15,.06)', overflow: 'hidden', cursor: 'pointer'
                    }}
                  >
                    {/* Product Image */}
                    <div style={{ position: 'relative', height: 160, background: T.iron50, overflow: 'hidden' }}>
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={datasheet.model_name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                          <CategoryIcon size={56} color={T.iron200} />
                        </div>
                      )}

                      {/* Stock Badge */}
                      <span style={{ ...badgeStyle(stockCfg.tone), position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <StatusIcon size={11} />
                        {datasheet.stock_available > 0 ? `${datasheet.stock_available} units` : 'Out of Stock'}
                      </span>

                      {/* Category Badge */}
                      {datasheet.category && (
                        <span style={{ ...badgeStyle('slate'), position: 'absolute', top: 8, left: 8 }}>
                          {datasheet.category}
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div style={{ padding: 12 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {datasheet.model_name}
                      </div>
                      {datasheet.subtitle && (
                        <div style={{ color: T.iron500, fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{datasheet.subtitle}</div>
                      )}
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 4 }}>{datasheet.sku_code}</div>

                      {/* Pricing */}
                      {datasheet.dealer_price && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <div>
                            {datasheet.mrp && (
                              <div style={{ ...mono, fontSize: 10.5, color: T.iron400, textDecoration: 'line-through' }}>
                                MRP: {formatCurrency(datasheet.mrp)}
                              </div>
                            )}
                            <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: T.orangeDeep }}>
                              {formatCurrency(datasheet.dealer_price)}
                            </div>
                          </div>
                          <button
                            title="View"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDatasheetDetail(datasheet);
                            }}
                            style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Datasheet Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedDatasheet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedDatasheet.model_name}
                  {selectedDatasheet.stock_available > 0 && (
                    <span style={{ ...badgeStyle('ok'), marginLeft: 6 }}>
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
                      <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 16, height: 288, display: 'grid', placeItems: 'center' }}>
                        <img
                          src={selectedDatasheet.images?.[0] || selectedDatasheet.image_url}
                          alt={selectedDatasheet.model_name}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      {selectedDatasheet.images?.length > 1 && (
                        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                          {selectedDatasheet.images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`${selectedDatasheet.model_name} ${idx + 1}`}
                              style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: `1px solid ${T.iron200}`, cursor: 'pointer', flexShrink: 0 }}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 16, height: 288, display: 'grid', placeItems: 'center' }}>
                      <ImageIcon size={72} color={T.iron200} />
                    </div>
                  )}

                  {/* Stock & Pricing Card */}
                  <IronCard pad={16}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <Caps size={10} color={T.iron400}>Stock & Pricing</Caps>
                      {(() => {
                        const sk = getStockStatus(selectedDatasheet.stock_available);
                        const sc = STOCK_STATUS[sk];
                        return (
                          <span style={badgeStyle(sc.tone)}>
                            {selectedDatasheet.stock_available > 0
                              ? `${selectedDatasheet.stock_available} available`
                              : 'Out of Stock'}
                          </span>
                        );
                      })()}
                    </div>

                    {selectedDatasheet.dealer_price && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: T.iron500 }}>MRP</span>
                          <span style={{ ...mono, color: T.iron400, textDecoration: 'line-through' }}>{formatCurrency(selectedDatasheet.mrp)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: T.iron500 }}>Dealer Price</span>
                          <span style={{ ...mono, color: T.orangeDeep, fontWeight: 700, fontSize: 15 }}>{formatCurrency(selectedDatasheet.dealer_price)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: T.iron500 }}>GST ({selectedDatasheet.gst_rate || 18}%)</span>
                          <span style={{ ...mono, color: T.iron900 }}>{formatCurrency(selectedDatasheet.dealer_price * (selectedDatasheet.gst_rate || 18) / 100)}</span>
                        </div>
                        <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: T.iron900, fontWeight: 700 }}>Total</span>
                          <span style={{ ...mono, color: T.green, fontWeight: 700, fontSize: 15 }}>
                            {formatCurrency(selectedDatasheet.dealer_price * (1 + (selectedDatasheet.gst_rate || 18) / 100))}
                          </span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                      <Link to="/dealer/orders/new" style={{ flex: 1 }}>
                        <button
                          disabled={selectedDatasheet.stock_available <= 0}
                          style={{
                            ...primaryBtn, width: '100%', justifyContent: 'center',
                            opacity: selectedDatasheet.stock_available <= 0 ? 0.5 : 1,
                            cursor: selectedDatasheet.stock_available <= 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <ShoppingCart size={14} strokeWidth={2} />
                          {selectedDatasheet.stock_available > 0 ? 'Place Order' : 'Out of Stock'}
                        </button>
                      </Link>
                      {selectedDatasheet.public_url && (
                        <a href={selectedDatasheet.public_url} target="_blank" rel="noopener noreferrer">
                          <button style={outlineBtn}>
                            <Share2 size={14} />
                          </button>
                        </a>
                      )}
                    </div>
                  </IronCard>

                  {/* Quick Links */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={`/datasheet/${selectedDatasheet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1 }}
                    >
                      <button style={{ ...outlineBtn, width: '100%', border: `1px solid ${T.orange}`, color: T.orangeDeep }}>
                        <ExternalLink size={14} />
                        Full Datasheet
                      </button>
                    </a>
                    {selectedDatasheet.pdf_url && (
                      <a href={selectedDatasheet.pdf_url} download style={{ flex: 1 }}>
                        <button style={{ ...outlineBtn, width: '100%' }}>
                          <Download size={14} />
                          Download PDF
                        </button>
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Column - Details */}
                <div className="space-y-4">
                  {/* Basic Info */}
                  <IronCard pad={16}>
                    <Caps size={10} color={T.iron400} style={{ display: 'block', marginBottom: 12 }}>Product Information</Caps>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ color: T.iron500 }}>SKU Code</span>
                        <span style={{ ...mono, color: T.iron900 }}>{selectedDatasheet.sku_code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.iron100}` }}>
                        <span style={{ color: T.iron500 }}>Category</span>
                        <span style={{ color: T.iron900 }}>{selectedDatasheet.category}</span>
                      </div>
                      {selectedDatasheet.warranty && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.iron100}` }}>
                          <span style={{ color: T.iron500 }}>Warranty</span>
                          <span style={{ color: T.iron900 }}>{selectedDatasheet.warranty}</span>
                        </div>
                      )}
                      {selectedDatasheet.hsn_code && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ color: T.iron500 }}>HSN Code</span>
                          <span style={{ ...mono, color: T.iron900 }}>{selectedDatasheet.hsn_code}</span>
                        </div>
                      )}
                    </div>
                  </IronCard>

                  {/* Specifications */}
                  {selectedDatasheet.specifications && Object.keys(selectedDatasheet.specifications).length > 0 && (
                    <IronCard pad={16}>
                      <Caps size={10} color={T.iron400} style={{ display: 'block', marginBottom: 12 }}>Technical Specifications</Caps>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 256, overflowY: 'auto' }}>
                        {Object.entries(selectedDatasheet.specifications).map(([section, specs]) => (
                          <div key={section}>
                            <Caps size={9} color={T.orangeDeep} style={{ display: 'block', marginBottom: 8 }}>{section}</Caps>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                              {Object.entries(specs || {}).map(([key, value]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.iron100}` }}>
                                  <span style={{ color: T.iron500 }}>{key}</span>
                                  <span style={{ color: T.iron900, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </IronCard>
                  )}

                  {/* Features */}
                  {selectedDatasheet.features && selectedDatasheet.features.length > 0 && (
                    <IronCard pad={16}>
                      <Caps size={10} color={T.iron400} style={{ display: 'block', marginBottom: 12 }}>Key Features</Caps>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 192, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
                        {selectedDatasheet.features.map((feature, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                            <ChevronRight size={15} color={T.orange} style={{ marginTop: 1, flexShrink: 0 }} />
                            <span style={{ color: T.iron700 }}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </IronCard>
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
