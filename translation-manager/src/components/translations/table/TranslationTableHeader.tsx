'use client';

import { memo } from 'react';
import { LanguageCode } from '@/types';
import { useLanguages } from '@/hooks/useReferenceData';

export interface TranslationTableHeaderProps {
  showProductColumn: boolean;
  displayLanguages: LanguageCode[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
}

/**
 * Table header component for the translation table
 * Displays column headers including dynamic language columns
 */
const TranslationTableHeader = memo(function TranslationTableHeader({
  showProductColumn,
  displayLanguages,
  allSelected,
  onToggleSelectAll,
}: TranslationTableHeaderProps) {
  const { languagesMap } = useLanguages();

  return (
    <thead className="bg-gray-50 border-b">
      <tr>
        <th scope="col" className="px-0.5 py-0.5 text-left w-8">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            className="rounded border-gray-300"
            aria-label="모든 항목 선택"
          />
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          중요도
        </th>
        {showProductColumn && (
          <th
            scope="col"
            className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
          >
            제품
          </th>
        )}
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          제품분류
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          플랫폼
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          버전
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          원문
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          설명
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          KEY/id
        </th>
        {displayLanguages.map((lang) => (
          <th
            scope="col"
            key={lang}
            className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700 cursor-help"
            title={languagesMap[lang]?.name || lang}
          >
            {lang.toUpperCase()}
          </th>
        ))}
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          번역 상태
        </th>
        <th
          scope="col"
          className="px-0.5 py-0.5 text-left text-xs font-medium text-gray-700"
        >
          비고
        </th>
      </tr>
    </thead>
  );
});

export default TranslationTableHeader;
