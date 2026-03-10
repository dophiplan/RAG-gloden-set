'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import DiffView, { UserAvatar, getUserColors } from '@/components/rollback/DiffView';

// ============================================
// 타입 정의
// ============================================

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

export interface UnifiedVersionHistoryPanelProps {
  mode: 'single' | 'bulk';
  translationId?: string;
  translationIds?: string[];
  languageCode: string;
  curre[기밀마스킹]ext?: string;
  onClose?: () => void;
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

// ============================================
// 유틸리티 함수
// ============================================

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

function formatDateTimeBulk(dateString: string): { date: string; time: string } {
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

const fieldIcons: Record<string, string> = {
  status: '📊',
  source_text: '📝',
  translated_text: '🌐',
  context: '💬',
  priority: '⚡',
  scope: '📁',
};

const fieldLabels: Record<string, string> = {
  status: '상태 변경',
  source_text: '원문 수정',
  translated_text: '번역 수정',
  context: '설명 수정',
  priority: '중요도 변경',
  scope: '범위 변경',
};

// ============================================
// 메인 컴포넌트
// ============================================

export function UnifiedVersionHistoryPanel({
  mode,
  translationId,
  translationIds,
  languageCode,
  curre[기밀마스킹]ext,
  onClose,
  onRevert,
}: UnifiedVersionHistoryPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // single 모드 상태
  const [logs, setLogs] = useState<VersionHistory[]>([]);
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);

  // bulk 모드 상태
  const [bulkLogs, setBulkLogs] = useState<BulkLog[]>([]);
  const [currentVersions, setCurrentVersions] = useState<CurrentVersion[]>([]);
  const [isBulkReverting, setIsBulkReverting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const fetchSingleLogs = async () => {
    if (!translationId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<VersionHistory[]>(
        `/api/translations/${translationId}/logs?language=${languageCode}`
      );
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBulkLogs = async () => {
    if (!translationIds || translationIds.length === 0) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiPost<{
        logs?: BulkLog[];
        currentVersions?: unknown[];
      }>('/api/translations/bulk-logs', {
        translationIds,
        languageCode,
      });
      setBulkLogs(data.logs || []);
      setCurrentVersions((data.currentVersions || []) as CurrentVersion[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleRevert = async (log: VersionHistory) => {
    if (!translationId) return;
    if (!confirm(`이 버전으로 복구하시겠습니까?\n\n${log.changeDescription}`)) {
      return;
    }

    try {
      setIsReverting(log.id);
      await apiPost(`/api/translations/${translationId}/revert`, {
        logId: log.id,
        languageCode,
      });
      await fetchSingleLogs();
      alert('복구가 완료되었습니다.');
      onRevert?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsReverting(null);
    }
  };

  const handleBulkRevert = async (groupLogs: BulkLog[]) => {
    if (!confirm(`이 버전으로 복구하시겠습니까?\n${groupLogs.length}개 항목이 변경됩니다.`)) {
      return;
    }

    try {
      setIsBulkReverting(true);
      const revertItems = groupLogs.map((log) => ({
        translationResultId: log.translationResultId,
        revertText: log.previousText,
      }));

      const result = await apiPost<{ message?: string }>('/api/translations/bulk-revert', {
        revertItems,
      });
      alert(result.message || '복구되었습니다.');
      await fetchBulkLogs();
      onRevert?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsBulkReverting(false);
    }
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const groupedLogs: GroupedLogs = useMemo(() => {
    return bulkLogs.reduce((acc, log) => {
      const { date, time } = formatDateTimeBulk(log.createdAt);
      const key = `${date} ${time}`;

      if (!acc[key]) {
        acc[key] = {
          date,
          time,
          logs: [],
          changedBy: log.changedBy,
          timestamp: log.createdAt,
        };
      }
      acc[key].logs.push(log);
      return acc;
    }, {} as GroupedLogs);
  }, [bulkLogs]);

  useEffect(() => {
    if (mode === 'single' && translationId && languageCode) {
      fetchSingleLogs();
    } else if (mode === 'bulk' && translationIds && translationIds.length > 0 && languageCode) {
      fetchBulkLogs();
    }
  }, [mode, translationId, translationIds, languageCode]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <Header
          mode={mode}
          translationId={translationId}
          translationIds={translationIds}
          languageCode={languageCode}
          onClose={onClose}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-gray-500">불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <Header
          mode={mode}
          translationId={translationId}
          translationIds={translationIds}
          languageCode={languageCode}
          onClose={onClose}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-red-500 text-center">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <Header
        mode={mode}
        translationId={translationId}
        translationIds={translationIds}
        languageCode={languageCode}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'single' ? (
          <SingleModeView
            logs={logs}
            expandedLogs={expandedLogs}
            isReverting={isReverting}
            curre[기밀마스킹]ext={curre[기밀마스킹]ext}
            onToggleExpand={toggleExpand}
            onRevert={handleSingleRevert}
          />
        ) : (
          <BulkModeView
            groupedLogs={groupedLogs}
            currentVersions={currentVersions}
            expandedGroups={expandedGroups}
            isReverting={isBulkReverting}
            onToggleGroup={toggleGroup}
            onRevert={handleBulkRevert}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// 서브 컴포넌트: 헤더
// ============================================

interface HeaderProps {
  mode: 'single' | 'bulk';
  translationId?: string;
  translationIds?: string[];
  languageCode: string;
  onClose?: () => void;
}

function Header({ mode, translationId, translationIds, languageCode, onClose }: HeaderProps) {
  const title = mode === 'single' ? '📋 버전 기록' : '📋 벌크 버전 기록';
  const subtitle =
    mode === 'single'
      ? `번역 ID: ${translationId?.slice(0, 8)}... · 언어: ${languageCode.toUpperCase()}`
      : `${translationIds?.length || 0}개 번역 항목의 변경 이력 · 언어: ${languageCode.toUpperCase()}`;

  return (
    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
      <div>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <svg
            className="w-5 h-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================
// 서브 컴포넌트: Single 모드 뷰
// ============================================

interface SingleModeViewProps {
  logs: VersionHistory[];
  expandedLogs: string[];
  isReverting: string | null;
  curre[기밀마스킹]ext?: string;
  onToggleExpand: (logId: string) => void;
  onRevert: (log: VersionHistory) => void;
}

function SingleModeView({
  logs,
  expandedLogs,
  isReverting,
  curre[기밀마스킹]ext,
  onToggleExpand,
  onRevert,
}: SingleModeViewProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm text-gray-500">변경 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* 타임라인 선 */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

      {logs.map((log) => {
        const colors = getUserColors(log.changedBy);
        const isCurrent = log.action === 'current';
        const canRevert = !isCurrent;
        const hasDiff =
          log.previousValue &&
          log.newValue &&
          log.previousValue !== log.newValue &&
          (log.fieldName === 'translated_text' ||
            log.fieldName === 'source_text' ||
            log.fieldName === 'context');
        const isExpanded = expandedLogs.includes(log.id);

        return (
          <div key={log.id} className={`relative mb-6 ${isCurrent ? 'opacity-100' : ''}`}>
            {/* 타임라인 점 */}
            <div
              className={`absolute -left-4 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                isCurrent
                  ? 'bg-blue-500 ring-2 ring-blue-200'
                  : colors.bg.replace('bg-', 'bg-').replace('100', '500')
              }`}
            />

            {/* 내용 카드 */}
            <div
              className={`rounded-lg border ${
                isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
              } p-3 shadow-sm`}
            >
              {/* 상단: 사용자 정보 */}
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
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    log.type === 'audit'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
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
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 line-through">
                    {log.previousValue}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
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
                      {String(log.newValue).slice(0, 50)}
                      {String(log.newValue).length > 50 ? '...' : ''}
                    </div>
                  )}

                  {/* Diff 토글 버튼 */}
                  <button
                    onClick={() => onToggleExpand(log.id)}
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
              {isCurrent && (log.newValue || curre[기밀마스킹]ext) && (
                <div className="mt-2 text-sm text-gray-700 bg-white rounded p-2 border border-blue-100">
                  {log.newValue || curre[기밀마스킹]ext}
                </div>
              )}

              {/* 복구 버튼 */}
              {canRevert && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => onRevert(log)}
                    disabled={isReverting === log.id}
                    className="w-full text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    {isReverting === log.id ? (
                      <>
                        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        복구 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
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
  );
}

// ============================================
// 서브 컴포넌트: Bulk 모드 뷰
// ============================================

interface BulkModeViewProps {
  groupedLogs: GroupedLogs;
  currentVersions: CurrentVersion[];
  expandedGroups: string[];
  isReverting: boolean;
  onToggleGroup: (key: string) => void;
  onRevert: (logs: BulkLog[]) => void;
}

function BulkModeView({
  groupedLogs,
  currentVersions,
  expandedGroups,
  isReverting,
  onToggleGroup,
  onRevert,
}: BulkModeViewProps) {
  const hasAnyHistory =
    Object.keys(groupedLogs).length > 0 || currentVersions.length > 0;

  if (!hasAnyHistory) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm text-gray-500">변경 이력이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 타임라인 선 */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

        {/* 현재 버전 섹션 */}
        {currentVersions.length > 0 && (
          <div className="relative mb-6">
            {/* 타임라인 점 - 현재 */}
            <div className="absolute -left-4 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm bg-blue-500 ring-2 ring-blue-200" />

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  현재
                </span>
                <span className="text-xs text-gray-500">{currentVersions.length}개 항목</span>
              </div>
              <div className="mt-2 space-y-2">
                {currentVersions.map((version) => (
                  <div
                    key={version.translationResultId}
                    className="text-sm border-l-2 border-blue-400 pl-3 py-1"
                  >
                    <div className="text-gray-900">{version.curre[기밀마스킹]ext || '(빈 텍스트)'}</div>
                    {version.updatedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(version.updatedAt).toLocaleString('ko-KR')} · {version.updatedBy}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 시간별 그룹 */}
        {Object.entries(groupedLogs).map(([key, group]) => {
          const colors = getUserColors(group.changedBy);
          const isExpanded = expandedGroups.includes(key);

          return (
            <div key={key} className="relative mb-6">
              {/* 타임라인 점 */}
              <div
                className={`absolute -left-4 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${colors.bg
                  .replace('bg-', 'bg-')
                  .replace('100', '500')}`}
              />

              {/* 그룹 카드 */}
              <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* 그룹 헤더 */}
                <div className="flex items-center justify-between p-3 bg-gray-50">
                  <button
                    onClick={() => onToggleGroup(key)}
                    className="flex-1 flex items-center gap-3 text-left hover:bg-gray-100 transition-colors -m-3 p-3"
                  >
                    <div className="flex-shrink-0">
                      <UserAvatar userName={group.changedBy} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{group.changedBy}</span>
                        <span className="text-xs text-gray-500">· {group.date}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {group.time} · {group.logs.length}개 변경
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ml-auto ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 복구 버튼 */}
                  <button
                    onClick={() => onRevert(group.logs)}
                    disabled={isReverting}
                    className="ml-2 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors shadow-sm"
                  >
                    {isReverting ? '복구 중...' : '이 버전으로 복구'}
                  </button>
                </div>

                {/* 확장된 상세 내용 */}
                {isExpanded && (
                  <div className="p-3 space-y-2 bg-white border-t border-gray-100">
                    {group.logs.map((log) => (
                      <div key={log.id} className="text-sm border-l-2 border-gray-300 pl-3 py-1">
                        <div className="text-gray-900 line-clamp-2">{log.newText || '(빈 텍스트)'}</div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
