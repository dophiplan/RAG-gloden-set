import { useState, useCallback } from 'react';
import type { TranslationWithAudit } from './useTranslationData';

interface DuplicateInfo {
  translationId: string;
  sourceText: string;
  duplicateIds: string[];
  duplicateCount: number;
}

interface PendingEdit {
  field: string;
  fieldName: string;
  value: string | string[] | null;
  updateFn: (id: string, value: string | string[] | null) => Promise<void>;
}

interface UseDuplicateCheckParams {
  translations: TranslationWithAudit[];
  fetchTranslations: () => Promise<void>;
}

export function useDuplicateCheck({ translations, fetchTranslations }: UseDuplicateCheckParams) {
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const checkDuplicatesAndEdit = useCallback(async (
    translationId: string,
    sourceText: string,
    field: string,
    fieldName: string,
    value: string | string[] | null,
    updateFn: (id: string, value: string | string[] | null) => Promise<void>
  ) => {
    try {
      const response = await fetch(
        `/api/translations/update-duplicates?sourceText=${encodeURIComponent(sourceText)}&excludeId=${translationId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.count > 0) {
          setDuplicateInfo({
            translationId,
            sourceText,
            duplicateIds: data.duplicates.map((d: { id: string }) => d.id),
            duplicateCount: data.count,
          });
          setPendingEdit({ field, fieldName, value, updateFn });
          setIsDuplicateModalOpen(true);
          return;
        }
      }
      await updateFn(translationId, value);
    } catch (error) {
      console.error('Error checking duplicates:', error);
      await updateFn(translationId, value);
    }
  }, []);

  const handleDuplicateEditConfirm = useCallback(async (updateAll: boolean) => {
    if (!duplicateInfo || !pendingEdit) return;

    try {
      await pendingEdit.updateFn(duplicateInfo.translationId, pendingEdit.value);

      if (updateAll && duplicateInfo.duplicateIds.length > 0) {
        await fetch('/api/translations/update-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: duplicateInfo.sourceText,
            field: pendingEdit.field,
            value: pendingEdit.value,
            excludeId: duplicateInfo.translationId,
          }),
        });
      }

      fetchTranslations();
    } catch (error) {
      console.error('Error updating duplicates:', error);
    } finally {
      setIsDuplicateModalOpen(false);
      setDuplicateInfo(null);
      setPendingEdit(null);
    }
  }, [duplicateInfo, pendingEdit, fetchTranslations]);

  const closeDuplicateModal = useCallback(() => {
    setIsDuplicateModalOpen(false);
    setDuplicateInfo(null);
    setPendingEdit(null);
  }, []);

  // Wrapped update functions that check for duplicates
  const makeVersionUpdateWithDuplicateCheck = useCallback(
    (handleVersionUpdate: (id: string, value: string | string[] | null) => Promise<void>) =>
      async (translationId: string, version: string) => {
        const translation = translations.find(t => t.id === translationId);
        if (!translation) return;

        await checkDuplicatesAndEdit(
          translationId,
          translation.source_text,
          'version',
          '버전',
          version.trim() || null,
          async (id, val) => {
            const response = await fetch(`/api/translations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                version: val,
                version_updated_at: val ? new Date().toISOString() : null,
              }),
            });
            if (response.ok) fetchTranslations();
          }
        );
      },
    [translations, checkDuplicatesAndEdit, fetchTranslations]
  );

  const makeNotesUpdateWithDuplicateCheck = useCallback(
    () =>
      async (translationId: string, notes: string) => {
        const translation = translations.find(t => t.id === translationId);
        if (!translation) return;

        await checkDuplicatesAndEdit(
          translationId,
          translation.source_text,
          'notes',
          '비고',
          notes || null,
          async (id, val) => {
            const response = await fetch(`/api/translations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes: val }),
            });
            if (response.ok) fetchTranslations();
          }
        );
      },
    [translations, checkDuplicatesAndEdit, fetchTranslations]
  );

  const makeDevCodeUpdateWithDuplicateCheck = useCallback(
    () =>
      async (translationId: string, devCode: string) => {
        const translation = translations.find(t => t.id === translationId);
        if (!translation) return;

        await checkDuplicatesAndEdit(
          translationId,
          translation.source_text,
          'dev_code',
          '개발코드',
          devCode || null,
          async (id, val) => {
            const response = await fetch(`/api/translations/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dev_code: val }),
            });
            if (response.ok) fetchTranslations();
          }
        );
      },
    [translations, checkDuplicatesAndEdit, fetchTranslations]
  );

  return {
    isDuplicateModalOpen,
    duplicateInfo,
    pendingEdit,
    handleDuplicateEditConfirm,
    closeDuplicateModal,
    makeVersionUpdateWithDuplicateCheck,
    makeNotesUpdateWithDuplicateCheck,
    makeDevCodeUpdateWithDuplicateCheck,
  };
}
