import { useCallback } from 'react';
import { showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';

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
  const optimisticPatch = useCallback(
    async (
      id: string,
      localUpdates: Partial<TranslationWithAudit>,
      body: Record<string, unknown>,
      successMessage?: string
    ) => {
      const prev = translations.find((t) => t.id === id);
      updateLocalTranslation(id, localUpdates);

      try {
        const response = await fetch(`/api/translations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          if (successMessage) {
            showSuccess(successMessage);
          }
        } else {
          if (prev) {
            updateLocalTranslation(id, prev);
          }
          showError('수정에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error updating translation:', error);
        if (prev) updateLocalTranslation(id, prev);
        showError('수정 중 오류가 발생했습니다.');
      }
    },
    [translations, updateLocalTranslation]
  );

  return { optimisticPatch };
}
