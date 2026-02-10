import { useCallback } from 'react';
import { TranslationStatus, LanguageCode, ProductCode, PriorityLevel } from '@/types';
import { showConfirm } from '@/lib/notifications';
import type { TranslationWithAudit } from './useTranslationData';

interface UseTranslationMutationsParams {
  translations: TranslationWithAudit[];
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
  fetchTranslations: () => Promise<void>;
  updateLocalTranslation: (id: string, updates: Partial<TranslationWithAudit>) => void;
}

export function useTranslationMutations({
  translations,
  setTranslations,
  fetchTranslations,
  updateLocalTranslation,
}: UseTranslationMutationsParams) {

  // Generic optimistic PATCH helper: update local state first, rollback on failure
  const optimisticPatch = useCallback(async (
    id: string,
    localUpdates: Partial<TranslationWithAudit>,
    body: Record<string, unknown>
  ) => {
    const prev = translations.find((t) => t.id === id);
    updateLocalTranslation(id, localUpdates);
    try {
      const response = await fetch(`/api/translations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok && prev) {
        updateLocalTranslation(id, prev);
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      if (prev) updateLocalTranslation(id, prev);
    }
  }, [translations, updateLocalTranslation]);

  const handleStatusChange = useCallback(async (id: string, status: TranslationStatus) => {
    await optimisticPatch(id, { status }, { status });
  }, [optimisticPatch]);

  const handleTranslationUpdate = useCallback(async (
    translationId: string,
    languageCode: LanguageCode,
    text: string
  ) => {
    const translation = translations.find((t) => t.id === translationId);
    if (!translation) return;

    // Optimistic: update translation_results locally
    const existingResult = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    const updatedResults = existingResult
      ? translation.translation_results.map((r) =>
          r.language_code === languageCode ? { ...r, translated_text: text } : r
        )
      : [
          ...translation.translation_results,
          {
            id: `temp-${Date.now()}`,
            translation_id: translationId,
            language_code: languageCode,
            translated_text: text,
            reviewer_id: null,
            reviewed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];

    updateLocalTranslation(translationId, { translation_results: updatedResults });

    try {
      const response = await fetch(`/api/translations/${translationId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: languageCode,
          translated_text: text,
        }),
      });

      if (response.ok) {
        // Record correction in background (fire-and-forget)
        if (existingResult && existingResult.translated_text !== text) {
          fetch('/api/ai/corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_text: existingResult.translated_text,
              corrected_text: text,
              source_text: translation.source_text,
              language_code: languageCode,
            }),
          }).catch(() => {});
        }
      } else {
        // Rollback
        updateLocalTranslation(translationId, { translation_results: translation.translation_results });
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      updateLocalTranslation(translationId, { translation_results: translation.translation_results });
    }
  }, [translations, updateLocalTranslation]);

  const handleSourceTextUpdate = useCallback(async (translationId: string, sourceText: string) => {
    await optimisticPatch(translationId, { source_text: sourceText }, { source_text: sourceText });
  }, [optimisticPatch]);

  const handleContextUpdate = useCallback(async (translationId: string, context: string) => {
    await optimisticPatch(translationId, { context: context || null }, { context: context || null });
  }, [optimisticPatch]);

  const handleScopeUpdate = useCallback(async (translationId: string, scope: 'SaaS' | 'Solution' | null) => {
    await optimisticPatch(translationId, { scope }, { scope });
  }, [optimisticPatch]);

  const handlePriorityUpdate = useCallback(async (translationId: string, priority: string) => {
    await optimisticPatch(translationId, { priority }, { priority });
  }, [optimisticPatch]);

  const handleNotesUpdate = useCallback(async (translationId: string, notes: string) => {
    await optimisticPatch(translationId, { notes: notes || null }, { notes: notes || null });
  }, [optimisticPatch]);

  const handleVersionUpdate = useCallback(async (translationId: string, version: string) => {
    const trimmed = version.trim() || null;
    await optimisticPatch(
      translationId,
      { version: trimmed, version_updated_at: trimmed ? new Date().toISOString() : null },
      { version: trimmed, version_updated_at: trimmed ? new Date().toISOString() : null }
    );
  }, [optimisticPatch]);

  const handleProductsUpdate = useCallback(async (
    translationId: string,
    products: { code: ProductCode; version: string }[]
  ) => {
    // Products update requires server response for relation, so refetch
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_codes: products }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating products:', error);
    }
  }, [fetchTranslations]);

  const handleDelete = useCallback(async (id: string) => {
    if (!showConfirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/translations/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setTranslations((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (error) {
      console.error('Error deleting translation:', error);
    }
  }, [setTranslations]);

  const handleBulkCreate = useCallback(async (
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
      }
    } catch (error) {
      console.error('Error creating translations:', error);
    }
  }, [fetchTranslations]);

  const handleCreate = useCallback(async (
    sourceText: string,
    context: string,
    version: string,
    productCode: ProductCode | '',
    scope: 'SaaS' | 'Solution' | '',
    priority?: PriorityLevel
  ) => {
    if (!sourceText.trim()) return;
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
        return true;
      }
    } catch (error) {
      console.error('Error creating translation:', error);
    }
    return false;
  }, [fetchTranslations]);

  return {
    handleStatusChange,
    handleTranslationUpdate,
    handleSourceTextUpdate,
    handleContextUpdate,
    handleScopeUpdate,
    handlePriorityUpdate,
    handleNotesUpdate,
    handleVersionUpdate,
    handleProductsUpdate,
    handleDelete,
    handleBulkCreate,
    handleCreate,
  };
}
