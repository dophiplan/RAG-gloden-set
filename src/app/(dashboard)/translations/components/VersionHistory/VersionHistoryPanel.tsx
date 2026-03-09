'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import DiffView, { UserAvatar, getUserColors } from '@/components/rollback/DiffView';

interface VersionHistory {
  id: string;
  type: 'audit' | 'translation';
  action: string;
  fieldName: string;
  changeDescription: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedBy: string;
}

interface VersionHistoryPanelProps {
  translationId: string;
  languageCode: string;
  curre[기밀마스킹]ext: string;
  onClose?: () => void;
}

// 시간 포맷팅
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

// 필드별 라벨
const fieldLabels: Record<string, string> = {
  status: '상태 변경',
  source_text: '원문 수정',
  translated_text: '번역 수정',
  context: '설명 수정',
  priority: '중요도 변경',
  scope: '범위 변경',
};

export function VersionHistoryPanel({
  translationId,
  languageCode,
  curre[기밀마스킹]ext,
  onClose,
}: VersionHistoryPanelProps) {
  const [logs, setLogs] = useState<VersionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);

  // 버전 히스토리 불러오기
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<VersionHistory[]>(`/api/translations/${translationId}/logs?language=${languageCode}`);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // 개별 복구 처리
  const handleRevert = async (log: VersionHistory) => {
    if (!confirm(`이 버전으로 복구하시겠습니까?\n\n${log.changeDescription}`)) {
      return;
    }

    try {
      setIsReverting(log.id);
      await apiPost(`/api/translations/${translationId}/revert`, { 
        logId: log.id, 
        languageCode 
      });
      
      // 성공 후 목록 새로고침
      await fetchLogs();
      alert('복구가 완료되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsReverting(null);
    }
  };

  // Diff 표시 토글
  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  useEffect(() => {
    if (translationId && languageCode) {
      fetchLogs();
    }
  }, [translationId, languageCode]);

  // 타임라인 아이템 렌더링
  const timelineItems = useMemo(() => {
    return logs.map((log, index) => ({
      ...log,
      isFirst: index === 0,
      isLast: index === logs.length - 1,
      isExpanded: expandedLogs.includes(log.id),
    }));
  }, [logs, expandedLogs]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">📋 버전 기록</h3>
            <p className="text-xs text-gray-500 mt-0.5">{translationId.slice(0, 8)}...</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-gray-500">불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">📋 버전 기록</h3>
            <p className="text-xs text-gray-500 mt-0.5">{translationId.slice(0, 8)}...</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-red-500 text-center">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            📋 버전 기록
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            번역 ID: {translationId.slice(0, 8)}... · 언어: {languageCode.toUpperCase()}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 타임라인 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm text-gray-500">변경 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="relative pl-6">
            {/* 타임라인 선 */}
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

            {timelineItems.map((log, index) => {
              const colors = getUserColors(log.changedBy);
              const isCurrent = log.action === 'current';
              // 모든 변경 유형에 대해 복구 가능 (현재 버전 제외)
              const canRevert = !isCurrent;
              const hasDiff = log.previousValue && log.newValue && 
                log.previousValue !== log.newValue &&
                (log.fieldName === 'translated_text' || log.fieldName === 'source_text' || log.fieldName === 'context');
              const isExpanded = expandedLogs.includes(log.id);

              return (
                <div
                  key={log.id}
                  className={`relative mb-6 ${isCurrent ? 'opacity-100' : ''}`}
                >
                  {/* 타임라인 점 */}
                  <div
                    className={`absolute -left-4 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                      isCurrent 
                        ? 'bg-blue-500 ring-2 ring-blue-200' 
                        : colors.bg.replace('bg-', 'bg-').replace('100', '500')
                    }`}
                  />

                  {/* 내용 카드 */}
                  <div className={`rounded-lg border ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'} p-3 shadow-sm`}>
                    {/* 상단: 사용자 정보 강조 */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0">
                        <UserAvatar userName={log.changedBy} size="md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-bold text-gray-900">{log.changedBy}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{formatDateTime(log.createdAt)}</div>
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
                        {fieldLabels[log.fieldName] || log.changeDescription}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          현재
                        </span>
                      )}
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

                    {/* 텍스트 변경 Diff 뷰 */}
                    {hasDiff && (
                      <div className="mt-2">
                        {isExpanded ? (
                          <DiffView
                            oldValue={log.previousValue}
                            newValue={log.newValue}
                            userName={log.changedBy}
                            showInline={String(log.newValue).length < 100 && !String(log.newValue).includes('\n')}
                          />
                        ) : (
                          <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                            <span className="text-gray-400">변경됨:</span>{' '}
                            {String(log.newValue).slice(0, 50)}{String(log.newValue).length > 50 ? '...' : ''}
                          </div>
                        )}
                        
                        {/* Diff 토글 버튼 */}
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <svg 
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {isExpanded ? '접기' : '변경 내용 상세 보기'}
                        </button>
                      </div>
                    )}

                    {/* 현재 버전 텍스트 표시 */}
                    {isCurrent && log.newValue && (
                      <div className="mt-2 text-sm text-gray-700 bg-white rounded p-2 border border-blue-100">
                        {log.newValue}
                      </div>
                    )}

                    {/* 복구 버튼 - 모든 변경 유형에 대해 표시 */}
                    {canRevert && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleRevert(log)}
                          disabled={isReverting === log.id}
                          className="w-full text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          {isReverting === log.id ? (
                            <>
                              <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              복구 중...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              이 버전으로 복구
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
