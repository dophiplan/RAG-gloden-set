import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import { useProducts } from '@/hooks/useReferenceData';
import { UserRole, ProductCode, USER_WORK_SCOPE_OPTIONS, WORK_LANGUAGE_OPTIONS } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { apiPatch } from '@/lib/api-utils';

interface UserBulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

// Account level options (matches user edit modal)
const ACCOUNT_LEVEL_OPTIONS = [
  { value: '1st_master', label: '1st Master' },
  { value: 'master', label: 'Master' },
  { value: 'manager', label: 'Manager' },
  { value: 'user', label: 'User' },
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
  const supabase = createClient();
  const { products } = useProducts();
  const [selectedAccountLevel, setSelectedAccountLevel] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedWorkScope, setSelectedWorkScope] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [has1stMaster, setHas1stMaster] = useState(false);

  // Check if any selected user is 1st_master
  useEffect(() => {
    const checkFor1stMaster = async () => {
      if ((selectedIds || []).length === 0) {
        setHas1stMaster(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('users')
          .select('account_level')
          .in('id', selectedIds);

        const hasFirstMaster = data?.some(u => u.account_level === '1st_master');
        setHas1stMaster(hasFirstMaster || false);
      } catch (error) {
        console.error('Error checking for 1st master:', error);
        setHas1stMaster(false);
      }
    };

    checkFor1stMaster();
  }, [selectedIds, supabase]);

  if (selectedCount === 0) {
    return null;
  }

  // Generate product options
  const productOptions = (products || []).map(p => ({ value: p.code, label: p.name }));


  const handleBulkAccountLevelChange = async () => {
    if (!selectedAccountLevel) {
      showError('계정 권한을 선택해주세요.');
      return;
    }

    const accountLevelLabel = ACCOUNT_LEVEL_OPTIONS.find(a => a.value === selectedAccountLevel)?.label || selectedAccountLevel;

    if (!showConfirm(`${selectedCount}명의 계정 권한을 "${accountLevelLabel}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await apiPatch('/api/admin/users/bulk-update', {
        user_ids: selectedIds,
        account_level: selectedAccountLevel,
      });

      showSuccess(`${selectedCount}명의 계정 권한이 변경되었습니다.`);
      setSelectedAccountLevel('');
      onClearSelection();
      onRefresh();
    } catch (error) {
      console.error('Bulk account level change error:', error);
      showError(error instanceof Error ? error.message : '계정 권한 변경 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkProductChange = async () => {
    if ((selectedProducts || []).length === 0) {
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
      await apiPatch('/api/admin/users/bulk-update', {
        user_ids: selectedIds,
        work_products: selectedProducts,
      });

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
    if ((selectedWorkScope || []).length === 0) {
      showError('작업 범위를 선택해주세요.');
      return;
    }

    const scopeLabels = selectedWorkScope.join(', ');

    if (!showConfirm(`${selectedCount}명의 작업 범위를 "${scopeLabels}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await apiPatch('/api/admin/users/bulk-update', {
        user_ids: selectedIds,
        work_scope: selectedWorkScope,
      });

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
    if ((selectedLanguages || []).length === 0) {
      showError('언어를 선택해주세요.');
      return;
    }

    const langLabels = selectedLanguages.join(', ');

    if (!showConfirm(`${selectedCount}명의 번역 언어를 "${langLabels}"(으)로 변경하시겠습니까?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await apiPatch('/api/admin/users/bulk-update', {
        user_ids: selectedIds,
        work_languages: selectedLanguages,
      });

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
            {/* 계정 권한 일괄 변경 (1st master 선택 시 숨김) */}
            {!has1stMaster && (
              <>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedAccountLevel}
                    onChange={(e) => setSelectedAccountLevel(e.target.value)}
                    options={[
                      { value: '', label: '계정 권한 선택...' },
                      ...ACCOUNT_LEVEL_OPTIONS
                    ]}
                    disabled={isProcessing}
                    className="w-48"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleBulkAccountLevelChange}
                    disabled={!selectedAccountLevel || isProcessing}
                    loading={isProcessing}
                    className="whitespace-nowrap"
                  >
                    변경
                  </Button>
                </div>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>
              </>
            )}

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
                disabled={(selectedProducts || []).length === 0 || isProcessing}
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
                disabled={(selectedWorkScope || []).length === 0 || isProcessing}
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
                disabled={(selectedLanguages || []).length === 0 || isProcessing}
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
