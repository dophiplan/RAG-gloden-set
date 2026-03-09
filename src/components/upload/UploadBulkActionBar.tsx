'use client';

import Button from '@/components/ui/Button';
import { showConfirm, showSuccess } from '@/lib/notifications';
import type { UploadBulkActionBarProps } from '@/types/upload';

/**
 * UploadBulkActionBar - 업로드 페이지 일괄 작업 바
 * 
 * 번역관리의 TranslationBulkActionBar와 유사한 UI/UX를 제공합니다.
 * 체크박스로 선택된 항목에 대한 일괄 작업을 지원합니다.
 */
export default function UploadBulkActionBar({
  selectedCount,
  selectedItems,
  onClearSelection,
  onBulkGlossaryAdd,
  isProcessing = false,
}: UploadBulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  // 선택된 항목 중 용어집에 없는 항목 수
  const nonGlossaryCount = selectedItems.filter(
    item => !item.glossaryMatch?.exists
  ).length;

  const handleBulkGlossaryAdd = () => {
    if (nonGlossaryCount === 0) {
      showSuccess('선택된 항목들은 이미 용어집에 등록되어 있습니다.');
      return;
    }

    const confirmed = showConfirm(
      `${nonGlossaryCount}개 항목을 용어집에 추가하시겠습니까?\n(이미 등록된 항목은 제외됩니다)`
    );

    if (confirmed) {
      onBulkGlossaryAdd();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* 왼쪽: 선택 개수 */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount}개 선택됨
            </span>
            {nonGlossaryCount > 0 && (
              <span className="text-xs text-orange-600">
                (용어집 미등록: {nonGlossaryCount}개)
              </span>
            )}
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div className="flex items-center gap-3">
            {/* 일괄 용어집 추가 */}
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkGlossaryAdd}
              disabled={isProcessing || nonGlossaryCount === 0}
              loading={isProcessing}
            >
              <span className="mr-1">📚</span> 일괄 용어집 추가
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 선택 해제 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={isProcessing}
            >
              ✕ 선택 해제
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
