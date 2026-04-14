import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, ArrowRight, Loader2, Zap, Battery, Activity, 
  Settings, Sun, Package
} from 'lucide-react';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

// Category metadata
const categoryMeta = {
  inverter: {
    name: 'Solar Inverters',
    subtitle: 'Hybrid & Off-Grid Solutions',
    icon: Zap,
    color: 'from-orange-500 to-amber-500',
    showcaseRoute: '/datasheet' // Uses the general interactive showcase
  },
  battery: {
    name: 'LiFePO4 Batteries',
    subtitle: 'Long Life Energy Storage',
    icon: Battery,
    color: 'from-green-500 to-emerald-500',
    showcaseRoute: '/showcase/battery'
  },
  stabilizer: {
    name: 'Voltage Stabilizers',
    subtitle: 'Mainline Protection',
    icon: Activity,
    color: 'from-blue-500 to-cyan-500',
    showcaseRoute: '/showcase/stabilizer'
  },
  servo: {
    name: 'Servo Stabilizers',
    subtitle: 'Industrial Grade',
    icon: Settings,
    color: 'from-purple-500 to-violet-500',
    showcaseRoute: '/showcase/servo'
  },
  solar: {
    name: 'Solar Panels',
    subtitle: 'Mono PERC Bifacial',
    icon: Sun,
    color: 'from-yellow-500 to-orange-500',
    showcaseRoute: '/showcase/solar'
  },
  accessories: {
    name: 'Accessories',
    subtitle: 'Complete Solutions',
    icon: Package,
    color: 'from-slate-500 to-gray-500',
    showcaseRoute: '/catalogue/accessories'
  }
};

export default function CategoryListing() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const meta = categoryMeta[category] || {
    name: category,
    subtitle: '',
    icon: Package,
    color: 'from-gray-500 to-slate-500'
  };
  const Icon = meta.icon;

  useEffect(() => {
    fetchProducts();
  }, [category]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/product-datasheets/public?category=${category}`);
      setProducts(res.data.datasheets || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (productId) => {
    // Route to the appropriate showcase page based on category
    if (category === 'accessories') {
      navigate(`/datasheet/${productId}`);
    } else if (category === 'battery') {
      navigate(`/showcase/battery/${productId}`);
    } else if (category === 'stabilizer') {
      navigate(`/showcase/stabilizer/${productId}`);
    } else if (category === 'servo') {
      navigate(`/showcase/servo/${productId}`);
    } else if (category === 'solar') {
      navigate(`/showcase/solar/${productId}`);
    } else {
      // Default to inverter showcase (the original PublicDatasheetView)
      navigate(`/datasheet/${productId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between relative">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" className="absolute left-1/2 -translate-x-1/2" />
          <div className="w-16 z-10"></div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-8 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${meta.color} bg-opacity-10 border border-white/20 rounded-full mb-4`}>
            <Icon className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">{meta.name}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {meta.name}
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            {meta.subtitle}
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <Icon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Coming Soon</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                We're adding products to this category. Check back soon or contact us for your requirements.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden hover:border-gray-500 transition-all duration-300 group cursor-pointer transform hover:scale-[1.02]"
                  onClick={() => handleProductClick(product.id)}
                >
                  {/* Product Image */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
                    {product.image_url || product.images?.[0] ? (
                      <img 
                        src={product.images?.[0] || product.image_url} 
                        alt={product.model_name}
                        className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon className="w-16 h-16 text-gray-700" />
                      </div>
                    )}
                    
                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-t ${meta.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    
                    {/* Category badge */}
                    <div className={`absolute top-3 left-3 px-2 py-1 bg-gradient-to-r ${meta.color} rounded-full`}>
                      <span className="text-white text-[10px] font-semibold uppercase">{category}</span>
                    </div>
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-5">
                    <h3 className="font-bold text-white text-lg mb-1 group-hover:text-orange-400 transition-colors line-clamp-2">
                      {product.model_name}
                    </h3>
                    {product.subtitle && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-1">{product.subtitle}</p>
                    )}
                    
                    {/* Key specs */}
                    {product.specifications && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {Object.entries(product.specifications).slice(0, 4).map(([key, value]) => (
                          <span key={key} className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-lg">
                            {String(value).substring(0, 20)}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Features preview */}
                    {product.features && product.features.length > 0 && (
                      <div className="text-gray-500 text-xs mb-4 line-clamp-2">
                        {product.features.slice(0, 3).join(' • ')}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                      <span className="text-gray-500 text-sm">
                        {product.warranty || '5 Years'} Warranty
                      </span>
                      <div className="flex items-center gap-2 text-orange-400 group-hover:translate-x-1 transition-transform">
                        <span className="text-sm font-medium">View</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FooterLogo3D className="mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-500">
            <a href="tel:+919999036254" className="hover:text-orange-400">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in" className="hover:text-orange-400">service@musclegrid.in</a>
            <a href="https://www.musclegrid.in" className="hover:text-orange-400">www.musclegrid.in</a>
          </div>
        </div>
      </footer>
      
      {/* WhatsApp Button */}
      <WhatsAppButton />
    </div>
  );
}
