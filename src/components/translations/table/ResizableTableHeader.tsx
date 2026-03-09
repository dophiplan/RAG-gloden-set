'use client';

import { memo, useEffect } from 'react';
import { LanguageCode } from '@/types';
import { useLanguages } from '@/hooks/useReferenceData';

export interface ResizableTableHeaderProps {
  showProductColumn: boolean;
  displayLanguages: LanguageCode[];
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
 * Resizable table header component
 * Allows users to resize columns by dragging handles
 */
const ResizableTableHeader = memo(function ResizableTableHeader({
  showProductColumn,
  displayLanguages,
  allSelected,
  onToggleSelectAll,
  columnWidths,
  onResizeStart,
}: ResizableTableHeaderProps) {
  const { languagesMap } = useLanguages();

  // Define columns with resizable flag
  const columns: ColumnDef[] = [
    { key: 'checkbox', label: '', resizable: false },
    { key: 'priority', label: '중요도', resizable: true },
    ...(showProductColumn ? [{ key: 'product', label: '제품', resizable: true }] : []),
    { key: 'scope', label: '제품분류', resizable: true },
    { key: 'platform', label: '플랫폼', resizable: true },
    { key: 'version', label: '버전', resizable: true },
    { key: 'sourceText', label: '원문', resizable: true },
    { key: 'context', label: '설명', resizable: true },
    { key: 'devCode', label: 'KEY/id', resizable: true },
    ...displayLanguages.map((lang) => ({
      key: `lang_${lang}`,
      label: lang.toUpperCase(),
      resizable: true,
    })),
    { key: 'status', label: '번역 상태', resizable: true },
    { key: 'notes', label: '비고', resizable: true },
    { key: 'actions', label: '작업', resizable: false },
  ];

  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr className="divide-x divide-gray-200">
        {columns.map((column) => {
          const width = columnWidths[column.key];
          const style = width ? { width: `${width}px`, minWidth: `${width}px` } : {};

          if (column.key === 'checkbox') {
            return (
              <th
                key={column.key}
                scope="col"
                className="px-0.5 py-0.5 text-left"
                style={{ width: '32px', minWidth: '32px' }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-gray-300"
                  aria-label="모든 항목 선택"
                />
              </th>
            );
          }

          // Language column
          if (column.key.startsWith('lang_')) {
            const lang = column.key.replace('lang_', '') as LanguageCode;
            return (
              <th
                key={column.key}
                scope="col"
                className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700 cursor-help relative group"
                style={style}
                title={languagesMap[lang]?.name || lang}
                suppressHydrationWarning
              >
                <span>{column.label}</span>
                {column.resizable && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onResizeStart(column.key, e.clientX);
                    }}
                  />
                )}
              </th>
            );
          }

          return (
            <th
              key={column.key}
              scope="col"
              className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700 relative group"
              style={style}
              suppressHydrationWarning
            >
              <span>{column.label}</span>
              {column.resizable && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
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
