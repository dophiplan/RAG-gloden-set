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
  onPriorityChange?: (translationId: string, priority: PriorityLevel) => Promise<void>; // Alias
  onNotesUpdate: (translationId: string, notes: string) => Promise<void>;
  onDevCodeUpdate?: (translationId: string, devCode: string) => Promise<void>;
  onPlatformsUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onPlatformUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>; // Alias
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
 * Main translation table component
 * Displays translations with editable cells and pagination
 * Refactored to use separated TranslationRow component
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
  const showProductColumn = true; // 항상 제품분류 열 표시

  // Calculate which languages to display (needed for column widths)
  const displayLanguagesForWidth = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      return allLanguages.filter((lang) => selectedLanguageColumns.includes(lang));
    }
    return allLanguages;
  }, [selectedLanguageColumns]);

  // Resizable columns setup
  const defaultWidths: { [key: string]: number } = {
    checkbox: 32,
    priority: 80,
    ...(showProductColumn && { product: 120 }),
    scope: 100,
    platform: 150,
    version: 100,
    sourceText: 250, // Wider for source text
    context: 220, // Wider for description
    devCode: 120,
    ...Object.fromEntries(
      (displayLanguagesForWidth || []).map((lang) => [`lang_${lang}`, 150])
    ),
    status: 120,
    notes: 180,
    actions: 100,
  };

  const minWidths: { [key: string]: number } = {
    checkbox: 32,
    priority: 60,
    product: 80,
    scope: 80,
    platform: 100,
    version: 80,
    sourceText: 150, // Minimum width for source text
    context: 120, // Minimum width for description
    devCode: 80,
    ...Object.fromEntries(
      (displayLanguagesForWidth || []).map((lang) => [`lang_${lang}`, 100])
    ),
    status: 100,
    notes: 120,
    actions: 80,
  };

  const { columnWidths, startResize, resize, stopResize } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'translation-table-column-widths',
  });

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

  // Use external selectedIds if provided, otherwise use internal state
  const selectedIds =
    externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;

  // Sync internal state with external prop when it changes
  useEffect(() => {
    if (externalSelectedIds !== undefined) {
      setInternalSelectedIds(externalSelectedIds);
    }
  }, [externalSelectedIds]);

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (newSelectedIds: string[]) => {
      setInternalSelectedIds(newSelectedIds);
      onSelectionChange?.(newSelectedIds);
    },
    [onSelectionChange]
  );

  // Calculate which languages to display based on user filter
  const displayLanguages = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();

    // If user has selected specific languages to display, filter to those
    if (selectedLanguageColumns && selectedLanguageColumns.length > 0) {
      return allLanguages.filter((lang) => selectedLanguageColumns.includes(lang));
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

  return (
    <div className="space-y-4 min-w-max">
      {/* Table - Page-level horizontal scroll */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <ResizableTableHeader
              showProductColumn={showProductColumn}
              displayLanguages={displayLanguages}
              allSelected={selectedIds.length === (translations || []).length}
              onToggleSelectAll={toggleSelectAll}
              columnWidths={columnWidths}
              onResizeStart={startResize}
            />
          <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={showProductColumn ? 18 : 17}
                    className="px-1.5 py-12 text-center text-sm text-gray-500"
                  >
                    로딩 중...
                  </td>
                </tr>
              ) : (translations || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={showProductColumn ? 18 : 17}
                    className="px-1.5 py-12 text-center text-sm text-gray-500"
                  >
                    번역 항목이 없습니다.
                  </td>
                </tr>
              ) : (
                (translations || []).map((translation) => (
                  <TranslationRow
                    key={translation.id}
                    translation={translation}
                    isSelected={selectedIds.includes(translation.id)}
                    showProductColumn={showProductColumn}
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
