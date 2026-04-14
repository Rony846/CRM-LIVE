import React from 'react';
import { Sun, Grid3X3, Layers, Maximize2, ThermometerSun, Shield, Award, Phone, Mail, Globe } from 'lucide-react';

// MuscleGrid Logo URL
const MUSCLEGRID_LOGO = 'https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/avndw84w_Corrected%20proprotions%20CDR%20MOD.png';

// Inline SVG Logo for PDF rendering (fallback)
const LogoFallback = () => (
  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
    <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
      <Sun className="w-5 h-5 text-white" />
    </div>
    <div>
      <span className="font-bold text-orange-600 text-lg block leading-tight">MuscleGrid</span>
      <span className="text-[8px] text-gray-500 block">Power Solutions</span>
    </div>
  </div>
);

export default function SolarPanelDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  // Group specifications into sections
  const specSections = [
    {
      title: 'Electrical Characteristics',
      items: [
        { label: 'Maximum Power (Pmax)', value: specs.wattage },
        { label: 'Open Circuit Voltage (Voc)', value: specs.voltage_voc },
        { label: 'Max Power Voltage (Vmp)', value: specs.voltage_vmp },
        { label: 'Short Circuit Current (Isc)', value: specs.current_isc },
        { label: 'Max Power Current (Imp)', value: specs.current_imp },
        { label: 'Module Efficiency', value: specs.efficiency },
        { label: 'Max System Voltage', value: specs.max_system_voltage },
      ]
    },
    {
      title: 'Cell Technology',
      items: [
        { label: 'Cell Type', value: specs.cell_type },
        { label: 'Number of Cells', value: specs.cells },
        { label: 'Bifacial Gain', value: specs.bifacial_gain },
      ]
    },
    {
      title: 'Mechanical Data',
      items: [
        { label: 'Dimensions (L×W×H)', value: specs.dimensions },
        { label: 'Weight', value: specs.weight ? `${specs.weight} kg` : null },
        { label: 'Frame Material', value: specs.frame },
        { label: 'Glass', value: specs.glass },
        { label: 'Junction Box', value: specs.junction_box },
        { label: 'Connector', value: specs.connector },
      ]
    },
    {
      title: 'Operating Conditions',
      items: [
        { label: 'Operating Temperature', value: specs.operating_temp },
        { label: 'Storage Temperature', value: specs.storage_temp },
        { label: 'Max Wind Load', value: specs.wind_load },
        { label: 'Max Snow Load', value: specs.snow_load },
      ]
    },
  ];

  // Filter out sections with no filled values
  const filledSections = specSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.value)
  })).filter(section => section.items.length > 0);

  return (
    <div className="bg-white min-h-auto w-full mx-auto font-sans relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header with Yellow Gradient */}
      <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 text-white p-3 md:p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <img 
              src={MUSCLEGRID_LOGO} 
              alt="MuscleGrid" 
              className="h-10 md:h-14 w-auto object-contain bg-white rounded-lg p-1 logo-primary"
              crossOrigin="anonymous"
              onError={(e) => { 
                e.target.style.display = 'none'; 
                const fallback = e.target.parentElement.querySelector('.logo-fallback');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="logo-fallback hidden">
              <LogoFallback />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] md:text-[10px] text-yellow-100 uppercase tracking-wider">Product Datasheet</p>
            <p className="text-xs md:text-sm font-semibold">Solar Panel Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-yellow-400 text-[10px] md:text-xs font-semibold mb-1 uppercase tracking-wider">
              {specs.cell_type || 'Mono PERC'} Solar Panel
            </p>
            <h2 className="text-base md:text-xl font-bold mb-1 leading-tight truncate">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-400 text-xs md:text-sm truncate">{data.subtitle}</p>}
          </div>
          <div className="w-20 h-16 md:w-32 md:h-24 bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden ml-2 md:ml-4 flex-shrink-0">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Sun className="w-10 h-10 md:w-14 md:h-14 text-yellow-400" />
            )}
          </div>
        </div>
      </div>

      {/* Key Feature Icons */}
      <div className="px-2 md:px-4 py-2 md:py-3 bg-gray-50 border-b">
        <div className="grid grid-cols-5 gap-1 md:gap-2">
          {[
            { icon: Sun, label: specs.wattage || 'High Power', bg: 'bg-yellow-500' },
            { icon: Grid3X3, label: specs.cells || '144 Cells', bg: 'bg-blue-500' },
            { icon: Layers, label: specs.bifacial_gain ? 'Bifacial' : 'Mono PERC', bg: 'bg-purple-500' },
            { icon: Shield, label: 'Anti-PID', bg: 'bg-green-500' },
            { icon: Award, label: data.warranty || '25 Years', bg: 'bg-cyan-500' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className={`w-6 h-6 md:w-8 md:h-8 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-0.5 md:mb-1`}>
                <item.icon className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </div>
              <p className="text-[7px] md:text-[9px] font-medium text-gray-600 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-2 md:p-4">
        {/* Specifications Table */}
        <div className="mb-3 md:mb-4">
          <table className="w-full text-[9px] md:text-[10px] border-collapse">
            <thead>
              <tr className="bg-yellow-500 text-white">
                <th className="py-1 md:py-1.5 px-1.5 md:px-2 text-left font-semibold uppercase tracking-wider text-[8px] md:text-[10px]" colSpan={2}>
                  MODEL: {data.model_name}
                </th>
              </tr>
            </thead>
            <tbody>
              {filledSections.map((section, sectionIdx) => (
                <React.Fragment key={sectionIdx}>
                  <tr className="bg-gray-100">
                    <td className="py-1 md:py-1.5 px-1.5 md:px-2 font-semibold text-gray-700 uppercase text-[8px] md:text-[9px]" colSpan={2}>
                      {section.title}
                    </td>
                  </tr>
                  {section.items.map((item, itemIdx) => (
                    <tr key={itemIdx} className={itemIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-1 md:py-1.5 px-1.5 md:px-2 text-gray-600 border-b border-gray-200 w-1/2">
                        {item.label}
                      </td>
                      <td className="py-1 md:py-1.5 px-1.5 md:px-2 text-gray-900 font-medium border-b border-gray-200">
                        {item.value}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Features */}
        {features.length > 0 && (
          <div className="mb-3 md:mb-4">
            <h3 className="text-[10px] md:text-xs font-bold text-gray-800 mb-1.5 md:mb-2 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1 h-3 md:h-4 bg-yellow-500 rounded-full"></span>
              Key Features
            </h3>
            <div className="grid grid-cols-1 gap-0.5 md:gap-1">
              {features.slice(0, 8).map((feature, i) => (
                <div key={i} className="flex items-start gap-1 md:gap-1.5 text-[8px] md:text-[9px] text-gray-700">
                  <span className="text-yellow-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {data.certifications && data.certifications.length > 0 && (
          <div className="flex items-center gap-2 md:gap-3 py-2 border-t border-gray-200">
            <span className="text-[8px] md:text-[9px] text-gray-500 uppercase">Certifications:</span>
            <div className="flex flex-wrap gap-1 md:gap-2">
              {data.certifications.map((cert, i) => (
                <span key={i} className="px-1.5 md:px-2 py-0.5 bg-gray-100 text-gray-700 text-[7px] md:text-[8px] rounded font-medium">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-2 md:p-3">
        <div className="flex flex-col md:flex-row justify-between items-center gap-1 md:gap-2">
          <div className="flex items-center gap-2">
            <img 
              src={MUSCLEGRID_LOGO} 
              alt="MuscleGrid" 
              className="h-6 md:h-8 w-auto object-contain"
              crossOrigin="anonymous"
            />
            <div>
              <p className="text-[8px] md:text-[10px] font-semibold">MuscleGrid Industries Pvt. Ltd.</p>
              <p className="text-[7px] md:text-[8px] text-gray-400">Consistency Through You</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end items-center gap-2 md:gap-3 text-[7px] md:text-[8px] text-gray-400">
            <span className="flex items-center gap-0.5 md:gap-1">
              <Phone className="w-2.5 h-2.5 md:w-3 md:h-3" /> +91 9999036254
            </span>
            <span className="flex items-center gap-0.5 md:gap-1">
              <Mail className="w-2.5 h-2.5 md:w-3 md:h-3" /> service@musclegrid.in
            </span>
            <span className="flex items-center gap-0.5 md:gap-1">
              <Globe className="w-2.5 h-2.5 md:w-3 md:h-3" /> www.musclegrid.in
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
