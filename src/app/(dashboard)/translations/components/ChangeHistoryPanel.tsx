'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import DiffView, { UserAvatar, getUserColors } from '@/components/rollback/DiffView';
import { showConfirm } from '@/lib/notifications';

// ============================================================================
// Types
// ============================================================================

interface ChangeHistoryItem {
  id: string;
  type: 'audit' | 'translation';
  action: string;
  fieldName: string;
  changeDescription: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  changedBy: string;
  // For bulk view
  translationId?: string;
  translationResultId?: string;
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

type ViewMode = 'timeline' | 'compact';
type ChangeType = 'all' | 'status' | 'text' | 'context' | 'priority' | 'scope';

export interface ChangeHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  translationIds: string[];
  languageCode?: string;
  selectedTranslation?: { id: string; sourceText: string } | null;
  onRevert?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const FIELD_ICONS: Record<string, string> = {
  status: '📊',
  source_text: '📝',
  translated_text: '🌐',
  context: '💬',
  priority: '⚡',
  scope: '📁',
};

const FIELD_LABELS: Record<string, string> = {
  status: '상태 변경',
  source_text: '원문 수정',
  translated_text: '번역 수정',
  context: '설명 수정',
  priority: '중요도 변경',
  scope: '범위 변경',
};

const CHANGE_TYPE_OPTIONS = [
  { value: 'all', label: '모든 변경' },
  { value: 'status', label: '상태 변경' },
  { value: 'text', label: '텍스트 변경' },
  { value: 'context', label: '설명 변경' },
  { value: 'priority', label: '중요도 변경' },
  { value: 'scope', label: '범위 변경' },
];

const VIEW_MODE_OPTIONS = [
  { value: 'timeline', label: '타임라인' },
  { value: 'compact', label: '간략히' },
];

// ============================================================================
// Helper Functions
// ============================================================================

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getChangeTypeFromField(fieldName: string): ChangeType {
  if (fieldName === 'status') return 'status';
  if (fieldName === 'source_text' || fieldName === 'translated_text') return 'text';
  if (fieldName === 'context') return 'context';
  if (fieldName === 'priority') return 'priority';
  if (fieldName === 'scope') return 'scope';
  return 'all';
}

function isTextField(fieldName: string): boolean {
  return fieldName === 'translated_text' || fieldName === 'source_text' || fieldName === 'context';
}

// ============================================================================
// Components
// ============================================================================

function FilterBar({
  changeType,
  onChangeTypeChange,
  viewMode,
  onViewModeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  userFilter,
  onUserFilterChange,
  availableUsers,
}: {
  changeType: ChangeType;
  onChangeTypeChange: (type: ChangeType) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  userFilter: string;
  onUserFilterChange: (user: string) => void;
  availableUsers: string[];
}) {
  const userOptions = [
    { value: '', label: '모든 사용자' },
    ...availableUsers.map(user => ({ value: user, label: user })),
  ];

  return (
    <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
      {/* Top row: Change type and View mode */}
      <div className="flex items-center gap-2">
        <Select
          value={changeType}
          onChange={(e) => onChangeTypeChange(e.target.value as ChangeType)}
          options={CHANGE_TYPE_OPTIONS}
          className="flex-1 min-w-0"
        />
        <div className="flex items-center bg-white rounded-lg border border-gray-300 p-0.5">
          {VIEW_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onViewModeChange(option.value as ViewMode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === option.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: Date range and User filter */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="시작일"
          />
          <span className="text-gray-400 text-xs">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="종료일"
          />
        </div>
        <Select
          value={userFilter}
          onChange={(e) => onUserFilterChange(e.target.value)}
          options={userOptions}
          className="w-28"
        />
      </div>
    </div>
  );
}

function ChangeBadge({ fieldName, isCurrent }: { fieldName: string; isCurrent?: boolean }) {
  const label = FIELD_LABELS[fieldName] || '변경';
  const icon = FIELD_ICONS[fieldName] || '📄';

  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          isCurrent
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-700'
        }`}
      >
        {label}
      </span>
      {isCurrent && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          현재
        </span>
      )}
    </div>
  );
}

function StatusChange({ previousValue, newValue }: { previousValue: string | null; newValue: string | null }) {
  return (
    <div className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
      {previousValue && (
        <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 line-through">
          {previousValue}
        </span>
      )}
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
      {newValue && (
        <span className="px-2 py-0.5 bg-blue-100 rounded text-blue-700">
          {newValue}
        </span>
      )}
    </div>
  );
}

function TimelineItem({
  log,
  isFirst,
  isLast,
  isExpanded,
  onToggleExpand,
  onRevert,
  isReverting,
  isSingle,
}: {
  log: ChangeHistoryItem;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRevert: () => void;
  isReverting: boolean;
  isSingle: boolean;
}) {
  const colors = getUserColors(log.changedBy);
  const isCurrent = log.action === 'current';
  const canRevert = !isCurrent;
  const hasDiff = log.previousValue && log.newValue && log.previousValue !== log.newValue && isTextField(log.fieldName);

  return (
    <div className={`relative ${isLast ? '' : 'mb-6'}`}>
      {/* Timeline dot */}
      <div
        className={`absolute -left-4 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
          isCurrent ? 'bg-blue-500 ring-2 ring-blue-200' : colors.bg.replace('bg-', 'bg-').replace('100', '500')
        }`}
      />

      {/* Content card */}
      <div
        className={`rounded-lg border p-3 shadow-sm ${
          isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
        }`}
      >
        {/* User info */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0">
            <UserAvatar userName={log.changedBy} size="md" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-gray-900">{log.changedBy}</div>
            <div className="text-xs text-gray-500 mt-0.5">{formatDateTime(log.createdAt)}</div>
          </div>
        </div>

        {/* Change type badge */}
        <div className="mb-2">
          <ChangeBadge fieldName={log.fieldName} isCurrent={isCurrent} />
        </div>

        {/* Status change */}
        {log.fieldName === 'status' && <StatusChange previousValue={log.previousValue} newValue={log.newValue} />}

        {/* Text diff */}
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

            <button
              onClick={onToggleExpand}
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

        {/* Current value display */}
        {isCurrent && log.newValue && (
          <div className="mt-2 text-sm text-gray-700 bg-white rounded p-2 border border-blue-100">
            {log.newValue}
          </div>
        )}

        {/* Revert button */}
        {canRevert && isSingle && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={onRevert}
              loading={isReverting}
              className="w-full"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              이 버전으로 복구
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactListItem({
  log,
  onRevert,
  isReverting,
}: {
  log: ChangeHistoryItem;
  onRevert: () => void;
  isReverting: boolean;
}) {
  const isCurrent = log.action === 'current';

  return (
    <div className={`p-3 rounded-lg border ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar userName={log.changedBy} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">{log.changedBy}</span>
              <span className="text-xs text-gray-500">{formatTime(log.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <span>{FIELD_ICONS[log.fieldName] || '📄'}</span>
              <span className="truncate">{FIELD_LABELS[log.fieldName] || log.changeDescription}</span>
            </div>
          </div>
        </div>
        {!isCurrent && (
          <Button size="sm" variant="ghost" onClick={onRevert} loading={isReverting} className="shrink-0">
            복구
          </Button>
        )}
      </div>
    </div>
  );
}

function BulkGroupedItem({
  date,
  time,
  changedBy,
  logs,
  isExpanded,
  onToggleExpand,
  onRevert,
  isReverting,
}: {
  date: string;
  time: string;
  changedBy: string;
  logs: BulkLog[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRevert: () => void;
  isReverting: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gray-50">
        <button onClick={onToggleExpand} className="flex-1 flex items-center gap-3 text-left hover:bg-gray-100 transition-colors -m-3 p-3">
          <span className="text-sm font-medium text-gray-700">{date}</span>
          <span className="text-xs text-gray-500">{time}</span>
          <span className="text-xs text-gray-500">· {changedBy}</span>
          <span className="text-xs text-gray-400">({logs.length}개 변경)</span>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Button size="sm" variant="secondary" onClick={onRevert} loading={isReverting} className="ml-2 whitespace-nowrap">
          이 버전으로 복구
        </Button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2 bg-white">
          {logs.map((log) => (
            <div key={log.id} className="text-sm border-l-2 border-gray-300 pl-3 py-1">
              <div className="text-gray-900 line-clamp-2">{log.newText || '(빈 텍스트)'}</div>
              {log.previousText && (
                <div className="text-xs text-gray-400 line-through mt-1 line-clamp-1">← {log.previousText}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
      <p className="text-sm text-gray-500">불러오는 중...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-sm text-red-500 mb-3">{message}</p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChangeHistoryPanel({
  isOpen,
  onClose,
  translationIds,
  languageCode = 'ko',
  selectedTranslation,
  onRevert,
}: ChangeHistoryPanelProps) {
  // Data states
  const [logs, setLogs] = useState<ChangeHistoryItem[]>([]);
  const [bulkLogs, setBulkLogs] = useState<BulkLog[]>([]);
  const [currentVersions, setCurrentVersions] = useState<CurrentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReverting, setIsReverting] = useState<string | null>(null);
  const [isBulkReverting, setIsBulkReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [changeType, setChangeType] = useState<ChangeType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const isSingle = translationIds.length === 1;
  const isBulk = translationIds.length > 1;

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isOpen || translationIds.length === 0) return;

    try {
      setIsLoading(true);
      setError(null);

      if (isSingle) {
        const data = await apiGet<ChangeHistoryItem[]>(`/api/translations/${translationIds[0]}/logs?language=${languageCode}`);
        setLogs(data);
      } else {
        const data = await apiPost<{ logs?: BulkLog[]; currentVersions?: CurrentVersion[] }>('/api/translations/bulk-logs', {
          translationIds,
          languageCode,
        });
        setBulkLogs(data.logs || []);
        setCurrentVersions((data.currentVersions || []) as CurrentVersion[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, translationIds, languageCode, isSingle]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Change type filter
      if (changeType !== 'all' && getChangeTypeFromField(log.fieldName) !== changeType) {
        return false;
      }

      // Date range filter
      if (dateFrom) {
        const logDate = new Date(log.createdAt);
        const fromDate = new Date(dateFrom);
        if (logDate < fromDate) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) return false;
      }

      // User filter
      if (userFilter && log.changedBy !== userFilter) {
        return false;
      }

      return true;
    });
  }, [logs, changeType, dateFrom, dateTo, userFilter]);

  // Group bulk logs by time
  const groupedBulkLogs = useMemo(() => {
    const grouped = bulkLogs.reduce(
      (acc, log) => {
        const date = formatDate(log.createdAt);
        const time = formatTime(log.createdAt);
        const key = `${date} ${time}`;

        if (!acc[key]) {
          acc[key] = { date, time, logs: [], changedBy: log.changedBy, timestamp: log.createdAt };
        }
        acc[key].logs.push(log);
        return acc;
      },
      {} as Record<string, { date: string; time: string; logs: BulkLog[]; changedBy: string; timestamp: string }>
    );

    // Sort by timestamp descending
    return Object.entries(grouped).sort((a, b) => new Date(b[1].timestamp).getTime() - new Date(a[1].timestamp).getTime());
  }, [bulkLogs]);

  // Get available users from logs
  const availableUsers = useMemo(() => {
    const users = new Set<string>();
    if (isSingle) {
      logs.forEach((log) => users.add(log.changedBy));
    } else {
      bulkLogs.forEach((log) => users.add(log.changedBy));
    }
    return Array.from(users).sort();
  }, [logs, bulkLogs, isSingle]);

  // Toggle expand
  const toggleExpand = (logId: string) => {
    setExpandedLogs((prev) => (prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]));
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // Revert handlers
  const handleRevertSingle = async (log: ChangeHistoryItem) => {
    if (!showConfirm(`이 버전으로 복구하시겠습니까?\n\n${log.changeDescription}`)) return;

    try {
      setIsReverting(log.id);
      await apiPost(`/api/translations/${translationIds[0]}/revert`, { logId: log.id, languageCode });
      await fetchData();
      onRevert?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsReverting(null);
    }
  };

  const handleRevertBulk = async (groupLogs: BulkLog[]) => {
    if (!showConfirm(`이 버전으로 복구하시겠습니까?\n${groupLogs.length}개 항목이 변경됩니다.`)) return;

    try {
      setIsBulkReverting(true);
      const revertItems = groupLogs.map((log) => ({
        translationResultId: log.translationResultId,
        revertText: log.previousText,
      }));

      await apiPost('/api/translations/bulk-revert', { revertItems });
      await fetchData();
      onRevert?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setIsBulkReverting(false);
    }
  };

  // Export history
  const handleExport = () => {
    const data = isSingle ? filteredLogs : bulkLogs;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const title = isSingle
    ? selectedTranslation?.sourceText
      ? `${selectedTranslation.sourceText.slice(0, 30)}${selectedTranslation.sourceText.length > 30 ? '...' : ''}`
      : '변경 이력'
    : `${translationIds.length}개 항목의 변경 이력`;

  const subtitle = isSingle ? `ID: ${translationIds[0]?.slice(0, 8)}... · 언어: ${languageCode.toUpperCase()}` : '';

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleExport} title="내보내기">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </Button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        changeType={changeType}
        onChangeTypeChange={setChangeType}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        availableUsers={availableUsers}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && <LoadingState />}

        {!isLoading && error && <ErrorState message={error} onRetry={fetchData} />}

        {!isLoading && !error && isSingle && filteredLogs.length === 0 && <EmptyState message="변경 이력이 없습니다." />}

        {!isLoading && !error && isBulk && bulkLogs.length === 0 && currentVersions.length === 0 && (
          <EmptyState message="변경 이력이 없습니다." />
        )}

        {!isLoading && !error && isSingle && filteredLogs.length > 0 && (
          <>
            {viewMode === 'timeline' ? (
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />

                {filteredLogs.map((log, index) => (
                  <TimelineItem
                    key={log.id}
                    log={log}
                    isFirst={index === 0}
                    isLast={index === filteredLogs.length - 1}
                    isExpanded={expandedLogs.includes(log.id)}
                    onToggleExpand={() => toggleExpand(log.id)}
                    onRevert={() => handleRevertSingle(log)}
                    isReverting={isReverting === log.id}
                    isSingle={true}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <CompactListItem
                    key={log.id}
                    log={log}
                    onRevert={() => handleRevertSingle(log)}
                    isReverting={isReverting === log.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && !error && isBulk && (bulkLogs.length > 0 || currentVersions.length > 0) && (
          <div className="space-y-3">
            {/* Current versions */}
            {currentVersions.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    현재
                  </span>
                  <span className="text-xs text-gray-500">{currentVersions.length}개 항목</span>
                </div>
                <div className="mt-2 space-y-2">
                  {currentVersions.map((version) => (
                    <div key={version.translationResultId} className="text-sm border-l-2 border-blue-400 pl-3 py-1">
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
            )}

            {/* Grouped logs */}
            {groupedBulkLogs.map(([key, group]) => (
              <BulkGroupedItem
                key={key}
                date={group.date}
                time={group.time}
                changedBy={group.changedBy}
                logs={group.logs}
                isExpanded={expandedGroups.includes(key)}
                onToggleExpand={() => toggleGroup(key)}
                onRevert={() => handleRevertBulk(group.logs)}
                isReverting={isBulkReverting}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Bulk actions */}
      {isBulk && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {translationIds.length}개 항목 선택됨
            </span>
            <Button size="sm" variant="secondary" onClick={handleExport}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              이력 내보내기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeHistoryPanel;
