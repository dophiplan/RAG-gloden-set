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
      console.log('[useDeleteTranslation] Called with id:', id);
      
      // Prevent duplicate deletion requests
      if (deletingIds.current.has(id)) {
        console.log('[useDeleteTranslation] Already deleting, skipping:', id);
        return;
      }

      // Prevent duplicate confirmation dialogs
      if (confirmingId.current === id) {
        console.log('[useDeleteTranslation] Already confirming, skipping:', id);
        return;
      }
      
      confirmingId.current = id;
      console.log('[useDeleteTranslation] Showing confirm for:', id);
      const confirmed = showConfirm('정말 삭제하시겠습니까?');
      confirmingId.current = null;
      
      if (!confirmed) {
        console.log('[useDeleteTranslation] User cancelled');
        return;
      }

      // Mark as deleting
      deletingIds.current.add(id);
      console.log('[useDeleteTranslation] Calling API for:', id);

      try {
        await apiDelete(`/api/translations/${id}`);
        console.log('[useDeleteTranslation] API success for:', id);
        setTranslations((prev) => prev.filter((t) => t.id !== id));
        showSuccess('삭제되었습니다.');
      } catch (error) {
        console.error('[useDeleteTranslation] API error:', error);
        showError('삭제 중 오류가 발생했습니다.');
        throw error; // Re-throw so caller knows it failed
      } finally {
        // Remove from deleting set
        deletingIds.current.delete(id);
      }
    },
    [setTranslations]
  );

  return { handleDelete };
}
