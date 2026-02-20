import type { TranslationWithAudit } from './useTranslationData';
import {
  useUpdateTranslationField,
  useUpdateTranslationResult,
  useUpdateRelations,
  useDeleteTranslation,
  useCreateTranslation,
} from './mutations';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';

interface UseTranslationMutationsParams {
  translations: TranslationWithAudit[];
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
  fetchTranslations: () => Promise<void>;
  updateLocalTranslation: (id: string, updates: Partial<TranslationWithAudit>) => void;
}

/**
 * Main hook for translation mutations
 * Orchestrates multiple specialized mutation hooks
 *
 * Refactored to use separated hooks for better maintainability:
 * - useUpdateTranslationField: Status, source text, context, etc.
 * - useUpdateTranslationResult: Translated text updates
 * - useUpdateRelations: Products and platforms
 * - useDeleteTranslation: Deletion with confirmation
 * - useCreateTranslation: Single and bulk creation
 */
export function useTranslationMutations({
  translations,
  setTranslations,
  fetchTranslations,
  updateLocalTranslation,
}: UseTranslationMutationsParams) {
  // Field updates
  const {
    handleStatusChange,
    handleSourceTextUpdate,
    handleContextUpdate,
    handleScopeUpdate,
    handlePriorityUpdate,
    handleNotesUpdate,
    handleVersionUpdate,
    handleDevCodeUpdate,
  } = useUpdateTranslationField({ translations, updateLocalTranslation });

  // Translation result updates
  const { handleTranslationUpdate } = useUpdateTranslationResult({
    translations,
    updateLocalTranslation,
  });

  // Relation updates
  const { handleProductsUpdate, handlePlatformsUpdate } = useUpdateRelations({
    fetchTranslations,
  });

  // Deletion
  const { handleDelete } = useDeleteTranslation({ setTranslations });

  // Creation
  const { handleCreate, handleBulkCreate } = useCreateTranslation({ fetchTranslations });

  return {
    handleStatusChange,
    handleTranslationUpdate,
    handleSourceTextUpdate,
    handleContextUpdate,
    handleScopeUpdate,
    handlePriorityUpdate,
    handlePriorityChange: handlePriorityUpdate, // Alias for backward compatibility
    handleNotesUpdate,
    handleVersionUpdate,
    handleDevCodeUpdate,
    handleProductsUpdate,
    handlePlatformsUpdate,
    handlePlatformUpdate: handlePlatformsUpdate, // Alias for backward compatibility
    handleScreenUpdate: async () => {}, // Placeholder
    handleDelete,
    handleBulkCreate,
    handleBulkStatusChange: async () => {}, // Placeholder
    handleBulkDelete: async (ids: string[]) => {
      if (!showConfirm(`${ids.length}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
      }

      try {
        const response = await fetch('/api/translations/bulk', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '삭제에 실패했습니다.');
        }

        const result = await response.json();
        showSuccess(`${result.deleted}개 항목이 삭제되었습니다.`);
        fetchTranslations();
      } catch (error) {
        console.error('Bulk delete error:', error);
        showError(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
      }
    },
    handleCreate,
  };
}
