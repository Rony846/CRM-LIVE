import React from 'react';
import { Zap, Sun, Battery, Wifi, Shield, Award, CheckCircle, Phone, Mail, Globe, Thermometer, Gauge } from 'lucide-react';

export default function InverterDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  // Group specifications into sections
  const specSections = [
    {
      title: 'AC Input',
      color: 'orange',
      items: [
        { label: 'Rated Input Voltage (VAC)', value: specs.rated_input_voltage },
        { label: 'Voltage Range (VAC)', value: specs.voltage_range },
        { label: 'Frequency (Hz)', value: specs.input_frequency },
      ]
    },
    {
      title: 'AC Output',
      color: 'orange',
      items: [
        { label: 'Rated Capacity (kW)', value: specs.rated_capacity_kw || specs.capacity_kw },
        { label: 'Surge Power (kVA)', value: specs.surge_power_kva },
        { label: 'Voltage (VAC)', value: specs.output_voltage || specs.ac_output },
        { label: 'Power Factor (PF)', value: specs.power_factor },
        { label: 'Frequency', value: specs.output_frequency || specs.frequency },
        { label: 'Switch Time (ms)', value: specs.switch_time },
        { label: 'Wave Form', value: specs.wave_form },
        { label: 'Overload Capacity', value: specs.overload_capacity },
        { label: 'Max. Efficiency', value: specs.max_efficiency || specs.efficiency },
        { label: 'Parallel Quantity', value: specs.parallel_quantity },
      ]
    },
    {
      title: 'Charger (PV / AC)',
      color: 'yellow',
      items: [
        { label: 'Solar Charger Type', value: specs.solar_charger_type },
        { label: 'Max. PV Input Current / Power', value: specs.max_pv_input },
        { label: 'MPPT Range@Operating (VDC)', value: specs.mppt_range || specs.pv_input_range },
        { label: 'Max PV Open Circuit (VOC)', value: specs.max_pv_voc },
        { label: 'Max PV Charge Current (A)', value: specs.max_pv_charge },
        { label: 'Max AC Charge Current (A)', value: specs.max_ac_charge },
        { label: 'Max. Charge Current (PV+AC)', value: specs.max_total_charge },
      ]
    },
    {
      title: 'Battery',
      color: 'green',
      items: [
        { label: 'Rated Voltage (VDC)', value: specs.battery_voltage },
        { label: 'Floating Charge Voltage (VDC)', value: specs.float_charge_voltage },
        { label: 'Overcharge Protection (VDC)', value: specs.overcharge_protection },
        { label: 'Battery Type', value: specs.battery_type },
      ]
    },
    {
      title: 'Interface',
      color: 'blue',
      items: [
        { label: 'HMI', value: specs.hmi || specs.display },
        { label: 'Interface', value: specs.interface },
        { label: 'Monitoring', value: specs.monitoring },
      ]
    },
    {
      title: 'General Data',
      color: 'gray',
      items: [
        { label: 'Ingress Protection', value: specs.ingress_protection },
        { label: 'Operating Temperature', value: specs.operating_temp },
        { label: 'Relative Humidity', value: specs.relative_humidity },
        { label: 'Storage Temperature', value: specs.storage_temp },
        { label: 'Net Weight (kg)', value: specs.weight },
        { label: 'Dimensions (W*H*D)', value: specs.dimensions },
        { label: 'Max. Operating Altitude', value: specs.max_altitude },
      ]
    },
  ];

  // Filter out sections with no filled values
  const filledSections = specSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.value)
  })).filter(section => section.items.length > 0);

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans print:shadow-none" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white p-5">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="bg-white/20 backdrop-blur p-2 rounded-lg">
                <Zap className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">MuscleGrid</h1>
                <p className="text-orange-100 text-xs">Power Solutions</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-orange-100 uppercase tracking-wider">Product Datasheet</p>
            <p className="text-xs font-medium">Solar Inverter Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-orange-400 text-xs font-semibold mb-1 uppercase tracking-wider">
              {specs.solar_charger_type ? `${specs.solar_charger_type} ` : ''}Solar Inverter
            </p>
            <h2 className="text-2xl font-bold mb-1 leading-tight">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-400 text-sm">{data.subtitle}</p>}
          </div>
          <div className="w-36 h-28 bg-gray-700/50 rounded-xl flex items-center justify-center overflow-hidden ml-4">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Zap className="w-16 h-16 text-orange-400" />
            )}
          </div>
        </div>
      </div>

      {/* Key Feature Icons */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: Sun, label: specs.solar_charger_type || 'MPPT Solar', bg: 'bg-amber-500' },
            { icon: Battery, label: specs.battery_type?.split(' ')[0] || 'Li-Ion Ready', bg: 'bg-green-500' },
            { icon: Wifi, label: specs.monitoring || 'WiFi Monitor', bg: 'bg-blue-500' },
            { icon: Shield, label: specs.ingress_protection || 'Protection', bg: 'bg-purple-500' },
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
        {/* Specifications Table - Professional Catalog Style */}
        <div className="mb-4">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-orange-500 text-white">
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

        {/* Two Column: Features & Certifications */}
        {features.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-bold text-gray-900 mb-2 pb-1 border-b-2 border-orange-500 uppercase tracking-wider">
              Key Features
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-orange-500 mt-0.5 flex-shrink-0" />
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

        {/* Disclaimer */}
        <p className="text-[8px] text-gray-400 mt-3 italic">
          Product specifications are subject to change without further notice.
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white p-3">
        <div className="flex justify-between items-center text-[10px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-orange-400" />
              <span>+91 98000 06416</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3 text-orange-400" />
              <span>service@musclegrid.in</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-orange-400" />
              <span>www.musclegrid.in</span>
            </div>
          </div>
          <p className="text-gray-400">© MuscleGrid Industries Pvt. Ltd.</p>
        </div>
      </div>
    </div>
  );
}
