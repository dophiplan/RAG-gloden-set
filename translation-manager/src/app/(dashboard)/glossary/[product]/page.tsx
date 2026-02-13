'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RequestList from '@/components/dashboard/RequestList';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import { LanguageCode, ProductCode } from '@/types';
import type { DashboardRequest } from '@/types/translations';
import { useGlossaryData } from '../hooks/useGlossaryData';
import { useProducts, useLanguages } from '@/hooks/useReferenceData';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import GlossaryFormModal from '../components/GlossaryFormModal';
import ExportModal from '../components/ExportModal';
import BulkActionBar from '../components/BulkActionBar';
import GlossaryTableHeader from '@/components/glossary/GlossaryTableHeader';
import { showError } from '@/lib/notifications';

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

  const displayLanguageColumns = selectedLanguageColumns.filter(lang => lang !== 'ko');

  // Request list data
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const response = await fetch('/api/dashboard/requests');
        if (response.ok) {
          const data = await response.json();
          // Filter by product
          const filteredRequests = productCode
            ? data.requests.filter((req: DashboardRequest) =>
                req.products.some(p => p.code === productCode)
              )
            : data.requests;
          setRequests(filteredRequests);
        }
      } catch (error) {
        console.error('Error fetching requests:', error);
        showError('요청 목록을 불러오는데 실패했습니다.');
      } finally {
        setRequestsLoading(false);
      }
    }

    fetchRequests();
  }, [productCode]);

  const handleStatusChange = async (id: string, newStatus: import('@/types/translations').TranslationStatus) => {
    try {
      const response = await fetch(`/api/translations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Status change error:', error.error || 'Failed to update status');
        showError('상태 변경에 실패했습니다.');
        return;
      }

      // Refresh requests
      const requestsRes = await fetch('/api/dashboard/requests');
      if (requestsRes.ok) {
        const data = await requestsRes.json();
        const filteredRequests = productCode
          ? data.requests.filter((req: DashboardRequest) =>
              req.products.some(p => p.code === productCode)
            )
          : data.requests;
        setRequests(filteredRequests);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showError('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  return (
    <DashboardLayout title={`용어집 - ${productCode?.toUpperCase()}`}>
      <div className="space-y-6">
        {/* Request List */}
        <RequestList
          requests={requests}
          loading={requestsLoading}
          onStatusChange={handleStatusChange}
        />

        {/* Glossary Content */}
        <Card padding="none">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main">용어집</h2>
              <p className="text-sm text-text-muted mt-1">
                등록된 용어: {terms.length}개
                {suggestionCount > 0 && (
                  <span className="ml-2 text-amber-600">· AI 제안: {suggestionCount}개</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAIReview}
                loading={isReviewing}
              >
                AI 용어 검수
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsExportModalOpen(true)}
              >
                내보내기
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
              >
                + 용어 추가
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 bg-background space-y-4">
            {/* Search and Quick Filters */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="용어 또는 번역 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value as LanguageCode | '')}
                options={languageSelectOptions}
                className="w-48"
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={approvalStatusFilter === 'pending' ? 'primary' : 'ghost'}
                  onClick={() => setQuickFilter('pending')}
                >
                  검수 대기 ({terms.filter(t => t.approval_status === 'pending').length})
                </Button>
                <Button
                  size="sm"
                  variant={approvalStatusFilter === 'approved' ? 'primary' : 'ghost'}
                  onClick={() => setQuickFilter('approved')}
                >
                  승인 ({terms.filter(t => t.approval_status === 'approved').length})
                </Button>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? '간단히' : '고급 필터'}
              </Button>

              {(languageFilter || sourceTypeFilter || approvalStatusFilter || importedAfter || importedBefore) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetFilters}
                >
                  초기화
                </Button>
              )}
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <Select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  options={[
                    { value: '', label: '모든 출처' },
                    { value: 'manual', label: '수동' },
                    { value: 'excel_import', label: 'Excel' },
                    { value: 'ai_generated', label: 'AI' },
                  ]}
                  className="w-48"
                />

                <Input
                  type="date"
                  placeholder="등록일 시작"
                  value={importedAfter}
                  onChange={(e) => setImportedAfter(e.target.value)}
                  className="w-48"
                />

                <Input
                  type="date"
                  placeholder="등록일 종료"
                  value={importedBefore}
                  onChange={(e) => setImportedBefore(e.target.value)}
                  className="w-48"
                />

                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: 'created_desc', label: '최신순' },
                    { value: 'created_asc', label: '오래된순' },
                    { value: 'term_asc', label: '가나다순' },
                    { value: 'hits_desc', label: '사용 횟수 높은순' },
                  ]}
                  className="w-48"
                />
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <GlossaryTableHeader
                isAllSelected={isAllSelected}
                onToggleAll={toggleSelectAll}
                columnWidths={columnWidths}
                onResizeStart={onResizeStart}
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
                          <div className="flex items-center gap-2">
                            <Badge variant={getApprovalStatusBadgeVariant(firstTerm.approval_status)}>
                              {approvalStatusLabels[firstTerm.approval_status]}
                            </Badge>
                            {firstTerm.approval_status === 'pending' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleApprove(firstTerm.id)}
                                  className="text-emerald-600 hover:text-emerald-700 text-xs"
                                  title="승인"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => handleReject(firstTerm.id)}
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
                            {firstTerm.hit_count || 0}
                          </span>
                        </td>
                        <td style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'center' }}>
                          <div className="flex justify-center gap-2">
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
        />

        {/* Modals */}
        <GlossaryFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          term={formTerm}
          translation={formTranslation}
          language={formLanguage}
          context={formContext}
          productCode={formProductCode}
          onTermChange={setFormTerm}
          onTranslationChange={setFormTranslation}
          onLanguageChange={setFormLanguage}
          onContextChange={setFormContext}
          onProductCodeChange={setFormProductCode}
          onSubmit={editingTerm ? handleUpdate : handleCreate}
          isEditing={!!editingTerm}
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
