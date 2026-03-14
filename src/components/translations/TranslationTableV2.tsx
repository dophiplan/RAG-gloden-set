'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import TranslationRow from '@/components/translations/table/TranslationRow';
import ResizableTableHeader from '@/components/translations/table/ResizableTableHeader';
import TranslationTablePagination from '@/components/translations/table/TranslationTablePagination';
import { useResizableColumns } from '@/hooks/useResizableColumns';
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
 * Slide View Translation Table
 * Page 1: Basic Info (중요|제품|분류|플랫폼|버전|KEY/ID|원문|상태)
 * Page 2: Translations (원문|EN|JA|ZH|...)
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
  const [currentSlide, setCurrentSlide] = useState<'info' | 'translations'>('info');
  // Product column removed - determined by page context

  // Get display languages - 모든 선택된 언어 표시 (제한 없음)
  const displayLanguages = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();
    let langs: LanguageCode[] = [];
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      langs = allLanguages.filter((lang) => selectedLanguageColumns.includes(lang));
    } else {
      langs = allLanguages;
    }
    // 제한 제거 - 모든 선택된 언어 표시
    return langs;
  }, [selectedLanguageColumns]);

  // 슬라이드 뷰: 모두 균등분할 (가로 스크롤 없음)
  const infoPageWidths = useMemo(() => ({
    // 기본정보 뷰 - 고정 컬럼들
    checkbox: 28,
    priority: 30,
    scope: 40,
    platform: 46,
    version: 36,
    devCode: 55,
    sourceText: 100,
    context: 60,
    status: 52,
    actions: 65,
  }), []);

  const translationsPageWidths = useMemo(() => {
    // 번역 뷰 - 원문 + 모든 언어 균등분할
    const availableWidth = 1200; // 1512 - 사이드바(256) - 패딩(32) - 여유(24)
    const fixedWidth = 28 + 65; // checkbox + actions
    const variableCount = 1 + displayLanguages.length; // sourceText + languages
    const colWidth = Math.floor((availableWidth - fixedWidth) / variableCount);
    
    const widths: { [key: string]: number } = {
      checkbox: 28,
      sourceText: colWidth,
    };
    
    displayLanguages.forEach((lang) => {
      widths[`lang_${lang}`] = colWidth;
    });
    
    widths['actions'] = 65;
    return widths;
  }, [displayLanguages]);

  const { columnWidths: infoColumnWidths, startResize: startResizeInfo, resize: resizeInfo, stopResize: stopResizeInfo } = useResizableColumns({
    defaultWidths: infoPageWidths,
    minWidths: {
      checkbox: 28,
      priority: 30,
      product: 50,
      scope: 40,
      platform: 46,
      version: 36,
      devCode: 55,
      sourceText: 60,
      context: 50,
      status: 52,
      actions: 65,
    },
    storageKey: 'translation-table-info-widths-v1',
  });

  const { columnWidths: transColumnWidths, startResize: startResizeTrans, resize: resizeTrans, stopResize: stopResizeTrans } = useResizableColumns({
    defaultWidths: translationsPageWidths,
    minWidths: {
      checkbox: 28,
      sourceText: 60,
      actions: 65,
    },
    storageKey: `translation-table-trans-widths-v1-lang${displayLanguages.length}`,
  });

  const columnWidths = currentSlide === 'info' ? infoColumnWidths : transColumnWidths;
  const startResize = currentSlide === 'info' ? startResizeInfo : startResizeTrans;
  const resize = currentSlide === 'info' ? resizeInfo : resizeTrans;
  const stopResize = currentSlide === 'info' ? stopResizeInfo : stopResizeTrans;

  // Reset column widths when slide changes
  useEffect(() => {
    console.log('[TranslationTableV2] currentSlide changed:', currentSlide);
    console.log('[TranslationTableV2] displayLanguages:', displayLanguages);
    console.log('[TranslationTableV2] columnWidths:', currentSlide === 'info' ? infoColumnWidths : transColumnWidths);
  }, [currentSlide, displayLanguages, infoColumnWidths, transColumnWidths]);

  // Global mouse handlers for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e.clientX);
    const handleMouseUp = () => stopResize();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resize, stopResize]);

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

  // 슬라이드 뷰: 기본정보 | 번역정보
  return (
    <div className="space-y-3">
      {/* 슬라이드 토글 */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setCurrentSlide('info')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentSlide === 'info'
                ? 'bg-white text-[#818CF8] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ● 기본 정보
          </button>
          <button
            onClick={() => setCurrentSlide('translations')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentSlide === 'translations'
                ? 'bg-white text-[#818CF8] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ● 번역 정보{displayLanguages.length > 0 && ` (${displayLanguages.length})`}
          </button>
        </div>
      </div>

      {/* 슬라이드 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-xs table-fixed">
          <ResizableTableHeader
            page={currentSlide}
            displayLanguages={displayLanguages}
            allSelected={selectedIds.length === (translations || []).length && translations.length > 0}
            onToggleSelectAll={toggleSelectAll}
            columnWidths={columnWidths}
            onResizeStart={startResize}
          />
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={currentSlide === 'info' ? 9 : 3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : (translations || []).length === 0 ? (
              <tr>
                <td colSpan={currentSlide === 'info' ? 9 : 3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  번역 항목이 없습니다.
                </td>
              </tr>
            ) : (
              (translations || []).map((translation) => (
                <TranslationRow
                  key={translation.id}
                  page={currentSlide}
                  translation={translation}
                  isSelected={selectedIds.includes(translation.id)}
                  displayLanguages={displayLanguages}
                  columnWidths={columnWidths}
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
