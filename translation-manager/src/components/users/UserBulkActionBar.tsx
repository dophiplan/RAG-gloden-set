import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import { useProducts } from '@/hooks/useReferenceData';
import { UserRole, ProductCode, USER_WORK_SCOPE_OPTIONS, WORK_LANGUAGE_OPTIONS } from '@/types';

interface UserBulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

// Role options
const ROLE_OPTIONS = [
  { value: 'master', label: '마스터' },
  { value: 'translator_ja', label: '일본어 번역' },
  { value: 'translator_zh', label: '중국어 번역' },
  { value: 'translator_en', label: '영어 번역' },
  { value: 'requester', label: '요청' },
  { value: 'deployer', label: '반영' },
  { value: 'reviewer_ja', label: '일본어 검수' },
  { value: 'reviewer_zh', label: '중국어 검수' },
  { value: 'reviewer_en', label: '영어 검수' },
];

// Work scope options
const WORK_SCOPE_OPTIONS = USER_WORK_SCOPE_OPTIONS.map((scope) => ({
  value: scope,
  label: scope,
}));

// Language options
const LANGUAGE_OPTIONS = WORK_LANGUAGE_OPTIONS.map((lang) => ({
  value: lang,
  label: lang,
}));

/**
 * UserBulkActionBar - 사용자 일괄 작업 바
 * 여러 사용자를 선택했을 때 하단에 표시되는 일괄 작업 바
 */
export default function UserBulkActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onRefresh,
}: UserBulkActionBarProps) {
  const { products } = useProducts();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedWorkScope, setSelectedWorkScope] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  // Generate product options
  const productOptions = products.map(p => ({ value: p.code, label: p.name }));

  const handleBulkDelete = async () => {
    if (!showConfirm(`정말 ${selectedCount}명의 사용자를 삭제하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: selectedIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '사용자 삭제에 실패했습니다.');
      }

      showSuccess(`${selectedCount}명의 사용자가 삭제되었습니다.`);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showError(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkRolesChange = async () => {
    if (selectedRoles.length === 0) {
      showError('권한을 선택해주세요.');
      return;
    }

    const roleLabels = selectedRoles
      .map(role => ROLE_OPTIONS.find(r => r.value === role)?.label || role)
      .join(', ');

    if (!showConfirm(`${selectedCount}명의 권한을 "${roleLabels}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedIds,
          roles: selectedRoles,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '권한 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}명의 권한이 변경되었습니다.`);
      setSelectedRoles([]);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk roles change error:', error);
      showError(error instanceof Error ? error.message : '권한 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkProductChange = async () => {
    if (selectedProducts.length === 0) {
      showError('제품을 선택해주세요.');
      return;
    }

    const productNames = selectedProducts
      .map(code => products.find(p => p.code === code)?.name || code)
      .join(', ');

    if (!showConfirm(`${selectedCount}명의 제품을 "${productNames}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedIds,
          work_products: selectedProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '제품 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}명의 제품이 변경되었습니다.`);
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

  const handleBulkWorkScopeChange = async () => {
    if (selectedWorkScope.length === 0) {
      showError('작업 범위를 선택해주세요.');
      return;
    }

    const scopeLabels = selectedWorkScope.join(', ');

    if (!showConfirm(`${selectedCount}명의 작업 범위를 "${scopeLabels}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedIds,
          work_scope: selectedWorkScope,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '작업 범위 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}명의 작업 범위가 변경되었습니다.`);
      setSelectedWorkScope([]);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk work scope change error:', error);
      showError(error instanceof Error ? error.message : '작업 범위 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkLanguageChange = async () => {
    if (selectedLanguages.length === 0) {
      showError('언어를 선택해주세요.');
      return;
    }

    const langLabels = selectedLanguages.join(', ');

    if (!showConfirm(`${selectedCount}명의 번역 언어를 "${langLabels}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/admin/users/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: selectedIds,
          work_languages: selectedLanguages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '번역 언어 변경에 실패했습니다.');
      }

      showSuccess(`${selectedCount}명의 번역 언어가 변경되었습니다.`);
      setSelectedLanguages([]);
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk language change error:', error);
      showError(error instanceof Error ? error.message : '번역 언어 변경 중 오류가 발생했습니다.');
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
              {selectedCount}명 선택됨
            </span>
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div className="flex items-center gap-3">
            {/* 삭제 */}
            <Button
              size="sm"
              variant="danger"
              onClick={handleBulkDelete}
              disabled={isProcessing}
              loading={isProcessing}
            >
              삭제
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            {/* 권한 일괄 변경 */}
            <div className="flex items-center gap-2">
              <MultiSelectDropdown
                options={ROLE_OPTIONS}
                selected={selectedRoles}
                onChange={setSelectedRoles}
                placeholder="권한 선택..."
                disabled={isProcessing}
                className="w-48"
                openUpward={true}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkRolesChange}
                disabled={selectedRoles.length === 0 || isProcessing}
                loading={isProcessing}
                className="whitespace-nowrap"
              >
                변경
              </Button>
            </div>

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
                className="whitespace-nowrap"
              >
                변경
              </Button>
            </div>

            {/* 작업 범위 일괄 변경 */}
            <div className="flex items-center gap-2">
              <MultiSelectDropdown
                options={WORK_SCOPE_OPTIONS}
                selected={selectedWorkScope}
                onChange={setSelectedWorkScope}
                placeholder="작업 범위 선택..."
                disabled={isProcessing}
                className="w-48"
                openUpward={true}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkWorkScopeChange}
                disabled={selectedWorkScope.length === 0 || isProcessing}
                loading={isProcessing}
                className="whitespace-nowrap"
              >
                변경
              </Button>
            </div>

            {/* 번역 언어 일괄 변경 */}
            <div className="flex items-center gap-2">
              <MultiSelectDropdown
                options={LANGUAGE_OPTIONS}
                selected={selectedLanguages}
                onChange={setSelectedLanguages}
                placeholder="언어 선택..."
                disabled={isProcessing}
                className="w-48"
                openUpward={true}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkLanguageChange}
                disabled={selectedLanguages.length === 0 || isProcessing}
                loading={isProcessing}
                className="whitespace-nowrap"
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
