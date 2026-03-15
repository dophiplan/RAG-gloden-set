'use client';

import { memo } from 'react';
import { LanguageCode } from '@/types';

// Debug logging helper - only in development
const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};

export interface ResizableTableHeaderProps {
  page?: 'info' | 'translations' | 'unified';
  displayLanguages?: LanguageCode[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  languagesMap?: Record<string, { name: string }>;
}

/**
 * 마이그레이션 스타일 테이블 헤더
 * 가로 스크롤 없이 한 화면에 표시
 */
const ResizableTableHeader = memo(function ResizableTableHeader({
  page = 'info',
  displayLanguages = [],
  allSelected,
  onToggleSelectAll,
  languagesMap = {},
}: ResizableTableHeaderProps) {
  debug('[ResizableTableHeader] page:', page, 'displayLanguages:', displayLanguages);

  // 언어 표시 이름 가져오기 (용어집과 동일)
  const getLanguageLabel = (langCode: LanguageCode): string => {
    return languagesMap[langCode]?.name || langCode.toUpperCase();
  };

  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      {page === 'info' ? (
        // 기본 정보 뷰 - 원문 25% 차지, 폰트 작게
        <tr>
          <th className="w-[28px] px-1 py-2 text-left">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="모든 항목 선택"
            />
          </th>
          <th className="w-[30px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">중요</th>
          <th className="w-[40px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">분류</th>
          <th className="w-[46px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">플랫폼</th>
          <th className="w-[36px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">버전</th>
          <th className="w-[55px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">KEY/ID</th>
          <th className="w-[25%] px-2 py-2 text-left text-[10px] font-medium text-gray-700 truncate">원문</th>
          <th className="w-[60px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">설명</th>
          <th className="w-[40px] px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">상태</th>
          <th className="w-[25px] px-1 py-2 text-right"></th>
        </tr>
      ) : (
        // 번역 정보 뷰 - 마이그레이션 스타일 (원문 + 선택된 언어 + 상태 + 작업)
        <tr>
          <th className="w-[28px] px-1 py-2 text-left">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="모든 항목 선택"
            />
          </th>
          <th className="w-[20%] px-2 py-2 text-left text-[10px] font-medium text-gray-700 truncate">원문</th>
          {displayLanguages.map((lang) => (
            <th key={lang} className="px-1 py-2 text-left text-[10px] font-medium text-gray-700 truncate">
              {getLanguageLabel(lang)}
            </th>
          ))}
          <th className="w-[50px] px-1 py-2 text-center text-[10px] font-medium text-gray-700 truncate">상태</th>
          <th className="w-[50px] px-1 py-2 text-right"></th>
        </tr>
      )}
    </thead>
  );
});

export default ResizableTableHeader;
