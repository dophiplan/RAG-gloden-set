'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import ProductTabs from '@/components/ProductTabs';
import EditableCell from '@/components/EditableCell';
import { LanguageCode } from '@/types';
import { useGlossaryData } from './hooks/useGlossaryData';
import { useProducts, useLanguages } from '@/hooks/useReferenceData';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import GlossaryFormModal from './components/GlossaryFormModal';
import ExportModal from './components/ExportModal';
import BulkActionBar from './components/BulkActionBar';
import GlossaryTableHeader from '@/components/glossary/GlossaryTableHeader';

export default function GlossaryPage() {
  const router = useRouter();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch reference data from DB
  const { productsMap } = useProducts();
  const { languages, languagesMap } = useLanguages();

  // Generate select options dynamically (exclude Korean since terms are in Korean)
  const languageSelectOptions = [
    { value: '', label: '모든 언어' },
    ...languages.filter(l => l.code !== 'ko').map(l => ({ value: l.code, label: l.name }))
  ];

  const {
    terms,
    loading,
    languageFilter,
    setLanguageFilter,
    selectedProduct,
    setSelectedProduct,
    searchTerm,
    setSearchTerm,
    sourceTypeFilter,
    setSourceTypeFilter,
    approvalStatusFilter,
    setApprovalStatusFilter,
    importedAfter,
    setImportedAfter,
    importedBefore,
    setImportedBefore,
    sortBy,
    setSortBy,
    isModalOpen,
    setIsModalOpen,
    editingTerm,
    setEditingTerm,
    isReviewing,
    suggestionCount,
    formTerm,
    setFormTerm,
    formTranslation,
    setFormTranslation,
    formLanguage,
    setFormLanguage,
    formContext,
    setFormContext,
    formProductCode,
    setFormProductCode,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleBulkReject,
    handleAIReview,
    openEditModal,
    groupedTerms,
    groupedByTerm,
    selectedLanguageColumns,
    setSelectedLanguageColumns,
    setQuickFilter,
    resetFilters,
    handleTermInlineUpdate,
    handleTranslationInlineUpdate,
    handleContextInlineUpdate,
  } = useGlossaryData();

  const sourceTypeLabels: Record<string, string> = {
    manual: '수동',
    excel_import: 'Excel',
    ai_generated: 'AI',
  };

  const approvalStatusLabels: Record<string, string> = {
    pending: '검수 대기',
    approved: '승인됨',
    rejected: '거부됨',
  };

  // Auto-select default languages when product changes (exclude Korean)
  useEffect(() => {
    if (selectedProduct && productsMap[selectedProduct]) {
      const product = productsMap[selectedProduct];
      if (product.default_languages && product.default_languages.length > 0) {
        const filteredLanguages = (product.default_languages as LanguageCode[]).filter(lang => lang !== 'ko');
        setSelectedLanguageColumns(filteredLanguages);
      }
    }
  }, [selectedProduct, productsMap]);

  const getSourceTypeBadgeVariant = (sourceType: string): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    if (sourceType === 'manual') return 'default';
    if (sourceType === 'excel_import') return 'info';
    if (sourceType === 'ai_generated') return 'success';
    return 'default';
  };

  const getApprovalStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'pending') return 'warning';
    if (status === 'approved') return 'success';
    if (status === 'rejected') return 'error';
    return 'default';
  };

  // Resizable columns setup
  const defaultWidths = {
    checkbox: 32,
    term: 200,
    translation: 200,
    context: 220,
    product: 120,
    source: 100,
    approval: 120,
    hitCount: 100,
    actions: 80,
  };

  const minWidths = {
    checkbox: 32,
    term: 120,
    translation: 120,
    context: 120,
    product: 80,
    source: 80,
    approval: 100,
    hitCount: 80,
    actions: 60,
  };

  const { columnWidths, startResize, resize, stopResize } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'glossary-table-column-widths-v2',
  });

  // Global mouse handlers for column resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e.clientX);
    const handleMouseUp = () => stopResize();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resize, stopResize]);

  // Helper to get cell style with width
  const getCellStyle = (columnKey: string, additionalStyle?: React.CSSProperties) => {
    const width = columnWidths[columnKey];
    return {
      ...(width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {}),
      ...(additionalStyle || {}),
    };
  };

  // Checkbox selection handlers
  const handleToggleAll = () => {
    if (selectedIds.length === terms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(terms.map(t => t.id));
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const isAllSelected = terms.length > 0 && selectedIds.length === terms.length;

  // 표시할 언어 토글 함수
  const handleLanguageToggle = (lang: LanguageCode) => {
    const newSelection = selectedLanguageColumns.includes(lang)
      ? selectedLanguageColumns.filter(l => l !== lang)
      : [...selectedLanguageColumns, lang];

    // 최소 1개 언어는 선택되어야 함
    if (newSelection.length === 0) {
      return;
    }

    setSelectedLanguageColumns(newSelection);
  };

  const isLanguageSelected = (lang: LanguageCode) => {
    return selectedLanguageColumns.includes(lang);
  };

  // Filter out Korean from display (terms are already in Korean)
  const displayLanguageColumns = selectedLanguageColumns.filter(lang => lang !== 'ko');

  // Determine empty state message based on filters
  const getEmptyStateMessage = () => {
    if (approvalStatusFilter === 'pending') {
      return '🎉 모든 용어가 검수되었습니다!';
    }
    if (searchTerm) {
      return '검색 결과가 없습니다.';
    }
    if (importedAfter || importedBefore) {
      return '해당 기간에 등록된 용어가 없습니다.';
    }
    return '아직 등록된 용어가 없습니다. "용어 추가" 버튼을 눌러 시작하세요.';
  };

  return (
    <DashboardLayout
      title="용어집"
      subtitle="여기에 등록된 번역 문구 기준으로 일관성 있게 번역 됩니다."
    >
      <div className="space-y-6">
        {/* Product Tabs */}
        <ProductTabs
          selectedProduct={selectedProduct}
          onProductChange={setSelectedProduct}
        />

        {/* Filters */}
        <Card>
          <div className="space-y-3">
            {/* Main Filters */}
            <div className="flex flex-wrap gap-2">
              {/* 언어 */}
              <div className="w-40">
                <Select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  options={languageSelectOptions}
                />
              </div>

              {/* 출처 */}
              <div className="w-40">
                <Select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  options={[
                    { value: '', label: '모든 출처' },
                    { value: 'manual', label: '수동' },
                    { value: 'excel_import', label: 'Excel' },
                    { value: 'ai_generated', label: 'AI' },
                  ]}
                />
              </div>

              {/* 승인 상태 */}
              <div className="w-40">
                <Select
                  value={approvalStatusFilter}
                  onChange={(e) => setApprovalStatusFilter(e.target.value)}
                  options={[
                    { value: '', label: '모든 상태' },
                    { value: 'pending', label: '승인 대기' },
                    { value: 'approved', label: '승인됨' },
                    { value: 'rejected', label: '거부됨' },
                  ]}
                />
              </div>

              {/* 정렬 */}
              <div className="w-40">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'term', label: '용어순' },
                    { value: 'hit_count', label: '사용 빈도순' },
                    { value: 'imported_at', label: '최근 추가순' },
                  ]}
                />
              </div>

              {/* 검색 */}
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="용어 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* 고급 필터 토글 버튼 */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? '▲ 고급 필터' : '▼ 고급 필터'}
              </Button>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="pt-3 border-t border-gray-200">
                <div className="flex flex-wrap items-end gap-2">
                  {/* Date Filters */}
                  <div className="w-52">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      추가 시작일
                    </label>
                    <Input
                      type="date"
                      value={importedAfter}
                      onChange={(e) => setImportedAfter(e.target.value)}
                    />
                  </div>
                  <div className="w-52">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      추가 종료일
                    </label>
                    <Input
                      type="date"
                      value={importedBefore}
                      onChange={(e) => setImportedBefore(e.target.value)}
                    />
                  </div>

                  {/* Quick Filters */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickFilter('today')}
                  >
                    오늘
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickFilter('this_week')}
                  >
                    이번 주 신규
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickFilter('this_month')}
                  >
                    이번 달
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuickFilter('frequently_used')}
                  >
                    많이 사용됨
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setQuickFilter('pending')}
                  >
                    ⚠️ 승인 대기 항목
                  </Button>
                </div>
              </div>
            )}

            {/* 표시할 언어 필터 (한국어 제외 - 용어가 이미 한국어임) */}
            <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-xl p-3 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-600 mr-1">🌐 언어:</span>
                <button
                  onClick={() => setSelectedLanguageColumns(languages.filter(l => l.code !== 'ko').map(l => l.code as LanguageCode))}
                  className="px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  전체
                </button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                {languages.filter(l => l.code !== 'ko').map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageToggle(lang.code as LanguageCode)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      isLanguageSelected(lang.code as LanguageCode)
                        ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 hover:shadow-md'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title={lang.name}
                    aria-label={`${lang.name} 표시`}
                  >
                    {lang.code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            총 <strong>{terms.length}</strong>개 용어
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push('/settings/migration')}
            >
              가져오기
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsExportModalOpen(true)}
            >
              Excel 내보내기
            </Button>
            <Button
              variant="secondary"
              onClick={handleAIReview}
              loading={isReviewing}
            >
              AI 일관성 검사
            </Button>
            <Button onClick={() => setIsModalOpen(true)}>용어 추가</Button>
          </div>
        </div>

        {/* Terms List */}
        {loading ? (
          <Card>
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" role="status" aria-label="로딩 중"></div>
              <p className="mt-4 text-[#64748B]">로딩 중...</p>
            </div>
          </Card>
        ) : languageFilter ? (
          <Card padding="none">
            <div className="overflow-auto">
              <table className="w-full table-fixed">
                <GlossaryTableHeader
                  isAllSelected={isAllSelected}
                  onToggleAll={handleToggleAll}
                  columnWidths={columnWidths}
                  onResizeStart={startResize}
                />
                <tbody>
                  {terms.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12">
                        <div className="text-gray-500">
                          {getEmptyStateMessage()}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    terms.map((term) => (
                      <tr key={term.id}>
                        <td className="px-2 py-2 align-top" style={getCellStyle('checkbox')}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(term.id)}
                            onChange={() => handleToggleOne(term.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="font-semibold" style={getCellStyle('term')}>
                          <EditableCell
                            value={term.term}
                            onSave={(newValue) => handleTermInlineUpdate(term.id, newValue)}
                            placeholder="용어"
                          />
                        </td>
                        <td style={getCellStyle('translation')}>
                          <EditableCell
                            value={term.translation}
                            onSave={(newValue) => handleTranslationInlineUpdate(term.id, newValue)}
                            placeholder="번역"
                          />
                        </td>
                        <td className="text-[#64748B]" style={getCellStyle('context')}>
                          <EditableCell
                            value={term.context || ''}
                            onSave={(newValue) => handleContextInlineUpdate(term.id, newValue)}
                            placeholder="문맥"
                          />
                        </td>
                        <td style={getCellStyle('product')}>
                          {term.glossary_products && term.glossary_products.length > 0 ? (
                            term.glossary_products.length === 1 ? (
                              <Badge variant="info">
                                {productsMap[term.glossary_products[0].product_code]?.name || term.glossary_products[0].product_code}
                              </Badge>
                            ) : (
                              <Badge variant="info">
                                {productsMap[term.glossary_products[0].product_code]?.name || term.glossary_products[0].product_code}
                                +{term.glossary_products.length - 1}
                              </Badge>
                            )
                          ) : term.product_code ? (
                            <Badge variant="info">{productsMap[term.product_code]?.name || term.product_code}</Badge>
                          ) : (
                            <Badge variant="default">전체</Badge>
                          )}
                        </td>
                        <td style={getCellStyle('source')}>
                          <Badge variant={getSourceTypeBadgeVariant(term.source_type)}>
                            {sourceTypeLabels[term.source_type] || term.source_type}
                          </Badge>
                        </td>
                        <td style={getCellStyle('approval')}>
                          <Badge variant={getApprovalStatusBadgeVariant(term.approval_status)}>
                            {approvalStatusLabels[term.approval_status] || term.approval_status}
                          </Badge>
                        </td>
                        <td className="text-center" style={getCellStyle('hitCount')}>
                          <span className={term.hit_count > 0 ? 'font-semibold text-indigo-600' : 'text-gray-400'}>
                            {term.hit_count}
                          </span>
                        </td>
                        <td style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'right' }}>
                          <div className="flex justify-end gap-2">
                            {term.approval_status === 'pending' && (
                              <>
                                <Button size="sm" variant="primary" onClick={() => handleApprove(term.id)}>✓ 승인</Button>
                                <Button size="sm" variant="danger" onClick={() => handleReject(term.id)}>✗ 거부</Button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(term.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="삭제"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : terms.length === 0 ? (
          <Card padding="none">
            <div className="overflow-auto">
              <table className="w-full table-fixed">
                <GlossaryTableHeader
                  isAllSelected={isAllSelected}
                  onToggleAll={handleToggleAll}
                  columnWidths={columnWidths}
                  onResizeStart={startResize}
                />
                <tbody>
                  <tr>
                    <td colSpan={9} className="text-center py-12">
                      <div className="text-gray-500">
                        {getEmptyStateMessage()}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-auto">
              <table className="w-full table-fixed">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th scope="col" className="px-2 py-3 w-8" style={getCellStyle('checkbox')}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleAll}
                        className="rounded border-gray-300"
                        aria-label="모든 항목 선택"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('term')}>
                      용어
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('term', e.clientX);
                        }}
                      />
                    </th>
                    {displayLanguageColumns.map((langCode) => (
                      <th
                        scope="col"
                        key={langCode}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group"
                        style={getCellStyle('translation')}
                      >
                        {languagesMap[langCode]?.name || langCode}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            startResize('translation', e.clientX);
                          }}
                        />
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('context')}>
                      문맥
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('context', e.clientX);
                        }}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('product')}>
                      제품
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('product', e.clientX);
                        }}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('source')}>
                      출처
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('source', e.clientX);
                        }}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('approval')} title="AI가 추가한 용어는 승인 후 사용됩니다">
                      검수 상태 <span className="text-gray-400">ⓘ</span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('approval', e.clientX);
                        }}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-700 relative group" style={getCellStyle('hitCount')} title="이 용어가 번역에 재사용된 횟수">
                      사용 횟수 <span className="text-gray-400">ⓘ</span>
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('hitCount', e.clientX);
                        }}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-700 relative group" style={getCellStyle('actions')}>
                      작업
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 group-hover:bg-primary/20"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startResize('actions', e.clientX);
                        }}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByTerm.length === 0 ? (
                    <tr>
                      <td colSpan={8 + displayLanguageColumns.length} className="text-center py-12">
                        <div className="text-gray-500">
                          {getEmptyStateMessage()}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupedByTerm.map((group) => {
                      // Get all IDs for checkbox selection
                      const allIds = Object.values(group.translations).map(t => t.id);
                      const isGroupSelected = allIds.every(id => selectedIds.includes(id));
                      // Get first translation for approval buttons (all translations share same approval status)
                      const firstTranslation = Object.values(group.translations)[0];

                      return (
                        <tr key={group.term}>
                          <td className="px-2 py-2 align-top" style={getCellStyle('checkbox')}>
                            <input
                              type="checkbox"
                              checked={isGroupSelected}
                              onChange={() => {
                                if (isGroupSelected) {
                                  setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
                                } else {
                                  setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-2 font-semibold" style={getCellStyle('term')}>
                            <EditableCell
                              value={group.term}
                              onSave={async (newValue) => {
                                // Update all translations with the same term
                                for (const id of allIds) {
                                  await handleTermInlineUpdate(id, newValue);
                                }
                              }}
                              placeholder="용어"
                            />
                          </td>
                          {displayLanguageColumns.map((langCode) => {
                            const translation = group.translations[langCode];
                            return (
                              <td key={langCode} className="px-4 py-2 text-[#64748B]" style={getCellStyle('translation')}>
                                {translation ? (
                                  <EditableCell
                                    value={translation.translation}
                                    onSave={(newValue) => handleTranslationInlineUpdate(translation.id, newValue)}
                                    placeholder="번역"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 text-[#64748B]" style={getCellStyle('context')}>
                            <EditableCell
                              value={group.context || ''}
                              onSave={async (newValue) => {
                                // Update context for all translations
                                for (const id of allIds) {
                                  await handleContextInlineUpdate(id, newValue);
                                }
                              }}
                              placeholder="문맥"
                            />
                          </td>
                          <td className="px-4 py-2" style={getCellStyle('product')}>
                            {group.glossary_products && group.glossary_products.length > 0 ? (
                              group.glossary_products.length === 1 ? (
                                <Badge variant="info">
                                  {productsMap[group.glossary_products[0].product_code]?.name || group.glossary_products[0].product_code}
                                </Badge>
                              ) : (
                                <Badge variant="info">
                                  {productsMap[group.glossary_products[0].product_code]?.name || group.glossary_products[0].product_code}
                                  +{group.glossary_products.length - 1}
                                </Badge>
                              )
                            ) : group.product_code ? (
                              <Badge variant="info">{productsMap[group.product_code]?.name || group.product_code}</Badge>
                            ) : (
                              <Badge variant="default">전체</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2" style={getCellStyle('source')}>
                            <Badge variant={getSourceTypeBadgeVariant(group.source_type)}>
                              {sourceTypeLabels[group.source_type] || group.source_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2" style={getCellStyle('approval')}>
                            <Badge variant={getApprovalStatusBadgeVariant(group.approval_status)}>
                              {approvalStatusLabels[group.approval_status] || group.approval_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-center" style={getCellStyle('hitCount')}>
                            <span className={group.hit_count > 0 ? 'font-semibold text-indigo-600' : 'text-gray-400'}>
                              {group.hit_count}
                            </span>
                          </td>
                          <td className="px-4 py-2" style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'right' }}>
                            <div className="flex justify-end gap-2">
                              {group.approval_status === 'pending' && (
                                <>
                                  <Button size="sm" variant="primary" onClick={() => {
                                    // Approve all translations for this term
                                    allIds.forEach(id => handleApprove(id));
                                  }}>✓ 승인</Button>
                                  <Button size="sm" variant="danger" onClick={() => {
                                    // Reject all translations for this term
                                    allIds.forEach(id => handleReject(id));
                                  }}>✗ 거부</Button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  // Delete all translations for this term
                                  allIds.forEach(id => handleDelete(id));
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="삭제"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Create Modal */}
        <GlossaryFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            resetForm();
          }}
          title="용어 추가"
          formTerm={formTerm}
          setFormTerm={setFormTerm}
          formTranslation={formTranslation}
          setFormTranslation={setFormTranslation}
          formLanguage={formLanguage}
          setFormLanguage={setFormLanguage}
          formContext={formContext}
          setFormContext={setFormContext}
          formProductCode={formProductCode}
          setFormProductCode={setFormProductCode}
          onSubmit={handleCreate}
          submitLabel="추가"
          showLanguageSelect={true}
        />

        {/* Edit Modal */}
        <GlossaryFormModal
          isOpen={!!editingTerm}
          onClose={() => {
            setEditingTerm(null);
            resetForm();
          }}
          title="용어 수정"
          formTerm={formTerm}
          setFormTerm={setFormTerm}
          formTranslation={formTranslation}
          setFormTranslation={setFormTranslation}
          formLanguage={formLanguage}
          setFormLanguage={setFormLanguage}
          formContext={formContext}
          setFormContext={setFormContext}
          formProductCode={formProductCode}
          setFormProductCode={setFormProductCode}
          onSubmit={handleUpdate}
          submitLabel="저장"
          showLanguageSelect={false}
          editingLanguage={editingTerm ? languagesMap[editingTerm.language_code as LanguageCode]?.name : undefined}
        />

        {/* Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          currentFilters={{
            language: (languageFilter as LanguageCode) || null,
            product_code: selectedProduct,
            source_type: sourceTypeFilter || null,
            imported_after: importedAfter || null,
            imported_before: importedBefore || null,
            search: searchTerm || null,
          }}
          totalCount={terms.length}
        />

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          onApproveAll={() => {
            handleBulkApprove(selectedIds);
            setSelectedIds([]);
          }}
          onRejectAll={() => {
            handleBulkReject(selectedIds);
            setSelectedIds([]);
          }}
          onClearSelection={() => setSelectedIds([])}
          onRefresh={() => window.location.reload()}
        />
      </div>
    </DashboardLayout>
  );
}
