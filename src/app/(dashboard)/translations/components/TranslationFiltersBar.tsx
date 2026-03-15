import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { TranslationStatus, LanguageCode, ScopeType, ProductCode } from '@/types';
import { useLanguages, useProducts, useScopes } from '@/hooks/useReferenceData';

// 고정 언어 순서 (용어집과 동일)
const LANGUAGE_ORDER: LanguageCode[] = ['en', 'ja', 'zh', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de', 'it'];

interface TranslationFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  languageFilter: string;
  onLanguageFilterChange: (value: string) => void;
  statusFilter: TranslationStatus | '';
  onStatusFilterChange: (value: TranslationStatus | '') => void;
  scopeFilter: ScopeType;
  onScopeFilterChange?: (value: ScopeType) => void;
  versionFilter: string;
  onVersionFilterChange?: (value: string) => void;
  selectedLanguageColumns: LanguageCode[] | null;
  onLanguageColumnsChange: (languages: LanguageCode[] | null) => void;
  availableLanguages: LanguageCode[];
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  createdAfter: string;
  onCreatedAfterChange: (value: string) => void;
  createdBefore: string;
  onCreatedBeforeChange: (value: string) => void;
  onQuickFilter: (filterType: 'today' | 'this_week' | 'this_month' | 'frequently_used') => void;
  // Product filter (new)
  selectedProduct: ProductCode | null;
  onProductChange: (product: ProductCode | null) => void;
  hideProductFilter?: boolean;
  // Optional filters for backward compatibility
  requestIdFilter?: string | null;
  onRequestIdFilterChange?: (value: string | null) => void;
  onRequestIdChange?: (value: string | null) => void; // Alias
  onClearAllFilters?: () => void;
  // Handler aliases for backward compatibility
  onScopeChange?: (value: ScopeType) => void;
  onVersionChange?: (value: string) => void;
}

