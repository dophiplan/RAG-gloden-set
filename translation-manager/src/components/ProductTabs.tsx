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
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
        {showAll && (
          <button
            onClick={() => onProductChange(null)}
            className={`
              whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
              ${
                selectedProduct === null
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            전체
          </button>
        )}
        {products.map(([code, name]) => (
          <button
            key={code}
            onClick={() => onProductChange(code)}
            className={`
              whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
              ${
                selectedProduct === code
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}
