'use client';

import { memo } from 'react';
import type { ReactElement } from 'react';

export interface GlossaryTableHeaderProps {
  isAllSelected: boolean;
  onToggleAll: () => void;
  columnWidths: { [key: string]: number };
  onResizeStart: (columnKey: string, clientX: number) => void;
}

interface ColumnDef {
  key: string;
  label: string | ReactElement;
  resizable: boolean;
  style?: React.CSSProperties;
}

/**
 * Resizable table header for glossary table
 */
const GlossaryTableHeader = memo(function GlossaryTableHeader({
  isAllSelected,
  onToggleAll,
  columnWidths,
  onResizeStart,
}: GlossaryTableHeaderProps) {
  const columns: ColumnDef[] = [
    { key: 'checkbox', label: '', resizable: false },
    { key: 'term', label: '용어', resizable: true },
    { key: 'translation', label: '번역', resizable: true },
    { key: 'context', label: '문맥', resizable: true },
    { key: 'product', label: '제품', resizable: true },
    { key: 'source', label: '출처', resizable: true },
    {
      key: 'approval',
      label: (
        <>
          검수 상태 <span className="text-gray-400">ⓘ</span>
        </>
      ),
      resizable: true,
    },
    {
      key: 'hitCount',
      label: (
        <>
          사용 횟수 <span className="text-gray-400">ⓘ</span>
        </>
      ),
      resizable: true,
    },
    { key: 'actions', label: '작업', resizable: true, style: { textAlign: 'right' } },
  ];

  return (
    <thead className="bg-gray-50 border-b">
      <tr>
        {columns.map((column) => {
          const width = columnWidths[column.key];
          const style = {
            ...(width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {}),
            ...(column.style || {}),
          };

          if (column.key === 'checkbox') {
            return (
              <th key={column.key} scope="col" className="px-2 py-3 w-8" style={style}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleAll}
                  className="rounded border-gray-300"
                  aria-label="모든 항목 선택"
                />
              </th>
            );
          }

          return (
            <th
              key={column.key}
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group"
              style={style}
              title={
                column.key === 'approval'
                  ? 'AI가 추가한 용어는 승인 후 사용됩니다'
                  : column.key === 'hitCount'
                  ? '이 용어가 번역에 재사용된 횟수'
                  : undefined
              }
            >
              {column.label}
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

export default GlossaryTableHeader;
