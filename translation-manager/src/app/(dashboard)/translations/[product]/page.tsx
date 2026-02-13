'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
import { BulkVersionHistoryPanel } from '../components/VersionHistory';

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
  const { translations, setTranslations, loading, fetchTranslations, updateLocalTranslation } = useTranslationData({
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

  // Event handlers
  const handlers = useTranslationEventHandlers({
    fetchTranslations,
    setSelectedProduct: filters.setSelectedProduct,
    openEmailModal: modals.openEmailModal,
    openDeploymentModal: modals.openDeploymentModal,
    selectedTranslationsCount: modals.selectedTranslations.length,
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

  // Duplicate-checked update handlers
  const handleVersionUpdateWithDuplicateCheck = duplicateCheck.makeVersionUpdateWithDuplicateCheck(
    mutations.handleVersionUpdate as (id: string, value: string | string[] | null) => Promise<void>
  );
  const handleNotesUpdateWithDuplicateCheck = duplicateCheck.makeNotesUpdateWithDuplicateCheck();

  // Calculate available languages for display (includes Korean)
  const availableLanguages = useMemo(() => {
    return getAllDisplayableLanguages();
  }, []);

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
    <DashboardLayout title={`번역 관리 - ${productCode?.toUpperCase()}`}>
      <div className="space-y-6">
        {/* Translation Header with Status Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {['pending', 'in_progress', 'reviewed', 'deployed'].map((status) => {
              const count = requests.filter(r => r.status === status).length;
              const labels = {
                pending: '요청',
                in_progress: '진행중',
                reviewed: '검수중',
                deployed: '반영완료'
              };
              return (
                <button
                  key={status}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    count > 0
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {labels[status as keyof typeof labels]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Translation Header */}
        <TranslationsHeader
          onCreateClick={modals.openCreateModal}
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
          onToggleSelectAll={modals.toggleSelectAll}
          onToggleSelect={modals.toggleSelect}
          selectedTranslations={modals.selectedTranslations}
          isAllSelected={modals.isAllSelected}
          page={filters.page}
          totalPages={filters.totalPages}
          onPageChange={filters.setPage}
        />

        {/* Bulk Action Bar */}
        <TranslationBulkActionBar
          selectedCount={modals.selectedTranslations.length}
          onClearSelection={modals.clearSelection}
          onBulkStatusChange={mutations.handleBulkStatusChange}
          onBulkDelete={mutations.handleBulkDelete}
          onBulkExport={handlers.handleBulkExport}
          onVersionHistoryClick={modals.openVersionHistoryPanel}
        />

        {/* Modals */}
        <CreateTranslationModal
          isOpen={modals.isCreateModalOpen}
          onClose={modals.closeCreateModal}
          onCreate={mutations.handleCreate}
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

        {/* Version History Sidebar */}
        {modals.isVersionHistoryPanelOpen && modals.selectedTranslations.length > 0 && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">버전 기록</h3>
              <button
                onClick={modals.closeVersionHistoryPanel}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BulkVersionHistoryPanel
                translationIds={modals.selectedTranslations.map(t => t.id)}
                languageCode={filters.selectedLanguageColumns?.[0] || 'ko'}
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
