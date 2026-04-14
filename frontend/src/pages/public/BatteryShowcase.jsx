import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Download, X, Battery, Cpu, Zap, Thermometer, Shield, 
  Wifi, Award, ChevronDown, Loader2, ArrowLeft, Smartphone,
  Activity, Clock, Gauge, Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BatteryDatasheet from '@/components/datasheets/BatteryDatasheet';
import { Logo3D, WhatsAppButton, FooterLogo3D } from '@/components/public/SharedComponents';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BatteryShowcase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(75);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const datasheetRef = useRef(null);

  useEffect(() => {
    fetchDatasheet();
    // Animate charge level
    const interval = setInterval(() => {
      setChargeLevel(prev => {
        if (prev >= 95) return 60;
        return prev + 1;
      });
    }, 100);
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
        <Loader2 className="w-12 h-12 text-green-500 animate-spin" />
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
    bms: {
      title: 'Smart BMS',
      icon: Cpu,
      description: specs.bms_type || 'JK Smart BMS',
      details: 'Active balancing, Bluetooth monitoring, Over-charge/discharge protection',
      color: 'from-blue-500 to-cyan-500'
    },
    cells: {
      title: 'LiFePO4 Cells',
      icon: Battery,
      description: specs.cell_grade || 'A+ Grade Cells',
      details: `${specs.cycle_life || '6000+'} cycle life, Thermal stability, No thermal runaway`,
      color: 'from-green-500 to-emerald-500'
    },
    voltage: {
      title: 'Voltage System',
      icon: Zap,
      description: `${specs.voltage || '48'}V Nominal`,
      details: `Compatible with ${specs.voltage || '48'}V inverters, Auto-balancing`,
      color: 'from-yellow-500 to-amber-500'
    },
    capacity: {
      title: 'Capacity',
      icon: Gauge,
      description: `${specs.capacity_ah || '120'}Ah / ${specs.energy_wh || '5760'}Wh`,
      details: 'Deep discharge capable, Consistent power delivery',
      color: 'from-purple-500 to-pink-500'
    },
    thermal: {
      title: 'Thermal Management',
      icon: Thermometer,
      description: specs.operating_temp || '-10°C to 55°C',
      details: 'Built-in temperature sensors, Auto-shutdown protection',
      color: 'from-red-500 to-orange-500'
    },
    communication: {
      title: 'Communication',
      icon: Wifi,
      description: specs.communication || 'RS485 / Bluetooth',
      details: 'Real-time monitoring via app, SOC/SOH display',
      color: 'from-indigo-500 to-purple-500'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-emerald-900/20 to-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between relative">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" className="absolute left-1/2 -translate-x-1/2" />
          <Button onClick={handleDownloadPDF} disabled={downloading} className="bg-green-600 hover:bg-green-500 text-sm px-2 md:px-3 z-10">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 md:mr-1" /><span className="hidden md:inline">PDF</span></>}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-6 px-3">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">LiFePO4 Battery</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400 text-sm">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Battery Diagram */}
          <div className="relative bg-gray-800/50 rounded-2xl p-4 md:p-8 border border-gray-700">
            <div className="flex flex-col items-center gap-6">
              
              {/* Battery Visual */}
              <div className="relative">
                {/* Battery Body */}
                <div 
                  className="relative w-48 h-72 md:w-64 md:h-96 bg-gradient-to-b from-gray-700 to-gray-800 rounded-2xl border-4 border-gray-600 cursor-pointer overflow-hidden"
                  onClick={() => setActiveHotspot(activeHotspot === 'battery' ? null : 'battery')}
                >
                  {/* Terminal */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-gray-600 rounded-t-lg flex justify-center gap-4 pt-1">
                    <div className="w-4 h-4 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">+</div>
                    <div className="w-4 h-4 bg-gray-900 rounded-full text-[8px] text-white flex items-center justify-center font-bold">-</div>
                  </div>
                  
                  {/* Charge Level Indicator */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 transition-all duration-300"
                    style={{ height: `${chargeLevel}%` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent animate-pulse"></div>
                  </div>
                  
                  {/* Cell Grid Pattern */}
                  <div className="absolute inset-4 grid grid-cols-4 gap-1 opacity-30">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className="bg-green-500 rounded-sm"></div>
                    ))}
                  </div>
                  
                  {/* Percentage */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">{chargeLevel}%</span>
                  </div>
                  
                  {/* Status LED */}
                  <div className="absolute top-4 right-4 w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
                </div>

                {/* Image Popup when clicking battery */}
                {activeHotspot === 'battery' && images.length > 0 && (
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
                              className={`w-3 h-3 rounded-full ${i === currentImageIndex ? 'bg-green-500' : 'bg-gray-600'}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Hotspot Buttons */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 w-full max-w-2xl">
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

              <p className="text-gray-500 text-xs animate-pulse">Tap on battery or icons to learn more</p>
            </div>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Battery, label: 'Capacity', value: `${specs.capacity_ah || '120'}Ah` },
              { icon: Zap, label: 'Voltage', value: `${specs.voltage || '48'}V` },
              { icon: Clock, label: 'Cycle Life', value: specs.cycle_life || '6000+' },
              { icon: Award, label: 'Warranty', value: datasheet.warranty || '5 Years' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
                <item.icon className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-gray-400 text-[10px]">{item.label}</p>
                <p className="text-white font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* View Specs */}
      <div className="text-center py-6">
        <button onClick={() => setShowDatasheet(!showDatasheet)} className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm">
          <span>View Full Specifications</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Datasheet */}
      <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="pb-16 px-2">
          <div className="overflow-x-auto">
            <div ref={datasheetRef} className="bg-white shadow-2xl mx-auto" style={{ minWidth: '380px', maxWidth: '794px', width: '100%' }}>
              <BatteryDatasheet data={datasheet} />
            </div>
          </div>
        </div>
      </section>

      {/* Popup Modal */}
      {activeHotspot && activeHotspot !== 'battery' && hotspots[activeHotspot] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60" onClick={() => setActiveHotspot(null)}>
          <div className="bg-gray-900 border border-gray-600 rounded-2xl p-5 w-full max-w-[300px] relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveHotspot(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${hotspots[activeHotspot].color} flex items-center justify-center mb-4`}>
              {React.createElement(hotspots[activeHotspot].icon, { className: 'w-7 h-7 text-white' })}
            </div>
            <h4 className="text-white font-bold text-xl mb-2">{hotspots[activeHotspot].title}</h4>
            <p className="text-green-400 font-semibold">{hotspots[activeHotspot].description}</p>
            <p className="text-gray-400 text-sm mt-2">{hotspots[activeHotspot].details}</p>
            <button onClick={() => setActiveHotspot(null)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm">Got it</button>
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
    </div>
  );
}
