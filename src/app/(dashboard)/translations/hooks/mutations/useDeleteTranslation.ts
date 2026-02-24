import { useCallback } from 'react';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';
import { apiDelete } from '@/lib/api-utils';

interface UseDeleteTranslationParams {
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
}

/**
 * Hook for deleting translations
 * Includes confirmation dialog and optimistic removal
 */
export function useDeleteTranslation({ setTranslations }: UseDeleteTranslationParams) {
  const handleDelete = useCallback(
    async (id: string) => {
      if (!showConfirm('정말 삭제하시겠습니까?')) return;

      try {
        await apiDelete(`/api/translations/${id}`);
        setTranslations((prev) => prev.filter((t) => t.id !== id));
        showSuccess('삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting translation:', error);
        showError('삭제 중 오류가 발생했습니다.');
      }
    },
    [setTranslations]
  );

  return { handleDelete };
}
