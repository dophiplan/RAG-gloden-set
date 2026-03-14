'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface PrecommitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: {
    total: number;
    import: number; // 새로 생성될 항목
    merge: number; // 병합될 항목
    skip: number; // skip될 항목
  };
  entries: Array<{
    id: string;
    source_text: string;
    category?: 'glossary' | 'translation';
    existing_in_glossary: boolean;
    existing_in_translation: boolean;
  }>;
}

export default function PrecommitConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  stats,
  entries,
}: PrecommitConfirmModalProps) {
  // 각 항목의 action 텍스트를 결정하는 함수
  const getActionText = (entry: {
    category?: 'glossary' | 'translation';
    existing_in_glossary: boolean;
    existing_in_translation: boolean;
  }): { text: string; colorClass: string } => {
    if (entry.category === 'glossary') {
      if (entry.existing_in_glossary) {
        return { text: '용어집 Skip (이미 존재)', colorClass: 'text-yellow-600 bg-yellow-50' };
      }
      return { text: '용어집 신규 생성', colorClass: 'text-emerald-600 bg-emerald-50' };
    }

    if (entry.category === 'translation') {
      if (entry.existing_in_translation) {
        return { text: '번역 병합', colorClass: 'text-blue-600 bg-blue-50' };
      }
      return { text: '번역 신규 생성', colorClass: 'text-emerald-600 bg-emerald-50' };
    }

    return { text: 'Unknown', colorClass: 'text-gray-600 bg-gray-50' };
  };

  // 표시할 항목 (최대 5개)
  const displayEntries = useMemo(() => entries.slice(0, 5), [entries]);
  const remainingCount = Math.max(0, entries.length - 5);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative z-50 w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">마이그레이션 확인</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
            aria-label="닫기"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {/* Total */}
            <Card padding="sm" className="text-center">
              <div className="text-xs text-gray-500 mb-1">전체</div>
              <div className="text-xl font-bold text-gray-700">{stats.total}</div>
            </Card>

            {/* Import (New) */}
            <Card padding="sm" className="text-center border-emerald-200">
              <div className="text-xs text-emerald-600 mb-1">신규 생성</div>
              <div className="text-xl font-bold text-emerald-500">{stats.import}</div>
            </Card>

            {/* Merge */}
            <Card padding="sm" className="text-center border-blue-200">
              <div className="text-xs text-blue-600 mb-1">병합</div>
              <div className="text-xl font-bold text-blue-500">{stats.merge}</div>
            </Card>

            {/* Skip */}
            <Card padding="sm" className="text-center border-yellow-200">
              <div className="text-xs text-yellow-600 mb-1">Skip</div>
              <div className="text-xl font-bold text-yellow-500">{stats.skip}</div>
            </Card>
          </div>

          {/* Detail List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">상세 목록</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
              {displayEntries.map((entry) => {
                const action = getActionText(entry);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm text-gray-800 truncate" title={entry.source_text}>
                        {entry.source_text}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium ${action.colorClass}`}
                    >
                      {action.text}
                    </span>
                  </div>
                );
              })}
              {remainingCount > 0 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  외 {remainingCount}건
                </div>
              )}
              {entries.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-500">
                  표시할 항목이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            마이그레이션 실행
          </Button>
        </div>
      </div>
    </div>
  );
}
