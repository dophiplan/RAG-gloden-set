'use client';

import { useState, useEffect } from 'react';

interface BulkLog {
  id: string;
  translationId: string;
  translationResultId: string;
  previousText: string;
  newText: string;
  createdAt: string;
  changedBy: string;
}

interface CurrentVersion {
  translationId: string;
  translationResultId: string;
  curre[기밀마스킹]ext: string;
  updatedAt: string;
  updatedBy: string;
}

interface BulkVersionHistoryPanelProps {
  translationIds: string[];
  languageCode: string;
  onRevert?: () => void;
}

interface GroupedLogs {
  [key: string]: {
    date: string;
    time: string;
    logs: BulkLog[];
    changedBy: string;
    timestamp: string;
  };
}

// 시간 포맷팅
function formatDateTime(dateString: string): { date: string; time: string } {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function BulkVersionHistoryPanel({
  translationIds,
  languageCode,
  onRevert,
}: BulkVersionHistoryPanelProps) {
  const [logs, setLogs] = useState<BulkLog[]>([]);
  const [currentVersions, setCurrentVersions] = useState<CurrentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReverting, setIsReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // 버전 히스토리 불러오기
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/translations/bulk-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationIds, languageCode }),
      });

      if (!response.ok) throw new Error('히스토리를 불러오지 못했습니다.');

      const data = await response.json();
      setLogs(data.logs || []);
      setCurrentVersions(data.currentVersions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // 복구 처리
  const handleRevert = async (groupLogs: BulkLog[]) => {
    if (!confirm(`이 버전으로 복구하시겠습니까?\n${groupLogs.length}개 항목이 변경됩니다.`)) {
      return;
    }

    try {
      setIsReverting(true);
      
      const revertItems = groupLogs.map((log) => ({
        translationResultId: log.translationResultId,
        revertText: log.previousText, // 이전 텍스트로 복구
      }));

      const response = await fetch('/api/translations/bulk-revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revertItems }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '복구에 실패했습니다.');
      }

      const result = await response.json();
      alert(result.message);
      
      // 성공 후 목록 새로고침
      await fetchLogs();
      
      // 부모에게 복구 완료 알림
      onRevert?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsReverting(false);
    }
  };

  // 시간별로 그룹화
  const groupedLogs: GroupedLogs = logs.reduce((acc, log) => {
    const { date, time } = formatDateTime(log.createdAt);
    const key = `${date} ${time}`;
    
    if (!acc[key]) {
      acc[key] = { date, time, logs: [], changedBy: log.changedBy, timestamp: log.createdAt };
    }
    acc[key].logs.push(log);
    return acc;
  }, {} as GroupedLogs);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    if (translationIds.length > 0 && languageCode) {
      fetchLogs();
    }
  }, [translationIds, languageCode]);

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-gray-500">불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">{error}</div>
    );
  }

  const hasAnyHistory = logs.length > 0 || currentVersions.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">버전 기록</h3>
        <p className="text-xs text-gray-500 mt-1">
          {translationIds.length}개 번역 항목의 변경 이력
        </p>
      </div>

      {/* 버전 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {!hasAnyHistory ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            변경 이력이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {/* 현재 버전 섹션 */}
            {currentVersions.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    현재
                  </span>
                  <span className="text-xs text-gray-500">
                    {currentVersions.length}개 항목
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {currentVersions.map((version) => (
                    <div key={version.translationResultId} className="text-sm border-l-2 border-blue-400 pl-3 py-1">
                      <div className="text-gray-900">
                        {version.curre[기밀마스킹]ext || '(빈 텍스트)'}
                      </div>
                      {version.updatedAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(version.updatedAt).toLocaleString('ko-KR')} · {version.updatedBy}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시간별 그룹 */}
            {Object.entries(groupedLogs).map(([key, group]) => (
              <div
                key={key}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <button
                    onClick={() => toggleGroup(key)}
                    className="flex-1 flex items-center gap-3 text-left hover:bg-gray-100 transition-colors -m-3 p-3"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {group.date}
                    </span>
                    <span className="text-xs text-gray-500">{group.time}</span>
                    <span className="text-xs text-gray-500">· {group.changedBy}</span>
                    <span className="text-xs text-gray-400">
                      ({group.logs.length}개 변경)
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ml-auto ${
                        expandedGroups.includes(key) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  
                  {/* 복구 버튼 */}
                  <button
                    onClick={() => handleRevert(group.logs)}
                    disabled={isReverting}
                    className="ml-2 text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isReverting ? '복구 중...' : '이 버전으로 복구'}
                  </button>
                </div>

                {expandedGroups.includes(key) && (
                  <div className="p-3 space-y-2 bg-white">
                    {group.logs.map((log) => (
                      <div
                        key={log.id}
                        className="text-sm border-l-2 border-gray-300 pl-3 py-1"
                      >
                        <div className="text-gray-900 line-clamp-2">
                          {log.newText || '(빈 텍스트)'}
                        </div>
                        {log.previousText && (
                          <div className="text-xs text-gray-400 line-through mt-1 line-clamp-1">
                            ← {log.previousText}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
