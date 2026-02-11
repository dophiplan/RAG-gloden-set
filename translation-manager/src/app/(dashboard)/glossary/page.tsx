'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import ProductTabs from '@/components/ProductTabs';
import { SUPPORTED_LANGUAGES, LanguageCode, PRODUCTS } from '@/types';
import { LANGUAGE_SELECT_OPTIONS } from '@/lib/constants';
import { useGlossaryData } from './hooks/useGlossaryData';
import GlossaryFormModal from './components/GlossaryFormModal';
import ExportModal from './components/ExportModal';
import BulkActionBar from './components/BulkActionBar';
import GlossaryStatsCard from './components/GlossaryStatsCard';

export default function GlossaryPage() {
  const router = useRouter();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    setQuickFilter,
    resetFilters,
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

        {/* Statistics Dashboard */}
        <GlossaryStatsCard />

        {/* Filters */}
        <Card>
          <div className="space-y-4">
            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setQuickFilter('pending')}
                className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              >
                ⏳ 승인 대기 항목
              </Button>
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
                variant="secondary"
                onClick={resetFilters}
              >
                필터 초기화
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? '▲ 고급 필터 숨기기' : '▼ 고급 필터 표시'}
              </Button>
            </div>

            {/* Main Filters */}
            <div className="flex flex-wrap gap-4">
              {/* 언어 */}
              <div className="w-40">
                <Select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  options={LANGUAGE_SELECT_OPTIONS}
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
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
                <div className="w-52">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    추가 시작일
                  </label>
                  <Input
                    type="date"
                    value={importedAfter}
                    onChange={(e) => setImportedAfter(e.target.value)}
                  />
                </div>
                <div className="w-52">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    추가 종료일
                  </label>
                  <Input
                    type="date"
                    value={importedBefore}
                    onChange={(e) => setImportedBefore(e.target.value)}
                  />
                </div>
              </div>
            )}
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
              onClick={() => router.push('/glossary/import')}
            >
              Excel 가져오기
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
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]"></div>
              <p className="mt-4 text-[#64748B]">로딩 중...</p>
            </div>
          </Card>
        ) : languageFilter ? (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th>용어</th>
                    <th>번역</th>
                    <th>문맥</th>
                    <th>제품</th>
                    <th>출처</th>
                    <th title="AI가 추가한 용어는 승인 후 사용됩니다">
                      검수 상태 <span className="text-gray-400">ⓘ</span>
                    </th>
                    <th title="이 용어가 번역에 재사용된 횟수">
                      사용 횟수 <span className="text-gray-400">ⓘ</span>
                    </th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
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
                        <td className="px-2 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(term.id)}
                            onChange={() => handleToggleOne(term.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="font-semibold">{term.term}</td>
                        <td>{term.translation}</td>
                        <td className="text-[#64748B]">{term.context || '-'}</td>
                        <td>
                          {term.product_code ? (
                            <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          <Badge variant={getSourceTypeBadgeVariant(term.source_type)}>
                            {sourceTypeLabels[term.source_type] || term.source_type}
                          </Badge>
                        </td>
                        <td>
                          <Badge variant={getApprovalStatusBadgeVariant(term.approval_status)}>
                            {approvalStatusLabels[term.approval_status] || term.approval_status}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <span className={term.hit_count > 0 ? 'font-semibold text-indigo-600' : 'text-gray-400'}>
                            {term.hit_count}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex justify-end gap-2">
                            {term.approval_status === 'pending' && (
                              <>
                                <Button size="sm" variant="success" onClick={() => handleApprove(term.id)}>✓ 승인</Button>
                                <Button size="sm" variant="error" onClick={() => handleReject(term.id)}>✗ 거부</Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEditModal(term)}>수정</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)}>삭제</Button>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th>용어</th>
                    <th>번역</th>
                    <th>문맥</th>
                    <th>제품</th>
                    <th>출처</th>
                    <th title="AI가 추가한 용어는 승인 후 사용됩니다">
                      검수 상태 <span className="text-gray-400">ⓘ</span>
                    </th>
                    <th title="이 용어가 번역에 재사용된 횟수">
                      사용 횟수 <span className="text-gray-400">ⓘ</span>
                    </th>
                    <th style={{ textAlign: 'right' }}>작업</th>
                  </tr>
                </thead>
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
          <div className="space-y-6">
            {Object.entries(groupedTerms).map(([langCode, langTerms]) => (
              <Card key={langCode} padding="none">
                <div className="px-6 py-4 border-b border-[#E2E8F0] bg-white/60 flex items-center gap-3">
                  <Badge variant="info">
                    {SUPPORTED_LANGUAGES[langCode as LanguageCode]}
                  </Badge>
                  <span className="text-sm text-[#64748B] font-medium">
                    {langTerms.length}개 용어
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="w-8">
                          <input
                            type="checkbox"
                            checked={langTerms.every(t => selectedIds.includes(t.id))}
                            onChange={() => {
                              const allLangIds = langTerms.map(t => t.id);
                              if (allLangIds.every(id => selectedIds.includes(id))) {
                                setSelectedIds(prev => prev.filter(id => !allLangIds.includes(id)));
                              } else {
                                setSelectedIds(prev => [...new Set([...prev, ...allLangIds])]);
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th>용어</th>
                        <th>번역</th>
                        <th>문맥</th>
                        <th>제품</th>
                        <th>검수 상태</th>
                        <th style={{ textAlign: 'right' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langTerms.map((term) => (
                        <tr key={term.id}>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(term.id)}
                              onChange={() => handleToggleOne(term.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="font-semibold">{term.term}</td>
                          <td>{term.translation}</td>
                          <td className="text-[#64748B]">{term.context || '-'}</td>
                          <td>
                            {term.product_code ? (
                              <Badge variant="info">{PRODUCTS[term.product_code]}</Badge>
                            ) : (
                              <span className="text-xs text-[#94A3B8]">-</span>
                            )}
                          </td>
                          <td>
                            <Badge variant={getApprovalStatusBadgeVariant(term.approval_status)}>
                              {approvalStatusLabels[term.approval_status] || term.approval_status}
                            </Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex justify-end gap-2">
                              {term.approval_status === 'pending' && (
                                <>
                                  <Button size="sm" variant="success" onClick={() => handleApprove(term.id)}>✓ 승인</Button>
                                  <Button size="sm" variant="error" onClick={() => handleReject(term.id)}>✗ 거부</Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => openEditModal(term)}>수정</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(term.id)}>삭제</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
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
          editingLanguage={editingTerm ? SUPPORTED_LANGUAGES[editingTerm.language_code as LanguageCode] : undefined}
        />

        {/* Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          currentFilters={{
            language: languageFilter as any,
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
          onApproveAll={() => {
            handleBulkApprove(selectedIds);
            setSelectedIds([]);
          }}
          onRejectAll={() => {
            handleBulkReject(selectedIds);
            setSelectedIds([]);
          }}
          onClearSelection={() => setSelectedIds([])}
        />
      </div>
    </DashboardLayout>
  );
}
