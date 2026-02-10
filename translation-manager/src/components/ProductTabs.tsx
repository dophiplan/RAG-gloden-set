'use client';

import { PRODUCTS, ProductCode } from '@/types';

interface ProductTabsProps {
  selectedProduct: ProductCode | null;
  onProductChange: (product: ProductCode | null) => void;
  showAll?: boolean;
}

export default function ProductTabs({
  selectedProduct,
  onProductChange,
  showAll = true,
}: ProductTabsProps) {
  const products = Object.entries(PRODUCTS) as [ProductCode, string][];

  return (
    <div className="bg-transparent border-b-2 border-[#C7D2FE]">
      <nav className="-mb-px flex space-x-1 overflow-x-auto px-3 py-2" aria-label="Tabs">
        {showAll && (
          <button
            onClick={() => onProductChange(null)}
            className={`
              whitespace-nowrap py-3 px-6 border-b-3 font-bold text-sm transition-all duration-200 rounded-t-xl
              ${
                selectedProduct === null
                  ? 'border-[#818CF8] text-[#4F46E5] bg-gradient-to-t from-[#E0E7FF] to-white shadow-lg transform translate-y-0.5'
                  : 'border-transparent text-[#64748B] hover:text-[#4F46E5] hover:bg-white/50'
              }
            `}
            style={selectedProduct === null ? {
              boxShadow: '0 -2px 8px rgba(123, 201, 111, 0.2)'
            } : undefined}
          >
            전체
          </button>
        )}
        {products.map(([code, name]) => (
          <button
            key={code}
            onClick={() => onProductChange(code)}
            className={`
              whitespace-nowrap py-3 px-6 border-b-3 font-bold text-sm transition-all duration-200 rounded-t-xl
              ${
                selectedProduct === code
                  ? 'border-[#818CF8] text-[#4F46E5] bg-gradient-to-t from-[#E0E7FF] to-white shadow-lg transform translate-y-0.5'
                  : 'border-transparent text-[#64748B] hover:text-[#4F46E5] hover:bg-white/50'
              }
            `}
            style={selectedProduct === code ? {
              boxShadow: '0 -2px 8px rgba(123, 201, 111, 0.2)'
            } : undefined}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
