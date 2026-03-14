'use client';

import { memo } from 'react';
import { LanguageCode } from '@/types';

export interface ResizableTableHeaderProps {
  page?: 'info' | 'translations' | 'unified';
  // showProductColumn removed - product is determined by page context
  displayLanguages?: LanguageCode[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  columnWidths: { [key: string]: number };
  onResizeStart: (columnKey: string, clientX: number) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  resizable: boolean;
}

/**
 * Slide View Table Header
 * Page 1 (info): Checkbox | Priority | Product | Scope | Platform | Version | KEY/ID | Source | Status | Actions
 * Page 2 (translations): Checkbox | Source | Lang1 | Lang2 | ... | Actions
 */
const ResizableTableHeader = memo(function ResizableTableHeader({
  page = 'info',

  displayLanguages = [],
  allSelected,
  onToggleSelectAll,
  columnWidths,
  onResizeStart,
}: ResizableTableHeaderProps) {
  // Define columns based on page
  const getColumns = (): ColumnDef[] => {
    console.log('[ResizableTableHeader] page:', page, 'displayLanguages:', displayLanguages);
    if (page === 'info') {
      // Page 1: Basic Info
      return [
        { key: 'checkbox', label: '', resizable: false },
        { key: 'priority', label: '중요', resizable: true },
        { key: 'scope', label: '분류', resizable: true },
        { key: 'platform', label: '플랫폼', resizable: true },
        { key: 'version', label: '버전', resizable: true },
        { key: 'devCode', label: 'KEY/ID', resizable: true },
        { key: 'sourceText', label: '원문', resizable: true },
        { key: 'context', label: '설명', resizable: true },
        { key: 'status', label: '상태', resizable: true },
        { key: 'actions', label: '', resizable: false },
      ];
    } else if (page === 'unified') {
      // Unified: Basic Info + All Languages
      return [
        { key: 'checkbox', label: '', resizable: false },
        { key: 'priority', label: '중요', resizable: true },
        { key: 'scope', label: '분류', resizable: true },
        { key: 'platform', label: '플랫폼', resizable: true },
        { key: 'version', label: '버전', resizable: true },
        { key: 'devCode', label: 'KEY/ID', resizable: true },
        { key: 'sourceText', label: '원문', resizable: true },
        { key: 'context', label: '설명', resizable: true },
        { key: 'status', label: '상태', resizable: true },
        // 모든 언어 컬럼
        ...displayLanguages.map((lang) => ({
          key: `lang_${lang}`,
          label: lang.toUpperCase(),
          resizable: true as const,
        })),
        { key: 'actions', label: '', resizable: false },
      ];
    } else {
      // Page 2: Translations
      return [
        { key: 'checkbox', label: '', resizable: false },
        { key: 'sourceText', label: '원문', resizable: true },
        ...displayLanguages.map((lang) => ({
          key: `lang_${lang}`,
          label: lang.toUpperCase(),
          resizable: true as const,
        })),
        { key: 'actions', label: '', resizable: false },
      ];
    }
  };
  
  const columns = getColumns();

  const languageLabels: Record<string, string> = {
    en: '영어',
    ja: '일본어',
    zh: '중국어',
    'zh-TW': '대만',
    fr: '프랑스',
    es: '스페인',
    de: '독일',
    pt: '포르투갈',
  };

  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        {columns.map((column) => {
          const width = columnWidths[column.key];
          const style = width ? { width: `${width}px`, minWidth: `${width}px` } : {};

          // Checkbox column
          if (column.key === 'checkbox') {
            return (
              <th
                key={column.key}
                scope="col"
                className="px-1 py-2 text-left"
                style={{ width: '28px', minWidth: '28px' }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="모든 항목 선택"
                />
              </th>
            );
          }

          // Actions column (last)
          if (column.key === 'actions') {
            return (
              <th
                key={column.key}
                scope="col"
                className="px-1 py-2 text-right"
                style={{ width: '65px', minWidth: '65px' }}
              />
            );
          }

          // Language columns (page 2)
          if (column.key.startsWith('lang_')) {
            const lang = column.key.replace('lang_', '');
            return (
              <th
                key={column.key}
                scope="col"
                className="px-1.5 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider relative group"
                style={style}
                title={languageLabels[lang] || lang}
              >
                <span className="truncate block">{column.label}</span>
                {column.resizable && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 group-hover:bg-blue-400/30"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onResizeStart(column.key, e.clientX);
                    }}
                  />
                )}
              </th>
            );
          }

          // Standard columns
          return (
            <th
              key={column.key}
              scope="col"
              className="px-1.5 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider relative group"
              style={style}
            >
              <span className="truncate block">{column.label}</span>
              {column.resizable && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 group-hover:bg-blue-400/30"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onResizeStart(column.key, e.clientX);
                  }}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
});

export default ResizableTableHeader;
