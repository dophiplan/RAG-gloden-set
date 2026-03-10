'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import { LanguageCode, ProductCode } from '@/types';
import { useGlossaryData } from '../hooks/useGlossaryData';
import { useProducts, useLanguages } from '@/hooks/useReferenceData';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import GlossaryFormModal from '../components/GlossaryFormModal';
import ExportModal from '../components/ExportModal';
import BulkActionBar from '../components/BulkActionBar';
import GlossaryTableHeader from '@/components/glossary/GlossaryTableHeader';
import { showError, showSuccess } from '@/lib/notifications';
import { apiPatch } from '@/lib/api-utils';

function GlossaryProductContent() {
  const params = useParams();
  const productCode = params.product as ProductCode;

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
    stats,
    fetchTerms,
    fetchStats,
    formSourceText,
    setFormSourceText,
    formContext,
    setFormContext,
    formProductCodes,
    setFormProductCodes,
    formTerm,
    setFormTerm,
    formTranslation,
    setFormTranslation,
    formLanguage,
    setFormLanguage,
    isSubmitting,
    resetForm,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject,
    handleRetranslate,
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

  // Set product from URL
  useEffect(() => {
    if (productCode) {
      setSelectedProduct(productCode);
    }
  }, [productCode, setSelectedProduct]);

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

  // Note: Language auto-selection moved to initial data load to avoid infinite loop

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

  const {
    columnWidths,
    onResizeStart,
  } = useResizableColumns({
    defaultWidths,
    minWidths,
    storageKey: 'glossary-table-column-widths-v2',
  });

  // Table selection
  const isAllSelected = selectedIds.length > 0 && selectedIds.length === terms.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(terms.map(t => t.id));
    }
  };

  const toggleSelect = (termId: string) => {
    if (selectedIds.includes(termId)) {
      setSelectedIds(selectedIds.filter(id => id !== termId));
    } else {
      setSelectedIds([...selectedIds, termId]);
    }
  };

  const getCellStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    return width ? {
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
    } : {};
  };

  // Define fixed language order
  const LANGUAGE_ORDER: LanguageCode[] = ['en', 'ja', 'zh', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'];
  
  // Default: English only if nothing selected
  // Maintain fixed order for selected languages
  const displayLanguageColumns = selectedLanguageColumns.length > 0 
    ? LANGUAGE_ORDER.filter(lang => selectedLanguageColumns.includes(lang) && lang !== 'ko')
    : ['en' as LanguageCode];

  // Language toggle functions
  const isLanguageSelected = (lang: LanguageCode) => {
    return selectedLanguageColumns.includes(lang);
  };

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

  // Glossary stats by status - each product independent
  const glossaryStats = {
    pending: stats.pending_terms,
    approved: stats.approved_terms,
    rejected: stats.rejected_terms,
    not_used: stats.not_used_terms,
  };

  const handleGlossaryStatusChange = async (ids: string[], newStatus: 'pending' | 'approved' | 'rejected' | 'not_used') => {
    try {
      const result = await apiPatch('/api/glossary/bulk-update', {
        glossary_ids: ids,
        approval_status: newStatus,
      }) as { updated: number };
      showSuccess(`${result.updated}개 용어의 상태가 변경되었습니다.`);
      fetchTerms();
      fetchStats(); // Refresh stats after status change
    } catch (error) {
      console.error('Status change error:', error);
      showError('상태 변경에 실패했습니다.');
    }
  };

  return (
    <DashboardLayout title={`용어집 - ${productCode?.toUpperCase()}`}>
      <div className="space-y-6">
        {/* Glossary Status Tabs - Independent per product */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { key: 'pending', label: '검수대기', color: 'amber' },
              { key: 'approved', label: '승인됨', color: 'emerald' },
              { key: 'rejected', label: '보류', color: 'rose' },
              { key: 'not_used', label: '사용안함', color: 'gray' },
            ].map((status) => {
              const count = glossaryStats[status.key as keyof typeof glossaryStats];
              const isActive = approvalStatusFilter === status.key;
              const isEmpty = count === 0;
              
              const colorClasses = {
                amber: { active: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300', inactive: 'bg-amber-50 text-amber-600 hover:bg-amber-100', empty: 'bg-gray-100 text-gray-400' },
                emerald: { active: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300', inactive: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', empty: 'bg-gray-100 text-gray-400' },
                rose: { active: 'bg-rose-100 text-rose-700 ring-2 ring-rose-300', inactive: 'bg-rose-50 text-rose-600 hover:bg-rose-100', empty: 'bg-gray-100 text-gray-400' },
                gray: { active: 'bg-gray-200 text-gray-700 ring-2 ring-gray-400', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200', empty: 'bg-gray-100 text-gray-400' },
              };
              
              const getClass = () => {
                if (isEmpty) return colorClasses[status.color as keyof typeof colorClasses].empty;
                if (isActive) return colorClasses[status.color as keyof typeof colorClasses].active;
                return colorClasses[status.color as keyof typeof colorClasses].inactive;
              };
              
              return (
                <button
                  key={status.key}
                  onClick={() => setApprovalStatusFilter(isActive ? '' : status.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${getClass()}`}
                >
                  {status.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

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
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                <div className="w-40">
                  <Input
                    type="date"
                    value={importedAfter}
                    onChange={(e) => setImportedAfter(e.target.value)}
                    placeholder="시작일"
                  />
                </div>
                <div className="w-40">
                  <Input
                    type="date"
                    value={importedBefore}
                    onChange={(e) => setImportedBefore(e.target.value)}
                    placeholder="종료일"
                  />
                </div>
                {(languageFilter || sourceTypeFilter || approvalStatusFilter || importedAfter || importedBefore) && (
                  <Button size="sm" variant="ghost" onClick={resetFilters}>
                    초기화
                  </Button>
                )}
              </div>
            )}

            {/* Language Toggle Buttons */}
            <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-xl p-3">
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
            {suggestionCount > 0 && (
              <span className="ml-2 text-amber-600">· AI 제안: {suggestionCount}개</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => window.location.href = '/settings/migration'}
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

        {/* Glossary Content */}
        <Card padding="none">

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <GlossaryTableHeader
                isAllSelected={isAllSelected}
                onToggleAll={toggleSelectAll}
                columnWidths={columnWidths}
                onResizeStart={onResizeStart}
                displayLanguages={displayLanguageColumns}
                languagesMap={languagesMap}
              />

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7 + displayLanguageColumns.length} className="px-4 py-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="로딩 중"></div>
                      <p className="mt-4 text-text-secondary">로딩 중...</p>
                    </td>
                  </tr>
                ) : terms.length === 0 ? (
                  <tr>
                    <td colSpan={7 + displayLanguageColumns.length} className="px-4 py-12 text-center text-text-muted">
                      등록된 용어가 없습니다
                    </td>
                  </tr>
                ) : groupedByTerm ? (
                  Object.entries(groupedTerms).map(([term, termsInGroup]) => {
                    const firstTerm = termsInGroup[0];
                    return (
                      <tr key={`group-${term}`} className="border-b border-border-light hover:bg-gray-50">
                        <td style={{ ...getCellStyle('checkbox'), textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={termsInGroup.every(t => selectedIds.includes(t.id))}
                            onChange={() => {
                              const allSelected = termsInGroup.every(t => selectedIds.includes(t.id));
                              if (allSelected) {
                                setSelectedIds(selectedIds.filter(id => !termsInGroup.some(t => t.id === id)));
                              } else {
                                setSelectedIds([...selectedIds, ...termsInGroup.map(t => t.id).filter(id => !selectedIds.includes(id))]);
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td style={getCellStyle('term')}>
                          <EditableCell
                            value={firstTerm.term}
                            onSave={(newValue) => handleTermInlineUpdate(firstTerm.id, newValue)}
                            placeholder="용어 입력"
                          />
                        </td>
                        {displayLanguageColumns.map((langCode) => {
                          const termForLang = termsInGroup.find(t => t.language_code === langCode);
                          return (
                            <td key={langCode} style={getCellStyle('translation')}>
                              {termForLang ? (
                                <EditableCell
                                  value={termForLang.translation}
                                  onSave={(newValue) => handleTranslationInlineUpdate(termForLang.id, newValue)}
                                  placeholder="번역 입력"
                                />
                              ) : (
                                <span className="text-text-muted text-sm">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={getCellStyle('context')}>
                          <EditableCell
                            value={firstTerm.context || ''}
                            onSave={(newValue) => handleContextInlineUpdate(firstTerm.id, newValue)}
                            placeholder="문맥 설명"
                          />
                        </td>
                        <td style={getCellStyle('product')}>
                          {firstTerm.product_code && productsMap[firstTerm.product_code]
                            ? productsMap[firstTerm.product_code].name
                            : '-'}
                        </td>
                        <td style={getCellStyle('source')}>
                          <Badge variant={getSourceTypeBadgeVariant(firstTerm.source_type)}>
                            {sourceTypeLabels[firstTerm.source_type] || firstTerm.source_type}
                          </Badge>
                        </td>
                        <td style={getCellStyle('approval')}>
                          <select
                            value={firstTerm.approval_status}
                            onChange={(e) => {
                              const newStatus = e.target.value as 'pending' | 'approved' | 'rejected' | 'not_used';
                              handleGlossaryStatusChange(termsInGroup.map(t => t.id), newStatus);
                            }}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="pending">검수대기</option>
                            <option value="approved">검수완료</option>
                            <option value="rejected">보류</option>
                            <option value="not_used">사용안함</option>
                          </select>
                        </td>
                        <td style={{ ...getCellStyle('hitCount'), textAlign: 'center' }}>
                          <span className="text-sm font-medium text-primary-active">
                            {firstTerm.hit_count || 0}
                          </span>
                        </td>
                        <td style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'center' }}>
                          <div className="flex justify-center gap-2">
                            {/* AI 재번역 버튼 */}
                            <button
                              onClick={async () => {
                                try {
                                  await handleRetranslate(firstTerm.term, firstTerm.context || '', displayLanguageColumns);
                                } catch (error) {
                                  console.error('Retranslate error:', error);
                                }
                              }}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                              title="AI 재번역"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(firstTerm.id)}
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
                ) : (
                  terms.map((term) => (
                    <tr key={term.id} className="border-b border-border-light hover:bg-gray-50">
                      <td style={{ ...getCellStyle('checkbox'), textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(term.id)}
                          onChange={() => toggleSelect(term.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td style={getCellStyle('term')}>
                        <EditableCell
                          value={term.term}
                          onSave={(newValue) => handleTermInlineUpdate(term.id, newValue)}
                          placeholder="용어 입력"
                        />
                      </td>
                      <td style={getCellStyle('translation')}>
                        <EditableCell
                          value={term.translation}
                          onSave={(newValue) => handleTranslationInlineUpdate(term.id, newValue)}
                          placeholder="번역 입력"
                        />
                      </td>
                      <td style={getCellStyle('context')}>
                        <EditableCell
                          value={term.context || ''}
                          onSave={(newValue) => handleContextInlineUpdate(term.id, newValue)}
                          placeholder="문맥 설명"
                        />
                      </td>
                      <td style={getCellStyle('product')}>
                        {term.product_code && productsMap[term.product_code]
                          ? productsMap[term.product_code].name
                          : '-'}
                      </td>
                      <td style={getCellStyle('source')}>
                        <Badge variant={getSourceTypeBadgeVariant(term.source_type)}>
                          {sourceTypeLabels[term.source_type] || term.source_type}
                        </Badge>
                      </td>
                      <td style={getCellStyle('approval')}>
                        <div className="flex items-center gap-2">
                          <Badge variant={getApprovalStatusBadgeVariant(term.approval_status)}>
                            {approvalStatusLabels[term.approval_status]}
                          </Badge>
                          {term.approval_status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleApprove(term.id)}
                                className="text-emerald-600 hover:text-emerald-700 text-xs"
                                title="승인"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => handleReject(term.id)}
                                className="text-red-600 hover:text-red-700 text-xs"
                                title="거부"
                              >
                                ✗
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ ...getCellStyle('hitCount'), textAlign: 'center' }}>
                        <span className="text-sm font-medium text-primary-active">
                          {term.hit_count || 0}
                        </span>
                      </td>
                      <td style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'center' }}>
                        <div className="flex justify-center gap-2">
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

        {/* Bulk Action Bar */}
        <BulkActionBar
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          onBulkApprove={handleBulkApprove}
          onBulkReject={handleBulkReject}
          onBulkRetranslate={async (ids) => {
            const selectedTerms = terms.filter(t => ids.includes(t.id));
            const uniqueTerms = [...new Set(selectedTerms.map(t => t.term))];
            for (const term of uniqueTerms) {
              const termData = selectedTerms.find(t => t.term === term);
              if (termData) {
                await handleRetranslate(term, termData.context || '', displayLanguageColumns);
              }
            }
          }}
        />

        {/* Modals */}
        <GlossaryFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          sourceText={formSourceText}
          onSourceTextChange={setFormSourceText}
          context={formContext}
          onContextChange={setFormContext}
          productCodes={formProductCodes}
          onProductCodesChange={setFormProductCodes}
          onSubmit={editingTerm ? handleUpdate : handleCreate}
          submitLabel={editingTerm ? "저장" : "추가"}
          isSubmitting={isSubmitting}
          selectedLanguages={displayLanguageColumns}
          onRetranslate={handleRetranslate}
        />

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
      </div>
    </DashboardLayout>
  );
}

export default function GlossaryProductPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <GlossaryProductContent />
    </Suspense>
  );
}
