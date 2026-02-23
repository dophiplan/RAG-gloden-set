'use client';

import { memo } from 'react';
import Button from '@/components/ui/Button';

export interface TranslationTablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Pagination controls for the translation table
 * Displays current page and navigation buttons
 */
const TranslationTablePagination = memo(function TranslationTablePagination({
  currentPage,
  totalPages,
  onPageChange,
}: TranslationTablePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="secondary"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          이전
        </Button>
        <span className="text-sm text-gray-600">
          {currentPage} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          다음
        </Button>
      </div>
    </div>
  );
});

export default TranslationTablePagination;
