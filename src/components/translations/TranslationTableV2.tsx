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
 * Main translation table component - Compact design without horizontal scroll
 * Columns: Checkbox | Priority | Product | Scope | Platform | Version | Source | Status | Actions
 * Expanded row shows: Context + Language translations
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
  const showProductColumn = true;

  // Compact column widths - total ~950px max (no horizontal scroll on 1024px+)
  const defaultWidths: { [key: string]: number } = {
    checkbox: 36,
    priority: 60,
    product: 70,
    scope: 80,
    platform: 90,
    version: 70,
    devCode: 100, // KEY/id column
    sourceText: 220, // Reduced slightly
    status: 80,
    actions: 90,
  };

  const minWidths: { [key: string]: number } = {
    checkbox: 36,
    priority: 50,
    product: 60,
    scope: 60,
    platform: 70,
    version: 60,
    devCode: 80,
    sourceText: 180,
    status: 70,
    actions: 80,
  };

  const { columnWidths, startResize, resize, stopResize } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'translation-table-column-widths-v2',
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

  const displayLanguages = useMemo(() => {
    const allLanguages = getAllDisplayableLanguages();
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

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Table - No horizontal scroll */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full border-collapse text-xs table-fixed">
          <ResizableTableHeader
            showProductColumn={showProductColumn}
            allSelected={selectedIds.length === (translations || []).length && translations.length > 0}
            onToggleSelectAll={toggleSelectAll}
            columnWidths={columnWidths}
            onResizeStart={startResize}
          />
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  로딩 중...
                </td>
              </tr>
            ) : (translations || []).length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center text-sm text-gray-500"
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
                  isExpanded={expandedId === translation.id}
                  showProductColumn={showProductColumn}
                  columnWidths={columnWidths}
                  onToggleSelect={toggleSelect}
                  onToggleExpand={() => toggleExpand(translation.id)}
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
                  displayLanguages={displayLanguages}
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
