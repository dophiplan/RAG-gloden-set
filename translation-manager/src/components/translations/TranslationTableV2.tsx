'use client';

import { useState, useCallback, memo, useMemo } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import TranslationSourceBadge from '@/components/translations/TranslationSourceBadge';
import { Translation, TranslationResult, TranslationStatus, LanguageCode, STATUS_COLORS, ProductCode, PriorityLevel, Scope } from '@/types';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
import { showSuccess, showError } from '@/lib/notifications';
import { useProducts, useLanguages } from '@/hooks/useReferenceData';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationTableV2Props {
  translations: TranslationWithResults[];
  selectedProduct: ProductCode | null;
  selectedLanguageColumns: LanguageCode[] | null;
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate: (translationId: string, scope: Scope | null) => Promise<void>;
  onVersionUpdate: (translationId: string, version: string) => Promise<void>;
  onPriorityUpdate: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onNotesUpdate: (translationId: string, notes: string) => Promise<void>;
  onDevCodeUpdate: (translationId: string, devCode: string) => Promise<void>;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

// Removed hardcoded TARGET_LANGUAGES - now calculated dynamically based on selected product

const STATUS_ROW_BG: Record<TranslationStatus, string> = {
  pending: 'bg-yellow-50',
  in_progress: 'bg-green-50',
  reviewed: 'bg-white',
  deployed: 'bg-gray-50',
};

// Memoized row component to prevent unnecessary re-renders
interface TranslationRowProps {
  translation: TranslationWithResults;
  isSelected: boolean;
  showProductColumn: boolean;
  displayLanguages: LanguageCode[];
  onToggleSelect: (id: string) => void;
  onStatusChange: TranslationTableV2Props['onStatusChange'];
  onTranslationUpdate: TranslationTableV2Props['onTranslationUpdate'];
  onSourceTextUpdate: TranslationTableV2Props['onSourceTextUpdate'];
  onContextUpdate: TranslationTableV2Props['onContextUpdate'];
  onScopeUpdate: TranslationTableV2Props['onScopeUpdate'];
  onVersionUpdate: TranslationTableV2Props['onVersionUpdate'];
  onPriorityUpdate: TranslationTableV2Props['onPriorityUpdate'];
  onNotesUpdate: TranslationTableV2Props['onNotesUpdate'];
  onDevCodeUpdate: TranslationTableV2Props['onDevCodeUpdate'];
  onDelete: TranslationTableV2Props['onDelete'];
}

const TranslationRow = memo(function TranslationRow({
  translation,
  isSelected,
  showProductColumn,
  displayLanguages,
  onToggleSelect,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onContextUpdate,
  onScopeUpdate,
  onVersionUpdate,
  onPriorityUpdate,
  onNotesUpdate,
  onDevCodeUpdate,
  onDelete,
}: TranslationRowProps) {
  const { productsMap } = useProducts();
  const statusInfo = STATUS_COLORS[translation.status];

  const getTranslationForLanguage = (languageCode: LanguageCode): string => {
    const result = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    return result?.translated_text || '';
  };

  const getTranslationResultForLanguage = (languageCode: LanguageCode): TranslationResult | undefined => {
    return translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
  };

  // Get product names from translation_products
  const productNames = translation.translation_products?.map(tp => {
    const productCode = tp.product_code;
    return productsMap[productCode]?.name || productCode;
  }).join(', ') || '-';

  return (
    <tr className={`${STATUS_ROW_BG[translation.status]} hover:bg-gray-100`}>
      <td className="px-2 py-2 align-top">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(translation.id)}
          className="rounded border-gray-300"
        />
      </td>
      {showProductColumn && (
        <td className="px-2 py-2 align-top">
          <div className="text-xs truncate">{productNames}</div>
        </td>
      )}
      <td className="px-2 py-2 align-top">
        <select
          value={translation.scope || ''}
          onChange={(e) => {
            const value = e.target.value;
            onScopeUpdate(
              translation.id,
              value === '' ? null : (value as Scope)
            );
          }}
          className="text-xs border rounded px-1 py-1 w-full bg-white"
        >
          <option value="">-</option>
          <option value="SaaS">SaaS</option>
          <option value="Solution">Solution</option>
          <option value="정부과제">정부과제</option>
          <option value="기타">기타</option>
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <select
          value={translation.priority || '중'}
          onChange={(e) => onPriorityUpdate(translation.id, e.target.value as PriorityLevel)}
          className="text-xs border rounded px-1 py-1 w-full bg-white"
        >
          <option value="긴급">긴급</option>
          <option value="상">상</option>
          <option value="중">중</option>
          <option value="하">하</option>
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="text-xs">
          <EditableCell
            value={translation.version || ''}
            onSave={(newVersion) => onVersionUpdate(translation.id, newVersion)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.context || ''}
            onSave={(newContext) => onContextUpdate(translation.id, newContext)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.source_text}
            onSave={(newText) => onSourceTextUpdate(translation.id, newText)}
            placeholder="KEY/id"
          />
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.dev_code || ''}
            onSave={(newCode) => onDevCodeUpdate(translation.id, newCode)}
            placeholder="dev_key_001"
            className="text-xs text-gray-600 font-mono"
          />
        </div>
      </td>
      {displayLanguages.map((lang) => {
        const result = getTranslationResultForLanguage(lang);
        return (
          <td key={lang} className="px-2 py-2 align-top">
            <div className="text-xs">
              <EditableCell
                value={getTranslationForLanguage(lang)}
                onSave={(newText) => onTranslationUpdate(translation.id, lang, newText)}
                placeholder="-"
              />
              {result?.source_type && (
                <div className="mt-1">
                  <TranslationSourceBadge sourceType={result.source_type} />
                </div>
              )}
            </div>
          </td>
        );
      })}
      <td className="px-2 py-2 align-top">
        <select
          value={translation.status}
          onChange={(e) =>
            onStatusChange(translation.id, e.target.value as TranslationStatus)
          }
          className={`text-xs border rounded px-1 py-1 w-full ${statusInfo.bg} ${statusInfo.text}`}
        >
          <option value="pending">요청</option>
          <option value="reviewed">검수</option>
          <option value="deployed">반영</option>
        </select>
      </td>
      <td className="px-2 py-2 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.notes || ''}
            onSave={(newNotes) => onNotesUpdate(translation.id, newNotes)}
            placeholder="-"
          />
        </div>
      </td>
    </tr>
  );
});

