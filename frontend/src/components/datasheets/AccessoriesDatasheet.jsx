import React from 'react';
import { Package, Shield, CheckCircle } from 'lucide-react';

export default function AccessoriesDatasheet({ data }) {
  const specs = data.specifications || {};
  
  // Try to parse description as HTML or plain text
  const description = data.subtitle || data.description || '';
  
  return (
    <div className="bg-white text-gray-900 font-sans w-full max-w-[794px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold break-words">{data.model_name}</h1>
            <p className="text-orange-100 text-xs sm:text-sm mt-1">{data.category?.toUpperCase() || 'ACCESSORIES'}</p>
          </div>
          <div className="flex-shrink-0">
            <img src="https://www.musclegrid.in/wp-content/uploads/2024/07/MuscleGrid-Logo-White.png" alt="MuscleGrid" className="h-8 sm:h-10 object-contain" />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-4 sm:p-6">
        {/* Product Images Grid */}
        {data.images && data.images.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
              {/* Main Image */}
              <div className="col-span-2 bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                <img 
                  src={data.images[0]} 
                  alt={data.model_name}
                  className="w-full h-auto object-contain p-2 sm:p-4"
                  style={{ maxHeight: '250px' }}
                />
              </div>
              
              {/* Secondary Images */}
              {data.images.slice(1, 5).map((img, i) => (
                <div key={i} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 aspect-square">
                  <img 
                    src={img} 
                    alt={`${data.model_name} view ${i + 2}`}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
              ))}
            </div>
            
            {/* Image Count */}
            {data.images.length > 5 && (
              <p className="text-center text-gray-400 text-sm mt-2">
                +{data.images.length - 5} more images
              </p>
            )}
          </div>
        )}
        
        {/* Description */}
        {description && (
          <div className="mb-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
              Product Description
            </h3>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed break-words">{description}</p>
          </div>
        )}
        
        {/* Specifications - Mobile responsive */}
        {Object.keys(specs).length > 0 && (
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
              Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {Object.entries(specs).map(([key, value], i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:justify-between p-2 sm:p-3 bg-gray-50 rounded-lg gap-1">
                  <span className="text-gray-600 text-xs sm:text-sm font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <span className="text-gray-900 font-medium text-xs sm:text-sm break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Features */}
        {data.features && data.features.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3">Key Features</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Warranty & Certifications */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6">
          <div className="p-3 sm:p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-green-800 font-semibold text-sm sm:text-base">{data.warranty || '1 Year Warranty'}</p>
                <p className="text-green-600 text-xs">Manufacturer Guarantee</p>
              </div>
            </div>
          </div>
          
          <div className="p-3 sm:p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-blue-800 font-semibold text-sm sm:text-base">Quality Assured</p>
                <p className="text-blue-600 text-xs">Tested & Verified</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-auto p-3 sm:p-4 bg-gray-100 border-t">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-gray-700">MuscleGrid</p>
            <p>+91 9999036254 | service@musclegrid.in</p>
          </div>
          <p>www.musclegrid.in</p>
        </div>
      </div>
    </div>
  );
}
