'use client';

import type { TranslationStatus } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newStatus: TranslationStatus) => void;
  currentStatus: TranslationStatus;
}

export default function StatusRevertModal({
  isOpen,
  onClose,
  onConfirm,
  currentStatus,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">번역 상태 변경</h2>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3">
            완료된 번역({currentStatus === 'reviewed' ? '검수 완료' : '반영 완료'})을 수정하면
            상태를 되돌려야 합니다.
          </p>
          <p className="text-sm text-gray-600">
            어느 상태로 변경하시겠습니까?
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onConfirm('in_progress')}
            className="w-full px-4 py-3 bg-[#E8F5E9] text-[#5FA654] font-semibold rounded-lg hover:bg-[#C8E6C9] text-left"
          >
            <div>
              <p className="font-semibold">진행 중 (in_progress)</p>
              <p className="text-xs text-gray-600">검수 과정부터 다시 진행합니다.</p>
            </div>
          </button>

          <button
            onClick={() => onConfirm('pending')}
            className="w-full px-4 py-3 bg-yellow-50 text-yellow-800 font-semibold rounded-lg hover:bg-yellow-100 text-left"
          >
            <div>
              <p className="font-semibold">대기 (pending)</p>
              <p className="text-xs text-gray-600">번역 요청 상태로 되돌립니다.</p>
            </div>
          </button>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
