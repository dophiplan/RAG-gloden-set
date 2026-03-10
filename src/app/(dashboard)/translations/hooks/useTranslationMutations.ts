import { useMemo } from 'react';
import type { TranslationWithAudit } from './useTranslationData';
import {
  useUpdateTranslationField,
  useUpdateTranslationResult,
  useUpdateRelations,
  useDeleteTranslation,
  useCreateTranslation,
} from './mutations';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';
import { apiDelete, apiFetch } from '@/lib/api-utils';

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
  } = useUpdateTranslationField({ setTranslations });

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

  // Memoize mutations object to prevent unnecessary re-renders
  return useMemo(() => ({
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
    handleScreenUpdate: handleDevCodeUpdate, // 화면 코드 업데이트 (dev_code 필드)
    handleDelete,
    handleBulkCreate,
    handleBulkStatusChange: async (ids: string[], status: import('@/types/translations').TranslationStatus) => {
      if (!ids || ids.length === 0) {
        showError('변경할 항목을 선택해주세요.');
        return;
      }

      if (!status) {
        showError('변경할 상태를 선택해주세요.');
        return;
      }

      try {
        const result = await apiFetch<{ updated: number }>('/api/translations/bulk-update', {
          method: 'PATCH',
          body: JSON.stringify({
            translation_ids: ids,
            status,
          }),
        });
        showSuccess(`${result.updated}개 항목의 상태가 변경되었습니다.`);
        fetchTranslations();
      } catch (error) {
        console.error('Bulk status change error:', error);
        showError(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.');
      }
    },
    handleBulkDelete: async (ids: string[]) => {
      if (!showConfirm(`${(ids || []).length}개 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
      }

      try {
        const result = await apiFetch<{ deleted: number }>('/api/translations/bulk', { 
          method: 'DELETE',
          body: JSON.stringify({ ids })
        });
        showSuccess(`${result.deleted}개 항목이 삭제되었습니다.`);
        fetchTranslations();
      } catch (error) {
        console.error('Bulk delete error:', error);
        showError(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
      }
    },
    handleCreate,
  }), [
    handleStatusChange,
    handleTranslationUpdate,
    handleSourceTextUpdate,
    handleContextUpdate,
    handleScopeUpdate,
    handlePriorityUpdate,
    handleNotesUpdate,
    handleVersionUpdate,
    handleDevCodeUpdate,
    handleProductsUpdate,
    handlePlatformsUpdate,
    handleDelete,
    handleBulkCreate,
    handleCreate,
    fetchTranslations,
    translations, // Add translations to ensure mutations update when data changes
  ]);
}
