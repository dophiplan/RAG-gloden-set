'use client';

import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { SUPPORTED_LANGUAGES, PRODUCTS } from '@/types';
import { useSuggestionData } from './hooks/useSuggestionData';
import SuggestionCard from './components/SuggestionCard';

const languageOptions = [
  { value: 'all', label: '모든 언어' },
  ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

const productOptions = [
  { value: 'all', label: '모든 제품' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];
// Note: suggestions page uses 'all' as default value instead of '', so it keeps its own options

const confidenceOptions = [
  { value: 'all', label: '모든 신뢰도' },
  { value: 'high', label: '높음 (80% 이상)' },
  { value: 'medium', label: '보통 (60-80%)' },
  { value: 'low', label: '낮음 (60% 미만)' },
];

export default function GlossarySuggestionsPage() {
  const router = useRouter();
  const {
    suggestions,
    loading,
    approving,
    filterLanguage,
    setFilterLanguage,
    filterProduct,
    setFilterProduct,
    filterConfidence,
    setFilterConfidence,
    filteredSuggestions,
    fetchSuggestions,
    toggleSelectAll,
    toggleSelect,
    updateContext,
    updateProducts,
    generateContext,
    toggleSamples,
    approveSelected,
    rejectSelected,
    selectedCount,
  } = useSuggestionData();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/glossary')}
              >
                ← 돌아가기
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">용어집 제안</h1>
            <p className="text-gray-600 mt-1">
              번역 기록에서 자동으로 감지된 용어들을 검토하고 승인하세요.
            </p>
          </div>
          <Button onClick={fetchSuggestions} variant="secondary">
            🔄 새로고침
          </Button>
        </div>

        {/* 필터 */}
        <Card>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                options={languageOptions}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                options={productOptions}
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(e.target.value)}
                options={confidenceOptions}
              />
            </div>
          </div>
        </Card>

        {/* 액션 버튼 */}
        {filteredSuggestions.length > 0 && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedCount > 0 ? `${selectedCount}개 선택됨` : '선택된 항목 없음'}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={toggleSelectAll}
                  variant="secondary"
                  size="sm"
                >
                  전체 선택
                </Button>
                <Button
                  onClick={rejectSelected}
                  disabled={selectedCount === 0}
                  variant="secondary"
                  size="sm"
                >
                  선택 항목 거부
                </Button>
                <Button
                  onClick={approveSelected}
                  disabled={selectedCount === 0 || approving}
                  loading={approving}
                  size="sm"
                >
                  선택 항목 승인
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 제안 목록 */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              로딩 중...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="font-medium">제안된 용어가 없습니다.</p>
              <p className="text-sm mt-2">
                번역 작업을 더 진행하면 자동으로 용어가 감지됩니다.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredSuggestions.map((suggestion) => {
                const actualIndex = suggestions.indexOf(suggestion);
                return (
                  <SuggestionCard
                    key={actualIndex}
                    suggestion={suggestion}
                    actualIndex={actualIndex}
                    onToggleSelect={toggleSelect}
                    onToggleSamples={toggleSamples}
                    onUpdateContext={updateContext}
                    onGenerateContext={generateContext}
                    onUpdateProducts={updateProducts}
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
