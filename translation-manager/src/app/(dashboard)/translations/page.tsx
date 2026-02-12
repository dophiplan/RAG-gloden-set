'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ProductTabs from '@/components/ProductTabs';
import TranslationTableV2 from '@/components/translations/TranslationTableV2';
import EmailTemplateModal from '@/components/translations/EmailTemplateModal';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import DuplicateEditModal from '@/components/translations/DuplicateEditModal';
import { Translation, ProductCode, EmailTemplateType, LanguageCode, PriorityLevel, ScopeType } from '@/types';
import { showError, showSuccess } from '@/lib/notifications';
import type { UploadedFile } from '@/components/FileUploader';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
import { useProducts } from '@/hooks/useReferenceData';

import { useTranslationFilters } from './hooks/useTranslationFilters';
import { useTranslationData } from './hooks/useTranslationData';
import { useTranslationMutations } from './hooks/useTranslationMutations';
import { useDuplicateCheck } from './hooks/useDuplicateCheck';
import { useGlossaryModal } from './hooks/useGlossaryModal';
import { TIMEOUTS } from '@/lib/constants';

import TranslationsHeader from './components/TranslationsHeader';
import TranslationFiltersBar from './components/TranslationFiltersBar';
import CreateTranslationModal from './components/CreateTranslationModal';
import GlossaryAddModal from './components/GlossaryAddModal';
import TranslationBulkActionBar from '@/components/translations/TranslationBulkActionBar';
import { BulkVersionHistoryPanel } from './components/VersionHistory';

