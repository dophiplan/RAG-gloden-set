import { useCallback } from 'react';
import { ProductCode, LanguageCode, PriorityLevel, ScopeType, EmailTemplateType } from '@/types';
import { showError, showSuccess } from '@/lib/notifications';
import type { UploadedFile } from '@/components/FileUploader';
import { TIMEOUTS } from '@/lib/constants';

interface UseTranslationEventHandlersParams {
  fetchTranslations: () => Promise<void>;
  setSelectedProduct: (product: ProductCode | null) => void;
  openEmailModal: (templateType: EmailTemplateType) => void;
  openDeploymentModal: () => void;
  selectedTranslationsCount: number;
}

/**
 * Hook for translation page event handlers
 * Centralizes PDF upload, creation, and modal open logic
 */
export function useTranslationEventHandlers({
  fetchTranslations,
  setSelectedProduct,
  openEmailModal,
  openDeploymentModal,
  selectedTranslationsCount,
}: UseTranslationEventHandlersParams) {

  const handleOpenEmailModal = useCallback((templateType: EmailTemplateType) => {
    if (selectedTranslationsCount === 0) {
      showError('번역 항목을 선택해주세요.');
      return;
    }
    openEmailModal(templateType);
  }, [selectedTranslationsCount, openEmailModal]);

  const handleOpenDeploymentModal = useCallback(() => {
    if (selectedTranslationsCount === 0) {
      showError('번역 항목을 선택해주세요.');
      return;
    }
    openDeploymentModal();
  }, [selectedTranslationsCount, openDeploymentModal]);

  const handlePDFUpload = useCallback(async (
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
        setSelectedProduct(productCode as ProductCode);
      }

      // Wait for state update to complete before fetching
      setTimeout(() => {
        fetchTranslations();
      }, TIMEOUTS.STATE_UPDATE_SHORT_DELAY_MS);

      showSuccess(`${bulkData.created || allTexts.length}개의 번역 항목이 저장되었습니다.`);
    } catch (error) {
      console.error('PDF upload error:', error);
      showError('PDF 업로드 중 오류가 발생했습니다.');
    }
  }, [fetchTranslations, setSelectedProduct]);

  const handleCreateTranslation = useCallback(async (
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
        setSelectedProduct(productCode as ProductCode);
      }
      return true;
    }
    return false;
  }, [fetchTranslations, setSelectedProduct]);

  return {
    handleOpenEmailModal,
    handleOpenDeploymentModal,
    handlePDFUpload,
    handleCreateTranslation,
  };
}
