import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Download, X, Settings, Zap, Shield, Gauge, 
  Clock, Award, ChevronDown, Loader2, ArrowLeft,
  RotateCw, Target, Thermometer, Power, Factory
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StabilizerDatasheet from '@/components/datasheets/StabilizerDatasheet';

const API = process.env.REACT_APP_BACKEND_URL;
const MUSCLEGRID_LOGO = 'https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/avndw84w_Corrected%20proprotions%20CDR%20MOD.png';

export default function ServoShowcase() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [servoAngle, setServoAngle] = useState(0);
  const [inputVoltage, setInputVoltage] = useState(380);
  const [outputVoltage, setOutputVoltage] = useState(400);
  const [motorActive, setMotorActive] = useState(false);
  const datasheetRef = useRef(null);

  useEffect(() => {
    fetchDatasheet();
    
    // Simulate servo motor voltage correction
    const interval = setInterval(() => {
      // Generate random input voltage fluctuation
      const newInput = 300 + Math.floor(Math.random() * 160); // 300V - 460V range
      const deviation = newInput - 400; // Deviation from ideal
      
      setInputVoltage(newInput);
      
      // Servo motor rotates to compensate
      if (Math.abs(deviation) > 5) {
        setMotorActive(true);
        setServoAngle(prev => prev + (deviation > 0 ? -5 : 5)); // Rotate to compensate
      } else {
        setMotorActive(false);
      }
      
      // Output always stays at 400V ±1%
      const outputVariation = Math.floor(Math.random() * 8) - 4;
      setOutputVoltage(400 + outputVariation);
    }, 1200);
    
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
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
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
    motor: {
      title: 'Servo Motor',
      icon: Settings,
      description: 'Precision Motor Control',
      details: 'Motorized variable transformer for ultra-precise ±1% voltage regulation',
      color: 'from-purple-500 to-violet-500'
    },
    accuracy: {
      title: 'High Accuracy',
      icon: Target,
      description: specs.regulation_accuracy || '±1%',
      details: 'Industrial-grade precision for CNC machines & medical equipment',
      color: 'from-green-500 to-emerald-500'
    },
    capacity: {
      title: 'Capacity',
      icon: Gauge,
      description: `${specs.capacity_kva || '10'}KVA`,
      details: `Three Phase: ${specs.phase || 'Three Phase'}, Efficiency: ${specs.efficiency || '>98%'}`,
      color: 'from-blue-500 to-cyan-500'
    },
    cooling: {
      title: 'Oil Cooled',
      icon: Thermometer,
      description: specs.cooling || 'Oil Cooled',
      details: 'Heavy duty cooling for continuous industrial operation',
      color: 'from-orange-500 to-amber-500'
    },
    input: {
      title: 'Input Range',
      icon: Zap,
      description: specs.input_range || '300V - 460V',
      details: 'Wide input range for industrial power supply variations',
      color: 'from-yellow-500 to-orange-500'
    },
    protection: {
      title: 'Protection',
      icon: Shield,
      description: 'Overload & Short Circuit',
      details: 'Digital metering with auto-cutoff protection',
      color: 'from-red-500 to-pink-500'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center justify-between relative">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline">Catalogue</span>
          </button>
          <img src={MUSCLEGRID_LOGO} alt="MuscleGrid" className="h-8 md:h-10 object-contain absolute left-1/2 -translate-x-1/2" />
          <Button onClick={handleDownloadPDF} disabled={downloading} className="bg-purple-600 hover:bg-purple-500 text-sm px-3 z-10">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-1" /> PDF</>}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-6 px-3">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Factory className="w-4 h-4 text-purple-400" />
              <p className="text-purple-400 text-xs font-semibold uppercase tracking-wider">Industrial Grade</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400 text-sm">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Servo Diagram */}
          <div className="relative bg-gray-800/50 rounded-2xl p-4 md:p-8 border border-gray-700">
            <div className="flex flex-col items-center gap-6">
              
              {/* Three-Phase Servo Visualization */}
              <div className="flex items-center justify-center gap-4 md:gap-8 w-full max-w-2xl">
                
                {/* Input Voltage Display */}
                <div className="flex flex-col items-center">
                  <p className="text-gray-400 text-xs mb-2">3Φ INPUT</p>
                  <div className="relative w-20 h-32 md:w-24 md:h-40 bg-gray-700/50 rounded-lg border border-yellow-600/50 flex flex-col items-center justify-center">
                    <div className="flex gap-1 mb-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-2xl font-bold text-yellow-400">{inputVoltage}V</span>
                    <span className="text-xs text-gray-500 mt-1">R-Y-B</span>
                  </div>
                </div>

                {/* Flow Arrow */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 md:w-12 h-1 bg-gradient-to-r from-yellow-500 to-purple-500 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-flow-right"></div>
                  </div>
                  <Zap className="w-4 h-4 text-yellow-400" />
                </div>

                {/* Servo Motor Unit */}
                <div 
                  className="relative cursor-pointer"
                  onClick={() => setActiveHotspot(activeHotspot === 'device' ? null : 'device')}
                >
                  <div className="relative w-32 h-40 md:w-40 md:h-48 bg-gradient-to-b from-gray-700 to-gray-800 rounded-xl border-2 border-purple-500/50 hover:border-purple-500 transition-all overflow-hidden">
                    
                    {/* Top Panel - Digital Display */}
                    <div className="absolute top-2 left-2 right-2 h-10 bg-gray-900 rounded flex items-center justify-center border border-gray-600">
                      <div className="text-green-400 font-mono text-sm">
                        <span>OUT: </span>
                        <span className="text-lg">{outputVoltage}V</span>
                      </div>
                    </div>
                    
                    {/* Servo Motor Animation */}
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20">
                      <div className="relative w-full h-full">
                        {/* Motor housing */}
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-600 to-gray-700 rounded-full border-4 border-gray-500">
                          {/* Rotating shaft indicator */}
                          <div 
                            className={`absolute inset-2 bg-gradient-to-tr from-purple-600 to-purple-400 rounded-full transition-transform duration-500 ${motorActive ? 'animate-spin-slow' : ''}`}
                            style={{ transform: `rotate(${servoAngle}deg)` }}
                          >
                            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>
                        {/* Motor status LED */}
                        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${motorActive ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                      </div>
                    </div>
                    
                    {/* Label */}
                    <div className="absolute bottom-2 inset-x-2 text-center">
                      <p className="text-purple-400 text-xs font-semibold">SERVO</p>
                      <p className="text-gray-500 text-[10px]">{motorActive ? 'CORRECTING...' : 'STABLE'}</p>
                    </div>
                    
                    {/* Active glow */}
                    {motorActive && (
                      <div className="absolute -inset-1 bg-purple-500/20 rounded-xl animate-pulse"></div>
                    )}
                  </div>
                  
                  {/* Oil tank indicator */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-16 bg-gradient-to-b from-amber-700 to-amber-900 rounded-r-lg border border-amber-600/50">
                    <div className="absolute bottom-1 inset-x-1 h-3/4 bg-amber-500/50 rounded"></div>
                    <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-amber-400">OIL</p>
                  </div>
                </div>

                {/* Flow Arrow */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 md:w-12 h-1 bg-gradient-to-r from-purple-500 to-green-500 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-flow-right"></div>
                  </div>
                  <Power className="w-4 h-4 text-green-400" />
                </div>

                {/* Output Voltage Display */}
                <div className="flex flex-col items-center">
                  <p className="text-gray-400 text-xs mb-2">3Φ OUTPUT</p>
                  <div className="relative w-20 h-32 md:w-24 md:h-40 bg-gray-700/50 rounded-lg border border-green-600/50 flex flex-col items-center justify-center">
                    <div className="flex gap-1 mb-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                    <span className="text-2xl font-bold text-green-400">{outputVoltage}V</span>
                    <span className="text-xs text-green-500 mt-1">±1%</span>
                    <Target className="w-4 h-4 text-green-400 mt-2" />
                  </div>
                </div>
              </div>

              {/* Accuracy Indicator */}
              <div className="flex items-center gap-4 px-4 py-2 bg-purple-900/30 rounded-lg border border-purple-500/30">
                <RotateCw className={`w-5 h-5 text-purple-400 ${motorActive ? 'animate-spin' : ''}`} />
                <div className="text-sm">
                  <span className="text-gray-400">Accuracy: </span>
                  <span className="text-purple-400 font-bold">±1%</span>
                  <span className="text-gray-500 ml-2">| Response: {specs.correction_time || '<20ms'}</span>
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

              <p className="text-gray-500 text-xs animate-pulse">Watch the servo motor auto-correct voltage!</p>
            </div>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Gauge, label: 'Capacity', value: `${specs.capacity_kva || '10'}KVA` },
              { icon: Target, label: 'Accuracy', value: specs.regulation_accuracy || '±1%' },
              { icon: Thermometer, label: 'Cooling', value: specs.cooling || 'Oil Cooled' },
              { icon: Award, label: 'Warranty', value: datasheet.warranty || '2 Years' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
                <item.icon className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <p className="text-gray-400 text-[10px]">{item.label}</p>
                <p className="text-white font-bold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* View Specs */}
      <div className="text-center py-6">
        <button onClick={() => setShowDatasheet(!showDatasheet)} className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm">
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
            <p className="text-purple-400 font-semibold">{hotspots[activeHotspot].description}</p>
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
                    className={`w-3 h-3 rounded-full ${i === currentImageIndex ? 'bg-purple-500' : 'bg-gray-600'}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-gray-500">
            <a href="tel:+919999036254">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in">service@musclegrid.in</a>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes flow-right {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-flow-right {
          animation: flow-right 0.8s linear infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
