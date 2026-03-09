'use client';

import { useState } from 'react';
import DiffView, { UserAvatar } from '@/components/rollback/DiffView';

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

// 필드별 아이콘
const fieldIcons: Record<string, string> = {
  status: '📊',
  source_text: '📝',
  translated_text: '🌐',
  context: '💬',
  priority: '⚡',
  scope: '📁',
};

export function VersionItem({ log, isCurrent, onRevert }: VersionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDiff = log.previousValue && log.newValue && 
    log.previousValue !== log.newValue &&
    (log.fieldName === 'translated_text' || log.fieldName === 'source_text' || log.fieldName === 'context');

  const isShortText = Boolean(log.newValue && String(log.newValue).length < 100 && !String(log.newValue).includes('\n'));

  return (
    <div className={`p-4 ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'} border-b border-gray-100 last:border-b-0`}>
      {/* 상단: 사용자 정보 강조 표시 */}
      <div className="flex items-start gap-3 mb-3">
        {/* 큰 아바타 */}
        <div className="flex-shrink-0">
          <UserAvatar userName={log.changedBy} size="md" />
        </div>
        
        {/* 사용자 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900">{log.changedBy}</span>
            {isCurrent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                현재
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatTime(log.createdAt)}
          </div>
        </div>
      </div>

      {/* 변경 유형 배지 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{fieldIcons[log.fieldName] || '📄'}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          log.type === 'audit'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {log.changeDescription}
        </span>
      </div>

      {/* 상태 변경 표시 */}
      {log.fieldName === 'status' && log.previousValue && log.newValue && (
        <div className="text-sm text-gray-700 mb-2 flex items-center gap-2">
          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 line-through">{log.previousValue}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-700">{log.newValue}</span>
        </div>
      )}

      {/* Diff 뷰 또는 텍스트 */}
      {hasDiff && isExpanded ? (
        <div className="mt-2">
          <DiffView
            oldValue={log.previousValue}
            newValue={log.newValue}
            userName={log.changedBy}
            showInline={isShortText}
          />
        </div>
      ) : log.newValue ? (
        <p className="text-sm text-gray-700 mt-2" title={log.newValue}>
          {String(log.newValue).slice(0, 100)}{String(log.newValue).length > 100 ? '...' : ''}
        </p>
      ) : null}

      {/* 액션 버튼들 */}
      <div className="flex items-center gap-2 mt-3">
        {/* Diff 토글 버튼 (변경 내용이 있는 경우) */}
        {hasDiff && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg 
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? '접기' : '변경 내용 보기'}
          </button>
        )}

        {/* 복구 버튼 */}
        {!isCurrent && onRevert && (
          <button
            onClick={onRevert}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium ml-auto flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            이 버전으로 복구
          </button>
        )}
      </div>
    </div>
  );
}