function TranslationsContent() {
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 버전 히스토리 사이드바 상태
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Filters
  const filters = useTranslationFilters();

  // Reference data
  const { productsMap } = useProducts();

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

  // Mutations
  const mutations = useTranslationMutations({
    translations,
    setTranslations,
    fetchTranslations,
    updateLocalTranslation,
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

  // Handle new texts from PDF upload and URL params
  useEffect(() => {
    const newTexts = searchParams.get('new');
    const version = searchParams.get('version');
    const product = searchParams.get('product') as ProductCode | null;
    const requestId = searchParams.get('request_id');
    const refresh = searchParams.get('refresh');

    // Set product filter FIRST if specified
    if (product && product !== filters.selectedProduct) {
      filters.setSelectedProduct(product);
    }

    // Set request_id filter if specified
    if (requestId && requestId !== filters.requestIdFilter) {
      filters.setRequestIdFilter(requestId);
    }

    // Handle legacy new texts param (if still used)
    if (newTexts) {
      try {
        const texts = JSON.parse(decodeURIComponent(newTexts));
        if (Array.isArray(texts) && texts.length > 0) {
          mutations.handleBulkCreate(texts, version || undefined, product || undefined);
        }
      } catch (e) {
        // Ignore parsing errors for legacy param
      }
    }

    // If refresh param exists, trigger fresh data fetch
    // This handles navigation from upload page
    if (refresh) {
      // Wait for product filter to be applied
      setTimeout(() => {
        fetchTranslations();
        // Clean up URL params to avoid re-triggering
        window.history.replaceState(
          {},
          '',
          '/translations' + (product ? `?product=${product}` : '')
        );
      }, TIMEOUTS.STATE_UPDATE_DELAY_MS);
    }
  }, [searchParams]);

  // 선택된 번역 ID 관리
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 선택된 번역 객체로 변환
  useEffect(() => {
    const selected = translations.filter((t) => selectedIds.includes(t.id));
    setSelectedTranslations(selected);
  }, [selectedIds, translations]);

  // Reset language column selection when product changes
  // Only reset when product actually changes, not when productsMap updates
  useEffect(() => {
    if (filters.selectedProduct && productsMap[filters.selectedProduct]) {
      const product = productsMap[filters.selectedProduct];
      if (product.default_languages && product.default_languages.length > 0) {
        filters.setSelectedLanguageColumns(product.default_languages as LanguageCode[]);
      } else {
        // RC or products without default languages: show default (EN, JA, ZH-CN)
        filters.setSelectedLanguageColumns(['en', 'ja', 'zh-CN']);
      }
    } else {
      // No product selected: show default languages (EN, JA, ZH-CN)
      filters.setSelectedLanguageColumns(['en', 'ja', 'zh-CN']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.selectedProduct]); // Only depend on selectedProduct, not productsMap

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

  const handlePDFUpload = async (
    files: UploadedFile[],
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,
    priority: PriorityLevel,
    languages: LanguageCode[],
    platformCodes: string[],
    completionDate: string
  ) => {
    try {
      const formData = new FormData();
      files.forEach((uploadedFile) => {
        formData.append('files', uploadedFile.file);
      });
      if (version) formData.append('version', version);
      if (productCode) formData.append('product_code', productCode);
      if (scope) formData.append('scope', scope);

      // Step 1: Parse PDF to extract texts
      const parseResponse = await fetch('/api/files/parse', {
        method: 'POST',
        body: formData,
      });

      if (!parseResponse.ok) {
        const error = await parseResponse.json();
        showError(error.error || 'PDF 파싱 중 오류가 발생했습니다.');
        return;
      }

      const parseData = await parseResponse.json();

      // Collect all extracted texts from all files
      const allTexts: string[] = [];
      if (parseData.results && Array.isArray(parseData.results)) {
        parseData.results.forEach((result: any) => {
          if (result.success && result.texts && Array.isArray(result.texts)) {
            allTexts.push(...result.texts);
          }
        });
      }

      if (allTexts.length === 0) {
        showError('추출된 텍스트가 없습니다. 따옴표로 감싼 텍스트를 확인해주세요.');
        return;
      }

      showSuccess(`${allTexts.length}개의 텍스트가 추출되었습니다.`);

      // Step 2: Save extracted texts to database
      const bulkCreateResponse = await fetch('/api/translations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: allTexts,
          version: version || undefined,
          product_code: productCode || undefined,
          scope: scope || undefined,
          priority: priority,
          languages: languages,
          platform_codes: platformCodes,
          completion_date: completionDate || undefined,
        }),
      });

      if (!bulkCreateResponse.ok) {
        const error = await bulkCreateResponse.json();
        showError(error.error || '번역 항목 저장 중 오류가 발생했습니다.');
        return;
      }

      const bulkData = await bulkCreateResponse.json();

      // Switch to selected product tab FIRST
      if (productCode) {
        filters.setSelectedProduct(productCode as ProductCode);
      }

      // Wait for state update to complete before fetching
      // React state updates are async, so we need to give it time
      setTimeout(() => {
        fetchTranslations();
      }, TIMEOUTS.STATE_UPDATE_SHORT_DELAY_MS);

      showSuccess(`${bulkData.created || allTexts.length}개의 번역 항목이 저장되었습니다.`);
    } catch (error) {
      console.error('PDF upload error:', error);
      showError('PDF 업로드 중 오류가 발생했습니다.');
    }
  };

  // Duplicate-checked update handlers
  const handleVersionUpdateWithDuplicateCheck = duplicateCheck.makeVersionUpdateWithDuplicateCheck(
    mutations.handleVersionUpdate as (id: string, value: string | string[] | null) => Promise<void>
  );
  const handleNotesUpdateWithDuplicateCheck = duplicateCheck.makeNotesUpdateWithDuplicateCheck();

  // Calculate available languages for display (includes Korean)
  const availableLanguages = useMemo(() => {
    return getAllDisplayableLanguages();
  }, []);

  return (
    <DashboardLayout
      title="번역 관리"
      subtitle="번역된 언어들을 전체 볼 수 있습니다."
    >
      <div className="space-y-6">
        <ProductTabs
          selectedProduct={filters.selectedProduct}
          onProductChange={filters.setSelectedProduct}
        />

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
          onOpenCreateModal={() => setIsModalOpen(true)}
          selectedCount={selectedTranslations.length}
          onShowHistory={() => {
            if (selectedIds.length > 0) {
              setHistoryPanelOpen(true);
            }
          }}
          translations={translations}
          versionFilter={filters.versionFilter}
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
          onRefresh={fetchTranslations}
          onSelectionChange={setSelectedIds}
          selectedIds={selectedIds}
          loading={loading}
          currentPage={filters.page}
          totalPages={filters.totalPages}
          onPageChange={filters.setPage}
        />

        {/* Modals */}
        <CreateTranslationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={async (
            sourceText: string,
            context: string,
            version: string,
            productCode: ProductCode | '',
            scope: ScopeType,
            priority: PriorityLevel,
            languages: LanguageCode[],
            platformCodes: string[],
            completionDate: string
          ) => {
            // Create translation with initial empty translation_results for each language
            const translationsArray = languages.map(lang => ({
              language_code: lang,
              translated_text: '',
            }));

            const response = await fetch('/api/translations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_text: sourceText,
                context: context || undefined,
                version: version || undefined,
                product_codes: productCode ? [productCode] : undefined,
                scope: scope || undefined,
                priority,
                translations: translationsArray,
                platform_codes: platformCodes,
                completion_date: completionDate || undefined,
              }),
            });

            if (response.ok) {
              fetchTranslations();
              if (productCode) {
                filters.setSelectedProduct(productCode as ProductCode);
              }
              return true;
            }
            return false;
          }}
          onPDFUpload={handlePDFUpload}
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

        {/* 버전 히스토리 사이드바 */}
        {historyPanelOpen && selectedIds.length > 0 && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">버전 기록</h3>
              <button
                onClick={() => setHistoryPanelOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <BulkVersionHistoryPanel
                translationIds={selectedIds}
                languageCode={filters.selectedLanguageColumns?.[0] || 'ko'}
                onRevert={() => {
                  // 복구 완료 후 테이블 새로고침
                  fetchTranslations();
                }}
              />
            </div>
          </div>
        )}

        {/* 일괄 작업 바 */}
        <TranslationBulkActionBar
          selectedCount={selectedIds.length}
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds([])}
          onRefresh={fetchTranslations}
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
