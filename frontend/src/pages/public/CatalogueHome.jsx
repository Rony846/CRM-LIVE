import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Zap, Battery, Activity, Sun, Settings, Package, 
  ArrowRight, Sparkles, ChevronRight, Phone, Mail, Globe
} from 'lucide-react';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

// Product categories with animations
const categories = [
  {
    id: 'inverter',
    name: 'Solar Inverters',
    subtitle: 'Hybrid & Off-Grid Solutions',
    icon: Zap,
    color: 'from-orange-500 to-amber-500',
    bgGlow: 'shadow-orange-500/30',
    description: 'Pure Sine Wave, MPPT, WiFi Monitoring',
    features: ['Up to 10kW', 'Dual MPPT', 'LiFePO4 Ready'],
    animationDelay: '0s'
  },
  {
    id: 'battery',
    name: 'LiFePO4 Batteries',
    subtitle: 'Long Life Energy Storage',
    icon: Battery,
    color: 'from-green-500 to-emerald-500',
    bgGlow: 'shadow-green-500/30',
    description: '6000+ Cycles, Smart BMS, Safe Chemistry',
    features: ['48V/51.2V', 'JK Smart BMS', '10 Year Life'],
    animationDelay: '0.1s'
  },
  {
    id: 'stabilizer',
    name: 'Voltage Stabilizers',
    subtitle: 'Mainline Protection',
    icon: Activity,
    color: 'from-blue-500 to-cyan-500',
    bgGlow: 'shadow-blue-500/30',
    description: 'Wide Range 50V-270V, Fast Correction',
    features: ['<10ms Response', 'Digital Display', 'Full Protection'],
    animationDelay: '0.2s'
  },
  {
    id: 'servo',
    name: 'Servo Stabilizers',
    subtitle: 'Industrial Grade',
    icon: Settings,
    color: 'from-purple-500 to-violet-500',
    bgGlow: 'shadow-purple-500/30',
    description: 'High Precision, Heavy Duty Applications',
    features: ['±1% Accuracy', 'Oil Cooled', 'Industrial Use'],
    animationDelay: '0.3s'
  },
  {
    id: 'solar',
    name: 'Solar Panels',
    subtitle: 'Mono PERC Bifacial',
    icon: Sun,
    color: 'from-yellow-500 to-orange-500',
    bgGlow: 'shadow-yellow-500/30',
    description: 'High Efficiency, 25 Year Warranty',
    features: ['540W+', 'Bifacial', 'Half-Cut Cells'],
    animationDelay: '0.4s'
  },
  {
    id: 'accessories',
    name: 'Accessories',
    subtitle: 'Complete Solutions',
    icon: Package,
    color: 'from-slate-500 to-gray-500',
    bgGlow: 'shadow-slate-500/30',
    description: 'Cables, Connectors, Mounting Kits',
    features: ['DC Cables', 'MC4 Connectors', 'Mounting'],
    animationDelay: '0.5s'
  }
];

export default function CatalogueHome() {
  const navigate = useNavigate();
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [datasheetCounts, setDatasheetCounts] = useState({});
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    // Fetch datasheet counts for each category
    fetchDatasheetCounts();
    
    // Animation phases
    const timer = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 3000);
    
    return () => clearInterval(timer);
  }, []);

  const fetchDatasheetCounts = async () => {
    try {
      const res = await axios.get(`${API}/api/product-datasheets/public`);
      const counts = {};
      (res.data.datasheets || []).forEach(ds => {
        counts[ds.category] = (counts[ds.category] || 0) + 1;
      });
      setDatasheetCounts(counts);
    } catch (err) {
      console.error('Error fetching counts:', err);
    }
  };

  const handleCategoryClick = (categoryId) => {
    navigate(`/catalogue/${categoryId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-orange-500/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`
            }}
          />
        ))}
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(251,146,60,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}></div>
        </div>
        
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo3D size="lg" />
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="tel:+919999036254" className="hover:text-orange-400 transition-colors flex items-center gap-2">
              <Phone className="w-4 h-4" /> +91 9999036254
            </a>
            <a href="https://www.musclegrid.in" className="hover:text-orange-400 transition-colors flex items-center gap-2">
              <Globe className="w-4 h-4" /> musclegrid.in
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-8 md:py-16 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Animated title */}
          <div className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full">
            <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
            <span className="text-orange-400 text-sm font-medium">Product Catalogue 2026</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            Power Your World with
            <span className="block bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              MuscleGrid
            </span>
          </h1>
          
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            Explore our complete range of solar inverters, lithium batteries, and power solutions. 
            Tap any category to view interactive product datasheets.
          </p>

          {/* Animated energy flow indicator */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="flex items-center gap-2">
              <Sun className="w-6 h-6 text-yellow-400 animate-spin-slow" />
              <div className="w-12 h-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
              </div>
              <Zap className="w-6 h-6 text-orange-400 animate-pulse" />
              <div className="w-12 h-1 bg-gradient-to-r from-orange-400 to-green-400 rounded-full overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" style={{ animationDelay: '0.5s' }}></div>
              </div>
              <Battery className="w-6 h-6 text-green-400 animate-bounce-slow" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="relative z-10 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const Icon = category.icon;
              const isHovered = hoveredCategory === category.id;
              const count = datasheetCounts[category.id] || 0;
              
              return (
                <div
                  key={category.id}
                  className={`group relative cursor-pointer transform transition-all duration-500 hover:scale-105 ${isHovered ? 'z-20' : 'z-10'}`}
                  style={{ animationDelay: category.animationDelay }}
                  onMouseEnter={() => setHoveredCategory(category.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  {/* Glow effect */}
                  <div className={`absolute -inset-2 bg-gradient-to-r ${category.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`}></div>
                  
                  {/* Card */}
                  <div className={`relative bg-gray-800/80 backdrop-blur border border-gray-700 rounded-2xl p-6 overflow-hidden transition-all duration-300 group-hover:border-transparent group-hover:shadow-2xl ${category.bgGlow}`}>
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
                      <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 50% 50%, currentColor 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                      }}></div>
                    </div>
                    
                    {/* Icon */}
                    <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                      
                      {/* Pulse ring */}
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${category.color} animate-ping opacity-20`}></div>
                    </div>
                    
                    {/* Content */}
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-white group-hover:to-gray-300 transition-all">
                      {category.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-3">{category.subtitle}</p>
                    <p className="text-gray-500 text-xs mb-4">{category.description}</p>
                    
                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {category.features.map((feature, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-full">
                          {feature}
                        </span>
                      ))}
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-700/50">
                      <span className="text-gray-500 text-sm">
                        {count > 0 ? `${count} Products` : 'Coming Soon'}
                      </span>
                      <div className="flex items-center gap-2 text-orange-400 group-hover:translate-x-2 transition-transform">
                        <span className="text-sm font-medium">Explore</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 border-t border-gray-800 mt-16">
        <div className="max-w-6xl mx-auto text-center">
          <FooterLogo3D className="mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium mb-2">Consistency Through You</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <a href="tel:+919999036254" className="hover:text-orange-400">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in" className="hover:text-orange-400">service@musclegrid.in</a>
            <a href="https://www.musclegrid.in" className="hover:text-orange-400">www.musclegrid.in</a>
          </div>
          <p className="text-gray-600 text-xs mt-6">© 2026 MuscleGrid Industries Pvt. Ltd. All rights reserved.</p>
        </div>
      </footer>
      
      {/* WhatsApp Button */}
      <WhatsAppButton />

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
