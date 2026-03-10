'use client';

import { useMemo, Suspense, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProductTabs from '@/components/ProductTabs';
import TranslationTableV2 from '@/components/translations/TranslationTableV2';
import EmailTemplateModal from '@/components/translations/EmailTemplateModal';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import DuplicateEditModal from '@/components/translations/DuplicateEditModal';
import { getAllDisplayableLanguages } from '@/lib/product-languages';

import { useTranslationFilters } from './hooks/useTranslationFilters';
import { useTranslationData } from './hooks/useTranslationData';
import { useTranslationStats } from './hooks/useTranslationStats';
import { useTranslationMutations } from './hooks/useTranslationMutations';
import { useDuplicateCheck } from './hooks/useDuplicateCheck';
import { useGlossaryModal } from './hooks/useGlossaryModal';
import { useModalStates } from './hooks/useModalStates';
import { useTranslationEventHandlers } from './hooks/useTranslationEventHandlers';
import { useUrlParamsHandler } from './hooks/useUrlParamsHandler';
import { useLanguageColumnManager } from './hooks/useLanguageColumnManager';

import TranslationsHeader from './components/TranslationsHeader';
import TranslationFiltersBar from './components/TranslationFiltersBar';
import CreateTranslationModal from './components/CreateTranslationModal';
import GlossaryAddModal from './components/GlossaryAddModal';
import TranslationBulkActionBar from '@/components/translations/TranslationBulkActionBar';
import { UnifiedVersionHistoryPanel } from './components/VersionHistory';

function TranslationsContent() {
  // Filters
  const filters = useTranslationFilters();

  // Data
  const { translations, setTranslations, loading, fetchTranslations, updateLocalTranslation } = useTranslationData({
    statusFilter: filters.statusFilter,
    languageFilter: filters.languageFilter,
    searchTerm: filters.searchTerm,
    selectedProduct: filters.selectedProduct,
    requestIdFilter: filters.requestIdFilter,
    scopeFilter: filters.scopeFilter,
    versionFilter: filters.versionFilter,
    page: filters.page,
    setTotalPages: filters.setTotalPages,
    createdAfter: filters.createdAfter,
    createdBefore: filters.createdBefore,
  });

  // Stats (for tab counts)
  const { stats, refreshStats } = useTranslationStats(filters.selectedProduct);

  // Combined refresh function
  const handleRefresh = useCallback(() => {
    fetchTranslations();
    refreshStats();
  }, [fetchTranslations, refreshStats]);

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
    selectedTranslationsCount: (modals.selectedTranslations || []).length,
  });

  // URL params handling
  useUrlParamsHandler({
    selectedProduct: filters.selectedProduct,
    setSelectedProduct: filters.setSelectedProduct,
    requestIdFilter: filters.requestIdFilter,
    setRequestIdFilter: filters.setRequestIdFilter,
    fetchTranslations,
    handleBulkCreate: mutations.handleBulkCreate,
  });

  // Language column management
  useLanguageColumnManager({
    selectedProduct: filters.selectedProduct,
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

  return (
    <DashboardLayout
      title="번역 관리"
      subtitle="번역된 언어들을 전체 볼 수 있습니다."
    >
      <div className="space-y-3 overflow-x-auto pb-4">
        {/* Product Tabs with Create Button */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <ProductTabs
              selectedProduct={filters.selectedProduct}
              onProductChange={filters.setSelectedProduct}
            />
          </div>
          <button
            onClick={modals.openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors ml-4"
          >
            새 번역 추가
          </button>
        </div>

        <TranslationFiltersBar
          searchTerm={filters.searchTerm}
          onSearchChange={filters.setSearchTerm}
          languageFilter={filters.languageFilter}
          onLanguageFilterChange={filters.setLanguageFilter}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={filters.setStatusFilter}
          scopeFilter={filters.scopeFilter}
          onScopeFilterChange={filters.setScopeFilter}
          versionFilter={filters.versionFilter}
          onVersionFilterChange={filters.setVersionFilter}
          selectedLanguageColumns={filters.selectedLanguageColumns}
          onLanguageColumnsChange={filters.setSelectedLanguageColumns}
          availableLanguages={availableLanguages}
          showAdvancedFilters={filters.showAdvancedFilters}
          onToggleAdvancedFilters={() => filters.setShowAdvancedFilters(!filters.showAdvancedFilters)}
          createdAfter={filters.createdAfter}
          onCreatedAfterChange={filters.setCreatedAfter}
          createdBefore={filters.createdBefore}
          onCreatedBeforeChange={filters.setCreatedBefore}
          onQuickFilter={filters.setQuickFilter}
        />

        <TranslationsHeader
          selectedCount={(modals.selectedTranslations || []).length}
          onShowHistory={() => {
            if ((modals.selectedIds || []).length > 0) {
              modals.openHistoryPanel();
            }
          }}
          translations={translations}
          versionFilter={filters.versionFilter}
        />

        <TranslationTableV2
          translations={translations}
          selectedProduct={filters.selectedProduct}
          selectedLanguageColumns={filters.selectedLanguageColumns}
          onStatusChange={mutations.handleStatusChange}
          onTranslationUpdate={mutations.handleTranslationUpdate}
          onSourceTextUpdate={mutations.handleSourceTextUpdate}
          onContextUpdate={mutations.handleContextUpdate}
          onScopeUpdate={mutations.handleScopeUpdate}
          onVersionUpdate={handleVersionUpdateWithDuplicateCheck}
          onPriorityUpdate={mutations.handlePriorityUpdate}
          onNotesUpdate={handleNotesUpdateWithDuplicateCheck}
          onDevCodeUpdate={mutations.handleDevCodeUpdate}
          onPlatformsUpdate={mutations.handlePlatformsUpdate}
          onDelete={mutations.handleDelete}
          onAddToGlossary={glossary.handleOpenModal}
          onHistoryClick={handleHistoryClick}
          onRefresh={handleRefresh}
          onSelectionChange={modals.setSelectedIds}
          selectedIds={modals.selectedIds}
          loading={loading}
          currentPage={filters.page}
          totalPages={filters.totalPages}
          onPageChange={filters.setPage}
        />

        {/* Modals */}
        <CreateTranslationModal
          isOpen={modals.isCreateModalOpen}
          onClose={modals.closeCreateModal}
          onCreate={handlers.handleCreateTranslation}
          onPDFUpload={handlers.handlePDFUpload}
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

        {modals.isEmailModalOpen && (
          <EmailTemplateModal
            isOpen={modals.isEmailModalOpen}
            onClose={modals.closeEmailModal}
            templateType={modals.emailTemplateType}
            selectedTranslations={modals.selectedTranslations}
          />
        )}

        {modals.isDeploymentModalOpen && (modals.selectedTranslations || []).length > 0 && (
          <DeploymentCheckModal
            isOpen={modals.isDeploymentModalOpen}
            onClose={modals.closeDeploymentModal}
            translation={modals.selectedTranslations[0]}
            onUpdate={() => {
              handleRefresh();
              modals.clearSelection();
            }}
          />
        )}

        <DuplicateEditModal
          isOpen={duplicateCheck.isDuplicateModalOpen}
          onClose={duplicateCheck.closeDuplicateModal}
          duplicateInfo={duplicateCheck.duplicateInfo}
          fieldName={duplicateCheck.pendingEdit?.fieldName || ''}
          newValue={String(duplicateCheck.pendingEdit?.value || '')}
          onConfirm={duplicateCheck.handleDuplicateEditConfirm}
        />

        {/* 버전 히스토리 사이드바 (일괄 선택) */}
        {modals.historyPanelOpen && (modals.selectedIds || []).length > 0 && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
            <UnifiedVersionHistoryPanel
              mode="bulk"
              translationIds={modals.selectedIds}
              languageCode={filters.selectedLanguageColumns?.[0] || 'ko'}
              onClose={modals.closeHistoryPanel}
              onRevert={() => {
                handleRefresh();
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
                  handleRefresh();
                }}
              />
            </div>
          </div>
        )}

        {/* 일괄 작업 바 */}
        <TranslationBulkActionBar
          selectedCount={(modals.selectedIds || []).length}
          selectedIds={modals.selectedIds}
          onClearSelection={modals.clearSelection}
          onRefresh={handleRefresh}
          onOpenEmailModal={handlers.handleOpenEmailModal}
          onOpenDeploymentModal={handlers.handleOpenDeploymentModal}
          onBulkDelete={mutations.handleBulkDelete}
        />
      </div>
    </DashboardLayout>
  );
}

export default function TranslationsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout
        title="번역 관리"
        subtitle="번역된 언어들을 전체 볼 수 있습니다."
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </DashboardLayout>
    }>
      <TranslationsContent />
    </Suspense>
  );
}
