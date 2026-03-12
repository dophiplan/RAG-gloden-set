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
 * Displays numeric pagination with navigation buttons
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
      <div className="flex items-center justify-center gap-2">
        {/* 이전 버튼 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          이전
        </button>
        
        <div className="flex items-center gap-1">
          {/* 첫 페이지 */}
          <button
            onClick={() => onPageChange(1)}
            className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
              currentPage === 1 
                ? 'bg-[#818CF8] text-white font-medium' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            1
          </button>
          
          {/* 왼쪽 생략 (...) */}
          {currentPage > 4 && (
            <span className="px-1 text-gray-400">...</span>
          )}
          
          {/* 중간 페이지들 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => page !== 1 && page !== totalPages && page >= currentPage - 2 && page <= currentPage + 2)
            .map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
                  currentPage === page 
                    ? 'bg-[#818CF8] text-white font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
          
          {/* 오른쪽 생략 (...) */}
          {currentPage < totalPages - 3 && (
            <span className="px-1 text-gray-400">...</span>
          )}
          
          {/* 마지막 페이지 */}
          {totalPages > 1 && (
            <button
              onClick={() => onPageChange(totalPages)}
              className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
                currentPage === totalPages 
                  ? 'bg-[#818CF8] text-white font-medium' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {totalPages}
            </button>
          )}
        </div>
        
        {/* 다음 버튼 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          다음
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default TranslationTablePagination;
