'use client';

import { useState, useCallback, useEffect } from 'react';

export type TableSlidePage = 'info' | 'translations';

interface UseTableSlideOptions {
  defaultPage?: TableSlidePage;
  storageKey?: string;
}

export function useTableSlide(options: UseTableSlideOptions = {}) {
  const { defaultPage = 'info', storageKey = 'translation-table-page' } = options;

  // Initialize from localStorage or default
  const [currentPage, setCurrentPage] = useState<TableSlidePage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey) as TableSlidePage;
      return saved === 'translations' ? 'translations' : defaultPage;
    }
    return defaultPage;
  });

  // Save to localStorage when page changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, currentPage);
    }
  }, [currentPage, storageKey]);

  const goToPage = useCallback((page: TableSlidePage) => {
    setCurrentPage(page);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentPage((prev) => (prev === 'info' ? 'translations' : 'info'));
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentPage((prev) => (prev === 'translations' ? 'info' : 'translations'));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Arrow keys
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      }
      // Number keys
      if (e.key === '1') {
        goToPage('info');
      }
      if (e.key === '2') {
        goToPage('translations');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, goToPage]);

  const transformStyle = {
    transform: `translateX(-${currentPage === 'info' ? 0 : 100}%)`,
  };

  return {
    currentPage,
    goToPage,
    goToNext,
    goToPrev,
    transformStyle,
    isInfoPage: currentPage === 'info',
    isTranslationsPage: currentPage === 'translations',
  };
}
