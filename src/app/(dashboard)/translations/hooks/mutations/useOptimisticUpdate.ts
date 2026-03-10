import { useCallback, useEffect, useRef } from 'react';
import { showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';
import { apiPatch } from '@/lib/api-utils';

interface UseOptimisticUpdateParams {
  translations: TranslationWithAudit[];
  updateLocalTranslation: (id: string, updates: Partial<TranslationWithAudit>) => void;
}

/**
 * Common hook for optimistic updates
 * Updates local state first, then makes API call
 * Rolls back on failure
 */
export function useOptimisticUpdate({
  translations,
  updateLocalTranslation,
}: UseOptimisticUpdateParams) {
  // Use ref to always access latest translations without dependency
  const translationsRef = useRef(translations);
  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  const optimisticPatch = useCallback(
    async (
      id: string,
      localUpdates: Partial<TranslationWithAudit>,
      body: Record<string, unknown>,
      successMessage?: string
    ) => {
      // Get previous value from ref to ensure we have latest data
      const prev = translationsRef.current.find((t) => t.id === id);
      updateLocalTranslation(id, localUpdates);

      try {
        await apiPatch(`/api/translations/${id}`, body);
        if (successMessage) {
          showSuccess(successMessage);
        }
      } catch (error) {
        console.error('Error updating translation:', error);
        if (prev) updateLocalTranslation(id, prev);
        showError('수정 중 오류가 발생했습니다.');
      }
    },
    [updateLocalTranslation] // Remove translations dependency
  );

  return { optimisticPatch };
}
