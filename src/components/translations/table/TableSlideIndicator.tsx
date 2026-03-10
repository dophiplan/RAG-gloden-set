'use client';

import { TableSlidePage } from '../hooks/useTableSlide';

interface TableSlideIndicatorProps {
  currentPage: TableSlidePage;
  onPageChange: (page: TableSlidePage) => void;
}

export default function TableSlideIndicator({
  currentPage,
  onPageChange,
}: TableSlideIndicatorProps) {
  const pages: { id: TableSlidePage; label: string }[] = [
    { id: 'info', label: '기본 정보' },
    { id: 'translations', label: '번역 언어' },
  ];

  return (
    <div className="flex items-center justify-between mb-4 px-1">
      {/* Left side - empty or could add title */}
      <div className="text-sm text-gray-500">
        {/* Optional: View title */}
      </div>

      {/* Right side - Page tabs */}
      <div className="flex items-center bg-gray-100 rounded-lg p-1">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => onPageChange(page.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              currentPage === page.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              {/* Dot indicator */}
              <span
                className={`w-2 h-2 rounded-full transition-all ${
                  currentPage === page.id ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
              {page.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
