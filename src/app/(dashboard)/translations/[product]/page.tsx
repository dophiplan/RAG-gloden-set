'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TranslationTableV2 from '@/components/translations/TranslationTableV2';
import EmailTemplateModal from '@/components/translations/EmailTemplateModal';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import DuplicateEditModal from '@/components/translations/DuplicateEditModal';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
import type { DashboardRequest } from '@/types/translations';
import type { ProductCode } from '@/types';
import { showError } from '@/lib/notifications';
import { apiGet, apiPatch } from '@/lib/api-utils';

import { useTranslationFilters } from '../hooks/useTranslationFilters';
import { useTranslationData } from '../hooks/useTranslationData';
import { useTranslationMutations } from '../hooks/useTranslationMutations';
import { useDuplicateCheck } from '../hooks/useDuplicateCheck';
import { useGlossaryModal } from '../hooks/useGlossaryModal';
import { useModalStates } from '../hooks/useModalStates';
import { useTranslationEventHandlers } from '../hooks/useTranslationEventHandlers';
import { useUrlParamsHandler } from '../hooks/useUrlParamsHandler';
import { useLanguageColumnManager } from '../hooks/useLanguageColumnManager';

import TranslationsHeader from '../components/TranslationsHeader';
import TranslationFiltersBar from '../components/TranslationFiltersBar';
import CreateTranslationModal from '../components/CreateTranslationModal';

import GlossaryAddModal from '../components/GlossaryAddModal';
import TranslationBulkActionBar from '@/components/translations/TranslationBulkActionBar';
import { UnifiedVersionHistoryPanel } from '../components/VersionHistory';

