'use client';

import { useState } from 'react';

interface VersionItemProps {
  log: {
    id: string;
    type: 'audit' | 'translation';
    action: string;
    fieldName: string;
    changeDescription: string;
    previousValue: string | null;
    newValue: string | null;
    createdAt: string;
    changedBy: string;
  };
  isCurrent: boolean;
  onRevert?: () => void;
}

// 시간 포맷팅
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VersionItem({ log, isCurrent, onRevert }: VersionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`p-3 ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isCurrent && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                현재
              </span>
            )}
            <span className="text-xs text-gray-500">{formatTime(log.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{log.changedBy}</p>
        </div>

        {/* 복구 버튼 */}
        {!isCurrent && onRevert && (
          <button
            onClick={onRevert}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700 whitespace-nowrap"
          >
            복구
          </button>
        )}
      </div>

      {/* 변경 내용 */}
      <div className="mt-2">
        {/* 변경 설명 */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            log.type === 'audit'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {log.changeDescription}
          </span>
        </div>

        {/* 새 값 */}
        {log.newValue && (
          <p className="text-sm text-gray-900 mt-1" title={log.newValue}>
            {log.newValue}
          </p>
        )}

        {/* 변경 전 값 표시 (접힌 상태) */}
        {!isCurrent && log.previousValue && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-400 mt-1 hover:text-gray-600"
          >
            {isExpanded ? '숨기기' : '변경 전 보기'}
          </button>
        )}

        {isExpanded && log.previousValue && (
          <p className="text-xs text-gray-400 mt-1 line-through">
            {log.previousValue}
          </p>
        )}
      </div>
    </div>
  );
}
