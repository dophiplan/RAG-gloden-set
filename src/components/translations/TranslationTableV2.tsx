'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import TranslationRow from '@/components/translations/table/TranslationRow';
import ResizableTableHeader from '@/components/translations/table/ResizableTableHeader';
import TranslationTablePagination from '@/components/translations/table/TranslationTablePagination';
import TableSlideIndicator from '@/components/translations/table/TableSlideIndicator';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useTableSlide } from '@/components/translations/hooks/useTableSlide';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Product column removed - determined by page context

  // Get display languages first (max 8 for translations page)
  const displayLanguages = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();
    let langs: LanguageCode[] = [];
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      langs = allLanguages.filter((lang) => selectedLanguageColumns.includes(lang));
    } else {
      langs = allLanguages;
    }
    // Limit to max 8 languages
    return langs.slice(0, 8);
  }, [selectedLanguageColumns]);

  // Slide view hook
  const { currentPage: slidePage, goToPage, goToNext, goToPrev, transformStyle } = useTableSlide();

  // Page 1: Basic Info columns (product removed)
  const infoPageWidths = {
    checkbox: 36,
    priority: 60,
    scope: 80,
    platform: 90,
    version: 70,
    devCode: 100,
    sourceText: 240,
    status: 80,
    actions: 90,
  };

  // Page 2: Translations columns (source + selected languages)
  // Use PERCENTAGE-based widths to ensure table always fills container
  const translationPageWidths = useMemo(() => {
    const widths: { [key: string]: number } = {};
    
    // Fixed columns as percentages
    widths.checkbox = 5;   // 5%
    widths.sourceText = 20; // 20%
    widths.actions = 8;    // 8%
    
    // Language columns: distribute remaining ~67% evenly
    const langCount = Math.max(displayLanguages.length, 1);
    const remainingPercent = 67; // 100 - 5 - 20 - 8 = 67
    const langPercent = Math.floor(remainingPercent / langCount);
    
    displayLanguages.forEach((lang) => {
      widths[`lang_${lang}`] = langPercent;
    });
    return widths;
  }, [displayLanguages]);

  const { columnWidths, startResize, resize, stopResize, resetWidths } = useResizableColumns({
    defaultWidths: slidePage === 'info' ? infoPageWidths : translationPageWidths,
    minWidths: {
      checkbox: 36,
      priority: 50,
      product: 60,
      scope: 60,
      platform: 70,
      version: 60,
      devCode: 80,
      sourceText: 150,
      status: 70,
      actions: 80,
    },
    // Include language count in storage key to invalidate when languages change
    storageKey: `translation-table-column-widths-v2-lang${displayLanguages.length}`,
  });

  // Reset column widths when language selection changes on translations page
  useEffect(() => {
    if (slidePage === 'translations') {
      resetWidths();
    }
  }, [displayLanguages.length, slidePage, resetWidths]);

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

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Slide Indicator */}
      <TableSlideIndicator
        currentPage={slidePage}
        onPageChange={goToPage}
      />

      {/* Slide Container */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={transformStyle}
          >
            {/* Page 1: Basic Info Table */}
            <div className="w-full flex-shrink-0">
              <table className="w-full border-collapse text-xs table-fixed">
                <ResizableTableHeader
                  page="info"

                  allSelected={selectedIds.length === (translations || []).length && translations.length > 0}
                  onToggleSelectAll={toggleSelectAll}
                  columnWidths={columnWidths}
                  onResizeStart={startResize}
                />
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                        로딩 중...
                      </td>
                    </tr>
                  ) : (translations || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500">
                        번역 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (translations || []).map((translation) => (
                      <TranslationRow
                        key={translation.id}
                        page="info"
                        translation={translation}
                        isSelected={selectedIds.includes(translation.id)}
                        isExpanded={expandedId === translation.id}
      
                        columnWidths={columnWidths}
                        onToggleSelect={toggleSelect}
                        onToggleExpand={() => toggleExpand(translation.id)}
                        onStatusChange={onStatusChange}
                        onSourceTextUpdate={onSourceTextUpdate}
                        onContextUpdate={onContextUpdate}
                        onScopeUpdate={onScopeUpdate}
                        onVersionUpdate={onVersionUpdate}
                        onPriorityUpdate={onPriorityUpdate}
                        onDevCodeUpdate={onDevCodeUpdate}
                        onPlatformsUpdate={onPlatformsUpdate}
                        onDelete={onDelete}
                        onAddToGlossary={onAddToGlossary}
                        onHistoryClick={onHistoryClick}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Page 2: Translations Table */}
            <div className="w-full flex-shrink-0">
              <table className="w-full border-collapse text-xs table-fixed">
                <ResizableTableHeader
                  page="translations"
                  displayLanguages={displayLanguages}
                  allSelected={selectedIds.length === (translations || []).length && translations.length > 0}
                  onToggleSelectAll={toggleSelectAll}
                  columnWidths={columnWidths}
                  onResizeStart={startResize}
                />
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                        로딩 중...
                      </td>
                    </tr>
                  ) : (translations || []).length === 0 ? (
                    <tr>
                      <td colSpan={3 + displayLanguages.length} className="px-4 py-12 text-center text-sm text-gray-500">
                        번역 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (translations || []).map((translation) => (
                      <TranslationRow
                        key={translation.id}
                        page="translations"
                        translation={translation}
                        isSelected={selectedIds.includes(translation.id)}
                        displayLanguages={displayLanguages}
                        columnWidths={columnWidths}
                        onToggleSelect={toggleSelect}
                        onTranslationUpdate={onTranslationUpdate}
                        onSourceTextUpdate={onSourceTextUpdate}
                        onDelete={onDelete}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
