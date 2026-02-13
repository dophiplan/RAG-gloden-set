import type { TranslationWithAudit } from './useTranslationData';
import {
  useUpdateTranslationField,
  useUpdateTranslationResult,
  useUpdateRelations,
  useDeleteTranslation,
  useCreateTranslation,
} from './mutations';

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
    handleNotesUpdate,
    handleVersionUpdate,
    handleDevCodeUpdate,
    handleProductsUpdate,
    handlePlatformsUpdate,
    handleDelete,
    handleBulkCreate,
    handleCreate,
  };
}
