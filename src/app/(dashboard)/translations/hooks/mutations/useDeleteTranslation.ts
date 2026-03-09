import { useCallback, useRef } from 'react';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';
import { apiDelete } from '@/lib/api-utils';

interface UseDeleteTranslationParams {
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
}

/**
 * Hook for deleting translations
 * Includes confirmation dialog and optimistic removal
 * Prevents duplicate deletions with processing ref
 */
export function useDeleteTranslation({ setTranslations }: UseDeleteTranslationParams) {
  // Track IDs currently being deleted to prevent duplicates
  const deletingIds = useRef<Set<string>>(new Set());
  // Track if confirmation dialog is already shown
  const confirmingId = useRef<string | null>(null);

  const handleDelete = useCallback(
    async (id: string) => {
      // Prevent duplicate deletion requests
      if (deletingIds.current.has(id)) {
        console.log('[useDeleteTranslation] Already deleting:', id);
        return;
      }

      // Prevent duplicate confirmation dialogs
      if (confirmingId.current === id) {
        console.log('[useDeleteTranslation] Already confirming:', id);
        return;
      }
      
      confirmingId.current = id;
      const confirmed = showConfirm('정말 삭제하시겠습니까?');
      confirmingId.current = null;
      
      if (!confirmed) return;

      // Mark as deleting
      deletingIds.current.add(id);

      try {
        await apiDelete(`/api/translations/${id}`);
        setTranslations((prev) => prev.filter((t) => t.id !== id));
        showSuccess('삭제되었습니다.');
      } catch (error) {
        console.error('Error deleting translation:', error);
        showError('삭제 중 오류가 발생했습니다.');
      } finally {
        // Remove from deleting set
        deletingIds.current.delete(id);
      }
    },
    [setTranslations]
  );

  return { handleDelete };
}
