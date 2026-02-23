import { useCallback } from 'react';
import { TranslationStatus, PriorityLevel, Scope } from '@/types';
import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { TranslationWithAudit } from '../useTranslationData';

interface UseUpdateTranslationFieldParams {
  translations: TranslationWithAudit[];
  updateLocalTranslation: (id: string, updates: Partial<TranslationWithAudit>) => void;
}

/**
 * Hook for updating individual translation fields
 * Provides handlers for status, source text, context, scope, priority, etc.
 */
export function useUpdateTranslationField({
  translations,
  updateLocalTranslation,
}: UseUpdateTranslationFieldParams) {
  const { optimisticPatch } = useOptimisticUpdate({ translations, updateLocalTranslation });

  const handleStatusChange = useCallback(
    async (id: string, status: TranslationStatus) => {
      await optimisticPatch(id, { status }, { status }, '상태가 변경되었습니다.');
    },
    [optimisticPatch]
  );

  const handleSourceTextUpdate = useCallback(
    async (translationId: string, sourceText: string) => {
      await optimisticPatch(
        translationId,
        { source_text: sourceText },
        { source_text: sourceText },
        '원문이 수정되었습니다.'
      );
    },
    [optimisticPatch]
  );

  const handleContextUpdate = useCallback(
    async (translationId: string, context: string) => {
      await optimisticPatch(translationId, { context }, { context });
    },
    [optimisticPatch]
  );

  const handleScopeUpdate = useCallback(
    async (translationId: string, scope: Scope | null) => {
      await optimisticPatch(translationId, { scope }, { scope });
    },
    [optimisticPatch]
  );

  const handlePriorityUpdate = useCallback(
    async (translationId: string, priority: PriorityLevel) => {
      await optimisticPatch(translationId, { priority }, { priority });
    },
    [optimisticPatch]
  );

  const handleNotesUpdate = useCallback(
    async (translationId: string, notes: string) => {
      await optimisticPatch(translationId, { notes }, { notes });
    },
    [optimisticPatch]
  );

  const handleVersionUpdate = useCallback(
    async (translationId: string, version: string) => {
      await optimisticPatch(
        translationId,
        { version, version_updated_at: new Date().toISOString() },
        { version }
      );
    },
    [optimisticPatch]
  );

  const handleDevCodeUpdate = useCallback(
    async (translationId: string, devCode: string) => {
      await optimisticPatch(
        translationId,
        { dev_code: devCode },
        { dev_code: devCode },
        'Dev Code가 수정되었습니다.'
      );
    },
    [optimisticPatch]
  );

  return {
    handleStatusChange,
    handleSourceTextUpdate,
    handleContextUpdate,
    handleScopeUpdate,
    handlePriorityUpdate,
    handleNotesUpdate,
    handleVersionUpdate,
    handleDevCodeUpdate,
  };
}
