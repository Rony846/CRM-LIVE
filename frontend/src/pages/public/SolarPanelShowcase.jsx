import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Download, X, Sun, Zap, Shield, Gauge, 
  Award, ChevronDown, Loader2, ArrowLeft,
  Sparkles, Grid3X3, Maximize2, ThermometerSun, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import SolarPanelDatasheet from '@/components/datasheets/SolarPanelDatasheet';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SolarPanelShowcase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sunPosition, setSunPosition] = useState(50);
  const [powerOutput, setPowerOutput] = useState(0);
  const [isBifacialActive, setIsBifacialActive] = useState(false);
  const datasheetRef = useRef(null);

  useEffect(() => {
    fetchDatasheet();
    
    // Simulate sun movement and power generation
    const interval = setInterval(() => {
      setSunPosition(prev => {
        const newPos = prev + 2;
        return newPos > 100 ? 0 : newPos;
      });
    }, 150);
    
    return () => clearInterval(interval);
  }, [id]);

  // Calculate power based on sun position
  useEffect(() => {
    // Power output follows a curve based on sun position (peak at 50%)
    const distanceFromPeak = Math.abs(50 - sunPosition);
    const basePower = Math.max(0, 100 - distanceFromPeak * 2);
    const bifacialBonus = isBifacialActive ? 30 : 0;
    setPowerOutput(Math.min(100, basePower + bifacialBonus * (basePower / 100)));
  }, [sunPosition, isBifacialActive]);

  const fetchDatasheet = async () => {
    try {
      const res = await axios.get(`${API}/api/product-datasheets/${id}`);
      setDatasheet(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!datasheetRef.current) return;
    setDownloading(true);
    try {
      setShowDatasheet(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      const canvas = await html2canvas(datasheetRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const ratio = pdfWidth / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, canvas.height * ratio);
      pdf.save(`${datasheet.model_name.replace(/[^a-zA-Z0-9]/g, '_')}_Datasheet.pdf`);
    } catch (err) {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!datasheet) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Product not found</p>
      </div>
    );
  }

  const specs = datasheet.specifications || {};
  const images = datasheet.images || [datasheet.image_url].filter(Boolean);
  const wattage = specs.wattage || '540W';
  const efficiency = specs.efficiency || '21%';
  const isBifacial = specs.cell_type?.toLowerCase().includes('bifacial') || datasheet.model_name?.toLowerCase().includes('bifacial');

  const hotspots = {
    cells: {
      title: 'Half-Cut Cells',
      icon: Grid3X3,
      description: specs.cells || '144 Half-Cut Cells',
      details: 'Reduced internal resistance, better shade tolerance, higher efficiency',
      color: 'from-blue-500 to-cyan-500'
    },
    efficiency: {
      title: 'High Efficiency',
      icon: Sparkles,
      description: efficiency,
      details: `${specs.cell_type || 'Mono PERC'} technology for maximum power harvesting`,
      color: 'from-yellow-500 to-orange-500'
    },
    bifacial: {
      title: 'Bifacial Design',
      icon: Layers,
      description: specs.bifacial_gain || 'Up to 30% Gain',
      details: 'Captures reflected light from rear side for extra power generation',
      color: 'from-purple-500 to-pink-500'
    },
    dimensions: {
      title: 'Dimensions',
      icon: Maximize2,
      description: specs.dimensions || '2278 x 1134 x 35 mm',
      details: `Weight: ${specs.weight || '32'}kg, Frame: ${specs.frame || 'Anodized Aluminum'}`,
      color: 'from-gray-500 to-slate-500'
    },
    thermal: {
      title: 'Temperature',
      icon: ThermometerSun,
      description: specs.operating_temp || '-40°C to 85°C',
      details: 'Wide operating range with minimal power degradation',
      color: 'from-red-500 to-orange-500'
    },
    protection: {
      title: 'Protection',
      icon: Shield,
      description: 'Anti-PID Technology',
      details: `${specs.glass || '3.2mm Tempered Glass'}, Weather resistant, ${specs.max_system_voltage || '1500V DC'} rated`,
      color: 'from-green-500 to-emerald-500'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-yellow-900/10 to-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" />
          <Button onClick={handleDownloadPDF} disabled={downloading} className="bg-yellow-600 hover:bg-yellow-500 text-sm px-2 md:px-3">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">PDF</span></>}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-6 px-3">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">
              {isBifacial ? 'Bifacial Solar Panel' : 'Mono PERC Solar Panel'}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400 text-sm">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Solar Panel Diagram */}
          <div className="relative bg-gray-800/50 rounded-2xl p-4 md:p-8 border border-gray-700 overflow-hidden">
            
            {/* Animated Sky Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 via-orange-900/10 to-gray-800/50 pointer-events-none"></div>
            
            {/* Moving Sun */}
            <div 
              className="absolute top-4 transition-all duration-150 ease-linear"
              style={{ left: `${sunPosition}%`, transform: 'translateX(-50%)' }}
            >
              <div className="relative">
                <Sun className="w-10 h-10 text-yellow-400 animate-pulse" />
                {/* Sun rays */}
                <div className="absolute inset-0 animate-spin-slow">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute w-0.5 h-4 bg-gradient-to-t from-yellow-400 to-transparent"
                      style={{ 
                        left: '50%', 
                        top: '-8px',
                        transformOrigin: '50% 28px',
                        transform: `translateX(-50%) rotate(${i * 45}deg)`
                      }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 relative z-10 pt-12">
              
              {/* Solar Panel Visual */}
              <div 
                className="relative cursor-pointer group"
                onClick={() => setActiveHotspot(activeHotspot === 'panel' ? null : 'panel')}
              >
                {/* Panel Frame */}
                <div className="relative w-64 h-40 md:w-80 md:h-48 bg-gradient-to-br from-blue-900 to-blue-950 rounded-lg border-4 border-gray-500 shadow-2xl overflow-hidden">
                  
                  {/* Cell Grid (144 half-cut cells = 12x12 grid) */}
                  <div className="absolute inset-2 grid grid-cols-12 grid-rows-6 gap-0.5">
                    {[...Array(72)].map((_, i) => (
                      <div 
                        key={i} 
                        className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-sm relative overflow-hidden"
                        style={{ animationDelay: `${i * 20}ms` }}
                      >
                        {/* Cell reflection based on sun position */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-opacity duration-150"
                          style={{ 
                            opacity: Math.abs(50 - sunPosition) < 30 ? 0.5 - Math.abs(50 - sunPosition) / 60 : 0,
                            transform: `translateX(${(sunPosition - 50) * 2}%)`
                          }}
                        ></div>
                        {/* Bus bars */}
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-400/50"></div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Power output indicator */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 rounded-t-lg border border-gray-600 border-b-0">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${powerOutput > 50 ? 'text-yellow-400' : 'text-gray-500'}`} />
                      <span className={`text-sm font-mono ${powerOutput > 50 ? 'text-green-400' : 'text-gray-400'}`}>
                        {Math.round(powerOutput * parseInt(wattage) / 100)}W
                      </span>
                    </div>
                  </div>
                  
                  {/* Corner mounts */}
                  <div className="absolute top-1 left-1 w-3 h-3 bg-gray-500 rounded-full"></div>
                  <div className="absolute top-1 right-1 w-3 h-3 bg-gray-500 rounded-full"></div>
                  <div className="absolute bottom-1 left-1 w-3 h-3 bg-gray-500 rounded-full"></div>
                  <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-500 rounded-full"></div>
                </div>

                {/* Bifacial rear reflection (when enabled) */}
                {isBifacial && (
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-56 md:w-72 h-4 flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBifacialActive(!isBifacialActive);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        isBifacialActive 
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' 
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {isBifacialActive ? '✓ Bifacial Active (+30%)' : 'Enable Bifacial Mode'}
                    </button>
                  </div>
                )}
                
                {/* Reflected light animation (bifacial) */}
                {isBifacialActive && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-48 md:w-64">
                    <div className="h-2 bg-gradient-to-t from-purple-500/50 to-transparent rounded animate-pulse"></div>
                    <div className="flex justify-around mt-1">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className="w-1 h-3 bg-gradient-to-t from-purple-400 to-transparent rounded animate-bounce"
                          style={{ animationDelay: `${i * 100}ms` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Power Generation Bar */}
              <div className="w-full max-w-md">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Power Output</span>
                  <span className={powerOutput > 70 ? 'text-green-400' : powerOutput > 30 ? 'text-yellow-400' : 'text-gray-500'}>
                    {Math.round(powerOutput)}%
                  </span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      powerOutput > 70 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                      powerOutput > 30 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                      'bg-gradient-to-r from-gray-500 to-gray-400'
                    }`}
                    style={{ width: `${powerOutput}%` }}
                  >
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  </div>
                </div>
              </div>

              {/* Hotspot Buttons */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 w-full max-w-2xl mt-4">
                {Object.entries(hotspots).map(([key, hotspot]) => {
                  const Icon = hotspot.icon;
                  const isActive = activeHotspot === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveHotspot(isActive ? null : key)}
                      className={`flex flex-col items-center p-3 rounded-xl transition-all duration-300 ${
                        isActive ? `bg-gradient-to-br ${hotspot.color} shadow-lg` : 'bg-gray-700/50 hover:bg-gray-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span className={`text-[9px] mt-1 ${isActive ? 'text-white' : 'text-gray-500'}`}>{hotspot.title.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-gray-500 text-xs animate-pulse">
                {isBifacial ? 'Toggle bifacial mode to see +30% power gain!' : 'Watch the sun move across the panel'}
              </p>
            </div>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Zap, label: 'Wattage', value: wattage },
              { icon: Sparkles, label: 'Efficiency', value: efficiency },
              { icon: Grid3X3, label: 'Cells', value: specs.cells || '144' },
              { icon: Award, label: 'Warranty', value: datasheet.warranty || '25 Years' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
                <item.icon className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <p className="text-gray-400 text-[10px]">{item.label}</p>
                <p className="text-white font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* View Specs */}
      <div className="text-center py-6">
        <button onClick={() => setShowDatasheet(!showDatasheet)} className="inline-flex items-center gap-2 text-yellow-400 hover:text-yellow-300 text-sm">
          <span>View Full Specifications</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Datasheet - Proper component with consistent styling */}
      <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="pb-16 px-2">
          <div className="overflow-x-auto">
            <div ref={datasheetRef} className="bg-white shadow-2xl mx-auto" style={{ minWidth: '380px', maxWidth: '794px', width: '100%' }}>
              <SolarPanelDatasheet data={datasheet} />
            </div>
          </div>
        </div>
      </section>

      {/* Popup Modal */}
      {activeHotspot && activeHotspot !== 'panel' && hotspots[activeHotspot] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60" onClick={() => setActiveHotspot(null)}>
          <div className="bg-gray-900 border border-gray-600 rounded-2xl p-5 w-full max-w-[300px] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveHotspot(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${hotspots[activeHotspot].color} flex items-center justify-center mb-4`}>
              {React.createElement(hotspots[activeHotspot].icon, { className: 'w-7 h-7 text-white' })}
            </div>
            <h4 className="text-white font-bold text-xl mb-2">{hotspots[activeHotspot].title}</h4>
            <p className="text-yellow-400 font-semibold">{hotspots[activeHotspot].description}</p>
            <p className="text-gray-400 text-sm mt-2">{hotspots[activeHotspot].details}</p>
            <button onClick={() => setActiveHotspot(null)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">Got it</button>
          </div>
        </div>
      )}
      
      {/* Device Image Modal */}
      {activeHotspot === 'panel' && images.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setActiveHotspot(null)}>
          <div className="relative bg-gray-900 rounded-2xl p-4 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveHotspot(null)} className="absolute top-2 right-2 p-2 bg-gray-800 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
            <img src={images[currentImageIndex]} alt="Product" className="w-full h-64 object-contain rounded-lg mb-4" />
            {images.length > 1 && (
              <div className="flex justify-center gap-2">
                {images.map((_, i) => (
                  <button key={i} onClick={() => setCurrentImageIndex(i)}
                    className={`w-3 h-3 rounded-full ${i === currentImageIndex ? 'bg-yellow-500' : 'bg-gray-600'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FooterLogo3D className="mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-500">
            <a href="tel:+919999036254">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in">service@musclegrid.in</a>
          </div>
        </div>
      </footer>
      
      {/* WhatsApp Button */}
      <WhatsAppButton />

      {/* CSS Animations */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
        .animate-shimmer {
          animation: shimmer 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
