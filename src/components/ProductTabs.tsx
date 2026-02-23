'use client';

import { ProductCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';

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
  const { products } = useProducts();

  return (
    <div className="bg-transparent border-b-2 border-border">
      <nav className="-mb-px flex space-x-1 overflow-x-auto px-3 py-2" aria-label="Tabs">
        {showAll && (
          <button
            onClick={() => onProductChange(null)}
            className={`
              whitespace-nowrap py-3 px-6 border-b-3 font-bold text-sm transition-all duration-200 rounded-t-xl
              ${
                selectedProduct === null
                  ? 'border-primary text-primary-active bg-gradient-to-t from-primary-light to-white shadow-lg transform translate-y-0.5'
                  : 'border-transparent text-text-secondary hover:text-primary-active hover:bg-white/50'
              }
            `}
            style={selectedProduct === null ? {
              boxShadow: '0 -2px 8px rgba(123, 201, 111, 0.2)'
            } : undefined}
          >
            전체
          </button>
        )}
        {products.map((product) => (
          <button
            key={product.code}
            onClick={() => onProductChange(product.code)}
            className={`
              whitespace-nowrap py-3 px-6 border-b-3 font-bold text-sm transition-all duration-200 rounded-t-xl
              ${
                selectedProduct === product.code
                  ? 'border-primary text-primary-active bg-gradient-to-t from-primary-light to-white shadow-lg transform translate-y-0.5'
                  : 'border-transparent text-text-secondary hover:text-primary-active hover:bg-white/50'
              }
            `}
            style={selectedProduct === product.code ? {
              boxShadow: '0 -2px 8px rgba(123, 201, 111, 0.2)'
            } : undefined}
          >
            {product.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
