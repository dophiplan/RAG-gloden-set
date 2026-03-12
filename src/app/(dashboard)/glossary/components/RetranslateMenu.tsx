'use client';

import { useState, useRef, useEffect } from 'react';
import { LanguageCode } from '@/types';

export type RetranslateMode = 'all' | 'empty' | 'untranslated';

interface RetranslateMenuProps {
  onRetranslate: (mode: RetranslateMode) => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  displayLanguages?: LanguageCode[];
  termLanguages?: LanguageCode[];
}

interface MenuItem {
  mode: RetranslateMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/**
 * AI 재번역 미니 메뉴 컴포넌트
 * 
 * 옵션:
 * 1. 전체 다시 번역 - 모든 언어를 다시 번역
 * 2. 빈 곳만 번역 - 번역이 비어있는 언어만 번역
 * 3. 테이블 노출 언어 중 번역되지 않은 언어만 번역 - 현재 테이블에 표시된 언어 중 번역되지 않은 것만
 */
export default function RetranslateMenu({
  onRetranslate,
  disabled = false,
  loading = false,
  displayLanguages = [],
  termLanguages = [],
}: RetranslateMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 번역되지 않은 언어 계산 (displayLanguages 중 termLanguages에 없는 것)
  const untranslatedLanguages = displayLanguages.filter(
    lang => !termLanguages.includes(lang)
  );

  const menuItems: MenuItem[] = [
    {
      mode: 'all',
      label: '전체 다시 번역',
      description: '모든 언어를 AI로 재번역',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      mode: 'empty',
      label: '빈 곳만 번역',
      description: '번역이 비어있는 항목만',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ),
    },
    {
      mode: 'untranslated',
      label: `미번역 언어만 (${untranslatedLanguages.length}개)`,
      description: '테이블 노출 언어 중 번역되지 않은 언어',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const handleItemClick = async (mode: RetranslateMode) => {
    setIsOpen(false);
    await onRetranslate(mode);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      {/* AI 재번역 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="AI 재번역 옵션"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.101 5.79 2.929 7.907l3.032-3.032z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </button>

      {/* 미니 메뉴 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500">AI 재번역 옵션</span>
          </div>
          {menuItems.map((item) => (
            <button
              key={item.mode}
              onClick={() => handleItemClick(item.mode)}
              disabled={item.mode === 'untranslated' && untranslatedLanguages.length === 0}
              className="w-full px-3 py-2 text-left hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700">{item.label}</div>
                  <div className="text-xs text-gray-500 truncate">{item.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
