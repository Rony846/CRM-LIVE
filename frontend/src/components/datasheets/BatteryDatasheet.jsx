import React from 'react';
import { Battery, Zap, Shield, Award, CheckCircle, Phone, Mail, Globe, Thermometer, Gauge, Timer, Cpu } from 'lucide-react';

// MuscleGrid Logo URL - official logo from customer
const MUSCLEGRID_LOGO = 'https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/avndw84w_Corrected%20proprotions%20CDR%20MOD.png';

export default function BatteryDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  // Group specifications into sections for LiFePO4 batteries
  const specSections = [
    {
      title: 'Battery Specifications',
      items: [
        { label: 'Battery Type', value: specs.type || 'LiFePO4 (Lithium Iron Phosphate)' },
        { label: 'Nominal Voltage (V)', value: specs.voltage },
        { label: 'Capacity (Ah)', value: specs.capacity_ah },
        { label: 'Energy (Wh)', value: specs.energy_wh },
        { label: 'Cycle Life', value: specs.cycle_life || '6000+ Cycles' },
        { label: 'Cell Grade', value: specs.cell_grade || 'A+ Grade' },
      ]
    },
    {
      title: 'BMS (Battery Management System)',
      items: [
        { label: 'BMS Type', value: specs.bms_type || 'JK Smart BMS' },
        { label: 'Active Balancer', value: specs.active_balancer || 'Yes' },
        { label: 'Communication', value: specs.communication || 'RS485 / Bluetooth' },
        { label: 'Overcharge Protection (V)', value: specs.overcharge_protection },
        { label: 'Over-discharge Protection (V)', value: specs.overdischarge_protection },
        { label: 'Max Continuous Discharge (A)', value: specs.max_discharge_current },
        { label: 'Max Charge Current (A)', value: specs.max_charge_current },
      ]
    },
    {
      title: 'Physical Specifications',
      items: [
        { label: 'Dimensions (L x W x H mm)', value: specs.dimensions },
        { label: 'Weight (kg)', value: specs.weight },
        { label: 'Terminal Type', value: specs.terminals || 'M8 Bolt' },
        { label: 'Enclosure', value: specs.enclosure || 'IP65 Rated Metal' },
        { label: 'Display', value: specs.display || 'LCD Screen' },
      ]
    },
    {
      title: 'Operating Conditions',
      items: [
        { label: 'Operating Temperature', value: specs.operating_temp || '-10°C to 55°C' },
        { label: 'Storage Temperature', value: specs.storage_temp || '-20°C to 60°C' },
        { label: 'Humidity', value: specs.humidity || '0-95% (Non-condensing)' },
        { label: 'Self-Discharge Rate', value: specs.self_discharge || '< 3% per month' },
      ]
    },
  ];

  // Filter out sections with no filled values
  const filledSections = specSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.value)
  })).filter(section => section.items.length > 0);

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header with Green Gradient for Battery */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 text-white p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src={MUSCLEGRID_LOGO} 
              alt="MuscleGrid" 
              className="h-14 w-auto object-contain bg-white rounded-lg p-1"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="text-right">
            <p className="text-[10px] text-green-100 uppercase tracking-wider">Product Datasheet</p>
            <p className="text-sm font-semibold">LiFePO4 Battery Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-green-400 text-xs font-semibold mb-1 uppercase tracking-wider">
              Lithium Iron Phosphate Battery
            </p>
            <h2 className="text-xl font-bold mb-1 leading-tight">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-400 text-sm">{data.subtitle}</p>}
          </div>
          <div className="w-32 h-24 bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden ml-4">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Battery className="w-14 h-14 text-green-400" />
            )}
          </div>
        </div>
      </div>

      {/* Key Feature Icons */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: Battery, label: 'LiFePO4', bg: 'bg-green-500' },
            { icon: Timer, label: specs.cycle_life || '6000 Cycles', bg: 'bg-emerald-500' },
            { icon: Cpu, label: specs.bms_type || 'JK Smart BMS', bg: 'bg-blue-500' },
            { icon: Shield, label: 'IP65 Rated', bg: 'bg-purple-500' },
            { icon: Award, label: data.warranty || '5 Years', bg: 'bg-cyan-500' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className={`w-8 h-8 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-1`}>
                <item.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-[9px] font-medium text-gray-600 leading-tight">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Specifications Table */}
        <div className="mb-4">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="py-1.5 px-2 text-left font-semibold uppercase tracking-wider" colSpan={2}>
                  MODEL: {data.model_name}
                </th>
              </tr>
            </thead>
            <tbody>
              {filledSections.map((section, sectionIdx) => (
                <React.Fragment key={section.title}>
                  {/* Section Header */}
                  <tr className="bg-gray-100">
                    <td colSpan={2} className="py-1.5 px-2 font-bold text-gray-700 text-[10px] uppercase tracking-wider">
                      {section.title}
                    </td>
                  </tr>
                  {/* Section Items */}
                  {section.items.map((item, itemIdx) => (
                    <tr key={itemIdx} className={itemIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-1.5 px-2 text-gray-600 border-b border-gray-100 w-1/2">
                        {item.label}
                      </td>
                      <td className="py-1.5 px-2 font-medium text-gray-900 border-b border-gray-100 text-right">
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
          <div className="mt-3">
            <h3 className="text-xs font-bold text-gray-900 mb-2 pb-1 border-b-2 border-green-500 uppercase tracking-wider">
              Key Features
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-gray-700 leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Certifications:</span>
          {(data.certifications || ['BIS', 'ISO 9001', 'UN38.3', 'IEC 62619']).map((cert, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[9px] font-medium rounded">
              {cert}
            </span>
          ))}
        </div>

        {/* Safety Notice */}
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
          <p className="text-[9px] text-green-800 font-medium">
            LiFePO4 Chemistry: Inherently safe, non-flammable, and environmentally friendly. No thermal runaway risk.
          </p>
        </div>

        {/* Disclaimer */}
        <p className="text-[8px] text-gray-400 mt-2 italic">
          Product specifications are subject to change without further notice.
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white p-3">
        <div className="flex justify-between items-center text-[10px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-green-400" />
              <span>+91 9999036254</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3 text-green-400" />
              <span>service@musclegrid.in</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-green-400" />
              <span>www.musclegrid.in</span>
            </div>
          </div>
          <p className="text-gray-400 text-[9px]">Consistency Through You</p>
        </div>
      </div>
    </div>
  );
}
