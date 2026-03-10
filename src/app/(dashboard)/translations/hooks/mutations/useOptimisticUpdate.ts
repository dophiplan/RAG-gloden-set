import { useCallback } from 'react';
import { showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';
import { apiPatch } from '@/lib/api-utils';

interface UseOptimisticUpdateParams {
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
}

/**
 * Common hook for optimistic updates
 * Updates local state first, then makes API call
 * Rolls back on failure
 */
export function useOptimisticUpdate({
  setTranslations,
}: UseOptimisticUpdateParams) {
  const optimisticPatch = useCallback(
    async (
      id: string,
      localUpdates: Partial<TranslationWithAudit>,
      body: Record<string, unknown>,
      successMessage?: string
    ) => {
      // Store previous value for rollback using functional update
      let prevValue: TranslationWithAudit | undefined;

      // Optimistic update using functional setState
      setTranslations((prev) => {
        const target = prev.find((t) => t.id === id);
        prevValue = target;
        return prev.map((t) => (t.id === id ? { ...t, ...localUpdates } : t));
      });

      try {
        await apiPatch(`/api/translations/${id}`, body);
        if (successMessage) {
          showSuccess(successMessage);
        }
      } catch (error) {
        console.error('Error updating translation:', error);
        // Rollback
        if (prevValue) {
          setTranslations((prev) =>
            prev.map((t) => (t.id === id ? prevValue! : t))
          );
        }
        showError('수정 중 오류가 발생했습니다.');
      }
    },
    [setTranslations]
  );

  return { optimisticPatch };
}
