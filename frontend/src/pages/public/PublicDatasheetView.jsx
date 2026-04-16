import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, X, Sun, Battery, Zap, Home, Wifi, Shield, ChevronDown, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Package, Wrench, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo3D, WhatsAppButton, FooterLogo3D, useCatalogueTheme } from '@/components/public/SharedComponents';

// Import datasheet templates
import InverterDatasheet from '@/components/datasheets/InverterDatasheet';
import BatteryDatasheet from '@/components/datasheets/BatteryDatasheet';
import StabilizerDatasheet from '@/components/datasheets/StabilizerDatasheet';
import AccessoriesDatasheet from '@/components/datasheets/AccessoriesDatasheet';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PublicDatasheetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datasheet, setDatasheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const datasheetRef = useRef(null);
  
  // Isolate from CRM theme
  useCatalogueTheme();

  useEffect(() => {
    fetchDatasheet();
  }, [id]);

  const fetchDatasheet = async () => {
    try {
      // Use public endpoint that doesn't require authentication
      const res = await axios.get(`${API}/api/product-datasheets/public/${id}`);
      setDatasheet(res.data);
    } catch (err) {
      setError('Datasheet not found');
    } finally {
      setLoading(false);
    }
  };

  // Direct PDF download using html2canvas + jsPDF
  const handleDownloadPDF = async () => {
    if (!datasheetRef.current) return;
    
    setDownloading(true);
    try {
      // Make datasheet visible for capture
      setShowDatasheet(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const element = datasheetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        onclone: (clonedDoc) => {
          // Make sure element is visible in clone
          const clonedElement = clonedDoc.querySelector('[data-datasheet-content]');
          if (clonedElement) {
            clonedElement.style.visibility = 'visible';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${datasheet.model_name.replace(/[^a-zA-Z0-9]/g, '_')}_Datasheet.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      // Fallback to print
      window.print();
    } finally {
      setDownloading(false);
    }
  };

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

  // Check if this is an accessory product (not inverter/battery/stabilizer)
  const isAccessory = !['inverter', 'battery', 'stabilizer', 'solar_panel', 'servo'].includes(datasheet.category?.toLowerCase());

  // For accessories, use a simpler product showcase layout
  if (isAccessory) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between relative">
            <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Catalogue</span>
            </button>
            <Logo3D size="sm" className="absolute left-1/2 -translate-x-1/2" />
            <Button 
              onClick={handleDownloadPDF} 
              disabled={downloading}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-2 md:px-3 z-10"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Hero Section for Accessories */}
        <section className="relative py-8 px-3 sm:px-4 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full">
            {/* Product Title */}
            <div className="text-center mb-8">
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                <Wrench className="w-4 h-4" />
                {datasheet.category?.toUpperCase() || 'ACCESSORY'}
              </p>
              <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">{datasheet.model_name}</h1>
              {datasheet.subtitle && <p className="text-gray-400 text-sm max-w-2xl mx-auto">{datasheet.subtitle}</p>}
            </div>

            {/* Image Gallery */}
            <div className="bg-gray-800/50 rounded-2xl p-4 md:p-6 border border-gray-700 mb-8">
              {/* Main Image */}
              <div 
                className="relative bg-gray-900/80 rounded-xl overflow-hidden mb-4 cursor-pointer group"
                onClick={() => setShowImageGallery(true)}
              >
                <img 
                  src={(datasheet.images || [datasheet.image_url])[currentImageIndex]} 
                  alt={datasheet.model_name}
                  className="w-full h-64 md:h-96 object-contain mx-auto transition-transform group-hover:scale-105"
                />
                {/* Navigation arrows */}
                {(datasheet.images?.length || 1) > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? (datasheet.images?.length || 1) - 1 : prev - 1); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === (datasheet.images?.length || 1) - 1 ? 0 : prev + 1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
                {/* Click to expand hint */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full">
                  Click to view gallery
                </div>
              </div>
              
              {/* Thumbnail strip */}
              {(datasheet.images?.length || 0) > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                  {datasheet.images.map((img, i) => (
                    <button 
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        i === currentImageIndex ? 'border-orange-500 scale-105' : 'border-gray-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              
              {/* Image count */}
              {(datasheet.images?.length || 0) > 0 && (
                <p className="text-center text-gray-500 text-xs mt-2">
                  {currentImageIndex + 1} / {datasheet.images?.length || 1} images
                  {datasheet.enhanced_images?.length > 0 && (
                    <span className="ml-2 text-purple-400">• AI Enhanced</span>
                  )}
                </p>
              )}
            </div>

            {/* Quick Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                <Package className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Quality Product</p>
                <p className="text-gray-500 text-xs">Tested & Verified</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                <Shield className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">{datasheet.warranty || '1 Year'}</p>
                <p className="text-gray-500 text-xs">Warranty</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Fast Delivery</p>
                <p className="text-gray-500 text-xs">Pan India</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                <CheckCircle className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">In Stock</p>
                <p className="text-gray-500 text-xs">Ready to Ship</p>
              </div>
            </div>

            {/* Specifications Section */}
            {Object.keys(specs).length > 0 && (
              <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 border border-gray-700 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-orange-400" />
                  Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {Object.entries(specs).map(([key, value], i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between p-3 bg-gray-900/50 rounded-lg gap-1">
                      <span className="text-gray-400 text-xs sm:text-sm font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <span className="text-white font-medium text-sm break-words text-right sm:text-right max-w-full">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features Section */}
            {datasheet.features && datasheet.features.length > 0 && (
              <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 border border-gray-700 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Key Features</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {datasheet.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Product Description Section */}
            {(datasheet.full_description || datasheet.subtitle) && (
              <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl p-4 sm:p-6 border border-gray-600 mb-8">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-400" />
                  Product Description
                </h3>
                <div className="prose prose-invert max-w-none overflow-hidden">
                  <p className="text-gray-200 text-sm sm:text-base leading-relaxed whitespace-pre-line break-words">
                    {datasheet.full_description || datasheet.subtitle}
                  </p>
                </div>
              </div>
            )}

            {/* Call-to-Action Section */}
            <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 rounded-2xl p-4 sm:p-6 border border-orange-700/50 mb-8 text-center">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Interested in this product?</h3>
              <p className="text-gray-400 text-sm mb-4">Contact us for pricing and availability</p>
              <div className="flex flex-wrap justify-center gap-3">
                <a 
                  href="tel:+919999036254" 
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Call Us
                </a>
                <a 
                  href="mailto:service@musclegrid.in" 
                  className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Email Us
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll to Datasheet */}
        <div className="text-center py-6">
          <button 
            onClick={() => setShowDatasheet(!showDatasheet)}
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm"
          >
            <span>View Full Datasheet</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Datasheet Section for Accessories */}
        <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
          <div className="pb-16 px-2">
            <div className="overflow-x-auto">
              <div 
                ref={datasheetRef} 
                data-datasheet-content 
                className="bg-white shadow-2xl mx-auto"
                style={{ minWidth: '380px', maxWidth: '794px', width: '100%' }}
              >
                <AccessoriesDatasheet data={datasheet} />
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 border-t border-gray-800 py-6">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <FooterLogo3D className="mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Consistency Through You</p>
            <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-6 mt-3 text-xs text-gray-500">
              <a href="tel:+919999036254" className="hover:text-orange-400">+91 9999036254</a>
              <a href="mailto:service@musclegrid.in" className="hover:text-orange-400">service@musclegrid.in</a>
              <a href="https://www.musclegrid.in" className="hover:text-orange-400">www.musclegrid.in</a>
            </div>
          </div>
        </footer>
        
        {/* WhatsApp Button */}
        <WhatsAppButton />

        {/* Image Gallery Modal */}
        {showImageGallery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90" onClick={() => setShowImageGallery(false)}>
            <div className="relative bg-gray-900 rounded-2xl p-4 max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowImageGallery(false)} className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-700">
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-white text-lg font-semibold mb-4 pr-12">{datasheet.model_name}</h3>
              
              {/* Main Image */}
              <div className="relative bg-gray-800 rounded-xl overflow-hidden mb-4">
                <img 
                  src={(datasheet.images || [datasheet.image_url])[currentImageIndex]} 
                  alt={datasheet.model_name}
                  className="w-full h-64 md:h-[500px] object-contain"
                />
                
                {/* Navigation arrows */}
                {(datasheet.images?.length || 1) > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? (datasheet.images?.length || 1) - 1 : prev - 1)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                    >
                      <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={() => setCurrentImageIndex(prev => prev === (datasheet.images?.length || 1) - 1 ? 0 : prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                    >
                      <ChevronRight className="w-8 h-8" />
                    </button>
                  </>
                )}
              </div>
              
              {/* Thumbnail strip */}
              {(datasheet.images?.length || 0) > 1 && (
                <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                  {datasheet.images.map((img, i) => (
                    <button 
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        i === currentImageIndex ? 'border-orange-500 scale-105' : 'border-gray-700 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-x-hidden">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between relative">
          <button onClick={() => navigate('/catalogue')} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm z-10">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Catalogue</span>
          </button>
          <Logo3D size="sm" className="absolute left-1/2 -translate-x-1/2" />
          <Button 
            onClick={handleDownloadPDF} 
            disabled={downloading}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-2 md:px-3 z-10"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Hero Section with Animation */}
      <section className="relative py-6 px-3 overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(251,146,60,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.3) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-5xl mx-auto relative">
          {/* Product Title */}
          <div className="text-center mb-6">
            <p className="text-orange-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">
              {datasheet.category === 'inverter' ? 'Hybrid Solar Inverter' : datasheet.category}
            </p>
            <h1 className="text-xl md:text-3xl font-bold text-white mb-2 px-2">{datasheet.model_name}</h1>
            {datasheet.subtitle && <p className="text-gray-400 text-sm">{datasheet.subtitle}</p>}
          </div>

          {/* Interactive Energy Flow Diagram - Mobile Optimized */}
          <div className="relative bg-gray-800/50 rounded-2xl p-4 md:p-8 border border-gray-700 overflow-hidden">
            
            {/* Main Layout - Vertical on mobile, horizontal on desktop */}
            <div className="flex flex-col items-center gap-4 md:gap-6">
              
              {/* Top Row: Solar → Inverter → Load */}
              <div className="flex items-center justify-center gap-2 md:gap-6 w-full">
                {/* Solar */}
                <div className="flex flex-col items-center">
                  <HotspotButton 
                    hotspot={hotspots.solar}
                    isActive={activeHotspot === 'solar'}
                    onClick={() => setActiveHotspot(activeHotspot === 'solar' ? null : 'solar')}
                    isMobile={true}
                  />
                </div>

                {/* Energy Flow Line */}
                <div className="relative w-8 md:w-16 h-1 bg-gradient-to-r from-yellow-500/30 to-yellow-500 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300 to-transparent animate-flow-right"></div>
                </div>

                {/* Inverter */}
                <div className="relative">
                  <div 
                    className="relative bg-gray-900 rounded-xl p-2 md:p-3 border-2 border-orange-500/50 cursor-pointer hover:border-orange-500 hover:scale-105 transition-all duration-300 group"
                    onClick={() => setShowImageGallery(true)}
                  >
                    {/* Glow effect */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    {datasheet.image_url ? (
                      <img 
                        src={datasheet.images?.[0] || datasheet.image_url} 
                        alt={datasheet.model_name}
                        className="relative w-16 h-20 md:w-28 md:h-36 object-contain"
                      />
                    ) : (
                      <div className="relative w-16 h-20 md:w-28 md:h-36 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                        <Zap className="w-8 h-8 md:w-12 md:h-12 text-orange-400" />
                      </div>
                    )}
                    {/* Status Dot */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Energy Flow Line */}
                <div className="relative w-8 md:w-16 h-1 bg-gradient-to-r from-cyan-500 to-cyan-500/30 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-flow-right"></div>
                </div>

                {/* Load */}
                <div className="flex flex-col items-center">
                  <HotspotButton 
                    hotspot={hotspots.load}
                    isActive={activeHotspot === 'load'}
                    onClick={() => setActiveHotspot(activeHotspot === 'load' ? null : 'load')}
                    isMobile={true}
                  />
                </div>
              </div>

              {/* Specs Tags */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-gray-700/50 rounded">{ratedCapacity}kW</span>
                <span className="px-2 py-1 bg-gray-700/50 rounded">MPPT</span>
                <span className="px-2 py-1 bg-gray-700/50 rounded flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> WiFi
                </span>
              </div>

              {/* Bottom Row: Battery and Grid */}
              <div className="flex justify-center gap-6 md:gap-12">
                {/* Battery */}
                <div className="flex flex-col items-center">
                  <div className="relative h-6 md:h-10 w-1 mb-2">
                    <div className="absolute inset-x-0 top-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-500/30 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-300 to-transparent animate-flow-down"></div>
                    </div>
                  </div>
                  <HotspotButton 
                    hotspot={hotspots.battery}
                    isActive={activeHotspot === 'battery'}
                    onClick={() => setActiveHotspot(activeHotspot === 'battery' ? null : 'battery')}
                    isMobile={true}
                  />
                </div>

                {/* Grid */}
                <div className="flex flex-col items-center">
                  <div className="relative h-6 md:h-10 w-1 mb-2">
                    <div className="absolute inset-x-0 top-0 w-1 h-full bg-gradient-to-b from-blue-500/30 to-blue-500 rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-300 to-transparent animate-flow-up"></div>
                    </div>
                  </div>
                  <HotspotButton 
                    hotspot={hotspots.grid}
                    isActive={activeHotspot === 'grid'}
                    onClick={() => setActiveHotspot(activeHotspot === 'grid' ? null : 'grid')}
                    isMobile={true}
                  />
                </div>
              </div>
            </div>

            {/* Tap Instruction */}
            <p className="text-center text-gray-500 text-xs mt-4 animate-pulse">
              Tap on any component to learn more
            </p>
          </div>

          {/* Key Features Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-6">
            {[
              { icon: Sun, label: 'MPPT Solar', value: pvPower },
              { icon: Battery, label: 'LiFePO4', value: `${batteryVoltage}V` },
              { icon: Shield, label: 'Protection', value: specs.ingress_protection || 'IP45' },
              { icon: Wifi, label: 'Monitoring', value: 'WiFi' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700">
                <item.icon className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <p className="text-gray-400 text-[10px]">{item.label}</p>
                <p className="text-white font-semibold text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scroll to Datasheet */}
      <div className="text-center py-6">
        <button 
          onClick={() => setShowDatasheet(!showDatasheet)}
          className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors text-sm"
        >
          <span>View Full Specifications</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDatasheet ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Datasheet Section - Scaled to fit mobile */}
      <section className={`transition-all duration-500 ${showDatasheet ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="pb-16 px-2">
          {/* Responsive container - horizontal scroll on small screens */}
          <div className="overflow-x-auto">
            <div 
              ref={datasheetRef} 
              data-datasheet-content 
              className="bg-white shadow-2xl mx-auto"
              style={{ minWidth: '380px', maxWidth: '794px', width: '100%' }}
            >
              {datasheet.category === 'battery' && <BatteryDatasheet data={datasheet} />}
              {datasheet.category === 'inverter' && <InverterDatasheet data={datasheet} />}
              {datasheet.category === 'stabilizer' && <StabilizerDatasheet data={datasheet} />}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <FooterLogo3D className="mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Consistency Through You</p>
          <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-6 mt-3 text-xs text-gray-500">
            <a href="tel:+919999036254" className="hover:text-orange-400">+91 9999036254</a>
            <a href="mailto:service@musclegrid.in" className="hover:text-orange-400">service@musclegrid.in</a>
            <a href="https://www.musclegrid.in" className="hover:text-orange-400">www.musclegrid.in</a>
          </div>
        </div>
      </footer>
      
      {/* WhatsApp Button */}
      <WhatsAppButton />

      {/* CSS Animations - FASTER */}
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
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes energy-particle {
          0% { transform: translateX(0) scale(1); opacity: 1; }
          100% { transform: translateX(50px) scale(0.5); opacity: 0; }
        }
        .animate-flow-right {
          animation: flow-right 0.8s linear infinite;
        }
        .animate-flow-down {
          animation: flow-down 0.8s linear infinite;
        }
        .animate-flow-up {
          animation: flow-up 0.8s linear infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
      `}</style>
      
      {/* Image Gallery Modal */}
      {showImageGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80" onClick={() => setShowImageGallery(false)}>
          <div className="relative bg-gray-900 rounded-2xl p-4 max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImageGallery(false)} className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-700">
              <X className="w-6 h-6" />
            </button>
            
            <h3 className="text-white text-lg font-semibold mb-4 pr-12">{datasheet.model_name}</h3>
            
            {/* Main Image */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden mb-4">
              <img 
                src={(datasheet.images || [datasheet.image_url])[currentImageIndex]} 
                alt={datasheet.model_name}
                className="w-full h-64 md:h-80 object-contain"
              />
              
              {/* Navigation arrows */}
              {(datasheet.images?.length || 1) > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? (datasheet.images?.length || 1) - 1 : prev - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => prev === (datasheet.images?.length || 1) - 1 ? 0 : prev + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
            
            {/* Thumbnail strip */}
            {(datasheet.images?.length || 0) > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {datasheet.images.map((img, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === currentImageIndex ? 'border-orange-500 scale-105' : 'border-gray-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            
            {/* Quick specs in gallery */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="text-center p-2 bg-gray-800 rounded-lg">
                <p className="text-orange-400 font-bold text-sm">{specs.rated_capacity_kw || specs.capacity_kw || '6.2'}kW</p>
                <p className="text-gray-500 text-xs">Capacity</p>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded-lg">
                <p className="text-green-400 font-bold text-sm">{specs.battery_voltage || '48'}V</p>
                <p className="text-gray-500 text-xs">Battery</p>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded-lg">
                <p className="text-blue-400 font-bold text-sm">{specs.monitoring || 'WiFi'}</p>
                <p className="text-gray-500 text-xs">Monitor</p>
              </div>
              <div className="text-center p-2 bg-gray-800 rounded-lg">
                <p className="text-purple-400 font-bold text-sm">{datasheet.warranty || '5Y'}</p>
                <p className="text-gray-500 text-xs">Warranty</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Global Popup Modal - renders at root level for proper positioning */}
      {activeHotspot && hotspots[activeHotspot] && (
        <InfoPopup 
          title={hotspots[activeHotspot].title}
          description={hotspots[activeHotspot].description}
          details={hotspots[activeHotspot].details}
          onClose={() => setActiveHotspot(null)}
        />
      )}
      
      {/* Inverter Popup */}
      {activeHotspot === 'inverter' && (
        <InfoPopup 
          title="Smart Inverter"
          description={`${efficiency} efficiency`}
          details={monitoring}
          onClose={() => setActiveHotspot(null)}
        />
      )}
    </div>
  );
}

// Hotspot Button Component - Mobile Optimized
function HotspotButton({ hotspot, isActive, onClick, isMobile }) {
  const Icon = hotspot.icon;
  
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`relative w-14 h-14 md:w-20 md:h-20 rounded-xl transition-all duration-300 ${
          isActive 
            ? `bg-gradient-to-br ${hotspot.color} shadow-lg` 
            : 'bg-gray-700/50 hover:bg-gray-700'
        }`}
      >
        <Icon className={`w-6 h-6 md:w-8 md:h-8 mx-auto ${isActive ? 'text-white' : 'text-gray-400'}`} />
        <p className={`text-[10px] md:text-xs mt-0.5 ${isActive ? 'text-white' : 'text-gray-500'}`}>
          {hotspot.title.split(' ')[0]}
        </p>
      </button>
    </div>
  );
}

// Info Popup Component - Fixed positioning for mobile
function InfoPopup({ title, description, details, onClose, position = "top" }) {
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-600 rounded-2xl p-5 shadow-2xl w-full max-w-[300px] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-4">
          <Zap className="w-7 h-7 text-white" />
        </div>
        
        <h4 className="text-white font-bold text-xl mb-2">{title}</h4>
        <p className="text-orange-400 font-semibold text-base">{description}</p>
        <p className="text-gray-400 text-sm mt-2">{details}</p>
        
        <button 
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