export default function TranslationFiltersBar({
  searchTerm,
  onSearchChange,
  languageFilter,
  onLanguageFilterChange,
  statusFilter,
  onStatusFilterChange,
  scopeFilter,
  onScopeFilterChange,
  versionFilter,
  onVersionFilterChange,
  selectedLanguageColumns,
  onLanguageColumnsChange,
  availableLanguages,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  createdAfter,
  onCreatedAfterChange,
  createdBefore,
  onCreatedBeforeChange,
  onQuickFilter,
  selectedProduct,
  onProductChange,
  hideProductFilter = false,
  requestIdFilter,
  onRequestIdFilterChange,
  onRequestIdChange,
  onClearAllFilters,
  onScopeChange,
  onVersionChange,
}: TranslationFiltersBarProps) {
  const { languages, languagesMap } = useLanguages();
  const { products } = useProducts();
  const { scopes, isLoading: scopesLoading } = useScopes();

  // 제품 분류 (scopes) - DB에서 조회, 없으면 하드코딩된 값 사용
  const productCategoryOptions = useMemo(() => {
    const defaultOptions = [
      { value: '', label: '모든 분류' },
      { value: 'SaaS', label: 'SaaS' },
      { value: 'Solution', label: 'Solution' },
    ];

    // scopes가 로딩 중이거나 없으면 기본값 사용
    if (scopesLoading || !scopes || scopes.length === 0) {
      return defaultOptions;
    }

    // DB에서 조회한 scopes 사용
    return [
      { value: '', label: '모든 분류' },
      ...scopes.map((scope) => ({
        value: scope.name,
        label: scope.name,
      })),
    ];
  }, [scopes, scopesLoading]);

  // Normalize handlers (support both old and new naming)
  const handleScopeChange = onScopeFilterChange ?? onScopeChange ?? (() => {});
  const handleVersionChange = onVersionFilterChange ?? onVersionChange ?? (() => {});
  const handleCreatedAfterChange = onCreatedAfterChange ?? (() => {});
  const handleCreatedBeforeChange = onCreatedBeforeChange ?? (() => {});

  // Generate select options dynamically
  const languageSelectOptions = [
    { value: '', label: '모든 언어' },
    ...languages.map(l => ({ value: l.code, label: l.name }))
  ];

  // Generate product options
  const productSelectOptions = [
    { value: '', label: '모든 제품' },
    ...products.map(p => ({ value: p.code, label: p.name }))
  ];

  const handleLanguageToggle = (lang: LanguageCode) => {
    if (!selectedLanguageColumns) {
      // If null (all selected), start with all available languages minus the clicked one
      const newSelection = availableLanguages.filter(l => l !== lang);
      onLanguageColumnsChange(newSelection.length === 0 ? null : newSelection);
    } else {
      // Toggle the language
      const newSelection = selectedLanguageColumns.includes(lang)
        ? selectedLanguageColumns.filter(l => l !== lang)
        : [...selectedLanguageColumns, lang];

      // If all languages are selected, set to null (show all)
      if (newSelection.length === availableLanguages.length) {
        onLanguageColumnsChange(null);
      } else if (newSelection.length === 0) {
        // Don't allow deselecting all languages
        return;
      } else {
        onLanguageColumnsChange(newSelection);
      }
    }
  };

  const isLanguageSelected = (lang: LanguageCode) => {
    if (!selectedLanguageColumns) return true; // null means all selected
    return selectedLanguageColumns.includes(lang);
  };

  return (
    <Card className="p-3">
      <div className="space-y-2">
        {/* Main Filters */}
        <div className="flex flex-wrap gap-2">
          {/* 제품 필터 - hideProductFilter가 false일 때만 표시 */}
          {!hideProductFilter && (
            <div className="w-40">
              <Select
                value={selectedProduct || ''}
                onChange={(e) => onProductChange(e.target.value as ProductCode || null)}
                options={productSelectOptions}
              />
            </div>
          )}
          {/* 모든 언어 -->
          <div className="w-40">
            <Select
              value={languageFilter}
              onChange={(e) => onLanguageFilterChange(e.target.value)}
              options={languageSelectOptions}
            />
          </div>
          {/* 제품 분류 */}
          <div className="w-40">
            {scopesLoading ? (
              <Select
                value={scopeFilter}
                onChange={(e) => handleScopeChange(e.target.value as ScopeType)}
                options={[{ value: '', label: '로딩 중...' }]}
                disabled
              />
            ) : (
              <Select
                value={scopeFilter}
                onChange={(e) => handleScopeChange(e.target.value as ScopeType)}
                options={productCategoryOptions}
              />
            )}
          </div>
          {/* 버전 */}
          <div className="w-40">
            <Input
              placeholder="버전 검색..."
              value={versionFilter}
              onChange={(e) => handleVersionChange(e.target.value)}
            />
          </div>
          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="원문 또는 번역문 검색..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* 고급 필터 토글 버튼 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleAdvancedFilters}
          >
            {showAdvancedFilters ? '▲ 고급 필터' : '▼ 고급 필터'}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex flex-wrap items-end gap-2">
              {/* Date Filters */}
              <div className="w-52">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  추가 시작일
                </label>
                <Input
                  type="date"
                  value={createdAfter}
                  onChange={(e) => handleCreatedAfterChange(e.target.value)}
                />
              </div>
              <div className="w-52">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  추가 종료일
                </label>
                <Input
                  type="date"
                  value={createdBefore}
                  onChange={(e) => handleCreatedBeforeChange(e.target.value)}
                />
              </div>

              {/* Quick Filters */}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuickFilter('today')}
              >
                오늘
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuickFilter('this_week')}
              >
                이번 주 신규
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuickFilter('this_month')}
              >
                이번 달
              </Button>
            </div>
          </div>
        )}

        {/* Language column selector */}
        <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-lg p-2 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-600 mr-1">🌐 언어:</span>
            <button
              onClick={() => onLanguageColumnsChange(null)}
              className="px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              전체
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            {LANGUAGE_ORDER.filter(lang => availableLanguages.includes(lang)).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageToggle(lang)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  isLanguageSelected(lang)
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title={languagesMap[lang]?.name || lang}
                aria-label={`${languagesMap[lang]?.name || lang} 표시`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
