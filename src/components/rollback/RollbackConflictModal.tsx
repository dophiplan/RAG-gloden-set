'use client';

import { ConflictAction, ConflictResolution } from '@/hooks/useRollback';

interface RollbackConflictModalProps {
  isOpen: boolean;
  conflicts: ConflictAction[];
  onResolve: (resolution: ConflictResolution) => void;
  targetName?: string;
}

const actionLabels: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  reject: '거부',
  rollback: '복구',
  import: '가져오기',
  export: '낳내기',
  bulk_create: '일괄 생성',
  bulk_update: '일괄 수정',
  bulk_delete: '일괄 삭제',
};

export default function RollbackConflictModal({
  isOpen,
  conflicts,
  onResolve,
  targetName,
}: RollbackConflictModalProps) {
  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={() => onResolve('cancel')}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">롤백 충돌 경고</h3>
                <p className="text-sm text-gray-600">
                  이 항목은 원본 작업 이후 {conflicts.length}개의 추가 수정이 있습니다
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {targetName && (
              <p className="text-sm text-gray-700 mb-4">
                대상: <span className="font-medium">{targetName}</span>
              </p>
            )}

            {/* Conflict List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {conflicts.map((conflict, index) => (
                <div
                  key={conflict.id}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          conflict.action === 'create'
                            ? 'bg-green-100 text-green-700'
                            : conflict.action === 'update'
                            ? 'bg-blue-100 text-blue-700'
                            : conflict.action === 'delete'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {actionLabels[conflict.action] || conflict.action}
                      </span>
                      {conflict.field && (
                        <span className="text-xs text-gray-500">{conflict.field}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(conflict.at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {conflict.user}
                  </div>

                  {/* Changes */}
                  {conflict.changes.from !== undefined && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-red-500 w-10 shrink-0">Before</span>
                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 flex-1 truncate">
                          {conflict.changes.from || '(없음)'}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-green-500 w-10 shrink-0">After</span>
                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 flex-1 truncate">
                          {conflict.changes.to || '(없음)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {index === conflicts.length - 1 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      현재 최신 버전
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>선택하세요:</strong>
              </p>
              <ul className="mt-1 text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>원래대로 복원:</strong> 선택한 시점의 값으로 되돌립니다 (최근 수정은
                  덮어씁니다)
                </li>
                <li>
                  <strong>최신 유지:</strong> 롤백을 취소하고 현재 최신 버전을 유지합니다
                </li>
                <li>
                  <strong>작업 취소:</strong> 아무것도 하지 않고 닫습니다
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => onResolve('overwrite')}
              className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              원래대로 복원
            </button>
            <button
              onClick={() => onResolve('keep_latest')}
              className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              최신 유지
            </button>
            <button
              onClick={() => onResolve('cancel')}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              작업 취소
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
