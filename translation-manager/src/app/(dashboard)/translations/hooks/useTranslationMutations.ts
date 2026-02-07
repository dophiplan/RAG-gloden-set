import { useCallback } from 'react';
import { TranslationStatus, LanguageCode, ProductCode } from '@/types';
import { showConfirm } from '@/lib/notifications';
import type { TranslationWithAudit } from './useTranslationData';

interface UseTranslationMutationsParams {
  translations: TranslationWithAudit[];
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
  fetchTranslations: () => Promise<void>;
}

export function useTranslationMutations({
  translations,
  setTranslations,
  fetchTranslations,
}: UseTranslationMutationsParams) {
  const handleStatusChange = useCallback(async (id: string, status: TranslationStatus) => {
    try {
      const response = await fetch(`/api/translations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, [fetchTranslations]);

  const handleTranslationUpdate = useCallback(async (
    translationId: string,
    languageCode: LanguageCode,
    text: string
  ) => {
    try {
      const translation = translations.find((t) => t.id === translationId);
      const existingResult = translation?.translation_results?.find(
        (r) => r.language_code === languageCode
      );

      const response = await fetch(`/api/translations/${translationId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_code: languageCode,
          translated_text: text,
        }),
      });

      if (response.ok) {
        if (existingResult && existingResult.translated_text !== text) {
          await fetch('/api/ai/corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              original_text: existingResult.translated_text,
              corrected_text: text,
              source_text: translation?.source_text,
              language_code: languageCode,
            }),
          }).catch((err) => {
            console.error('Error recording correction:', err);
          });
        }
        fetchTranslations();
      }
    } catch (error) {
      console.error('Error updating translation:', error);
    }
  }, [translations, fetchTranslations]);

  const handleSourceTextUpdate = useCallback(async (translationId: string, sourceText: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_text: sourceText }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating source text:', error);
    }
  }, [fetchTranslations]);

  const handleContextUpdate = useCallback(async (translationId: string, context: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context || null }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }, [fetchTranslations]);

  const handleScopeUpdate = useCallback(async (translationId: string, scope: 'SaaS' | 'Solution' | null) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating scope:', error);
    }
  }, [fetchTranslations]);

  const handleWorkScopeUpdate = useCallback(async (translationId: string, workScope: string[]) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_scope: workScope }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating work scope:', error);
    }
  }, [fetchTranslations]);

  const handleDevCodeUpdate = useCallback(async (translationId: string, devCode: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dev_code: devCode || null }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating dev code:', error);
    }
  }, [fetchTranslations]);

  const handleNotesUpdate = useCallback(async (translationId: string, notes: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  }, [fetchTranslations]);

  const handlePlatformCompletionUpdate = useCallback(async (
    translationId: string,
    platform: string,
    completed: boolean
  ) => {
    try {
      const translation = translations.find((t) => t.id === translationId);
      if (!translation) return;

      const updatedCompletions = {
        ...translation.platform_completions,
        [platform]: {
          completed,
          completed_at: completed ? new Date().toISOString() : undefined,
          completed_by: completed ? 'current_user' : undefined,
        },
      };

      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_completions: updatedCompletions }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating platform completion:', error);
    }
  }, [translations, fetchTranslations]);

  const handleVersionUpdate = useCallback(async (translationId: string, version: string) => {
    try {
      const response = await fetch(`/api/translations/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim() || null,
          version_updated_at: version.trim() ? new Date().toISOString() : null,
        }),
      });
      if (response.ok) fetchTranslations();
    } catch (error) {
      console.error('Error updating version:', error);
    }
  }, [fetchTranslations]);

  const handleProductsUpdate = useCallback(async (
    translationId: string,
    products: { code: ProductCode; version: string }[]
  ) => {
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
    productCode?: ProductCode
  ) => {
    try {
      const response = await fetch('/api/translations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, version, product_code: productCode }),
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
    productCode: ProductCode | ''
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
    handleWorkScopeUpdate,
    handleDevCodeUpdate,
    handleNotesUpdate,
    handlePlatformCompletionUpdate,
    handleVersionUpdate,
    handleProductsUpdate,
    handleDelete,
    handleBulkCreate,
    handleCreate,
  };
}
