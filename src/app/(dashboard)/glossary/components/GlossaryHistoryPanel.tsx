'use client';

import { useEffect, useState } from 'react';
import { AuditLogEntry } from '../hooks/useGlossaryRollback';
import { useRollback, ConflictResolution } from '@/hooks/useRollback';
import RollbackConflictModal from '@/components/rollback/RollbackConflictModal';
import DiffView, { UserAvatar, getUserColors } from '@/components/rollback/DiffView';

interface GlossaryHistoryPanelProps {
  glossaryId: string;
  term: string;
  isOpen: boolean;
  onClose: () => void;
  auditHistory: AuditLogEntry[];
  isLoading: boolean;
  onRevert?: (auditLogId: string, fieldName: string | null) => void; // deprecated, use onSuccess instead
  onSuccess?: () => void; // 롤백 성공 시 호출
  currentVersion?: number;
}

const fieldNameLabels: Record<string, string> = {
  term: '용어',
  translation: '번역',
  context: '문맥',
  approval_status: '상태',
};

const actionLabels: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  reject: '거부',
  rollback: '복구',
  bulk_create: '일괄 생성',
  bulk_update: '일괄 수정',
  bulk_delete: '일괄 삭제',
  bulk_approve: '일괄 승인',
  bulk_reject: '일괄 거부',
  import: '가져오기',
};

export default function GlossaryHistoryPanel({
  glossaryId,
  term,
  isOpen,
  onClose,
  auditHistory,
  isLoading,
  onRevert,
  onSuccess,
  currentVersion,
}: GlossaryHistoryPanelProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // 새로운 롤백 시스템 사용
  const rollback = useRollback('glossary', () => {
    onSuccess?.();
  });

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/* History Icon */}
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">변경 이력</h2>
              <p className="text-sm text-gray-500">{term}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Version Info */}
        {currentVersion && (
          <div className="px-6 py-2 bg-indigo-50 border-b border-indigo-100">
            <span className="text-xs font-medium text-indigo-700">
              현재 버전: v{currentVersion}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <svg className="w-12 h-12 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">변경 이력이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {auditHistory.map((log, index) => (
                <HistoryItem
                  key={log.id}
                  log={log}
                  isFirst={index === 0}
                  isSelected={selectedLogId === log.id}
                  onSelect={() => setSelectedLogId(log.id)}
                  onRevert={async () => {
                    // 새로운 롤백 시스템 사용
                    const result = await rollback.rollbackWithConfirm(
                      log.id,
                      glossaryId,
                      { fieldName: log.field_name }
                    );
                    // 충돌이 없어서 바로 실행된 경우
                    if (result) {
                      onSuccess?.();
                    }
                  }}
                  isReverting={rollback.isLoading || rollback.isChecking}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            * 복구를 클릭하면 해당 시점의 값으로 되돌립니다.
          </p>
        </div>
      </div>
      
      {/* Rollback Conflict Modal */}
      <RollbackConflictModal
        isOpen={rollback.showConflictModal}
        conflicts={rollback.conflicts}
        onResolve={(resolution) => {
          rollback.resolveAndExecute(resolution);
        }}
        targetName={term}
      />
    </>
  );
}

interface HistoryItemProps {
  log: AuditLogEntry;
  isFirst: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRevert: () => void;
  isReverting?: boolean;
}

function HistoryItem({ log, isFirst, isSelected, onSelect, onRevert, isReverting }: HistoryItemProps) {
  const isRollback = log.is_rollback || (log as any).is_rolled_back;
  const fieldName = log.field_name || '전체';
  const oldValue = log.old_value || '(없음)';
  const newValue = log.new_value || '(없음)';
  const colors = getUserColors(log.user_name || log.user_email);

  return (
    <div
      className={`p-4 transition-colors cursor-pointer ${
        isSelected 
          ? `${colors.light} border-l-4 ${colors.border.replace('border', 'border-l')}` 
          : 'border-l-4 border-transparent hover:bg-gray-50'
      } ${isRollback ? 'opacity-70' : ''}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserAvatar userName={log.user_name} userEmail={log.user_email} size="sm" />
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              isRollback
                ? 'bg-purple-100 text-purple-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {actionLabels[log.action] || log.action}
          </span>
          {log.field_name && (
            <span className="text-xs text-gray-500">
              {fieldNameLabels[log.field_name] || log.field_name}
            </span>
          )}
        </div>
        <time className="text-xs text-gray-400">
          {new Date(log.created_at).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>

      {/* User Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {log.user_name || log.user_email}
        </span>
      </div>

      {/* Diff View (when selected) */}
      {isSelected && !isRollback && log.field_name && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <DiffView
            oldValue={log.old_value}
            newValue={log.new_value}
            userName={log.user_name}
            showInline={true}
          />
        </div>
      )}
      
      {/* Collapsed View */}
      {!isSelected && !isRollback && log.field_name && (
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500 line-through truncate flex-1">
              {oldValue}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 truncate flex-1">
              {newValue}
            </span>
          </div>
        </div>
      )}

      {/* Rollback indicator */}
      {isRollback && (
        <div className="mt-2 text-xs text-purple-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>이전 버전으로 복구됨</span>
        </div>
      )}

      {/* Revert button */}
      {!isRollback && isSelected && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRevert();
            }}
            disabled={isReverting}
            className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReverting ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                이 버전으로 복구
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
