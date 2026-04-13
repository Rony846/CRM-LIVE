import React from 'react';
import { Activity, Zap, Shield, Award, CheckCircle, Phone, Mail, Globe, Gauge, Timer, Settings } from 'lucide-react';

// MuscleGrid Logo URL - official logo from customer
const MUSCLEGRID_LOGO = 'https://customer-assets.emergentagent.com/job_crm-rebuild-11/artifacts/avndw84w_Corrected%20proprotions%20CDR%20MOD.png';

export default function StabilizerDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  // Determine stabilizer type
  const isServo = data.subtitle?.toLowerCase().includes('servo') || specs.type?.toLowerCase().includes('servo');

  // Group specifications into sections
  const specSections = [
    {
      title: 'Input Specifications',
      items: [
        { label: 'Input Voltage Range (V)', value: specs.input_range },
        { label: 'Input Frequency (Hz)', value: specs.frequency || '50' },
        { label: 'Phase', value: specs.phase || 'Single Phase' },
        { label: 'Low Voltage Recovery', value: specs.low_voltage_recovery },
        { label: 'High Voltage Recovery', value: specs.high_voltage_recovery },
      ]
    },
    {
      title: 'Output Specifications',
      items: [
        { label: 'Capacity (kVA)', value: specs.capacity_kva },
        { label: 'Output Voltage (V)', value: specs.output_voltage || '220 ± 3%' },
        { label: 'Correction Time (ms)', value: specs.correction_time || '< 10' },
        { label: 'Efficiency (%)', value: specs.efficiency || '> 95%' },
        { label: 'Regulation Accuracy', value: specs.regulation_accuracy || '± 3%' },
      ]
    },
    {
      title: 'Protection Features',
      items: [
        { label: 'Overload Protection', value: specs.overload_protection || 'Yes' },
        { label: 'Short Circuit Protection', value: specs.short_circuit || 'Yes' },
        { label: 'Over Voltage Protection', value: specs.over_voltage || 'Yes' },
        { label: 'Under Voltage Protection', value: specs.under_voltage || 'Yes' },
        { label: 'Time Delay', value: specs.time_delay },
      ]
    },
    {
      title: 'Physical Specifications',
      items: [
        { label: 'Mounting Type', value: specs.mounting || 'Floor Mount' },
        { label: 'Dimensions (mm)', value: specs.dimensions },
        { label: 'Weight (kg)', value: specs.weight },
        { label: 'Display', value: specs.display || 'Digital LED' },
        { label: 'Cooling', value: specs.cooling || 'Natural / Fan Cooled' },
      ]
    },
    {
      title: 'Operating Conditions',
      items: [
        { label: 'Operating Temperature', value: specs.operating_temp || '0°C to 45°C' },
        { label: 'Humidity', value: specs.humidity || '0-95% (Non-condensing)' },
        { label: 'Altitude', value: specs.altitude || 'Up to 2000m' },
      ]
    },
  ];

  // Filter out sections with no filled values
  const filledSections = specSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.value)
  })).filter(section => section.items.length > 0);

  const headerColor = isServo 
    ? 'bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600' 
    : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600';
  const accentColor = isServo ? 'text-purple-400' : 'text-blue-400';
  const borderColor = isServo ? 'border-purple-500' : 'border-blue-500';
  const tableHeaderBg = isServo ? 'bg-purple-600' : 'bg-blue-600';

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className={`${headerColor} text-white p-4`}>
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
            <p className="text-[10px] opacity-80 uppercase tracking-wider">Product Datasheet</p>
            <p className="text-sm font-semibold">{isServo ? 'Servo Stabilizer' : 'Mainline Stabilizer'} Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className={`${accentColor} text-xs font-semibold mb-1 uppercase tracking-wider`}>
              {isServo ? 'Servo Controlled' : 'Mainline'} Voltage Stabilizer
            </p>
            <h2 className="text-xl font-bold mb-1 leading-tight">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-400 text-sm">{data.subtitle}</p>}
          </div>
          <div className="w-32 h-24 bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden ml-4">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Activity className={`w-14 h-14 ${accentColor}`} />
            )}
          </div>
        </div>
      </div>

      {/* Key Feature Icons */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: Gauge, label: specs.input_range || '50V-270V', bg: isServo ? 'bg-purple-500' : 'bg-blue-500' },
            { icon: Timer, label: specs.correction_time || '< 10ms', bg: 'bg-cyan-500' },
            { icon: Settings, label: isServo ? 'Servo Motor' : 'Microprocessor', bg: 'bg-amber-500' },
            { icon: Shield, label: 'Full Protection', bg: 'bg-green-500' },
            { icon: Award, label: data.warranty || '2 Years', bg: 'bg-rose-500' },
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
              <tr className={`${tableHeaderBg} text-white`}>
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
            <h3 className={`text-xs font-bold text-gray-900 mb-2 pb-1 border-b-2 ${borderColor} uppercase tracking-wider`}>
              Key Features
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle className={`w-3 h-3 ${isServo ? 'text-purple-500' : 'text-blue-500'} mt-0.5 flex-shrink-0`} />
                  <span className="text-[10px] text-gray-700 leading-tight">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Certifications:</span>
          {(data.certifications || ['BIS', 'ISO 9001', 'CE']).map((cert, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[9px] font-medium rounded">
              {cert}
            </span>
          ))}
        </div>

        {/* Application Note */}
        <div className={`mt-3 p-2 ${isServo ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} border rounded`}>
          <p className={`text-[9px] ${isServo ? 'text-purple-800' : 'text-blue-800'} font-medium`}>
            Suitable for: {isServo ? 'Industrial machinery, CNC equipment, medical devices, and high-precision applications.' : 'Whole house protection, offices, shops, and residential applications with wide voltage fluctuation.'}
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
              <Phone className={`w-3 h-3 ${isServo ? 'text-purple-400' : 'text-blue-400'}`} />
              <span>+91 98000 06416</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className={`w-3 h-3 ${isServo ? 'text-purple-400' : 'text-blue-400'}`} />
              <span>service@musclegrid.in</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className={`w-3 h-3 ${isServo ? 'text-purple-400' : 'text-blue-400'}`} />
              <span>www.musclegrid.in</span>
            </div>
          </div>
          <p className="text-gray-400 text-[9px]">Consistency Through You</p>
        </div>
      </div>
    </div>
  );
}
