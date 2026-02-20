'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { ProductCode, LanguageCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';
import { showSuccess, showError } from '@/lib/notifications';

interface GlossaryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  // Source text (원문)
  sourceText?: string;
  onSourceTextChange?: (value: string) => void;
  // Context
  context?: string;
  onContextChange?: (value: string) => void;
  // Products (multiple selection)
  productCodes?: string[];
  onProductCodesChange?: (codes: string[]) => void;
  // Legacy single product (for backward compatibility)
  productCode?: ProductCode | '';
  onProductCodeChange?: (value: ProductCode | '') => void;
  // Submit
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  // AI retranslate props
  selectedLanguages?: LanguageCode[];
  onRetranslate?: (sourceText: string, context: string, languages: LanguageCode[]) => Promise<void>;
}

export default function GlossaryFormModal({
  isOpen,
  onClose,
  title,
  sourceText = '',
  onSourceTextChange = () => {},
  context = '',
  onContextChange = () => {},
  productCodes = [],
  onProductCodesChange,
  productCode = '',
  onProductCodeChange = () => {},
  onSubmit,
  submitLabel = '추가',
  isSubmitting = false,
  selectedLanguages = [],
  onRetranslate,
}: GlossaryFormModalProps) {
  const { products } = useProducts();
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isRetranslating, setIsRetranslating] = useState(false);

  const selectedProducts = onProductCodesChange ? productCodes : productCode ? [productCode] : [];

  const handleProductToggle = (code: string) => {
    if (onProductCodesChange) {
      const newSelection = selectedProducts.includes(code)
        ? selectedProducts.filter((c) => c !== code)
        : [...selectedProducts, code];
      onProductCodesChange(newSelection);
    } else {
      onProductCodeChange(code as ProductCode);
    }
  };

  const handleSelectAll = () => {
    if (onProductCodesChange) {
      if (selectedProducts.length === products.length) {
        onProductCodesChange([]);
      } else {
        onProductCodesChange(products.map((p) => p.code));
      }
    }
  };

  const handleRetranslate = async () => {
    if (!sourceText.trim() || selectedLanguages.length === 0 || !onRetranslate) return;

    setIsRetranslating(true);
    try {
      await onRetranslate(sourceText, context, selectedLanguages);
      showSuccess('AI 재번역이 완료되었습니다.');
    } catch (error) {
      console.error('Retranslate error:', error);
      showError('AI 재번역 중 오류가 발생했습니다.');
    } finally {
      setIsRetranslating(false);
    }
  };

  const isAllSelected = products.length > 0 && selectedProducts.length === products.length;
  const isIndeterminate = selectedProducts.length > 0 && selectedProducts.length < products.length;

  const selectedProductNames = selectedProducts
    .map((code) => products.find((p) => p.code === code)?.name || code)
    .join(', ');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title ?? '용어 추가'}>
      <div className="space-y-4">
        {/* 제품 다중 선택 드롭다운 */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">제품</label>
          <button
            type="button"
            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-left bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <span className={selectedProducts.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
              {selectedProducts.length === 0
                ? '제품 선택'
                : selectedProducts.length === products.length
                  ? '전체 제품'
                  : `${selectedProductNames} (${selectedProducts.length}개)`}
            </span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {isProductDropdownOpen ? '▲' : '▼'}
            </span>
          </button>

          {isProductDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsProductDropdownOpen(false)} />
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2">
                  <label className="flex items-center cursor-pointer hover:bg-gray-100 rounded px-1 py-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">전체</span>
                  </label>
                </div>
                <div className="py-1">
                  {products.map((product) => (
                    <label
                      key={product.code}
                      className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.code)}
                        onChange={() => handleProductToggle(product.code)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{product.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 용어 + 재번역 버튼 */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="용어 *"
              value={sourceText}
              onChange={(e) => onSourceTextChange(e.target.value)}
              placeholder="예: Login"
            />
          </div>
          {/* AI 재번역 버튼 */}
          {onRetranslate && selectedLanguages.length > 0 && (
            <button
              type="button"
              onClick={handleRetranslate}
              disabled={isRetranslating || !sourceText.trim()}
              className="mb-0.5 p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="AI 재번역"
            >
              <svg
                className={`w-5 h-5 ${isRetranslating ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
        </div>

        <Input
          label="문맥/설명"
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="이 용어가 사용되는 상황을 설명하세요 (AI 번역에 참고됩니다)"
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting || isRetranslating}>
            취소
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting} disabled={isRetranslating}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
