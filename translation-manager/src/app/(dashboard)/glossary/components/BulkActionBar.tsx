import React from 'react';
import Button from '@/components/ui/Button';
import { showConfirm } from '@/lib/notifications';

interface BulkActionBarProps {
  selectedCount: number;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onClearSelection: () => void;
}

/**
 * Bulk action bar that appears at the bottom when items are selected
 * Allows batch approval/rejection of glossary terms
 */
export default function BulkActionBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  const handleApprove = () => {
    if (showConfirm(`${selectedCount}개 용어를 승인하시겠습니까?`)) {
      onApproveAll();
    }
  };

  const handleReject = () => {
    if (showConfirm(`${selectedCount}개 용어를 거부하시겠습니까?`)) {
      onRejectAll();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount}개 선택됨
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={handleApprove}
              >
                ✓ 일괄 승인
              </Button>
              <Button
                size="sm"
                variant="error"
                onClick={handleReject}
              >
                ✗ 일괄 거부
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
              >
                선택 해제
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
