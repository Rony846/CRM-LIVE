import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Download, X, Activity, Zap, Shield, Gauge, 
  Clock, Award, ChevronDown, Loader2, ArrowLeft,
  AlertTriangle, CheckCircle, Power, Tv
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StabilizerDatasheet from '@/components/datasheets/StabilizerDatasheet';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

export default function StabilizerShowcase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [inputVoltage, setInputVoltage] = useState(180);
  const [isSpike, setIsSpike] = useState(false);
  const [outputVoltage, setOutputVoltage] = useState(220);
  const datasheetRef = useRef(null);

  useEffect(() => {
    fetchDatasheet();
    
    // Simulate voltage fluctuation and correction
    const interval = setInterval(() => {
      // Generate random input voltage (fluctuating)
      const randomInput = Math.random();
      let newInputVoltage;
      
      if (randomInput < 0.3) {
        // Low voltage spike
        newInputVoltage = 90 + Math.floor(Math.random() * 50);
        setIsSpike(true);
      } else if (randomInput > 0.85) {
        // High voltage spike
        newInputVoltage = 260 + Math.floor(Math.random() * 20);
        setIsSpike(true);
      } else {
        // Normal fluctuation
        newInputVoltage = 180 + Math.floor(Math.random() * 60);
        setIsSpike(false);
      }
      
      setInputVoltage(newInputVoltage);
      
      // Output is always stable around 220V ±3%
      const outputVariation = Math.floor(Math.random() * 6) - 3;
      setOutputVoltage(220 + outputVariation);
    }, 800);
    
    return () => clearInterval(interval);
  }, [id]);

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
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
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

  const hotspots = {
    input: {
      title: 'Wide Input Range',
      icon: Zap,
      description: specs.input_range || '50V - 270V',
      details: 'Handles extreme voltage fluctuations common in Indian power grids',
      color: 'from-yellow-500 to-orange-500'
    },
    output: {
      title: 'Stable Output',
      icon: CheckCircle,
      description: specs.output_voltage || '220V ±3%',
      details: 'Consistent power for sensitive electronics',
      color: 'from-green-500 to-emerald-500'
    },
    correction: {
      title: 'Fast Correction',
      icon: Clock,
      description: specs.correction_time || '<10ms',
      details: 'Ultra-fast response prevents equipment damage',
      color: 'from-blue-500 to-cyan-500'
    },
    protection: {
      title: 'All-Round Protection',
      icon: Shield,
      description: 'Overload + Short Circuit',
      details: 'Over-voltage cutoff at 300V, Under-voltage cutoff at 50V',
      color: 'from-red-500 to-pink-500'
    },
    capacity: {
      title: 'Capacity',
      icon: Gauge,
      description: `${specs.capacity_kva || '10'}KVA`,
      details: `Efficiency: ${specs.efficiency || '>96%'}`,
      color: 'from-purple-500 to-violet-500'
    },
    display: {
      title: 'Digital Display',
      icon: Tv,
      description: specs.display || 'Digital LED',
      details: 'Real-time input/output voltage monitoring',
      color: 'from-indigo-500 to-blue-500'
    }
  };

  // Calculate bar heights for visualization
  const inputBarHeight = Math.min(Math.max((inputVoltage / 300) * 100, 10), 100);
  const outputBarHeight = (outputVoltage / 250) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-blue-900/20 to-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center justify-between relative">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" className="absolute left-1/2 -translate-x-1/2" />
          <Button onClick={handleDownloadPDF} disabled={downloading} className="bg-blue-600 hover:bg-blue-500 text-sm px-3 z-10">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> PDF</>}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-6 px-3">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">Voltage Stabilizer</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400 text-sm">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Voltage Diagram */}
          <div className="relative bg-gray-800/50 rounded-2xl p-4 md:p-8 border border-gray-700">
            <div className="flex flex-col items-center gap-6">
              
              {/* Voltage Flow Visualization */}
              <div className="flex items-end justify-center gap-4 md:gap-8 w-full max-w-xl">
                
                {/* Input Side */}
                <div className="flex flex-col items-center flex-1">
                  <p className="text-gray-400 text-xs mb-2">GRID INPUT</p>
                  <div className="relative w-full h-48 bg-gray-700/50 rounded-lg overflow-hidden border border-gray-600">
                    {/* Fluctuating bar */}
                    <div 
                      className={`absolute bottom-0 w-full transition-all duration-300 ${
                        isSpike ? 'bg-gradient-to-t from-red-600 to-yellow-500' : 'bg-gradient-to-t from-yellow-600 to-yellow-400'
                      }`}
                      style={{ height: `${inputBarHeight}%` }}
                    >
                      {isSpike && (
                        <div className="absolute inset-0 animate-pulse bg-red-500/30"></div>
                      )}
                    </div>
                    {/* Voltage reading */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`text-center ${isSpike ? 'animate-pulse' : ''}`}>
                        <span className={`text-3xl font-bold ${isSpike ? 'text-red-400' : 'text-yellow-400'}`}>{inputVoltage}V</span>
                        {isSpike && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 text-xs">SPIKE!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Zap className={`w-4 h-4 ${isSpike ? 'text-red-400' : 'text-yellow-400'}`} />
                    <span className={`text-xs ${isSpike ? 'text-red-400' : 'text-gray-400'}`}>Unstable</span>
                  </div>
                </div>

                {/* Stabilizer Unit */}
                <div className="flex flex-col items-center">
                  <div 
                    className="relative w-20 h-28 md:w-28 md:h-36 bg-gradient-to-b from-gray-700 to-gray-800 rounded-xl border-2 border-blue-500/50 cursor-pointer hover:border-blue-500 transition-all group"
                    onClick={() => setActiveHotspot(activeHotspot === 'device' ? null : 'device')}
                  >
                    {/* LED Display */}
                    <div className="absolute top-2 left-2 right-2 h-8 bg-gray-900 rounded flex items-center justify-center border border-gray-600">
                      <span className="text-green-400 font-mono text-sm">{outputVoltage}V</span>
                    </div>
                    
                    {/* MuscleGrid Logo */}
                    <div className="absolute inset-x-2 top-12 bottom-8 flex items-center justify-center">
                      <Activity className="w-8 h-8 text-blue-400" />
                    </div>
                    
                    {/* Status LED */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <div className={`w-2 h-2 rounded-full ${isSpike ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    </div>
                    
                    {/* Active processing indicator */}
                    <div className="absolute -inset-1 border-2 border-blue-500/30 rounded-xl animate-ping opacity-20"></div>
                  </div>
                  <p className="text-blue-400 text-xs mt-2 font-semibold">STABILIZER</p>
                </div>

                {/* Output Side */}
                <div className="flex flex-col items-center flex-1">
                  <p className="text-gray-400 text-xs mb-2">STABLE OUTPUT</p>
                  <div className="relative w-full h-48 bg-gray-700/50 rounded-lg overflow-hidden border border-green-600/50">
                    {/* Stable bar */}
                    <div 
                      className="absolute bottom-0 w-full bg-gradient-to-t from-green-600 to-green-400 transition-all duration-300"
                      style={{ height: `${outputBarHeight}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent"></div>
                    </div>
                    {/* Voltage reading */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-3xl font-bold text-green-400">{outputVoltage}V</span>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-xs">STABLE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Power className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Protected</span>
                  </div>
                </div>
              </div>

              {/* Flow arrows */}
              <div className="flex items-center justify-center gap-2 w-full max-w-xl">
                <div className={`flex-1 h-2 rounded-full overflow-hidden ${isSpike ? 'bg-red-900/50' : 'bg-yellow-900/50'}`}>
                  <div className={`h-full animate-flow-right ${isSpike ? 'bg-gradient-to-r from-red-500 via-yellow-500 to-transparent' : 'bg-gradient-to-r from-yellow-500 via-yellow-300 to-transparent'}`}></div>
                </div>
                <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
                <div className="flex-1 h-2 bg-green-900/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 via-green-300 to-transparent animate-flow-right"></div>
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

              <p className="text-gray-500 text-xs animate-pulse">Watch the voltage correction in real-time!</p>
            </div>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Gauge, label: 'Capacity', value: `${specs.capacity_kva || '10'}KVA` },
              { icon: Zap, label: 'Input Range', value: specs.input_range || '50V-270V' },
              { icon: Clock, label: 'Response', value: specs.correction_time || '<10ms' },
              { icon: Award, label: 'Warranty', value: datasheet.warranty || '2 Years' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
                <item.icon className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <p className="text-gray-400 text-[10px]">{item.label}</p>
                <p className="text-white font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* View Specs */}
      <div className="text-center py-6">
        <button onClick={() => setShowDatasheet(!showDatasheet)} className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
          <span>View Full Specifications</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Datasheet */}
      <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="pb-16 px-2">
          <div className="overflow-x-auto">
            <div ref={datasheetRef} className="bg-white shadow-2xl mx-auto" style={{ minWidth: '380px', maxWidth: '794px', width: '100%' }}>
              <StabilizerDatasheet data={datasheet} />
            </div>
          </div>
        </div>
      </section>

      {/* Popup Modal */}
      {activeHotspot && activeHotspot !== 'device' && hotspots[activeHotspot] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60" onClick={() => setActiveHotspot(null)}>
          <div className="bg-gray-900 border border-gray-600 rounded-2xl p-5 w-full max-w-[300px] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveHotspot(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${hotspots[activeHotspot].color} flex items-center justify-center mb-4`}>
              {React.createElement(hotspots[activeHotspot].icon, { className: 'w-7 h-7 text-white' })}
            </div>
            <h4 className="text-white font-bold text-xl mb-2">{hotspots[activeHotspot].title}</h4>
            <p className="text-blue-400 font-semibold">{hotspots[activeHotspot].description}</p>
            <p className="text-gray-400 text-sm mt-2">{hotspots[activeHotspot].details}</p>
            <button onClick={() => setActiveHotspot(null)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">Got it</button>
          </div>
        </div>
      )}
      
      {/* Device Image Modal */}
      {activeHotspot === 'device' && images.length > 0 && (
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
                    className={`w-3 h-3 rounded-full ${i === currentImageIndex ? 'bg-blue-500' : 'bg-gray-600'}`} />
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
        @keyframes flow-right {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-flow-right {
          animation: flow-right 0.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
