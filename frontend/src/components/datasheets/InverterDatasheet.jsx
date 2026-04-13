import React from 'react';
import { Zap, Sun, Battery, Wifi, Shield, Award, CheckCircle, Phone, Mail, Globe } from 'lucide-react';

export default function InverterDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">MuscleGrid</h1>
                <p className="text-orange-100 text-sm">Power Solutions</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-orange-100">Product Datasheet</p>
            <p className="text-sm font-medium">Solar Inverter Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-400 text-sm font-medium mb-1">SOLAR OFF-GRID INVERTER</p>
            <h2 className="text-4xl font-bold mb-2">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-300 text-lg">{data.subtitle}</p>}
          </div>
          <div className="w-48 h-32 bg-gray-700/50 rounded-xl flex items-center justify-center">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Zap className="w-20 h-20 text-orange-400" />
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Features Icons */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Sun className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">MPPT Solar</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Battery className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Li-Ion Ready</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">WiFi Monitor</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="w-9 h-9 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Protection</p>
          </div>
          <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
            <div className="w-9 h-9 bg-cyan-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Award className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">{data.warranty || '2 Years'}</p>
          </div>
        </div>

        {/* System Diagram */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
          <p className="text-xs text-gray-500 mb-2">System Diagram</p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mb-1">
                <Sun className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-xs text-gray-600">Solar Panel</p>
            </div>
            <div className="text-2xl text-gray-400">→</div>
            <div className="text-center">
              <div className="w-20 h-16 bg-orange-100 rounded-lg flex items-center justify-center mb-1 border-2 border-orange-400">
                <Zap className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-600 font-semibold">{data.model_name}</p>
            </div>
            <div className="text-2xl text-gray-400">→</div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mb-1">
                <Battery className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-600">Battery</p>
            </div>
            <div className="text-2xl text-gray-400">→</div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
                <span className="text-2xl">🏠</span>
              </div>
              <p className="text-xs text-gray-600">Load</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Specifications */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-orange-500">
              Technical Specifications
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {specs.capacity_kva && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Rated Capacity</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.capacity_kva} kVA / {specs.capacity_kw || specs.capacity_kva} kW</td>
                  </tr>
                )}
                {specs.pv_input_range && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">PV Input Range</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.pv_input_range} VDC</td>
                  </tr>
                )}
                {specs.max_pv_power && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Max PV Power</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.max_pv_power} W</td>
                  </tr>
                )}
                {specs.battery_voltage && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Battery Voltage</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.battery_voltage} VDC</td>
                  </tr>
                )}
                {specs.ac_output && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">AC Output</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.ac_output} VAC</td>
                  </tr>
                )}
                {specs.frequency && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Frequency</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.frequency} Hz</td>
                  </tr>
                )}
                {specs.efficiency && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Peak Efficiency</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.efficiency}%</td>
                  </tr>
                )}
                {specs.display && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Display</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.display}</td>
                  </tr>
                )}
                {specs.dimensions && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Dimensions</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.dimensions}</td>
                  </tr>
                )}
                {specs.weight && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Weight</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.weight} kg</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right: Features */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-orange-500">
              Key Features
            </h3>
            <ul className="space-y-2">
              {features.length > 0 ? features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              )) : (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">Pure Sine Wave Output</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">Built-in MPPT Solar Charger</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">Wide PV Input Voltage Range</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">Lithium Battery Compatible</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">WiFi Monitoring Support</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <span className="text-gray-700">Dual AC Output</span>
                  </li>
                </>
              )}
            </ul>

            {/* Certifications */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Certifications</p>
              <div className="flex gap-2 flex-wrap">
                {(data.certifications || ['BIS', 'ISO 9001', 'CE']).map((cert, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white p-4">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>+91 98000 06416</span>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <span>service@musclegrid.in</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>www.musclegrid.in</span>
            </div>
          </div>
          <p className="text-gray-400">© MuscleGrid Industries Pvt. Ltd.</p>
        </div>
      </div>
    </div>
  );
}
