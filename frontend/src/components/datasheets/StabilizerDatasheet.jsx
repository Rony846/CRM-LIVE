import React from 'react';
import { Activity, Shield, Gauge, Zap, Award, CheckCircle, Phone, Mail, Globe } from 'lucide-react';

export default function StabilizerDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">MuscleGrid</h1>
                <p className="text-blue-100 text-sm">Power Solutions</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-100">Product Datasheet</p>
            <p className="text-sm font-medium">Stabilizer Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-400 text-sm font-medium mb-1">VOLTAGE STABILIZER</p>
            <h2 className="text-4xl font-bold mb-2">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-300 text-lg">{data.subtitle}</p>}
          </div>
          <div className="w-48 h-32 bg-gray-700/50 rounded-xl flex items-center justify-center">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Activity className="w-20 h-20 text-blue-400" />
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Features Icons */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Wide Range</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Protection</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Fast Response</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Award className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">{data.warranty || '2 Years'} Warranty</p>
          </div>
        </div>

        {/* Voltage Range Visual */}
        <div className="bg-gradient-to-r from-red-50 via-green-50 to-red-50 rounded-xl p-4 mb-6 border border-gray-200">
          <p className="text-xs text-gray-500 mb-3 text-center">Input Voltage Range</p>
          <div className="relative h-8 bg-gradient-to-r from-red-400 via-green-400 to-red-400 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-between px-4 text-white text-xs font-bold">
              <span>{specs.input_range?.split('-')[0] || '90'}V</span>
              <span className="bg-green-600 px-3 py-1 rounded-full">{specs.output_voltage || '220V'} Output</span>
              <span>{specs.input_range?.split('-')[1] || '300'}V</span>
            </div>
          </div>
          <div className="flex justify-center mt-2">
            <span className="text-xs text-gray-500">Maintains stable {specs.output_voltage || '220V'} output across entire range</span>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Specifications */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
              Technical Specifications
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {specs.capacity_kva && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Capacity</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.capacity_kva} kVA</td>
                  </tr>
                )}
                {specs.input_range && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Input Voltage Range</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.input_range} VAC</td>
                  </tr>
                )}
                {specs.output_voltage && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Output Voltage</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.output_voltage}</td>
                  </tr>
                )}
                {specs.phase && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Phase</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.phase}</td>
                  </tr>
                )}
                {specs.frequency && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Frequency</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.frequency} Hz</td>
                  </tr>
                )}
                {specs.correction_time && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Correction Time</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.correction_time}</td>
                  </tr>
                )}
                {specs.mounting && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Mounting</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.mounting}</td>
                  </tr>
                )}
                {specs.protection && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Protection</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.protection}</td>
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
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
              Key Features
            </h3>
            <ul className="space-y-2">
              {features.length > 0 ? features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              )) : (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Wide input voltage range</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Microcontroller based design</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Fast correction time</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Overload & short circuit protection</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Digital display for voltage reading</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="text-gray-700">Time delay on start-up</span>
                  </li>
                </>
              )}
            </ul>

            {/* Applications */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Ideal For</p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">AC Units</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Refrigerators</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">TVs</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Computers</span>
              </div>
            </div>

            {/* Certifications */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Certifications</p>
              <div className="flex gap-2 flex-wrap">
                {(data.certifications || ['BIS', 'ISO 9001']).map((cert, i) => (
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