export default memo(function TranslationTableV2({
  translations,
  selectedProduct,
  selectedLanguageColumns,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onContextUpdate,
  onScopeUpdate,
  onVersionUpdate,
  onPriorityUpdate,
  onNotesUpdate,
  onDevCodeUpdate,
  onDelete,
  onRefresh,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TranslationTableV2Props) {
  const { languagesMap } = useLanguages();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const showProductColumn = selectedProduct === null;

  // Calculate which languages to display based on user filter ONLY
  const displayLanguages = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();

    // If user has selected specific languages to display, filter to those
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      return allLanguages.filter(lang => selectedLanguageColumns.includes(lang));
    }

    return allLanguages;
  }, [selectedLanguageColumns]);

  const toggleSelectAll = () => {
    if (selectedIds.length === translations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(translations.map((t) => t.id));
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleBulkStatusChange = async (status: TranslationStatus) => {
    if (selectedIds.length === 0) return;

    try {
      const response = await fetch('/api/translations/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });

      if (response.ok) {
        onRefresh();
        setSelectedIds([]);
        showSuccess(`${selectedIds.length}개 항목의 상태가 변경되었습니다.`);
      } else {
        showError('상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error bulk updating status:', error);
      showError('상태 변경 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-blue-700">
              {selectedIds.length}개 선택됨
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('reviewed')}
            >
              검수 완료로 변경
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('deployed')}
            >
              반영 완료로 변경
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-2 py-2 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === translations.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    aria-label="모든 항목 선택"
                  />
                </th>
                {showProductColumn && (
                  <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-28">
                    제품
                  </th>
                )}
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-24">
                  제품분류
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-20">
                  중요도
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-20">
                  버전
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                  설명
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-48">
                  KEY/id
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                  개발자 코드
                </th>
                {displayLanguages.map((lang) => (
                  <th
                    scope="col"
                    key={lang}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-32 cursor-help"
                    title={languagesMap[lang]?.name || lang}
                  >
                    {lang.toUpperCase()}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-24">
                  번역 상태
                </th>
                <th scope="col" className="px-2 py-2 text-left text-xs font-medium text-gray-700 w-32">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={showProductColumn ? 16 : 15} className="px-3 py-12 text-center text-sm text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : translations.length === 0 ? (
                <tr>
                  <td colSpan={showProductColumn ? 16 : 15} className="px-3 py-12 text-center text-sm text-gray-500">
                    번역 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                translations.map((translation) => (
                  <TranslationRow
                    key={translation.id}
                    translation={translation}
                    isSelected={selectedIds.includes(translation.id)}
                    showProductColumn={showProductColumn}
                    displayLanguages={displayLanguages}
                    onToggleSelect={toggleSelect}
                    onStatusChange={onStatusChange}
                    onTranslationUpdate={onTranslationUpdate}
                    onSourceTextUpdate={onSourceTextUpdate}
                    onContextUpdate={onContextUpdate}
                    onScopeUpdate={onScopeUpdate}
                    onVersionUpdate={onVersionUpdate}
                    onPriorityUpdate={onPriorityUpdate}
                    onNotesUpdate={onNotesUpdate}
                    onDevCodeUpdate={onDevCodeUpdate}
                    onDelete={onDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              이전
            </Button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}

    </div>
  );
});
