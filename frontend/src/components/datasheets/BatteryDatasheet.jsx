import React from 'react';
import { Battery, Shield, Award, CheckCircle, Phone, Mail, Globe } from 'lucide-react';

export default function BatteryDatasheet({ data }) {
  const specs = data.specifications || {};
  const features = data.features || [];

  return (
    <div className="bg-white min-h-[1123px] w-[794px] mx-auto font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Battery className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">MuscleGrid</h1>
                <p className="text-cyan-100 text-sm">Power Solutions</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-cyan-100">Product Datasheet</p>
            <p className="text-sm font-medium">Battery Series</p>
          </div>
        </div>
      </div>

      {/* Product Title Section */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cyan-400 text-sm font-medium mb-1">TUBULAR BATTERY</p>
            <h2 className="text-4xl font-bold mb-2">{data.model_name}</h2>
            {data.subtitle && <p className="text-gray-300 text-lg">{data.subtitle}</p>}
          </div>
          <div className="w-48 h-32 bg-gray-700/50 rounded-xl flex items-center justify-center">
            {data.image_url ? (
              <img src={data.image_url} alt={data.model_name} className="max-h-full max-w-full object-contain" />
            ) : (
              <Battery className="w-20 h-20 text-green-400" />
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Features Icons */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Long Life</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Battery className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Deep Cycle</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Award className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">{data.warranty || '2 Years'} Warranty</p>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">BIS Certified</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Specifications */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-cyan-500">
              Technical Specifications
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {specs.capacity_ah && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Capacity</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.capacity_ah} Ah</td>
                  </tr>
                )}
                {specs.voltage && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Voltage</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.voltage} V</td>
                  </tr>
                )}
                {specs.type && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Type</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.type}</td>
                  </tr>
                )}
                {specs.dimensions && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Dimensions (LxWxH)</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.dimensions}</td>
                  </tr>
                )}
                {specs.weight && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Weight</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.weight} kg</td>
                  </tr>
                )}
                {specs.electrolyte && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Electrolyte Volume</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.electrolyte} L</td>
                  </tr>
                )}
                {specs.terminals && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Terminal Type</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.terminals}</td>
                  </tr>
                )}
                {specs.cycle_life && (
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Cycle Life</td>
                    <td className="py-2 font-semibold text-gray-900 text-right">{specs.cycle_life}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Right: Features */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-cyan-500">
              Key Features
            </h3>
            <ul className="space-y-2">
              {features.length > 0 ? features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              )) : (
                <>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">Extra thick positive plates for longer life</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">Superior deep discharge recovery</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">Factory charged, ready to use</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">Low maintenance design</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                    <span className="text-gray-700">Suitable for high ambient temperatures</span>
                  </li>
                </>
              )}
            </ul>

            {/* Certifications */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Certifications</p>
              <div className="flex gap-2">
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
