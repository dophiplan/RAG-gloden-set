import React from 'react';

interface TranslationSourceBadgeProps {
  sourceType: 'glossary' | 'ai' | 'manual' | 'imported' | null | undefined;
  className?: string;
}

/**
 * Badge component to display the source of a translation
 * - glossary: Green badge "[DB 검색 결과]" - indicates translation came from glossary (no cost)
 * - ai: Blue badge "[신규 AI 번역]" - indicates new AI translation (cost incurred)
 * - manual/imported: No badge shown
 * - null/undefined: No badge shown (legacy data)
 */
export default function TranslationSourceBadge({ sourceType, className = '' }: TranslationSourceBadgeProps) {
  if (!sourceType || sourceType === 'manual' || sourceType === 'imported') {
    return null;
  }

  const styles = {
    glossary: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'DB 검색 결과',
    },
    ai: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: '신규 AI 번역',
    },
  };

  const style = styles[sourceType];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} ${className}`}
      title={sourceType === 'glossary' ? '용어집에서 재사용 (비용 없음)' : 'AI가 새로 번역 (비용 발생)'}
    >
      {style.label}
    </span>
  );
}
