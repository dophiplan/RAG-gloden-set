'use client';

import { useState, useRef, useEffect } from 'react';
import { ProductCode, TranslationProduct } from '@/types';
import Badge from '@/components/ui/Badge';
import { useProducts } from '@/hooks/useReferenceData';

interface ProductWithVersion {
  code: ProductCode;
  version: string;
}

interface EditableProductVersionCellProps {
  products: TranslationProduct[];
  onSave: (products: ProductWithVersion[]) => Promise<void> | void;
  disabled?: boolean;
}

export default function EditableProductVersionCell({
  products,
  onSave,
  disabled = false,
}: EditableProductVersionCellProps) {
  const { products: allProducts, productsMap } = useProducts();
  const [isEditing, setIsEditing] = useState(false);
  const [editProducts, setEditProducts] = useState<ProductWithVersion[]>(
    products.map((p) => ({ code: p.product_code, version: p.version || '' }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductCode[]>(
    allProducts.map(p => p.code as ProductCode)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditProducts(products.map((p) => ({ code: p.product_code, version: p.version || '' })));
  }, [products]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleSave();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, editProducts]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await onSave(editProducts.filter((p) => p.code));
    } catch (error) {
      console.error('Error saving products:', error);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditProducts(products.map((p) => ({ code: p.product_code, version: p.version || '' })));
    setIsEditing(false);
  };

  const addProduct = (productCode: ProductCode) => {
    setEditProducts([...editProducts, { code: productCode, version: '' }]);
  };

  const removeProduct = (index: number) => {
    setEditProducts(editProducts.filter((_, i) => i !== index));
  };

  const updateVersion = (index: number, version: string) => {
    const newProducts = [...editProducts];
    newProducts[index].version = version;
    setEditProducts(newProducts);
  };

  const getAvailableProductsToAdd = () => {
    const usedCodes = editProducts.map((p) => p.code);
    return availableProducts.filter((code) => !usedCodes.includes(code));
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className="min-w-[300px] space-y-2">
        {editProducts.map((product, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <span className="text-sm font-medium text-gray-700 min-w-[60px]">
              {productsMap[product.code]?.name || product.code}
            </span>
            <input
              type="text"
              value={product.version}
              onChange={(e) => updateVersion(index, e.target.value)}
              placeholder="버전 (예: 2.0.0)"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => removeProduct(index)}
              className="text-red-600 hover:text-red-800"
              title="제거"
            >
              ✕
            </button>
          </div>
        ))}

        {getAvailableProductsToAdd().length > 0 && (
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  addProduct(e.target.value as ProductCode);
                  e.target.value = '';
                }
              }}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
              disabled={isSaving}
            >
              <option value="">+ 제품 추가</option>
              {getAvailableProductsToAdd().map((code) => (
                <option key={code} value={code}>
                  {productsMap[code]?.name || code}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => !disabled && setIsEditing(true)}
      className={`
        min-h-[32px] px-2 py-1 rounded
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100'}
      `}
      title="더블클릭하여 편집"
    >
      {products.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-1">
              <Badge variant="info">{productsMap[product.product_code]?.name || product.product_code}</Badge>
              {product.version && (
                <span className="text-xs text-blue-600 font-mono">v{product.version}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic">제품 미지정</span>
      )}
    </div>
  );
}
