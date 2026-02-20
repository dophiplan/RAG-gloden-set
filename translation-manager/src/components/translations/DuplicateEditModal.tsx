'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface DuplicateInfo {
  translationId: string;
  sourceText: string;
  duplicateIds: string[];
  duplicateCount: number;
}

interface DuplicateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateInfo?: DuplicateInfo | null;
  fieldName?: string;
  newValue?: string;
  onConfirm?: (updateAll: boolean) => Promise<void>;
  // Aliases for backward compatibility
  duplicates?: string[];
  newVersion?: string;
}

export default function DuplicateEditModal({
  isOpen,
  onClose,
  duplicateInfo,
  fieldName,
  newValue,
  onConfirm,
}: DuplicateEditModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!duplicateInfo) return null;

  const handleConfirm = async (updateAll: boolean) => {
    if (!onConfirm) return;
    setIsUpdating(true);
    try {
      await onConfirm(updateAll);
      onClose();
    } catch (error) {
      console.error('Error updating:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="중복 데이터 수정" size="md">
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            동일한 원문을 가진 데이터가 <strong>{duplicateInfo.duplicateCount}개</strong> 더 있습니다.
          </p>
        </div>

        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">원문:</p>
          <p className="bg-gray-100 p-2 rounded text-xs truncate">
            {duplicateInfo.sourceText}
          </p>
        </div>

        <div className="text-sm text-gray-600">
          <p className="font-medium mb-1">변경 내용:</p>
          <p className="text-xs">
            <span className="font-medium">{fieldName}</span> → <span className="text-blue-600">{newValue || '(빈 값)'}</span>
          </p>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            어떤 데이터를 수정하시겠습니까?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleConfirm(false)}
              disabled={isUpdating}
              variant="secondary"
              className="w-full justify-center"
            >
              이것만 수정
            </Button>
            <Button
              onClick={() => handleConfirm(true)}
              disabled={isUpdating}
              className="w-full justify-center"
            >
              과거 데이터도 모두 수정 ({duplicateInfo.duplicateCount + 1}개)
            </Button>
          </div>
        </div>

        {isUpdating && (
          <p className="text-center text-sm text-gray-500">수정 중...</p>
        )}
      </div>
    </Modal>
  );
}
