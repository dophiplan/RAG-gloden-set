import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { ProductCode, TranslationStatus } from '@/types';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import { useProducts } from '@/hooks/useReferenceData';
import { apiPatch, apiDelete, apiFetch } from '@/lib/api-utils';

interface TranslationBulkActionBarProps {
  selectedCount: number;
  selectedIds?: string[];
  onClearSelection: () => void;
  onRefresh?: () => void;
  onOpenEmailModal?: (templateType: 'translation_request') => void;
  onOpenDeploymentModal?: () => void;
  // Additional handlers for backward compatibility
  onBulkStatusChange?: (status: TranslationStatus) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onBulkExport?: () => Promise<void>;
  onVersionHistoryClick?: () => void;
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
  onBulkStatusChange,
  onBulkDelete,
}: TranslationBulkActionBarProps) {
  const { products } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<ProductCode | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<TranslationStatus | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Debug log
  console.log('TranslationBulkActionBar - selectedCount:', selectedCount, 'selectedIds:', selectedIds);

  if (selectedCount === 0) {
    return null;
  }

  // Generate product options for select
  const productOptions = [
    { value: '', label: '제품 선택...' },
    ...(products || []).map(p => ({ value: p.code, label: p.name }))
  ];

  // Status options
  const statusOptions = [
    { value: '', label: '상태 선택...' },
    { value: 'pending', label: '요청' },
    { value: 'in_progress', label: '진행중' },
    { value: 'reviewed', label: '검수중' },
    { value: 'deployed', label: '반영완료' },
  ];

  const handleBulkProductChange = async () => {
    if (!selectedProduct) {
      showError('제품을 선택해주세요.');
      return;
    }

    const productName = (products || []).find(p => p.code === selectedProduct)?.name || selectedProduct;

    if (!showConfirm(`${selectedCount}개 항목의 제품을 "${productName}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await apiPatch('/api/translations/bulk-update', {
        translation_ids: selectedIds,
        product_code: selectedProduct,
      });

      showSuccess(`${selectedCount}개 항목의 제품이 변경되었습니다.`);
      setSelectedProduct('');
      onClearSelection();
      onRefresh?.();
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

    // 외부에서 onBulkStatusChange prop이 전달되면 사용
    if (onBulkStatusChange) {
      await onBulkStatusChange(targetStatus);
      setSelectedStatus('');
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
      await apiPatch('/api/translations/bulk-update', {
        translation_ids: selectedIds,
        status: targetStatus,
      });

      showSuccess(`${selectedCount}개 항목의 상태가 변경되었습니다.`);
      setSelectedStatus('');
      onClearSelection();
      onRefresh?.();
    } catch (error) {
      console.error('Bulk status change error:', error);
      showError(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds || selectedIds.length === 0) {
      showError('삭제할 항목을 선택해주세요.');
      return;
    }

    if (onBulkDelete) {
      // Use parent handler (it will show confirm and handle API)
      try {
        await onBulkDelete(selectedIds);
        onClearSelection(); // Clear selection after successful deletion
      } catch (error) {
        // Error is already handled by parent
      }
      return;
    } else {
      // Direct API call if handler not provided
      const confirmed = showConfirm(`${selectedCount}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
      if (!confirmed) return;

      setIsProcessing(true);
      try {
        const result = await apiFetch<{ deleted: number }>('/api/translations/bulk', { 
          method: 'DELETE',
          body: JSON.stringify({ ids: selectedIds })
        });
        showSuccess(`${result.deleted}개 항목이 삭제되었습니다.`);
        onClearSelection();
        onRefresh?.();
      } catch (error) {
        console.error('Bulk delete error:', error);
        showError(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
      } finally {
        setIsProcessing(false);
      }
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
              <Select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value as ProductCode | '')}
                options={productOptions}
                className="w-48"
                disabled={isProcessing}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkProductChange}
                disabled={!selectedProduct || isProcessing}
                loading={isProcessing}
                className="whitespace-nowrap"
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
                className="w-48"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleBulkStatusChange()}
                disabled={!selectedStatus || isProcessing}
                loading={isProcessing}
                className="whitespace-nowrap"
              >
                변경
              </Button>
            </div>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 일괄 삭제 */}
            <Button
              size="sm"
              variant="danger"
              onClick={handleBulkDelete}
              disabled={isProcessing}
              loading={isProcessing}
              className="bg-red-700 hover:bg-red-800"
            >
              🗑 삭제
            </Button>

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
