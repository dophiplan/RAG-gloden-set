import { useCallback } from 'react';
import { TranslationStatus, LanguageCode, ProductCode, PriorityLevel, Scope } from '@/types';
import { showConfirm, showSuccess, showError } from '@/lib/notifications';
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
      } else if (prev) {
        updateLocalTranslation(id, prev);
        showError('수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      if (prev) updateLocalTranslation(id, prev);
      showError('수정 중 오류가 발생했습니다.');
    }
  }, [translations, updateLocalTranslation]);

  const handleStatusChange = useCallback(async (id: string, status: TranslationStatus) => {
    await optimisticPatch(id, { status }, { status }, '상태가 변경되었습니다.');
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

    // Check if status needs to be reverted for completed translations
    const needsStatusRevert = translation.status === 'reviewed' || translation.status === 'deployed';
    if (needsStatusRevert) {
      // Automatically revert to in_progress
      updateLocalTranslation(translationId, { status: 'in_progress' });
    }

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
        // If status was reverted, also update it on the server and show appropriate message
        if (needsStatusRevert) {
          await fetch(`/api/translations/${translationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          });
          showSuccess('번역이 저장되었습니다. 상태가 "진행 중"으로 변경되었습니다.');
        } else {
          showSuccess('번역이 저장되었습니다.');
        }
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
        showError('번역 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      updateLocalTranslation(translationId, { translation_results: translation.translation_results });
      showError('번역 저장 중 오류가 발생했습니다.');
    }
  }, [translations, updateLocalTranslation]);

  const handleSourceTextUpdate = useCallback(async (translationId: string, sourceText: string) => {
    const translation = translations.find((t) => t.id === translationId);
    const needsStatusRevert = translation?.status === 'reviewed' || translation?.status === 'deployed';

    if (needsStatusRevert) {
      // Update both source_text and status
      updateLocalTranslation(translationId, { source_text: sourceText, status: 'in_progress' });
      try {
        await fetch(`/api/translations/${translationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_text: sourceText, status: 'in_progress' }),
        });
        showSuccess('원문이 수정되었습니다. 상태가 "진행 중"으로 변경되었습니다.');
      } catch (error) {
        console.error('Error updating translation:', error);
        if (translation) updateLocalTranslation(translationId, translation);
        showError('수정 중 오류가 발생했습니다.');
      }
    } else {
      await optimisticPatch(translationId, { source_text: sourceText }, { source_text: sourceText }, '원문이 수정되었습니다.');
    }
  }, [translations, optimisticPatch, updateLocalTranslation]);

  const handleContextUpdate = useCallback(async (translationId: string, context: string) => {
    await optimisticPatch(translationId, { context: context || null }, { context: context || null }, '설명이 수정되었습니다.');
  }, [optimisticPatch]);

  const handleScopeUpdate = useCallback(async (translationId: string, scope: Scope | null) => {
    await optimisticPatch(translationId, { scope }, { scope }, '제품분류가 변경되었습니다.');
  }, [optimisticPatch]);

  const handlePriorityUpdate = useCallback(async (translationId: string, priority: PriorityLevel) => {
    await optimisticPatch(translationId, { priority }, { priority }, '중요도가 변경되었습니다.');
  }, [optimisticPatch]);

  const handleNotesUpdate = useCallback(async (translationId: string, notes: string) => {
    await optimisticPatch(translationId, { notes: notes || null }, { notes: notes || null }, '비고가 수정되었습니다.');
  }, [optimisticPatch]);

  const handleVersionUpdate = useCallback(async (translationId: string, version: string) => {
    const trimmed = version.trim() || null;
    await optimisticPatch(
      translationId,
      { version: trimmed, version_updated_at: trimmed ? new Date().toISOString() : null },
      { version: trimmed, version_updated_at: trimmed ? new Date().toISOString() : null },
      '버전이 수정되었습니다.'
    );
  }, [optimisticPatch]);

  const handleDevCodeUpdate = useCallback(async (translationId: string, devCode: string) => {
    await optimisticPatch(
      translationId,
      { dev_code: devCode || null },
      { dev_code: devCode || null },
      '개발자 코드가 업데이트되었습니다.'
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
      if (response.ok) {
        fetchTranslations();
        showSuccess('제품이 변경되었습니다.');
      } else {
        showError('제품 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating products:', error);
      showError('제품 변경 중 오류가 발생했습니다.');
    }
  }, [fetchTranslations]);

  const handleDelete = useCallback(async (id: string) => {
    if (!showConfirm('정말 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/translations/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setTranslations((prev) => prev.filter((t) => t.id !== id));
        showSuccess('삭제되었습니다.');
      } else {
        showError('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting translation:', error);
      showError('삭제 중 오류가 발생했습니다.');
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
        showSuccess(`${texts.length}개의 번역이 생성되었습니다.`);
      } else {
        showError('번역 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating translations:', error);
      showError('번역 생성 중 오류가 발생했습니다.');
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
        showSuccess('번역이 생성되었습니다.');
        return true;
      } else {
        showError('번역 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating translation:', error);
      showError('번역 생성 중 오류가 발생했습니다.');
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
    handleDevCodeUpdate,
    handleProductsUpdate,
    handleDelete,
    handleBulkCreate,
    handleCreate,
  };
}
