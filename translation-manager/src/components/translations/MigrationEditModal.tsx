'use client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onModify: () => void;
  onAddNew: () => void;
  translationText: string;
}

export default function MigrationEditModal({
  isOpen,
  onClose,
  onModify,
  onAddNew,
  translationText,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">마이그레이션 데이터 수정</h2>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            이 데이터는 마이그레이션을 통해 가져온 데이터입니다.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm font-medium text-gray-900">{translationText}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onModify}
            className="w-full px-4 py-3 bg-[#7BC96F] text-white font-semibold rounded-lg hover:bg-[#66BB6A] text-left"
          >
            <div className="flex items-start">
              <span className="text-lg mr-2">✏️</span>
              <div>
                <p className="font-semibold">기존 데이터 수정</p>
                <p className="text-xs opacity-90">현재 레코드의 내용을 변경합니다.</p>
              </div>
            </div>
          </button>

          <button
            onClick={onAddNew}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-left"
          >
            <div className="flex items-start">
              <span className="text-lg mr-2">➕</span>
              <div>
                <p className="font-semibold">새 데이터로 추가</p>
                <p className="text-xs opacity-90">기존 데이터는 유지하고 새 레코드를 생성합니다.</p>
              </div>
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
