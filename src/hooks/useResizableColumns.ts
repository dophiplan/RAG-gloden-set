import { useState, useCallback, useEffect, useRef } from 'react';

export interface ColumnWidths {
  [columnKey: string]: number;
}

interface UseResizableColumnsOptions {
  defaultWidths: ColumnWidths;
  minWidths: ColumnWidths;
  storageKey: string;
}

export function useResizableColumns({
  defaultWidths,
  minWidths,
  storageKey,
}: UseResizableColumnsOptions) {
  // Load saved widths from localStorage
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    if (typeof window === 'undefined') return defaultWidths;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all columns have widths
        return { ...defaultWidths, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load column widths:', e);
    }
    return defaultWidths;
  });

  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  // Save to localStorage whenever widths change
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch (e) {
      console.error('Failed to save column widths:', e);
    }
  }, [columnWidths, storageKey]);

  const startResize = useCallback(
    (columnKey: string, clientX: number) => {
      resizingColumn.current = columnKey;
      startX.current = clientX;
      startWidth.current = columnWidths[columnKey] || defaultWidths[columnKey];

      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [columnWidths, defaultWidths]
  );

  const resize = useCallback(
    (clientX: number) => {
      if (!resizingColumn.current) return;

      const columnKey = resizingColumn.current;
      const diff = clientX - startX.current;
      const newWidth = Math.max(
        minWidths[columnKey] || 50,
        startWidth.current + diff
      );

      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    },
    [minWidths]
  );

  const stopResize = useCallback(() => {
    resizingColumn.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const resetWidths = useCallback(() => {
    setColumnWidths(defaultWidths);
  }, [defaultWidths]);

  // Alias for backward compatibility
  const onResizeStart = startResize;

  return {
    columnWidths,
    startResize,
    onResizeStart,
    resize,
    stopResize,
    resetWidths,
  };
}
