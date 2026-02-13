'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import TranslationRow from '@/components/translations/table/TranslationRow';
import TranslationTableHeader from '@/components/translations/table/TranslationTableHeader';
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

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationTableV2Props {
  translations: TranslationWithResults[];
  selectedProduct: ProductCode | null;
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
  onRefresh,
  onSelectionChange,
  selectedIds: externalSelectedIds,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TranslationTableV2Props) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const showProductColumn = selectedProduct === null;

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
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full table-auto text-xs">
            <TranslationTableHeader
              showProductColumn={showProductColumn}
              displayLanguages={displayLanguages}
              allSelected={selectedIds.length === translations.length}
              onToggleSelectAll={toggleSelectAll}
            />
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={showProductColumn ? 18 : 17}
                    className="px-1.5 py-12 text-center text-sm text-gray-500"
                  >
                    로딩 중...
                  </td>
                </tr>
              ) : translations.length === 0 ? (
                <tr>
                  <td
                    colSpan={showProductColumn ? 18 : 17}
                    className="px-1.5 py-12 text-center text-sm text-gray-500"
                  >
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
