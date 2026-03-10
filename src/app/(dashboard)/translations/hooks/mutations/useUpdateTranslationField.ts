import { useCallback } from 'react';
import { TranslationStatus, PriorityLevel, Scope } from '@/types';
import { apiPatch } from '@/lib/api-utils';
import { showSuccess, showError } from '@/lib/notifications';
import type { TranslationWithAudit } from '../useTranslationData';

interface UseUpdateTranslationFieldParams {
  setTranslations: React.Dispatch<React.SetStateAction<TranslationWithAudit[]>>;
  fetchTranslations: () => Promise<void>;
}

/**
 * Hook for updating individual translation fields
 * API call first, then refresh data
 */
export function useUpdateTranslationField({
  setTranslations,
  fetchTranslations,
}: UseUpdateTranslationFieldParams) {
  
  const handleStatusChange = useCallback(
    async (id: string, status: TranslationStatus) => {
      try {
        await apiPatch(`/api/translations/${id}/status`, { status });
        await fetchTranslations();
        showSuccess('상태가 변경되었습니다.');
      } catch (error) {
        console.error('Error updating status:', error);
        showError('상태 변경 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleSourceTextUpdate = useCallback(
    async (translationId: string, sourceText: string) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { source_text: sourceText });
        await fetchTranslations();
        showSuccess('원문이 수정되었습니다.');
      } catch (error) {
        console.error('Error updating source text:', error);
        showError('원문 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleContextUpdate = useCallback(
    async (translationId: string, context: string) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { context });
        await fetchTranslations();
      } catch (error) {
        console.error('Error updating context:', error);
        showError('설명 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleScopeUpdate = useCallback(
    async (translationId: string, scope: Scope | null) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { scope });
        await fetchTranslations();
      } catch (error) {
        console.error('Error updating scope:', error);
        showError('분류 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handlePriorityUpdate = useCallback(
    async (translationId: string, priority: PriorityLevel) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { priority });
        await fetchTranslations();
      } catch (error) {
        console.error('Error updating priority:', error);
        showError('중요도 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleNotesUpdate = useCallback(
    async (translationId: string, notes: string) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { notes });
        await fetchTranslations();
      } catch (error) {
        console.error('Error updating notes:', error);
        showError('메모 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleVersionUpdate = useCallback(
    async (translationId: string, version: string) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { 
          version, 
          version_updated_at: new Date().toISOString() 
        });
        await fetchTranslations();
      } catch (error) {
        console.error('Error updating version:', error);
        showError('버전 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
  );

  const handleDevCodeUpdate = useCallback(
    async (translationId: string, devCode: string) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { dev_code: devCode });
        await fetchTranslations();
        showSuccess('KEY/ID가 수정되었습니다.');
      } catch (error) {
        console.error('Error updating dev code:', error);
        showError('KEY/ID 수정 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [fetchTranslations]
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
