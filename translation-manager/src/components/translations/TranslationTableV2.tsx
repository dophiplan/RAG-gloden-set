'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import TranslationSourceBadge from '@/components/translations/TranslationSourceBadge';
import { Translation, TranslationResult, TranslationStatus, LanguageCode, STATUS_COLORS, ProductCode, PriorityLevel, Scope } from '@/types';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
import { showSuccess, showError } from '@/lib/notifications';
import { useProducts, useLanguages, usePlatforms } from '@/hooks/useReferenceData';

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
  onPlatformsUpdate: (translationId: string, platformCodes: string[]) => Promise<void>;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  selectedIds?: string[];
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

// Removed hardcoded TARGET_LANGUAGES - now calculated dynamically based on selected product

const STATUS_ROW_COLORS: Record<TranslationStatus, { bg: string; hover: string }> = {
  re_request: { bg: '#FEF3C7', hover: '#FDE68A' },        // 재요청 - 노란색 (대시보드 통일)
  re_deploy_request: { bg: '#FEF3C7', hover: '#FDE68A' }, // 재반영요청 - 노란색 (대시보드 통일)
  pending: { bg: '#FEF3C7', hover: '#FDE68A' },           // 요청 - 노란색 (대시보드 통일)
  in_progress: { bg: '#DBEAFE', hover: '#BFDBFE' },       // 진행 중 - 파란색 (대시보드 통일)
  reviewed: { bg: '#F3F4F6', hover: '#E5E7EB' },          // 검수 - 회색 (대시보드 통일)
  deployed: { bg: '#D1FAE5', hover: '#A7F3D0' },          // 반영 - 연두색 (대시보드 통일)
  not_used: { bg: '#1F2937', hover: '#374151' },          // 사용안함 - 검은색 (대시보드 통일)
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
  onPlatformsUpdate: TranslationTableV2Props['onPlatformsUpdate'];
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
  onPlatformsUpdate,
  onDelete,
}: TranslationRowProps) {
  const { productsMap } = useProducts();
  const { platformsMap } = usePlatforms();
  const statusInfo = STATUS_COLORS[translation.status];
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);

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

  const [isHovered, setIsHovered] = useState(false);
  const colors = STATUS_ROW_COLORS[translation.status];
  const isNotUsed = translation.status === 'not_used';

  // Get selected platform codes
  const selectedPlatformCodes = translation.translation_platforms?.map(tp => tp.platform_code) || [];

  // Calculate platform completion rate
  const platformCompletions = translation.platform_completions || {};
  const completedCount = selectedPlatformCodes.filter(code => platformCompletions[code]?.completed).length;
  const totalCount = selectedPlatformCodes.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Handle platform selection
  const handlePlatformToggle = (platformCode: string) => {
    const newCodes = selectedPlatformCodes.includes(platformCode)
      ? selectedPlatformCodes.filter(code => code !== platformCode)
      : [...selectedPlatformCodes, platformCode];
    onPlatformsUpdate(translation.id, newCodes);
  };

  return (
    <tr
      style={{ backgroundColor: isHovered ? colors.hover : colors.bg }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`transition-colors duration-150 ${isNotUsed ? 'text-white line-through' : ''}`}
    >
      <td className="px-0.5 py-0.5 align-top">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(translation.id)}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-0.5 py-0.5 align-top">
        <select
          value={translation.priority || '중'}
          onChange={(e) => onPriorityUpdate(translation.id, e.target.value as PriorityLevel)}
          className="text-xs border rounded px-1 py-0.5 w-full bg-white"
        >
          <option value="긴급">긴급</option>
          <option value="상">상</option>
          <option value="중">중</option>
          <option value="하">하</option>
        </select>
      </td>
      {showProductColumn && (
        <td className="px-0.5 py-0.5 align-top">
          <div className="text-xs truncate">{productNames}</div>
        </td>
      )}
      <td className="px-0.5 py-0.5 align-top">
        <select
          value={translation.scope || ''}
          onChange={(e) => {
            const value = e.target.value;
            onScopeUpdate(
              translation.id,
              value === '' ? null : (value as Scope)
            );
          }}
          className="text-xs border rounded px-1 py-0.5 w-full bg-white"
        >
          <option value="">-</option>
          <option value="SaaS">SaaS</option>
          <option value="Solution">Solution</option>
          <option value="정부과제">정부과제</option>
          <option value="기타">기타</option>
        </select>
      </td>
      <td className="px-2 py-2 align-top relative">
        <div className="relative group">
          <button
            onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
            className="text-xs border rounded px-1 py-0.5 w-full bg-white text-left hover:bg-gray-50 flex items-center justify-between"
          >
            <span className="truncate">
              {selectedPlatformCodes.length > 0
                ? selectedPlatformCodes.map(code => platformsMap[code]?.name || code).join(', ')
                : '플랫폼 선택'}
            </span>
            <svg className="w-4 h-4 ml-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Platform completion rate tooltip */}
          {selectedPlatformCodes.length > 0 && (
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-30 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3">
              <div className="mb-2 font-semibold border-b border-gray-700 pb-2">
                플랫폼 반영 현황 ({completedCount}/{totalCount}) - {completionRate}%
              </div>
              <div className="space-y-1">
                {selectedPlatformCodes.map(code => {
                  const isCompleted = platformCompletions[code]?.completed;
                  const completedAt = platformCompletions[code]?.completed_at;
                  return (
                    <div key={code} className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        {isCompleted ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-500">○</span>
                        )}
                        {platformsMap[code]?.name || code}
                      </span>
                      {isCompleted && completedAt && (
                        <span className="text-gray-400 text-xs">
                          {new Date(completedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Arrow */}
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          )}
          {showPlatformDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPlatformDropdown(false)}
              />
              <div className="absolute z-20 mt-1 w-48 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {Object.values(platformsMap).sort((a, b) => a.display_order - b.display_order).map(platform => (
                  <label
                    key={platform.code}
                    className="flex items-center px-1.5 py-0.5 hover:bg-gray-50 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatformCodes.includes(platform.code)}
                      onChange={() => handlePlatformToggle(platform.code)}
                      className="rounded border-gray-300 text-blue-600 mr-2"
                    />
                    <span className="text-xs">{platform.name}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top">
        <div className="text-xs">
          <EditableCell
            value={translation.version || ''}
            onSave={(newVersion) => onVersionUpdate(translation.id, newVersion)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top">
        <div className="text-xs">
          <EditableCell
            value={translation.source_text}
            onSave={(newSourceText) => onSourceTextUpdate(translation.id, newSourceText)}
            placeholder="원문"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.context || ''}
            onSave={(newContext) => onContextUpdate(translation.id, newContext)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top">
        <div className="text-xs truncate">
          <EditableCell
            value={translation.dev_code || ''}
            onSave={(newCode) => onDevCodeUpdate(translation.id, newCode)}
            placeholder="KEY/id"
            className="text-xs text-gray-600 font-mono"
          />
        </div>
      </td>
      {displayLanguages.map((lang) => {
        const result = getTranslationResultForLanguage(lang);
        const currentText = getTranslationForLanguage(lang);
        return (
          <td key={lang} className="px-0.5 py-0.5 align-top">
            <div className="text-xs">
              <EditableCell
                value={currentText}
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

      <td className="px-0.5 py-0.5 align-top">
        <select
          value={translation.status}
          onChange={(e) =>
            onStatusChange(translation.id, e.target.value as TranslationStatus)
          }
          className={`text-xs border rounded px-1 py-0.5 w-full ${statusInfo.bg} ${statusInfo.text}`}
        >
          <option value="re_request">재요청</option>
          <option value="re_deploy_request">재반영요청</option>
          <option value="pending">요청</option>
          <option value="in_progress">진행 중</option>
          <option value="reviewed">검수</option>
          <option value="deployed">반영</option>
          <option value="not_used">사용안함</option>
        </select>
      </td>
      <td className="px-0.5 py-0.5 align-top">
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
  onPlatformsUpdate,
  onDelete,
  onRefresh,
  onSelectionChange,
  selectedIds: externalSelectedIds,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TranslationTableV2Props) {
  const { languagesMap } = useLanguages();
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const showProductColumn = selectedProduct === null;

  // Use external selectedIds if provided, otherwise use internal state
  const selectedIds = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;

  // Sync internal state with external prop when it changes
  useEffect(() => {
    if (externalSelectedIds !== undefined) {
      setInternalSelectedIds(externalSelectedIds);
    }
  }, [externalSelectedIds]);

  // 선택 변경 시 부모에게 알림
  const handleSelectionChange = useCallback((newSelectedIds: string[]) => {
    setInternalSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  }, [onSelectionChange]);

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
      handleSelectionChange([]);
    } else {
      handleSelectionChange(translations.map((t) => t.id));
    }
  };

  const toggleSelect = useCallback((id: string) => {
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    setInternalSelectedIds(newSelected);
    onSelectionChange?.(newSelected);
  }, [selectedIds, onSelectionChange]);

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full table-auto text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-0.5 py-0.5 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === translations.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    aria-label="모든 항목 선택"
                  />
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  중요도
                </th>
                {showProductColumn && (
                  <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                    제품
                  </th>
                )}
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  제품분류
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  플랫폼
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  버전
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  원문
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  설명
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  KEY/id
                </th>
                {displayLanguages.map((lang) => (
                  <th
                    scope="col"
                    key={lang}
                    className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700 cursor-help"
                    title={languagesMap[lang]?.name || lang}
                  >
                    {lang.toUpperCase()}
                  </th>
                ))}
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  번역 상태
                </th>
                <th scope="col" className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700">
                  비고
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={showProductColumn ? 18 : 17} className="px-1.5 py-12 text-center text-sm text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : translations.length === 0 ? (
                <tr>
                  <td colSpan={showProductColumn ? 18 : 17} className="px-1.5 py-12 text-center text-sm text-gray-500">
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
                    onPlatformsUpdate={onPlatformsUpdate}
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
