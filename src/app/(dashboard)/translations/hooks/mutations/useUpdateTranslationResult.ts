import { useCallback } from 'react';
import { LanguageCode, TranslationResult } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';
import { apiPost, apiPatch } from '@/lib/api-utils';

interface UseUpdateTranslationResultParams {
  translations: TranslationWithAudit[];
  updateLocalTranslation: (id: string, updates: Partial<TranslationWithAudit>) => void;
}

/**
 * Hook for updating translation results (translated text)
 * Handles optimistic updates, status reversion, and correction tracking
 */
export function useUpdateTranslationResult({
  translations,
  updateLocalTranslation,
}: UseUpdateTranslationResultParams) {
  const handleTranslationUpdate = useCallback(
    async (translationId: string, languageCode: LanguageCode, text: string) => {
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
      const needsStatusRevert =
        translation.status === 'reviewed' || translation.status === 'deployed';
      if (needsStatusRevert) {
        // Automatically revert to in_progress
        updateLocalTranslation(translationId, { status: 'in_progress' });
      }

      try {
        const savedResult = await apiPost<TranslationResult>(`/api/translations/${translationId}/results`, {
          language_code: languageCode,
          translated_text: text,
        });
        console.log('[Translation Update] Success:', savedResult);

        // Update with actual server response
        const finalResults = existingResult
          ? translation.translation_results.map((r) =>
              r.language_code === languageCode ? savedResult : r
            )
          : [...translation.translation_results, savedResult];

        updateLocalTranslation(translationId, { translation_results: finalResults });

        // If status was reverted, also update it on the server
        if (needsStatusRevert) {
          await apiPatch(`/api/translations/${translationId}`, { status: 'in_progress' });
          showSuccess('번역이 저장되었습니다. 상태가 "진행 중"으로 변경되었습니다.');
        } else {
          showSuccess('번역이 저장되었습니다.');
        }

        // Record correction in background (fire-and-forget)
        if (existingResult && existingResult.translated_text !== text) {
          void apiPost('/api/ai/corrections', {
            original_text: existingResult.translated_text,
            corrected_text: text,
            source_text: translation.source_text,
            language_code: languageCode,
          }).catch(() => {});
        }
      } catch (error) {
        console.error('[Translation Update] Error:', error);
        updateLocalTranslation(translationId, {
          translation_results: translation.translation_results,
        });
        if (needsStatusRevert) {
          updateLocalTranslation(translationId, { status: translation.status });
        }
        showError('번역 저장 중 오류가 발생했습니다.');
      }
    },
    [translations, updateLocalTranslation]
  );

  return { handleTranslationUpdate };
}
