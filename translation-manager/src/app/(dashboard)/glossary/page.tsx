'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { showSuccess, showError } from '@/lib/notifications';

import GlossaryFormModal from './components/GlossaryFormModal';
import ExportModal from './components/ExportModal';
import BulkActionBar from './components/BulkActionBar';
import GlossaryStatsCard from './components/GlossaryStatsCard';
import GlossaryHistoryPanel from './components/GlossaryHistoryPanel';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import { useGlossaryRollback } from './hooks/useGlossaryRollback';


export default function GlossaryPage() {
  const router = useRouter();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // History panel state
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [selectedHistoryTerm, setSelectedHistoryTerm] = useState<{ id: string; term: string; version?: number } | null>(null);
  
  // Rollback hook
  const {
    isLoading: isRollbackLoading,
    isHistoryLoading,
    auditHistory,
    conflicts,
    showConflictModal,
    fetchAuditHistory,
    rollbackField,
    bulkRollback,
    resolveConflicts,
    closeConflictModal,
  } = useGlossaryRollback(() => {
    // On success callback - refresh data
    fetchTerms();
    if (selectedHistoryTerm) {
      fetchAuditHistory(selectedHistoryTerm.id);
    }
  });

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
    formSourceText,
    setFormSourceText,
    formContext,
    setFormContext,
    formProductCodes,
    setFormProductCodes,
    isSubmitting,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject,
    handleStatusChange,
    handleRetranslate,
    handleBulkApprove,
    handleBulkReject,
    handleAIReview,
    openEditModal,
    fetchTerms,

    selectedLanguageColumns,
    setSelectedLanguageColumns,
    setQuickFilter,
    resetFilters,
    handleTermInlineUpdate,
    handleTranslationInlineUpdate,
    handleContextInlineUpdate,
    stats,
    isDeleting,
    isStatusChanging,
    isRetranslating,
    isBulkProcessing,
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

  // Note: Language auto-selection moved to ProductTabs onChange handler to avoid infinite loop

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

  // Checkbox selection handler

  const handleToggleOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };



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

  // Define fixed language order
  const LANGUAGE_ORDER: LanguageCode[] = ['en', 'ja', 'zh', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'];
  
  // Filter out Korean from display (terms are already in Korean)
  // Default: English only if nothing selected
  // Maintain fixed order for selected languages
  const displayLanguageColumns = selectedLanguageColumns.length > 0 
    ? LANGUAGE_ORDER.filter(lang => selectedLanguageColumns.includes(lang) && lang !== 'ko')
    : ['en' as LanguageCode];

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
          onProductChange={(product) => {
            setSelectedProduct(product);
            // Auto-select default languages when product changes (exclude Korean)
            if (product && productsMap[product]) {
              const prod = productsMap[product];
              if (prod.default_languages && prod.default_languages.length > 0) {
                const filteredLanguages = (prod.default_languages as LanguageCode[]).filter(lang => lang !== 'ko');
                setSelectedLanguageColumns(filteredLanguages);
              }
            }
          }}
        />

        {/* Statistics Cards - 실시간 통계 */}
        <GlossaryStatsCard selectedProduct={selectedProduct} stats={stats} />

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

        {/* Terms List - Single table with multiple language columns */}
        {loading ? (
          <Card>
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" role="status" aria-label="로딩 중"></div>
              <p className="mt-4 text-[#64748B]">로딩 중...</p>
            </div>
          </Card>
        ) : terms.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <div className="text-gray-500">
                {getEmptyStateMessage()}
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === terms.length && terms.length > 0}
                        onChange={() => {
                          if (selectedIds.length === terms.length) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds(terms.map(t => t.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">용어</th>
                    {/* 언어별 번역 컬럼 */}
                    {(languageFilter ? [languageFilter] : displayLanguageColumns).map((langCode) => (
                      <th key={langCode} className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                        {languagesMap[langCode]?.name || langCode}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">문맥</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 w-[100px]">제품</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 w-[80px]">출처</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 w-[100px]">검수 상태</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 w-[80px]">사용 횟수</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 w-[100px]">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* 용어별로 그룹화 */}
                  {(() => {
                    console.log('Glossary table - terms count:', terms.length);
                    // 용어명으로 그룹화
                    const grouped = terms.reduce((acc, term) => {
                      if (!acc[term.term]) {
                        acc[term.term] = {
                          term: term.term,
                          context: term.context,
                          glossary_products: term.glossary_products,
                          product_code: term.product_code,
                          source_type: term.source_type,
                          approval_status: term.approval_status,
                          hit_count: term.hit_count,
                          translations: {} as Record<string, { id: string; translation: string; language_code: string }>,
                        };
                      }
                      acc[term.term].translations[term.language_code] = {
                        id: term.id,
                        translation: term.translation,
                        language_code: term.language_code,
                      };
                      return acc;
                    }, {} as Record<string, any>);

                    return Object.values(grouped).map((group: any) => {
                      const allIds = Object.values(group.translations).map((t: any) => t.id);
                      const isGroupSelected = allIds.every((id: string) => selectedIds.includes(id));

                      return (
                        <tr key={group.term} className="hover:bg-gray-50/50">
                          <td className="px-2 py-2">
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
                          <td className="px-4 py-2 font-semibold">
                            <EditableCell
                              value={group.term}
                              onSave={async (newValue) => {
                                for (const id of allIds) {
                                  await handleTermInlineUpdate(id, newValue);
                                }
                              }}
                              placeholder="용어"
                            />
                          </td>
                          {/* 언어별 번역 셀 */}
                          {(languageFilter ? [languageFilter] : displayLanguageColumns).map((langCode) => {
                            const translation = group.translations[langCode];
                            return (
                              <td key={langCode} className="px-4 py-2 text-[#64748B]">
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
                          <td className="px-4 py-2 text-[#64748B]">
                            <EditableCell
                              value={group.context || ''}
                              onSave={async (newValue) => {
                                for (const id of allIds) {
                                  await handleContextInlineUpdate(id, newValue);
                                }
                              }}
                              placeholder="문맥"
                            />
                          </td>
                          <td className="px-4 py-2">
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
                          <td className="px-4 py-2">
                            <Badge variant={getSourceTypeBadgeVariant(group.source_type)}>
                              {sourceTypeLabels[group.source_type] || group.source_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={group.approval_status}
                              onChange={(e) => {
                                const newStatus = e.target.value as 'pending' | 'approved' | 'rejected' | 'not_used';
                                allIds.forEach((id: string) => handleStatusChange(id, newStatus));
                              }}
                              disabled={isStatusChanging}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="pending">검수대기</option>
                              <option value="approved">검수완료</option>
                              <option value="rejected">보류</option>
                              <option value="not_used">사용안함</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={group.hit_count > 0 ? 'font-semibold text-indigo-600' : 'text-gray-400'}>
                              {group.hit_count}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-center gap-1">
                              {/* AI 재번역 버튼 (개별) */}
                              <button
                                onClick={async () => {
                                  try {
                                    const languages = displayLanguageColumns;
                                    await handleRetranslate(group.term, group.context || '', languages);
                                    showSuccess(`${languages.length}개 언어로 재번역되었습니다.`);
                                  } catch (error) {
                                    console.error('Retranslate error:', error);
                                    showError('재번역에 실패했습니다.');
                                  }
                                }}
                                disabled={isRetranslating}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="AI 재번역"
                              >
                                {isRetranslating ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.101 5.79 2.929 7.907l3.032-3.032z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => allIds.forEach((id: string) => handleDelete(id))}
                                disabled={isDeleting}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="삭제"
                              >
                                {isDeleting ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.101 5.79 2.929 7.907l3.032-3.032z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                              {/* 변경 이력 버튼 */}
                              <button
                                onClick={() => {
                                  const firstId = allIds[0];
                                  const termData = terms.find(t => t.id === firstId);
                                  setSelectedHistoryTerm({
                                    id: firstId,
                                    term: group.term,
                                    version: termData?.version,
                                  });
                                  fetchAuditHistory(firstId);
                                  setHistoryPanelOpen(true);
                                }}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title="변경 이력 보기"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
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
          sourceText={formSourceText}
          onSourceTextChange={setFormSourceText}
          context={formContext}
          onContextChange={setFormContext}
          productCodes={formProductCodes}
          onProductCodesChange={setFormProductCodes}
          onSubmit={handleCreate}
          submitLabel="추가"
          isSubmitting={isSubmitting}
          selectedLanguages={displayLanguageColumns}
          onRetranslate={handleRetranslate}
        />

        {/* Edit Modal - Note: Edit functionality simplified for single language */}
        <GlossaryFormModal
          isOpen={!!editingTerm}
          onClose={() => {
            setEditingTerm(null);
            resetForm();
          }}
          title="용어 수정"
          sourceText={formSourceText}
          onSourceTextChange={setFormSourceText}
          context={formContext}
          onContextChange={setFormContext}
          productCodes={formProductCodes}
          onProductCodesChange={setFormProductCodes}
          onSubmit={handleUpdate}
          submitLabel="저장"
          selectedLanguages={displayLanguageColumns}
          onRetranslate={handleRetranslate}
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
          onBulkRetranslate={async (ids) => {
            // Get terms info for retranslation
            const selectedTerms = terms.filter(t => ids.includes(t.id));
            const uniqueTerms = [...new Set(selectedTerms.map(t => t.term))];
            
            for (const term of uniqueTerms) {
              const termData = selectedTerms.find(t => t.term === term);
              if (termData) {
                await handleRetranslate(term, termData.context || '', displayLanguageColumns);
              }
            }
          }}
          onBulkViewHistory={(ids) => {
            // Show history for the first selected term
            const firstId = ids[0];
            const termData = terms.find(t => t.id === firstId);
            if (termData) {
              setSelectedHistoryTerm({
                id: firstId,
                term: termData.term,
                version: termData.version,
              });
              fetchAuditHistory(firstId);
              setHistoryPanelOpen(true);
            }
          }}
          onClearSelection={() => setSelectedIds([])}
          onRefresh={() => {
            setSelectedIds([]);
          }}
        />

        {/* History Panel */}
        {selectedHistoryTerm && (
          <GlossaryHistoryPanel
            glossaryId={selectedHistoryTerm.id}
            term={selectedHistoryTerm.term}
            isOpen={historyPanelOpen}
            onClose={() => {
              setHistoryPanelOpen(false);
              setSelectedHistoryTerm(null);
            }}
            auditHistory={auditHistory}
            isLoading={isHistoryLoading}
            currentVersion={selectedHistoryTerm.version}
            onRevert={async (auditLogId, fieldName) => {
              const success = await rollbackField(
                selectedHistoryTerm.id,
                auditLogId,
                selectedHistoryTerm.version,
                fieldName || undefined
              );
              if (success) {
                setHistoryPanelOpen(false);
                setSelectedHistoryTerm(null);
              }
            }}
          />
        )}

        {/* Conflict Resolution Modal */}
        <ConflictResolutionModal
          isOpen={showConflictModal}
          onClose={closeConflictModal}
          conflicts={conflicts}
          onResolve={resolveConflicts}
          isLoading={isRollbackLoading}
        />
      </div>
    </DashboardLayout>
  );
}
