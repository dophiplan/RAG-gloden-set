'use client';

import { useState } from 'react';
import { ProductCode, PRODUCTS } from '@/types';

interface MultiProductSelectProps {
  selectedProducts: ProductCode[];
  onProductsChange: (products: ProductCode[]) => void;
  disabled?: boolean;
  className?: string;
}

export default function MultiProductSelect({
  selectedProducts,
  onProductsChange,
  disabled = false,
  className = '',
}: MultiProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleProduct = (productCode: ProductCode) => {
    if (selectedProducts.includes(productCode)) {
      onProductsChange(selectedProducts.filter((p) => p !== productCode));
    } else {
      onProductsChange([...selectedProducts, productCode]);
    }
  };

  const selectAll = () => {
    onProductsChange(Object.keys(PRODUCTS) as ProductCode[]);
  };

  const clearAll = () => {
    onProductsChange([]);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left bg-white border rounded-lg
          flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-400 cursor-pointer'}
          ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}
        `}
      >
        <span className="text-sm text-gray-700">
          {selectedProducts.length === 0
            ? '제품 선택'
            : selectedProducts.length === Object.keys(PRODUCTS).length
            ? '전체 제품'
            : `${selectedProducts.length}개 제품 선택됨`}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-auto">
            <div className="sticky top-0 bg-gray-50 border-b px-3 py-2 flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                전체 선택
              </button>
              <span className="text-xs text-gray-400">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-gray-600 hover:text-gray-800 font-medium"
              >
                전체 해제
              </button>
            </div>
            {Object.entries(PRODUCTS).map(([code, name]) => (
              <label
                key={code}
                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(code as ProductCode)}
                  onChange={() => toggleProduct(code as ProductCode)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700">{name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
