import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Package, Cable, Plug, Wrench, 
  ArrowRight, Loader2, ExternalLink
} from 'lucide-react';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

// Accessory subcategories with icons
const accessoryTypes = [
  {
    id: 'cables',
    name: 'DC Cables',
    icon: Cable,
    description: 'Solar DC cables, battery cables, earthing cables',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'connectors',
    name: 'MC4 Connectors',
    icon: Plug,
    description: 'MC4 pairs, branch connectors, Y-connectors',
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'mounting',
    name: 'Mounting Kits',
    icon: Wrench,
    description: 'Panel mounts, rails, clamps, tin roof hooks',
    color: 'from-orange-500 to-amber-500'
  },
  {
    id: 'other',
    name: 'Other Accessories',
    icon: Package,
    description: 'Junction boxes, fuses, breakers, tools',
    color: 'from-purple-500 to-pink-500'
  }
];

export default function AccessoriesListing() {
  const navigate = useNavigate();
  const [accessories, setAccessories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    fetchAccessories();
  }, []);

  const fetchAccessories = async () => {
    try {
      const res = await axios.get(`${API}/api/product-datasheets/public?category=accessories`);
      setAccessories(res.data.datasheets || []);
    } catch (err) {
      console.error('Error fetching accessories:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccessories = selectedType 
    ? accessories.filter(a => {
        const name = (a.model_name || '').toLowerCase();
        const subtitle = (a.subtitle || '').toLowerCase();
        if (selectedType === 'cables') return name.includes('cable') || subtitle.includes('cable');
        if (selectedType === 'connectors') return name.includes('mc4') || name.includes('connector') || subtitle.includes('connector');
        if (selectedType === 'mounting') return name.includes('mount') || name.includes('rail') || name.includes('clamp');
        return true;
      })
    : accessories;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-slate-900/50 to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" />
          <div className="w-16"></div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-500/10 border border-slate-500/30 rounded-full mb-4">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm font-medium">Solar Accessories</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Complete Your Installation
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Quality cables, connectors, and mounting solutions for professional solar installations
          </p>
        </div>
      </section>

      {/* Category Filters */}
      <section className="px-4 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {accessoryTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(isSelected ? null : type.id)}
                  className={`relative p-4 rounded-xl border transition-all duration-300 text-left group ${
                    isSelected 
                      ? `bg-gradient-to-br ${type.color} border-transparent shadow-lg` 
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`} />
                  <h3 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>{type.name}</h3>
                  <p className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{type.description}</p>
                </button>
              );
            })}
          </div>
          {selectedType && (
            <button 
              onClick={() => setSelectedType(null)}
              className="mt-3 text-sm text-gray-400 hover:text-white"
            >
              ← Show all accessories
            </button>
          )}
        </div>
      </section>

      {/* Products Grid */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
            </div>
          ) : filteredAccessories.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Coming Soon</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                We're adding accessories to our catalogue. Check back soon or contact us for your requirements.
              </p>
              <a 
                href="tel:+919999036254"
                className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
              >
                Call for Enquiry
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccessories.map((product) => (
                <div
                  key={product.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all group cursor-pointer"
                  onClick={() => navigate(`/datasheet/${product.id}`)}
                >
                  {/* Product Image */}
                  <div className="aspect-video bg-gray-900 relative overflow-hidden">
                    {product.image_url || product.images?.[0] ? (
                      <img 
                        src={product.images?.[0] || product.image_url} 
                        alt={product.model_name}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-700" />
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-slate-300 transition-colors">
                      {product.model_name}
                    </h3>
                    {product.subtitle && (
                      <p className="text-gray-500 text-xs mb-3">{product.subtitle}</p>
                    )}
                    
                    {/* Quick specs */}
                    {product.specifications && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {Object.entries(product.specifications).slice(0, 3).map(([key, value]) => (
                          <span key={key} className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-[10px] rounded">
                            {value}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-xs">View Details</span>
                      <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="px-4 pb-16">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-r from-slate-800 to-gray-800 rounded-2xl p-6 md:p-8 text-center border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-2">Need Custom Accessories?</h3>
            <p className="text-gray-400 text-sm mb-4">
              We supply cables, connectors, and mounting kits in bulk. Contact us for wholesale pricing.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a 
                href="tel:+919999036254"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                📞 +91 9999036254
              </a>
              <a 
                href="mailto:service@musclegrid.in"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
              >
                ✉️ Email Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FooterLogo3D className="mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-500">
            <a href="tel:+919999036254" className="hover:text-white">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in" className="hover:text-white">service@musclegrid.in</a>
            <a href="https://www.musclegrid.in" className="hover:text-white">www.musclegrid.in</a>
          </div>
        </div>
      </footer>
      
      {/* WhatsApp Button */}
      <WhatsAppButton />
    </div>
  );
}
