'use client';

import { useRef, useState, useCallback, ReactNode } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';

interface VirtualTableProps<T> {
  data: T[];
  renderRow: (item: T, index: number) => ReactNode;
  rowHeight: number;
  headerHeight?: number;
  renderHeader?: () => ReactNode;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
}

export function VirtualTable<T>({
  data,
  renderRow,
  rowHeight,
  headerHeight = 48,
  renderHeader,
  overscan = 5,
  className = '',
  emptyMessage = '데이터가 없습니다.',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan,
    onChange: (instance) => {
      if (instance.scrollOffset !== null) {
        setScrollTop(instance.scrollOffset);
      }
    },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: '100%', maxHeight: 'calc(100vh - 300px)' }}
    >
      {/* Header */}
      {renderHeader && (
        <div style={{ height: headerHeight }} className="sticky top-0 z-10">
          {renderHeader()}
        </div>
      )}

      {/* Virtual Container */}
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem: VirtualItem) => {
          const item = data[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderRow(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Window virtualization for infinite scroll
interface WindowVirtualListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  overscan?: number;
  className?: string;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function WindowVirtualList<T>({
  data,
  renderItem,
  itemHeight,
  overscan = 5,
  className = '',
  loading = false,
  hasMore = false,
  onLoadMore,
}: WindowVirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasMore ? data.length + 1 : data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => itemHeight, [itemHeight]),
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Load more when scrolling near end
  useEffect(() => {
    const [lastItem] = [...virtualItems].reverse();
    if (!lastItem) return;

    if (lastItem.index >= data.length - 1 && hasMore && !loading && onLoadMore) {
      onLoadMore();
    }
  }, [virtualItems, data.length, hasMore, loading, onLoadMore]);

  return (
    <div ref={parentRef} className={`overflow-auto ${className}`}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem: VirtualItem) => {
          const isLoaderRow = virtualItem.index > data.length - 1;
          const item = data[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <div className="flex items-center justify-center p-4 text-gray-500">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                      로딩 중...
                    </>
                  ) : (
                    '더 불러오기...'
                  )}
                </div>
              ) : (
                renderItem(item, virtualItem.index)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect } from 'react';

export default VirtualTable;
