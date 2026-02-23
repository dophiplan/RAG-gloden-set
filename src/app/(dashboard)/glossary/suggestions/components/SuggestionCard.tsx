'use client';

import { LanguageCode, ProductCode } from '@/types';
import { useLanguages, useProducts } from '@/hooks/useReferenceData';
import { SuggestionWithUI } from '../hooks/useSuggestionData';

interface SuggestionCardProps {
  suggestion: SuggestionWithUI;
  actualIndex: number;
  onToggleSelect: (index: number) => void;
  onToggleSamples: (index: number) => void;
  onUpdateContext: (index: number, context: string) => void;
  onGenerateContext: (index: number) => void;
  onUpdateProducts: (index: number, productCode: ProductCode) => void;
}

export default function SuggestionCard({
  suggestion,
  actualIndex,
  onToggleSelect,
  onToggleSamples,
  onUpdateContext,
  onGenerateContext,
  onUpdateProducts,
}: SuggestionCardProps) {
  const { languages, languagesMap } = useLanguages();
  const { products, productsMap } = useProducts();

  return (
    <div
      className={`p-6 ${suggestion.selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
    >
      <div className="flex gap-4">
        {/* 체크박스 */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={suggestion.selected}
            onChange={() => onToggleSelect(actualIndex)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {/* 용어 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">용어 (한국어)</label>
              <div className="text-sm font-medium text-gray-900 mt-1">
                {suggestion.term}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">번역</label>
              <div className="text-sm font-medium text-blue-600 mt-1">
                {suggestion.translation}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">언어</label>
              <div className="text-sm text-gray-700 mt-1">
                {languagesMap[suggestion.language_code as LanguageCode]?.name || suggestion.language_code}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">빈도</label>
              <div className="text-sm text-gray-700 mt-1">
                {suggestion.frequency}회
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">신뢰도</label>
              <div className="text-sm text-gray-700 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  suggestion.confidence >= 0.8
                    ? 'bg-green-100 text-green-800'
                    : suggestion.confidence >= 0.6
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* 사용 예시 */}
          <div>
            <button
              onClick={() => onToggleSamples(actualIndex)}
              className="text-xs text-blue-600 hover:underline"
            >
              {suggestion.showSamples
                ? '예시 숨기기'
                : `사용 예시 ${suggestion.sample_contexts.length}개 보기`}
            </button>
            {suggestion.showSamples && (
              <div className="mt-2 space-y-1">
                {suggestion.sample_contexts.map((ctx, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-600 pl-3 border-l-2 border-gray-300 py-1"
                  >
                    {ctx}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 설명 입력 */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs font-medium text-gray-700">
                설명 (선택사항)
              </label>
              <button
                onClick={() => onGenerateContext(actualIndex)}
                disabled={suggestion.generating}
                className="text-xs text-blue-600 hover:underline disabled:text-gray-400"
              >
                {suggestion.generating ? '생성 중...' : '💡 AI 생성'}
              </button>
            </div>
            <textarea
              value={suggestion.context}
              onChange={(e) => onUpdateContext(actualIndex, e.target.value)}
              placeholder="이 용어를 어떻게 사용해야 하는지 설명해주세요..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* 제품 선택 */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">
              적용 제품 (선택사항)
            </label>
            <div className="flex flex-wrap gap-3">
              {products.map((product) => (
                <label
                  key={product.code}
                  className="inline-flex items-center cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={suggestion.product_codes.includes(product.code as ProductCode)}
                    onChange={() => onUpdateProducts(actualIndex, product.code as ProductCode)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {product.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
