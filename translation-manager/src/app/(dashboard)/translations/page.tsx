'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProductTabs from '@/components/ProductTabs';
import TranslationTableV2 from '@/components/translations/TranslationTableV2';
import EmailTemplateModal from '@/components/translations/EmailTemplateModal';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import DuplicateEditModal from '@/components/translations/DuplicateEditModal';
import { Translation, ProductCode, EmailTemplateType } from '@/types';
import { showError } from '@/lib/notifications';

import { useTranslationFilters } from './hooks/useTranslationFilters';
import { useTranslationData } from './hooks/useTranslationData';
import { useTranslationMutations } from './hooks/useTranslationMutations';
import { useDuplicateCheck } from './hooks/useDuplicateCheck';
import { useGlossaryModal } from './hooks/useGlossaryModal';

import TranslationsHeader from './components/TranslationsHeader';
import TranslationFiltersBar from './components/TranslationFiltersBar';
import CreateTranslationModal from './components/CreateTranslationModal';
import GlossaryAddModal from './components/GlossaryAddModal';

function TranslationsContent() {
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const filters = useTranslationFilters();

  // Data
  const { translations, setTranslations, loading, fetchTranslations } = useTranslationData({
    statusFilter: filters.statusFilter,
    searchTerm: filters.searchTerm,
    selectedProduct: filters.selectedProduct,
    page: filters.page,
    setTotalPages: filters.setTotalPages,
  });

  // Mutations
  const mutations = useTranslationMutations({
    translations,
    setTranslations,
    fetchTranslations,
  });

  // Duplicate check
  const duplicateCheck = useDuplicateCheck({ translations, fetchTranslations });

  // Glossary modal
  const glossary = useGlossaryModal();

  // Email and deployment modals
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplateType>('translation_request');
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [selectedTranslations, setSelectedTranslations] = useState<Translation[]>([]);

  // Handle new texts from PDF upload
  useEffect(() => {
    const newTexts = searchParams.get('new');
    const version = searchParams.get('version');
    const product = searchParams.get('product') as ProductCode | null;

    if (newTexts) {
      try {
        const texts = JSON.parse(decodeURIComponent(newTexts));
        if (Array.isArray(texts) && texts.length > 0) {
          mutations.handleBulkCreate(texts, version || undefined, product || undefined);
        }
      } catch (e) {
        console.error('Error parsing new texts:', e);
      }
    }

    if (product) {
      filters.setSelectedProduct(product);
    }
  }, [searchParams]);

  // Update selected translations when translations change
  useEffect(() => {
    setSelectedTranslations((prev) =>
      prev.filter((selected) => translations.some((t) => t.id === selected.id))
    );
  }, [translations]);

  const handleOpenEmailModal = (templateType: EmailTemplateType) => {
    if (selectedTranslations.length === 0) {
      showError('번역 항목을 선택해주세요.');
      return;
    }
    setEmailTemplateType(templateType);
    setIsEmailModalOpen(true);
  };

  const handleOpenDeploymentModal = () => {
    if (selectedTranslations.length === 0) {
      showError('번역 항목을 선택해주세요.');
      return;
    }
    setIsDeploymentModalOpen(true);
  };

  // Duplicate-checked update handlers
  const handleVersionUpdateWithDuplicateCheck = duplicateCheck.makeVersionUpdateWithDuplicateCheck(
    mutations.handleVersionUpdate as (id: string, value: string | string[] | null) => Promise<void>
  );
  const handleNotesUpdateWithDuplicateCheck = duplicateCheck.makeNotesUpdateWithDuplicateCheck();
  const handleDevCodeUpdateWithDuplicateCheck = duplicateCheck.makeDevCodeUpdateWithDuplicateCheck();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TranslationsHeader onOpenCreateModal={() => setIsModalOpen(true)} />

        <ProductTabs
          selectedProduct={filters.selectedProduct}
          onProductChange={filters.setSelectedProduct}
        />

        <TranslationFiltersBar
          searchTerm={filters.searchTerm}
          onSearchChange={filters.setSearchTerm}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={filters.setStatusFilter}
        />

        {/* Bulk Actions */}
        {selectedTranslations.length > 0 && (
          <Card>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">
                {selectedTranslations.length}개 선택됨
              </span>
              <Button
                size="sm"
                onClick={() => handleOpenEmailModal('translation_request')}
              >
                메일 발송
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOpenDeploymentModal}
              >
                반영 완료 체크
              </Button>
            </div>
          </Card>
        )}

        <TranslationTableV2
          translations={translations}
          onStatusChange={mutations.handleStatusChange}
          onTranslationUpdate={mutations.handleTranslationUpdate}
          onSourceTextUpdate={mutations.handleSourceTextUpdate}
          onContextUpdate={mutations.handleContextUpdate}
          onScopeUpdate={mutations.handleScopeUpdate}
          onVersionUpdate={handleVersionUpdateWithDuplicateCheck}
          onWorkScopeUpdate={mutations.handleWorkScopeUpdate}
          onDevCodeUpdate={handleDevCodeUpdateWithDuplicateCheck}
          onNotesUpdate={handleNotesUpdateWithDuplicateCheck}
          onPlatformCompletionUpdate={mutations.handlePlatformCompletionUpdate}
          onDelete={mutations.handleDelete}
          onRefresh={fetchTranslations}
          loading={loading}
          currentPage={filters.page}
          totalPages={filters.totalPages}
          onPageChange={filters.setPage}
        />

        {/* Modals */}
        <CreateTranslationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={mutations.handleCreate}
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

        {isEmailModalOpen && (
          <EmailTemplateModal
            isOpen={isEmailModalOpen}
            onClose={() => setIsEmailModalOpen(false)}
            templateType={emailTemplateType}
            selectedTranslations={selectedTranslations}
          />
        )}

        {isDeploymentModalOpen && selectedTranslations.length > 0 && (
          <DeploymentCheckModal
            isOpen={isDeploymentModalOpen}
            onClose={() => setIsDeploymentModalOpen(false)}
            translation={selectedTranslations[0]}
            onUpdate={() => {
              fetchTranslations();
              setSelectedTranslations([]);
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
      </div>
    </DashboardLayout>
  );
}

export default function TranslationsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">로딩 중...</div>
        </div>
      </DashboardLayout>
    }>
      <TranslationsContent />
    </Suspense>
  );
}
