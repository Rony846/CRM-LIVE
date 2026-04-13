import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Download, X, Sun, Battery, Zap, Home, Wifi, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReactToPrint } from 'react-to-print';

// Import datasheet templates
import InverterDatasheet from '@/components/datasheets/InverterDatasheet';
import BatteryDatasheet from '@/components/datasheets/BatteryDatasheet';
import StabilizerDatasheet from '@/components/datasheets/StabilizerDatasheet';

const API = process.env.REACT_APP_BACKEND_URL;

// MuscleGrid Logo
const MUSCLEGRID_LOGO = 'https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/avndw84w_Corrected%20proprotions%20CDR%20MOD.png';

export default function PublicDatasheetView() {
  const { id } = useParams();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const datasheetRef = useRef(null);

  useEffect(() => {
    fetchDatasheet();
  }, [id]);

  const fetchDatasheet = async () => {
    try {
      const res = await axios.get(`${API}/api/product-datasheets/${id}`);
      setDatasheet(res.data);
    } catch (err) {
      setError('Datasheet not found');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: datasheetRef,
    documentTitle: datasheet ? `${datasheet.model_name}_Datasheet` : 'Product_Datasheet',
    pageStyle: `
      @page { size: A4; margin: 0; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !datasheet) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error || 'Product not found'}</p>
          <a href="https://www.musclegrid.in" className="text-orange-400 hover:underline">
            Visit MuscleGrid Website →
          </a>
        </div>
      </div>
    );
  }

  const specs = datasheet.specifications || {};
  
  // Dynamic spec values from datasheet
  const pvPower = specs.max_pv_input || specs.max_pv_power || '9000W';
  const batteryVoltage = specs.battery_voltage || '48';
  const ratedCapacity = specs.rated_capacity_kw || specs.capacity_kw || '6.2';
  const surgeCapacity = specs.surge_power_kva || '13';
  const efficiency = specs.max_efficiency || specs.efficiency || '94%';
  const monitoring = specs.monitoring || 'WiFi Built-in';

  // Hotspot information - dynamic based on specs
  const hotspots = {
    solar: {
      title: 'Solar Input',
      description: `Supports up to ${pvPower} of solar panels`,
      details: specs.solar_charger_type ? `${specs.solar_charger_type} technology` : 'Dual MPPT tracking',
      icon: Sun,
      color: 'from-yellow-400 to-orange-500'
    },
    battery: {
      title: 'Battery System',
      description: `Compatible with ${batteryVoltage}V LiFePO4 batteries`,
      details: 'Supports up to 400Ah capacity',
      icon: Battery,
      color: 'from-green-400 to-emerald-500'
    },
    grid: {
      title: 'Grid Connection',
      description: 'Works as On-Grid + Off-Grid',
      details: 'Seamless switchover in <10ms',
      icon: Zap,
      color: 'from-blue-400 to-cyan-500'
    },
    load: {
      title: 'Output Power',
      description: `${ratedCapacity}kW continuous load`,
      details: `${surgeCapacity}kVA surge capacity`,
      icon: Home,
      color: 'from-purple-400 to-pink-500'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={MUSCLEGRID_LOGO} alt="MuscleGrid" className="h-10 object-contain" />
          <Button onClick={handlePrint} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </header>

      {/* Hero Section with Animation */}
      <section className="relative py-8 px-4 overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(251,146,60,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-5xl mx-auto relative">
          {/* Product Title */}
          <div className="text-center mb-8">
            <p className="text-orange-400 text-sm font-semibold uppercase tracking-wider mb-2">
              {datasheet.category === 'inverter' ? 'Hybrid Solar Inverter' : datasheet.category}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Energy Flow Diagram */}
          <div className="relative bg-gray-800/50 rounded-3xl p-6 md:p-10 border border-gray-700">
            
            {/* Energy Flow Animation Container */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 items-center min-h-[400px]">
              
              {/* Left Column - Solar Panels */}
              <div className="flex flex-col items-center">
                <HotspotButton 
                  hotspot={hotspots.solar}
                  isActive={activeHotspot === 'solar'}
                  onClick={() => setActiveHotspot(activeHotspot === 'solar' ? null : 'solar')}
                />
                
                {/* Energy Flow Line to Inverter */}
                <div className="relative h-4 w-full my-4">
                  <div className="absolute inset-y-0 right-0 w-3/4 h-1 bg-gradient-to-r from-yellow-500/30 to-yellow-500 top-1/2 -translate-y-1/2 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300 to-transparent animate-flow-right"></div>
                  </div>
                  <EnergyParticles direction="right" color="yellow" />
                </div>
              </div>

              {/* Center Column - Inverter */}
              <div className="flex flex-col items-center">
                {/* Inverter Image */}
                <div className="relative group cursor-pointer" onClick={() => setActiveHotspot(activeHotspot === 'inverter' ? null : 'inverter')}>
                  <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-cyan-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                  <div className="relative bg-gray-900 rounded-2xl p-4 border-2 border-orange-500/50 group-hover:border-orange-500 transition-colors">
                    {datasheet.image_url ? (
                      <img 
                        src={datasheet.image_url} 
                        alt={datasheet.model_name}
                        className="w-32 h-40 md:w-40 md:h-48 object-contain"
                      />
                    ) : (
                      <div className="w-32 h-40 md:w-40 md:h-48 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
                        <Zap className="w-16 h-16 text-orange-400" />
                      </div>
                    )}
                    {/* Status Indicator */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                  </div>
                  
                  {/* Inverter Info Popup */}
                  {activeHotspot === 'inverter' && (
                    <InfoPopup 
                      title="Smart Inverter"
                      description={`${efficiency} efficiency`}
                      details={monitoring}
                      onClose={() => setActiveHotspot(null)}
                      color="from-orange-400 to-cyan-500"
                    />
                  )}
                </div>

                {/* Specs Quick View */}
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                  <span className="px-2 py-1 bg-gray-700/50 rounded">{ratedCapacity}kW</span>
                  <span className="px-2 py-1 bg-gray-700/50 rounded">MPPT</span>
                  <span className="px-2 py-1 bg-gray-700/50 rounded flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> WiFi
                  </span>
                </div>
              </div>

              {/* Right Column - Load */}
              <div className="flex flex-col items-center">
                {/* Energy Flow Line from Inverter */}
                <div className="relative h-4 w-full my-4">
                  <div className="absolute inset-y-0 left-0 w-3/4 h-1 bg-gradient-to-r from-cyan-500 to-cyan-500/30 top-1/2 -translate-y-1/2 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-flow-right"></div>
                  </div>
                  <EnergyParticles direction="right" color="cyan" />
                </div>
                
                <HotspotButton 
                  hotspot={hotspots.load}
                  isActive={activeHotspot === 'load'}
                  onClick={() => setActiveHotspot(activeHotspot === 'load' ? null : 'load')}
                />
              </div>
            </div>

            {/* Bottom Row - Battery and Grid */}
            <div className="flex justify-center gap-8 md:gap-16 mt-8">
              {/* Battery */}
              <div className="flex flex-col items-center">
                <div className="relative h-12 w-1 mb-2">
                  <div className="absolute inset-x-0 top-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-500/30 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-300 to-transparent animate-flow-down"></div>
                  </div>
                </div>
                <HotspotButton 
                  hotspot={hotspots.battery}
                  isActive={activeHotspot === 'battery'}
                  onClick={() => setActiveHotspot(activeHotspot === 'battery' ? null : 'battery')}
                />
              </div>

              {/* Grid */}
              <div className="flex flex-col items-center">
                <div className="relative h-12 w-1 mb-2">
                  <div className="absolute inset-x-0 top-0 w-1 h-full bg-gradient-to-b from-blue-500/30 to-blue-500 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-300 to-transparent animate-flow-up"></div>
                  </div>
                </div>
                <HotspotButton 
                  hotspot={hotspots.grid}
                  isActive={activeHotspot === 'grid'}
                  onClick={() => setActiveHotspot(activeHotspot === 'grid' ? null : 'grid')}
                />
              </div>
            </div>

            {/* Tap Instruction */}
            <p className="text-center text-gray-500 text-sm mt-6 animate-pulse">
              ☝️ Tap on any component to learn more
            </p>
          </div>

          {/* Key Features Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { icon: Sun, label: 'MPPT Solar', value: pvPower },
              { icon: Battery, label: 'LiFePO4', value: `${batteryVoltage}V` },
              { icon: Shield, label: 'Protection', value: specs.ingress_protection || 'IP45' },
              { icon: Wifi, label: 'Monitoring', value: 'WiFi' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700 hover:border-orange-500/50 transition-colors">
                <item.icon className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <p className="text-gray-400 text-xs">{item.label}</p>
                <p className="text-white font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scroll to Datasheet */}
      <div className="text-center py-8">
        <button 
          onClick={() => setShowDatasheet(!showDatasheet)}
          className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
        >
          <span>View Full Specifications</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Datasheet Section */}
      <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div ref={datasheetRef} className="bg-white rounded-lg overflow-hidden shadow-2xl">
            {datasheet.category === 'battery' && <BatteryDatasheet data={datasheet} />}
            {datasheet.category === 'inverter' && <InverterDatasheet data={datasheet} />}
            {datasheet.category === 'stabilizer' && <StabilizerDatasheet data={datasheet} />}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <img src={MUSCLEGRID_LOGO} alt="MuscleGrid" className="h-12 mx-auto mb-4 opacity-80" />
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex justify-center gap-6 mt-4 text-sm text-gray-500">
            <a href="tel:+919800006416" className="hover:text-orange-400">+91 98000 06416</a>
            <a href="mailto:service@musclegrid.in" className="hover:text-orange-400">service@musclegrid.in</a>
            <a href="https://www.musclegrid.in" className="hover:text-orange-400">www.musclegrid.in</a>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes flow-right {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes flow-down {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
        @keyframes flow-up {
          0% { transform: translateY(200%); }
          100% { transform: translateY(-100%); }
        }
        @keyframes particle {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(100px) scale(0.5); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-flow-right {
          animation: flow-right 2s linear infinite;
        }
        .animate-flow-down {
          animation: flow-down 2s linear infinite;
        }
        .animate-flow-up {
          animation: flow-up 2s linear infinite;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Hotspot Button Component
function HotspotButton({ hotspot, isActive, onClick }) {
  const Icon = hotspot.icon;
  
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl transition-all duration-300 transform hover:scale-105 ${
          isActive 
            ? `bg-gradient-to-br ${hotspot.color} shadow-lg` 
            : 'bg-gray-700/50 hover:bg-gray-700'
        }`}
      >
        <Icon className={`w-8 h-8 md:w-10 md:h-10 mx-auto ${isActive ? 'text-white' : 'text-gray-400'}`} />
        <p className={`text-xs mt-1 ${isActive ? 'text-white' : 'text-gray-500'}`}>{hotspot.title.split(' ')[0]}</p>
        
        {/* Pulse Ring */}
        <span className={`absolute inset-0 rounded-2xl border-2 ${isActive ? 'border-white/50' : 'border-transparent'} animate-ping opacity-20`}></span>
      </button>
      
      {/* Info Popup */}
      {isActive && (
        <InfoPopup 
          title={hotspot.title}
          description={hotspot.description}
          details={hotspot.details}
          onClose={onClick}
          color={hotspot.color}
        />
      )}
    </div>
  );
}

// Info Popup Component
function InfoPopup({ title, description, details, onClose, color }) {
  return (
    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-xl relative">
        {/* Arrow */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 border-b border-r border-gray-700 rotate-45"></div>
        
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
          <Zap className="w-5 h-5 text-white" />
        </div>
        
        <h4 className="text-white font-semibold mb-1">{title}</h4>
        <p className="text-orange-400 text-sm font-medium">{description}</p>
        <p className="text-gray-400 text-xs mt-1">{details}</p>
      </div>
    </div>
  );
}

// Energy Particles Component
function EnergyParticles({ direction, color }) {
  const colorClass = color === 'yellow' ? 'bg-yellow-400' : color === 'cyan' ? 'bg-cyan-400' : 'bg-green-400';
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`absolute w-2 h-2 ${colorClass} rounded-full opacity-80`}
          style={{
            left: direction === 'right' ? '0%' : 'auto',
            right: direction === 'left' ? '0%' : 'auto',
            top: '50%',
            transform: 'translateY(-50%)',
            animation: `particle 1.5s linear infinite`,
            animationDelay: `${i * 0.5}s`
          }}
        />
      ))}
    </div>
  );
}
