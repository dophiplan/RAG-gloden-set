'use client';

import { useState, useRef, useEffect } from 'react';
import { ProductCode, PRODUCTS } from '@/types';
import Badge from '@/components/ui/Badge';
import MultiProductSelect from '@/components/MultiProductSelect';

interface EditableProductsCellProps {
  products: ProductCode[];
  onSave: (products: ProductCode[]) => Promise<void> | void;
  disabled?: boolean;
}

export default function EditableProductsCell({
  products,
  onSave,
  disabled = false,
}: EditableProductsCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<ProductCode[]>(products);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(products);
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
  }, [isEditing, editValue]);

  const handleSave = async () => {
    if (isSaving) return;

    // Check if products changed
    const productsChanged =
      editValue.length !== products.length ||
      editValue.some((p) => !products.includes(p));

    if (productsChanged) {
      setIsSaving(true);
      try {
        await onSave(editValue);
      } catch (error) {
        console.error('Error saving products:', error);
        setEditValue(products);
      } finally {
        setIsSaving(false);
      }
    }

    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(products);
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div ref={containerRef} onKeyDown={handleKeyDown} className="min-w-[200px]">
        <MultiProductSelect
          selectedProducts={editValue}
          onProductsChange={setEditValue}
          disabled={isSaving}
        />
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(products);
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
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
        <div className="flex flex-wrap gap-1">
          {products.map((code) => (
            <Badge key={code} variant="info">
              {PRODUCTS[code]}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic">제품 미지정</span>
      )}
    </div>
  );
}
