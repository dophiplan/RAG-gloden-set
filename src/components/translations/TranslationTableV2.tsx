'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import TranslationRow from '@/components/translations/table/TranslationRow';
import ResizableTableHeader from '@/components/translations/table/ResizableTableHeader';
import TranslationTablePagination from '@/components/translations/table/TranslationTablePagination';
import {
  Translation,
  TranslationResult,
  TranslationStatus,
  LanguageCode,
  ProductCode,
  PriorityLevel,
  Scope,
} from '@/types';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
import { useLanguages } from '@/hooks/useReferenceData';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationTableV2Props {
  translations: TranslationWithResults[];
  selectedProduct?: ProductCode | null;
  selectedLanguageColumns: LanguageCode[] | null;
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate: (
    translationId: string,
    languageCode: LanguageCode,
    text: string
  ) => Promise<void>;
  onSourceTextUpdate: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate: (translationId: string, scope: Scope | null) => Promise<void>;
  onVersionUpdate: (translationId: string, version: string) => Promise<void>;
  onPriorityUpdate?: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onPriorityChange?: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onNotesUpdate: (translationId: string, notes: string) => Promise<void>;
  onDevCodeUpdate?: (translationId: string, devCode: string) => Promise<void>;
  onPlatformsUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onPlatformUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onScreenUpdate?: (translationId: string, screenCode: string) => Promise<void>;
  onDelete: (id: string) => void;
  onAddToGlossary?: (translation: any) => void;
  onHistoryClick?: (translationId: string) => void;
  onRefresh?: () => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onToggleSelectAll?: () => void;
  onToggleSelect?: (id: string) => void;
  selectedIds?: string[];
  selectedTranslations?: any[];
  isAllSelected?: boolean;
  loading?: boolean;
  page?: number;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  availableLanguages?: LanguageCode[];
  onLanguageColumnsChange?: (languages: LanguageCode[] | null) => void;
}

/**
 * 마이그레이션 스타일 Translation Table
 * 가로 스크롤 없이 한 화면에 표시
 */
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
  onAddToGlossary,
  onHistoryClick,
  onRefresh,
  onSelectionChange,
  selectedIds: externalSelectedIds,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TranslationTableV2Props) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'basic' | 'translations'>('basic');
  const { languagesMap } = useLanguages();

  // 언어 필터와 연동 - 선택된 언어만 표시 (없으면 모든 언어)
  const displayLanguages = useMemo(() => {
    const allLanguages = ['en', 'ja', 'zh', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de', 'it'] as LanguageCode[];
    
    // 선택된 언어가 있으면 필터링, 없으면 모든 언어 표시
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      // 고정된 순서로 필터링된 언어 반환
      return allLanguages.filter(lang => selectedLanguageColumns.includes(lang));
    }
    
    // 선택된 언어가 없으면 모든 언어 표시
    return allLanguages;
  }, [selectedLanguageColumns]);

  const selectedIds =
    externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;

  useEffect(() => {
    if (externalSelectedIds !== undefined) {
      setInternalSelectedIds(externalSelectedIds);
    }
  }, [externalSelectedIds]);

  const handleSelectionChange = useCallback(
    (newSelectedIds: string[]) => {
      setInternalSelectedIds(newSelectedIds);
      onSelectionChange?.(newSelectedIds);
    },
    [onSelectionChange]
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === translations.length) {
      handleSelectionChange([]);
    } else {
      handleSelectionChange(translations.map((t) => t.id));
    }
  };

  const toggleSelect = useCallback(
    (id: string) => {
      const newSelected = selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id];
      setInternalSelectedIds(newSelected);
      onSelectionChange?.(newSelected);
    },
    [selectedIds, onSelectionChange]
  );

  // 마이그레이션 스타일 뷰: 기본정보 | 번역정보
  return (
    <div className="space-y-3">
      {/* 뷰 토글 - 마이그레이션 스타일 (상단 우측) */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveView('basic')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'basic'
                ? 'bg-white text-[#818CF8] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ● 기본 정보
          </button>
          <button
            onClick={() => setActiveView('translations')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'translations'
                ? 'bg-white text-[#818CF8] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ● 번역 정보{displayLanguages.length > 0 && ` (${displayLanguages.length})`}
          </button>
        </div>
      </div>

      {/* 테이블 - 마이그레이션 스타일 (가로 스크롤 없음) */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-xs whitespace-nowrap">
          <ResizableTableHeader
            page={activeView === 'basic' ? 'info' : 'translations'}
            displayLanguages={displayLanguages}
            allSelected={selectedIds.length === (translations || []).length && translations.length > 0}
            onToggleSelectAll={toggleSelectAll}
            languagesMap={languagesMap}
          />
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={activeView === 'basic' ? 10 : 3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : (translations || []).length === 0 ? (
              <tr>
                <td colSpan={activeView === 'basic' ? 10 : 3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  번역 항목이 없습니다.
                </td>
              </tr>
            ) : (
              (translations || []).map((translation) => (
                <TranslationRow
                  key={translation.id}
                  page={activeView === 'basic' ? 'info' : 'translations'}
                  translation={translation}
                  isSelected={selectedIds.includes(translation.id)}
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
                  onAddToGlossary={onAddToGlossary}
                  onHistoryClick={onHistoryClick}
                  onRefresh={onRefresh}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {onPageChange && (
        <TranslationTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
});
