import { useCallback } from 'react';
import { ProductCode, PriorityLevel } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';

interface UseCreateTranslationParams {
  fetchTranslations: () => Promise<void>;
}

/**
 * Hook for creating translations
 * Supports both single and bulk creation
 */
export function useCreateTranslation({ fetchTranslations }: UseCreateTranslationParams) {
  const handleCreate = useCallback(
    async (
      sourceText: string,
      context: string,
      version: string,
      productCode: ProductCode | '',
      scope: 'SaaS' | 'Solution' | '',
      priority?: PriorityLevel
    ) => {
      if (!sourceText.trim()) return false;

      try {
        const response = await fetch('/api/translations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_text: sourceText,
            context: context || undefined,
            version: version || undefined,
            product_code: productCode || undefined,
            scope: scope || undefined,
            priority: priority,
          }),
        });

        if (response.ok) {
          fetchTranslations();
          showSuccess('번역이 생성되었습니다.');
          return true;
        } else {
          showError('번역 생성에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error creating translation:', error);
        showError('번역 생성 중 오류가 발생했습니다.');
      }

      return false;
    },
    [fetchTranslations]
  );

  const handleBulkCreate = useCallback(
    async (
      texts: string[],
      version?: string,
      productCode?: ProductCode,
      scope?: 'SaaS' | 'Solution',
      priority?: PriorityLevel
    ) => {
      try {
        const response = await fetch('/api/translations/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts, version, product_code: productCode, scope, priority }),
        });

        if (response.ok) {
          fetchTranslations();
          window.history.replaceState({}, '', '/translations');
          showSuccess(`${texts.length}개의 번역이 생성되었습니다.`);
        } else {
          showError('번역 생성에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error creating translations:', error);
        showError('번역 생성 중 오류가 발생했습니다.');
      }
    },
    [fetchTranslations]
  );

  return {
    handleCreate,
    handleBulkCreate,
  };
}
