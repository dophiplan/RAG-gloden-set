'use client';

// Icons replaced with inline SVGs
import { RollbackConflict } from '../hooks/useGlossaryRollback';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: RollbackConflict[];
  onResolve: (resolution: 'overwrite' | 'cancel') => void;
  isLoading?: boolean;
}

export default function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  onResolve,
  isLoading = false,
}: ConflictResolutionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-900">
                {conflicts.length > 1 
                  ? `${conflicts.length}개 항목에 충돌 발생`
                  : '다른 사용자가 수정했습니다'
                }
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                일부 항목이 다른 사용자에 의해 수정되어 복구할 수 없습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
          {conflicts.map((conflict, index) => (
            <ConflictItem
              key={conflict.glossaryId}
              conflict={conflict}
              isLast={index === conflicts.length - 1}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex flex-col gap-3">
            {/* Primary action */}
            <button
              onClick={() => onResolve('overwrite')}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                  현재 값 덮어쓰기 (강제 복구)
                </>
              )}
            </button>

            {/* Secondary actions */}
            <div className="flex gap-3">
              <button
                onClick={() => onResolve('cancel')}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                취소
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 py-2 px-4 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                닫기 (나중에 해결)
              </button>
            </div>
          </div>

          {/* Warning */}
          <p className="mt-3 text-xs text-gray-500 text-center">
            * "덮어쓰기"를 선택하면 다른 사용자의 변경사항이 손실됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

interface ConflictItemProps {
  conflict: RollbackConflict;
  isLast: boolean;
}

function ConflictItem({ conflict, isLast }: ConflictItemProps) {
  return (
    <div className={`py-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{conflict.glossaryId}</span>
        {conflict.serverVersion && (
          <span className="text-xs text-gray-500">
            서버 버전: v{conflict.serverVersion}
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16">현재 값:</span>
          <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
            {conflict.currentValue || '(없음)'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16">복구 값:</span>
          <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">
            {conflict.expectedValue || '(없음)'}
          </span>
        </div>
      </div>
    </div>
  );
}