function TranslationsProductContent() {
  const params = useParams();
  const productCode = params.product as ProductCode;

  // Filters (automatically set to product from URL)
  const filters = useTranslationFilters();

  // Set product filter from URL
  useEffect(() => {
    if (productCode) {
      filters.setSelectedProduct(productCode);
    }
  }, [productCode, filters.setSelectedProduct]);

  // Data
  const { translations, setTranslations, loading, stats, fetchTranslations, updateLocalTranslation } = useTranslationData({
    statusFilter: filters.statusFilter,
    languageFilter: filters.languageFilter,
    searchTerm: filters.searchTerm,
    selectedProduct: productCode,
    requestIdFilter: filters.requestIdFilter,
    scopeFilter: filters.scopeFilter,
    versionFilter: filters.versionFilter,
    page: filters.page,
    setTotalPages: filters.setTotalPages,
    createdAfter: filters.createdAfter,
    createdBefore: filters.createdBefore,
  });

  // Mutations
  const mutations = useTranslationMutations({
    translations,
    setTranslations,
    fetchTranslations,
    updateLocalTranslation,
  });

  // Modal states
  const modals = useModalStates(translations);
  
  // Debug log - 개발 모드에서만 출력
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[Product Page] modals.selectedIds:', modals.selectedIds, 'modals.selectedTranslations:', modals.selectedTranslations.length);
  }

  // Event handlers
  const handlers = useTranslationEventHandlers({
    fetchTranslations,
    setSelectedProduct: filters.setSelectedProduct,
    openEmailModal: modals.openEmailModal,
    openDeploymentModal: modals.openDeploymentModal,
    selectedTranslationsCount: modals.selectedTranslations.length,
    translations,
    selectedTranslations: modals.selectedTranslations,
  });

  // URL params handling
  useUrlParamsHandler({
    selectedProduct: productCode,
    setSelectedProduct: filters.setSelectedProduct,
    requestIdFilter: filters.requestIdFilter,
    setRequestIdFilter: filters.setRequestIdFilter,
    fetchTranslations,
    handleBulkCreate: mutations.handleBulkCreate,
  });

  // Language column management
  useLanguageColumnManager({
    selectedProduct: productCode,
    setSelectedLanguageColumns: filters.setSelectedLanguageColumns,
  });

  // Duplicate check
  const duplicateCheck = useDuplicateCheck({ translations, fetchTranslations });

  // Glossary modal
  const glossary = useGlossaryModal();

  // Wrapper for create with product code from URL
  const handleCreateWithProduct = useCallback(async (
    sourceText: string,
    context: string,
    version: string,
    scope: import('@/types').ScopeType,
    priority: import('@/types').PriorityLevel,
    languages: import('@/types').LanguageCode[],
    platformCodes: string[],
    completionDate: string
  ) => {
    // Call the original handleCreate with additional product code logic via API
    const { apiPost } = await import('@/lib/api-utils');
    const { showSuccess, showError } = await import('@/lib/notifications');
    const { invalidateCache } = await import('@/hooks/useSWRData');
    
    if (!sourceText.trim()) return false;
    
    try {
      // Create translation with product code from URL
      const createdTranslation = await apiPost<{
        data?: { id: string };
        id: string;
      }>('/api/translations', {
        source_text: sourceText,
        context: context || undefined,
        version: version || undefined,
        product_code: productCode, // From URL
        scope: scope || undefined,
        priority,
        platform_codes: platformCodes?.length ? platformCodes : undefined,
      });
      
      const translationId = createdTranslation.data?.id || createdTranslation.id;
      
      if (!translationId) {
        showError('번역 ID를 찾을 수 없습니다.');
        return false;
      }
      
      showSuccess('번역이 생성되었습니다. AI 번역을 진행 중입니다...');
      fetchTranslations();
      
      // Auto-translate
      if (languages && languages.length > 0) {
        (async () => {
          try {
            const result = await apiPost<{
              translations?: unknown[];
              provider: string;
            }>('/api/ai/translate', {
              translationId: translationId,
              sourceText: sourceText,
              context: context || undefined,
              targetLanguages: languages,
            });
            
            if (result) {
              showSuccess(`AI 번역 완료: ${result.translations?.length || 0}개 언어 (${result.provider})`);
              setTimeout(() => fetchTranslations(), 500);
            }
          } catch (aiError) {
            console.error('[AutoTranslate] Error:', aiError);
          }
        })();
      }
      
      invalidateCache(/^\/api\/(translations|dashboard)/);
      return true;
    } catch (error) {
      console.error('Error creating translation:', error);
      showError('번역 생성 중 오류가 발생했습니다.');
      return false;
    }
  }, [productCode, fetchTranslations]);

  // Duplicate-checked update handlers
  const handleVersionUpdateWithDuplicateCheck = duplicateCheck.makeVersionUpdateWithDuplicateCheck(
    mutations.handleVersionUpdate as (id: string, value: string | string[] | null) => Promise<void>
  );
  const handleNotesUpdateWithDuplicateCheck = duplicateCheck.makeNotesUpdateWithDuplicateCheck();

  // Calculate available languages for display (includes Korean)
  const availableLanguages = useMemo(() => {
    return getAllDisplayableLanguages();
  }, []);

  // 개별 번역 항목 히스토리 모달 상태
  const [individualHistoryModal, setIndividualHistoryModal] = useState<{
    open: boolean;
    translationId: string | null;
    languageCode: string;
    curre[기밀마스킹]ext: string;
  }>({
    open: false,
    translationId: null,
    languageCode: 'ko',
    curre[기밀마스킹]ext: '',
  });

  // 번역 텍스트 가져오기 헬퍼
  const getTranslationText = useCallback((translation: typeof translations[0], languageCode: string): string => {
    const result = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    return result?.translated_text || '';
  }, []);

  // 히스토리 버튼 클릭 핸들러
  const handleHistoryClick = useCallback((translationId: string) => {
    const translation = translations.find(t => t.id === translationId);
    if (translation) {
      const langCode = filters.selectedLanguageColumns?.[0] || 'ko';
      setIndividualHistoryModal({
        open: true,
        translationId,
        languageCode: langCode,
        curre[기밀마스킹]ext: getTranslationText(translation, langCode),
      });
    }
  }, [translations, filters.selectedLanguageColumns, getTranslationText]);

  // Request list data
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const result = await apiGet<{ data?: { requests?: DashboardRequest[] }; requests?: DashboardRequest[] }>('/api/dashboard/requests');
        // API returns { data: { requests: [...] } }
        const requestsData = result.data?.requests || result.requests || [];
        // Filter by product
        const filteredRequests = productCode
          ? requestsData.filter((req: DashboardRequest) =>
              req.products.some(p => p.code === productCode)
            )
          : requestsData;
        setRequests(filteredRequests);
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
      await apiPatch(`/api/translations/${id}/status`, { status: newStatus });

      // Refresh translations table
      fetchTranslations();

      // Refresh requests
      const result = await apiGet<{ data?: { requests?: DashboardRequest[] }; requests?: DashboardRequest[] }>('/api/dashboard/requests');
      const requestsData = result.data?.requests || result.requests || [];
      const filteredRequests = productCode
        ? requestsData.filter((req: DashboardRequest) =>
            req.products.some(p => p.code === productCode)
          )
        : requestsData;
      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error updating status:', error);
      showError('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  return (
    <DashboardLayout title={`번역 관리 - ${productCode?.toUpperCase()}`}>
      <div className="space-y-3 pb-4">
        {/* Status Tabs with Create Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[
              { key: 'pending', label: '요청', count: stats.pending, color: 'yellow' },
              { key: 'in_progress', label: '진행중', count: translations.filter(t => t.status === 'in_progress').length, color: 'blue' },
              { key: 'reviewed', label: '검수중', count: stats.reviewed, color: 'indigo' },
              { key: 'deployed', label: '반영완료', count: stats.deployed, color: 'green' },
              { key: 're_request', label: '재요청', count: translations.filter(t => t.status === 're_request').length, color: 'orange' },
              { key: 'not_used', label: '미사용', count: translations.filter(t => t.status === 'not_used').length, color: 'gray' },
            ].map((tab) => {
              const isActive = filters.statusFilter === tab.key;
              const hasItems = tab.count > 0;
              
              const colorClasses: Record<string, { active: string; inactive: string }> = {
                yellow: { active: 'bg-yellow-500 text-white', inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
                blue: { active: 'bg-blue-600 text-white', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                indigo: { active: 'bg-indigo-600 text-white', inactive: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                green: { active: 'bg-green-600 text-white', inactive: 'bg-green-50 text-green-700 hover:bg-green-100' },
                orange: { active: 'bg-orange-500 text-white', inactive: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                gray: { active: 'bg-gray-600 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
              };
              
              const colors = colorClasses[tab.color];
              
              return (
                <button
                  key={tab.key}
                  onClick={() => filters.setStatusFilter(isActive ? '' : tab.key as any)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? colors.active + ' shadow-md'
                      : hasItems
                        ? colors.inactive
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
          <button
            onClick={modals.openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            새 번역 추가
          </button>
        </div>

        {/* Translation Header */}
        <TranslationsHeader
          onEmailClick={() => handlers.handleEmailClick(modals.selectedTranslations)}
          onDownloadExcel={handlers.handleDownloadExcel}
          onDownloadAllExcel={handlers.handleDownloadAllExcel}
          hasSelectedTranslations={modals.selectedTranslations.length > 0}
          canEmail={modals.canEmail}
        />

        {/* Filters */}
        <TranslationFiltersBar
          statusFilter={filters.statusFilter}
          languageFilter={filters.languageFilter}
          searchTerm={filters.searchTerm}
          requestIdFilter={filters.requestIdFilter}
          scopeFilter={filters.scopeFilter}
          versionFilter={filters.versionFilter}
          createdAfter={filters.createdAfter}
          createdBefore={filters.createdBefore}
          selectedLanguageColumns={filters.selectedLanguageColumns}
          availableLanguages={availableLanguages}
          showAdvancedFilters={filters.showAdvancedFilters}
          onStatusFilterChange={filters.setStatusFilter}
          onLanguageFilterChange={filters.setLanguageFilter}
          onSearchChange={filters.setSearchTerm}
          onRequestIdChange={filters.setRequestIdFilter}
          onScopeChange={filters.setScopeFilter}
          onVersionChange={filters.setVersionFilter}
          onCreatedAfterChange={filters.setCreatedAfter}
          onCreatedBeforeChange={filters.setCreatedBefore}
          onLanguageColumnsChange={filters.setSelectedLanguageColumns}
          onToggleAdvancedFilters={filters.toggleAdvancedFilters}
          onQuickFilter={filters.applyQuickFilter}
          onClearAllFilters={filters.clearAllFilters}
        />

        {/* Translation Table */}
        <TranslationTableV2
          translations={translations}
          loading={loading}
          selectedLanguageColumns={filters.selectedLanguageColumns}
          onLanguageColumnsChange={filters.setSelectedLanguageColumns}
          availableLanguages={availableLanguages}
          onStatusChange={mutations.handleStatusChange}
          onTranslationUpdate={mutations.handleTranslationUpdate}
          onSourceTextUpdate={mutations.handleSourceTextUpdate}
          onScreenUpdate={mutations.handleScreenUpdate}
          onContextUpdate={mutations.handleContextUpdate}
          onScopeUpdate={mutations.handleScopeUpdate}
          onPlatformUpdate={mutations.handlePlatformUpdate}
          onVersionUpdate={handleVersionUpdateWithDuplicateCheck}
          onNotesUpdate={handleNotesUpdateWithDuplicateCheck}
          onPriorityChange={mutations.handlePriorityChange}
          onDelete={mutations.handleDelete}
          onAddToGlossary={glossary.handleOpenModal}
          onHistoryClick={handleHistoryClick}
          onToggleSelectAll={modals.toggleSelectAll}
          onToggleSelect={modals.toggleSelect}
          selectedIds={modals.selectedIds}
          onSelectionChange={modals.setSelectedIds}
          selectedTranslations={modals.selectedTranslations}
          isAllSelected={modals.isAllSelected}
          page={filters.page}
          totalPages={filters.totalPages}
          onPageChange={filters.setPage}
        />

        {/* Bulk Action Bar */}
        <TranslationBulkActionBar
          selectedCount={modals.selectedIds.length}
          selectedIds={modals.selectedIds}
          onClearSelection={modals.clearSelection}
          onBulkStatusChange={(status) => mutations.handleBulkStatusChange(modals.selectedIds, status)}
          onBulkDelete={mutations.handleBulkDelete}
          onBulkExport={handlers.handleBulkExport}
          onVersionHistoryClick={modals.openVersionHistoryPanel}
          onRefresh={fetchTranslations}
        />

        {/* Modals */}
        <CreateTranslationModal
          isOpen={modals.isCreateModalOpen}
          onClose={modals.closeCreateModal}
          onCreate={handleCreateWithProduct}
          onPDFUpload={handlers.handlePDFUpload}
        />

        <EmailTemplateModal
          isOpen={modals.isEmailModalOpen}
          onClose={modals.closeEmailModal}
          selectedTranslations={modals.selectedTranslations}
          onSend={handlers.handleSendEmail}
        />

        {modals.isDeploymentModalOpen && modals.selectedTranslations.length > 0 && (
          <DeploymentCheckModal
            isOpen={modals.isDeploymentModalOpen}
            onClose={modals.closeDeploymentModal}
            translation={modals.selectedTranslations[0]}
            onUpdate={() => {
              fetchTranslations();
              modals.clearSelection();
            }}
          />
        )}

        <DuplicateEditModal
          isOpen={duplicateCheck.showDuplicateModal}
          onClose={duplicateCheck.handleCancelDuplicateEdit}
          duplicates={duplicateCheck.duplicates}
          newVersion={duplicateCheck.pendingEdit?.newVersion || ''}
          onConfirm={duplicateCheck.handleConfirmDuplicateEdit}
        />

        <GlossaryAddModal
          isOpen={glossary.isGlossaryModalOpen}
          onClose={glossary.closeGlossaryModal}
          glossaryTerm={glossary.glossaryTerm}
          setGlossaryTerm={glossary.setGlossaryTerm}
          glossaryTranslation={glossary.glossaryTranslation}
          setGlossaryTranslation={glossary.setGlossaryTranslation}
          glossaryLanguage={glossary.glossaryLanguage}
          setGlossaryLanguage={glossary.setGlossaryLanguage}
          glossaryContext={glossary.glossaryContext}
          setGlossaryContext={glossary.setGlossaryContext}
          glossaryProductCodes={glossary.glossaryProductCodes}
          toggleGlossaryProduct={glossary.toggleGlossaryProduct}
          onSave={glossary.handleGlossaryCreate}
        />

        {/* Version History Sidebar (Bulk) */}
        {modals.isVersionHistoryPanelOpen && modals.selectedTranslations.length > 0 && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
            <UnifiedVersionHistoryPanel
              mode="bulk"
              translationIds={modals.selectedTranslations.map(t => t.id)}
              languageCode={filters.selectedLanguageColumns?.[0] || 'ko'}
              onClose={modals.closeVersionHistoryPanel}
              onRevert={() => {
                fetchTranslations();
                modals.clearSelection();
              }}
            />
          </div>
        )}

        {/* 개별 번역 히스토리 모달 */}
        {individualHistoryModal.open && individualHistoryModal.translationId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
              <UnifiedVersionHistoryPanel
                mode="single"
                translationId={individualHistoryModal.translationId}
                languageCode={individualHistoryModal.languageCode}
                curre[기밀마스킹]ext={individualHistoryModal.curre[기밀마스킹]ext}
                onClose={() => setIndividualHistoryModal(prev => ({ ...prev, open: false }))}
                onRevert={() => {
                  fetchTranslations();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function TranslationsProductPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TranslationsProductContent />
    </Suspense>
  );
}
