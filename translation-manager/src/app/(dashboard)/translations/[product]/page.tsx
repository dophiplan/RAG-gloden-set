'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import RequestList from '@/components/dashboard/RequestList';
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
        {/* Request List */}
        <RequestList
          requests={requests}
          loading={requestsLoading}
          onStatusChange={handleStatusChange}
        />

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
          isOpen={glossary.isModalOpen}
          onClose={glossary.handleCloseModal}
          term={glossary.selectedTerm}
        />

        <BulkVersionHistoryPanel
          isOpen={modals.isVersionHistoryPanelOpen}
          onClose={modals.closeVersionHistoryPanel}
          selectedTranslationIds={modals.selectedTranslations.map(t => t.id)}
        />
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
