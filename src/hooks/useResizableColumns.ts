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
  // Use ref to store defaultWidths to avoid dependency changes
  const defaultWidthsRef = useRef(defaultWidths);
  
  // Start with default widths to avoid hydration mismatch
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(defaultWidthsRef.current);
  const hasLoaded = useRef(false);
  
  // Load saved widths from localStorage on client side only (once)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasLoaded.current) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure all columns have widths
        setColumnWidths({ ...defaultWidthsRef.current, ...parsed });
      }
      hasLoaded.current = true;
    } catch (e) {
      console.error('Failed to load column widths:', e);
    }
  }, [storageKey]);

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
      startWidth.current = columnWidths[columnKey] || defaultWidthsRef.current[columnKey];

      // Prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [columnWidths]
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
    setColumnWidths(defaultWidthsRef.current);
  }, []);

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
