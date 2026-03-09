import { useCallback } from 'react';
import { ProductCode, LanguageCode, PriorityLevel, ScopeType, EmailTemplateType } from '@/types';
import { showError, showSuccess } from '@/lib/notifications';
import { apiPost, apiFetch } from '@/lib/api-utils';
import type { UploadedFile } from '@/components/FileUploader';
import { TIMEOUTS } from '@/lib/constants';
import { invalidateCache } from '@/hooks/useSWRData';
import type { TranslationWithAudit } from './useTranslationData';
import * as XLSX from 'xlsx';

interface UseTranslationEventHandlersParams {
  fetchTranslations: () => Promise<void>;
  setSelectedProduct: (product: ProductCode | null) => void;
  openEmailModal: (templateType: EmailTemplateType) => void;
  openDeploymentModal: () => void;
  selectedTranslationsCount: number;
  translations?: TranslationWithAudit[];
  selectedTranslations?: TranslationWithAudit[];
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
  translations = [],
  selectedTranslations = [],
}: UseTranslationEventHandlersParams) {

  const handleOpenEmailModal = useCallback((templateTypeOrTranslations: EmailTemplateType | any[]) => {
    if (selectedTranslationsCount === 0) {
      showError('번역 항목을 선택해주세요.');
      return;
    }
    // Support both old signature (templateType) and new signature (translations array)
    const templateType = Array.isArray(templateTypeOrTranslations) ? 'translation_request' : templateTypeOrTranslations;
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
      const parseData = await apiFetch<{ results?: { success?: boolean; texts?: string[] }[] }>('/api/files/parse', {
        method: 'POST',
        body: formData,
      });

      // Collect all extracted texts from all files
      const allTexts: string[] = [];
      if (parseData.results && Array.isArray(parseData.results)) {
        parseData.results.forEach((result) => {
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
      const bulkData = await apiPost<{ created?: number }>('/api/translations/bulk', {
        texts: allTexts,
        version: version || undefined,
        product_code: productCode || undefined,
        scope: scope || undefined,
        priority: priority,
        languages: languages,
        platform_codes: platformCodes,
        completion_date: completionDate || undefined,
      });

      // Switch to selected product tab FIRST
      if (productCode) {
        setSelectedProduct(productCode as ProductCode);
      }

      // Wait for state update to complete before fetching
      setTimeout(() => {
        fetchTranslations();
      }, TIMEOUTS.STATE_UPDATE_SHORT_DELAY_MS);

      showSuccess(`${bulkData.created || allTexts.length}개의 번역 항목이 저장되었습니다.`);
      
      // Clear SWR cache to show new data immediately (including dashboard)
      invalidateCache(/^\/api\/(translations|dashboard)/);
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

    try {
      await apiPost('/api/translations', {
        source_text: sourceText,
        context: context || undefined,
        version: version || undefined,
        product_codes: productCode ? [productCode] : undefined,
        scope: scope || undefined,
        priority,
        translations: translationsArray,
        platform_codes: platformCodes,
        completion_date: completionDate || undefined,
      });
      fetchTranslations();
      
      // Clear SWR cache to show new data immediately (including dashboard)
      invalidateCache(/^\/api\/(translations|dashboard)/);
      
      if (productCode) {
        setSelectedProduct(productCode as ProductCode);
      }
      return true;
    } catch (error) {
      return false;
    }
  }, [fetchTranslations, setSelectedProduct]);

  // Excel 다운로드 헬퍼 함수
  const exportToExcel = useCallback((data: TranslationWithAudit[], filename: string) => {
    try {
      // 언어 코드 추출 (모든 번역 결과에서)
      const languageCodes = new Set<string>();
      data.forEach(t => {
        t.translation_results?.forEach(r => {
          if (r.language_code) languageCodes.add(r.language_code);
        });
      });
      const sortedLangCodes = Array.from(languageCodes).sort();

      // 상태 라벨 매핑
      const statusLabels: Record<string, string> = {
        pending: '요청',
        in_progress: '진행중',
        reviewed: '검수중',
        deployed: '반영완료',
        re_request: '재요청',
        re_deploy_request: '재반영요청',
        not_used: '사용안함',
      };

      // 우선순위 라벨 매핑
      const priorityLabels: Record<string, string> = {
        urgent: '긴급',
        high: '상',
        medium: '중',
        low: '하',
      };

      // 엑셀 데이터 생성
      const excelData = data.map(t => {
        const row: Record<string, string | number> = {
          'ID': t.id,
          '원문': t.source_text,
          '상태': statusLabels[t.status] || t.status,
          '제품': t.translation_products?.map(p => p.product_code).join(', ') || '',
          '버전': t.version || '',
          '화면코드': t.dev_code || '',
          '우선순위': priorityLabels[t.priority] || t.priority,
          '범위': t.scope || '',
          '컨텍스트': t.context || '',
          '메모': t.notes || '',
          '생성일': t.created_at ? new Date(t.created_at).toLocaleString('ko-KR') : '',
          '수정일': t.updated_at ? new Date(t.updated_at).toLocaleString('ko-KR') : '',
        };

        // 언어별 번역 추가
        sortedLangCodes.forEach(langCode => {
          const result = t.translation_results?.find(r => r.language_code === langCode);
          row[`번역(${langCode.toUpperCase()})`] = result?.translated_text || '';
        });

        return row;
      });

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      const colWidths: Record<string, number> = {
        'ID': 25,
        '원문': 50,
        '상태': 10,
        '제품': 15,
        '버전': 12,
        '화면코드': 15,
        '우선순위': 8,
        '범위': 12,
        '컨텍스트': 30,
        '메모': 30,
        '생성일': 20,
        '수정일': 20,
      };
      sortedLangCodes.forEach(langCode => {
        colWidths[`번역(${langCode.toUpperCase()})`] = 50;
      });

      worksheet['!cols'] = Object.keys(excelData[0] || {}).map(key => ({
        wch: colWidths[key] || 20,
      }));

      // 워크북 생성 및 다운로드
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '번역 목록');
      XLSX.writeFile(workbook, filename);

      showSuccess(`${data.length}개 항목이 Excel로 다운로드되었습니다.`);
    } catch (error) {
      console.error('Excel export error:', error);
      showError('Excel 다운로드 중 오류가 발생했습니다.');
    }
  }, []);

  // 선택 항목 Excel 다운로드
  const handleDownloadExcel = useCallback(() => {
    if (selectedTranslations.length === 0) {
      showError('다운로드할 항목을 선택해주세요.');
      return;
    }
    exportToExcel(selectedTranslations, `translations_selected_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [selectedTranslations, exportToExcel]);

  // 전체 항목 Excel 다운로드
  const handleDownloadAllExcel = useCallback(() => {
    if (translations.length === 0) {
      showError('다운로드할 항목이 없습니다.');
      return;
    }
    exportToExcel(translations, `translations_all_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [translations, exportToExcel]);

  const handleBulkExport = useCallback(async () => {
    showError('일괄 납품 기능은 아직 구현되지 않았습니다.');
  }, []);

  const handleSendEmail = useCallback(async () => {
    showError('이메일 전송 기능은 아직 구현되지 않았습니다.');
  }, []);

  return {
    handleOpenEmailModal,
    handleEmailClick: handleOpenEmailModal, // Alias for backward compatibility
    handleOpenDeploymentModal,
    handlePDFUpload,
    handleCreateTranslation,
    handleDownloadExcel,
    handleDownloadAllExcel,
    handleBulkExport,
    handleSendEmail,
  };
}
