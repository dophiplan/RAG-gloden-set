import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { ProductCode, TranslationStatus } from '@/types';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import { useProducts } from '@/hooks/useReferenceData';

interface TranslationBulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
  onOpenEmailModal?: (templateType: 'translation_request') => void;
  onOpenDeploymentModal?: () => void;
}

/**
 * TranslationBulkActionBar - 번역 항목 일괄 작업 바
 *
 * 여러 번역 항목을 선택했을 때 하단에 표시되는 일괄 작업 바입니다.
 * 용어집의 BulkActionBar와 유사하지만 번역 관리에 특화된 기능을 제공합니다.
 *
 * 기능:
 * - 제품 일괄 변경 (셀렉트 박스)
 * - 상태 일괄 변경 (셀렉트 박스)
 * - 선택 해제
 */
export default function TranslationBulkActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onRefresh,
  onOpenEmailModal,
  onOpenDeploymentModal,
}: TranslationBulkActionBarProps) {
  const { products } = useProducts();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<TranslationStatus | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  // Generate product options for multi-select
  const productOptions = products.map(p => ({ value: p.code, label: p.name }));

  // Status options
  const statusOptions = [
    { value: '', label: '상태 선택...' },
    { value: 'pending', label: '요청' },
    { value: 'in_progress', label: '진행중' },
    { value: 'reviewed', label: '검수중' },
    { value: 'deployed', label: '반영완료' },
  ];

  const handleBulkProductChange = async () => {
    if (selectedProducts.length === 0) {
      showError('제품을 선택해주세요.');
      return;
    }

    const productNames = selectedProducts
      .map(code => products.find(p => p.code === code)?.name || code)
      .join(', ');

    if (!showConfirm(`${selectedCount}개 항목의 제품을 "${productNames}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/translations/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translation_ids: selectedIds,
          product_codes: selectedProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '제품 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}개 항목의 제품이 변경되었습니다.`);
      setSelectedProducts([]);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk product change error:', error);
      showError(error instanceof Error ? error.message : '제품 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkStatusChange = async (status?: TranslationStatus) => {
    const targetStatus = status || selectedStatus;

    if (!targetStatus) {
      showError('상태를 선택해주세요.');
      return;
    }

    const statusLabels: Record<TranslationStatus, string> = {
      re_request: '재요청',
      re_deploy_request: '재반영요청',
      pending: '요청',
      in_progress: '진행중',
      reviewed: '검수중',
      deployed: '반영완료',
      not_used: '사용안함',
    };

    const statusLabel = statusLabels[targetStatus as TranslationStatus];
    if (!showConfirm(`${selectedCount}개 항목의 상태를 "${statusLabel}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/translations/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          translation_ids: selectedIds,
          status: targetStatus,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '상태 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}개 항목의 상태가 변경되었습니다.`);
      setSelectedStatus('');
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk status change error:', error);
      showError(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
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
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div className="flex items-center gap-3">
            {/* 메일/배포 액션 */}
            {onOpenEmailModal && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onOpenEmailModal('translation_request')}
                disabled={isProcessing}
              >
                메일 발송
              </Button>
            )}
            {onOpenDeploymentModal && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onOpenDeploymentModal}
                disabled={isProcessing}
              >
                반영 완료 체크
              </Button>
            )}

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 빠른 상태 변경 */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('reviewed')}
              disabled={isProcessing}
              loading={isProcessing}
            >
              검수 완료로 변경
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('deployed')}
              disabled={isProcessing}
              loading={isProcessing}
            >
              반영 완료로 변경
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 제품 일괄 변경 */}
            <div className="flex items-center gap-2">
              <MultiSelectDropdown
                options={productOptions}
                selected={selectedProducts}
                onChange={setSelectedProducts}
                placeholder="제품 선택..."
                disabled={isProcessing}
                className="w-48"
                openUpward={true}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkProductChange}
                disabled={selectedProducts.length === 0 || isProcessing}
                loading={isProcessing}
              >
                변경
              </Button>
            </div>

            {/* 상태 일괄 변경 */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as TranslationStatus | '')}
                options={statusOptions}
                className="w-40"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkStatusChange()}
                disabled={!selectedStatus || isProcessing}
                loading={isProcessing}
              >
                변경
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 선택 해제 */}
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearSelection}
              disabled={isProcessing}
            >
              ✕
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
