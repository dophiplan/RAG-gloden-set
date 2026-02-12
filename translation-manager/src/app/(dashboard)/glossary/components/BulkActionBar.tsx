import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import { useProducts } from '@/hooks/useReferenceData';
import { ProductCode } from '@/types';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onApproveAll: () => void;
  onRejectAll: () => void;
  onClearSelection: () => void;
  onRefresh: () => void;
}

/**
 * Bulk action bar that appears at the bottom when items are selected
 * Allows batch approval/rejection of glossary terms
 */
export default function BulkActionBar({
  selectedCount,
  selectedIds,
  onApproveAll,
  onRejectAll,
  onClearSelection,
  onRefresh,
}: BulkActionBarProps) {
  const { products } = useProducts();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleApprove = () => {
    if (showConfirm(`${selectedCount}개 용어를 승인하시겠습니까?`)) {
      onApproveAll();
    }
  };

  const handlePending = async () => {
    if (!showConfirm(`${selectedCount}개 용어를 대기 상태로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/glossary/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glossary_ids: selectedIds,
          approval_status: 'pending',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '상태 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}개 용어의 상태가 변경되었습니다.`);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk status change error:', error);
      showError(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    if (showConfirm(`${selectedCount}개 용어를 거부하시겠습니까?`)) {
      onRejectAll();
    }
  };

  // Generate product options for multi-select
  const productOptions = products.map(p => ({ value: p.code, label: p.name }));

  const handleBulkProductChange = async () => {
    if (selectedProducts.length === 0) {
      showError('제품을 선택해주세요.');
      return;
    }

    const productNames = selectedProducts
      .map(code => products.find(p => p.code === code)?.name || code)
      .join(', ');

    if (!showConfirm(`${selectedCount}개 용어의 제품을 "${productNames}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/glossary/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glossary_ids: selectedIds,
          product_codes: selectedProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '제품 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}개 용어의 제품이 변경되었습니다.`);
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

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount}개 선택됨
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 일괄 승인/대기/거부 */}
            <Button
              size="sm"
              variant="primary"
              onClick={handleApprove}
              disabled={isProcessing}
            >
              ✓ 일괄 승인
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePending}
              disabled={isProcessing}
            >
              일괄 대기
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleReject}
              disabled={isProcessing}
            >
              ✗ 일괄 거부
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
