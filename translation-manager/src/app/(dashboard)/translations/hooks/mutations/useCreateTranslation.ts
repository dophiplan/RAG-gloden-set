import { useCallback, useRef } from 'react';
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
import { showSuccess, showError, showWarning } from '@/lib/notifications';

interface UseCreateTranslationParams {
  fetchTranslations: () => Promise<void>;
}

/**
 * Hook for creating translations
 * Supports both single and bulk creation
 */
export function useCreateTranslation({ fetchTranslations }: UseCreateTranslationParams) {
  // Prevent duplicate submissions
  const isSubmitting = useRef(false);

  const handleCreate = useCallback(
    async (
      sourceText: string,
      context: string,
      version: string,
      productCode: ProductCode | '',
      scope: ScopeType,
      priority?: PriorityLevel,
      languages?: LanguageCode[],
      _platformCodes?: string[],
      _completionDate?: string
    ) => {
      if (!sourceText.trim()) return false;
      
      // Prevent duplicate submissions
      if (isSubmitting.current) {
        console.log('Submission already in progress, ignoring duplicate click');
        return false;
      }
      
      isSubmitting.current = true;

      try {
        // 1. Create translation
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

        if (!response.ok) {
          showError('번역 생성에 실패했습니다.');
          return false;
        }

        const createdTranslation = await response.json();
        
        // Extract ID from response (handle both {data: {...}} and direct {...} formats)
        const translationId = createdTranslation.data?.id || createdTranslation.id;
        
        if (!translationId) {
          console.error('No translation ID in response:', createdTranslation);
          showError('번역 ID를 찾을 수 없습니다.');
          return false;
        }
        
        // Show success immediately for translation creation
        showSuccess('번역이 생성되었습니다. AI 번역을 진행 중입니다...');
        
        // Refresh list immediately
        fetchTranslations();
        
        // 2. Auto-translate if languages are specified
        if (languages && languages.length > 0) {
          console.log('[AutoTranslate] Starting for translation:', translationId, 'languages:', languages);
          
          // Execute immediately, not in setTimeout for better reliability
          (async () => {
            try {
              console.log('[AutoTranslate] Calling API with:', {
                translationId,
                sourceText: sourceText.substring(0, 50),
                targetLanguages: languages
              });
              
              const aiResponse = await fetch('/api/ai/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  translationId: translationId,
                  sourceText: sourceText,
                  context: context || undefined,
                  targetLanguages: languages,
                }),
              });

              console.log('[AutoTranslate] API response status:', aiResponse.status);

              if (aiResponse.ok) {
                const result = await aiResponse.json();
                console.log('[AutoTranslate] Success:', result);
                showSuccess(`AI 번역 완료: ${result.translations?.length || 0}개 언어 (${result.provider})`);
                
                // Delay refresh to allow DB to commit
                setTimeout(() => {
                  console.log('[AutoTranslate] Refreshing translations...');
                  fetchTranslations();
                }, 500);
              } else {
                const errorText = await aiResponse.text();
                console.error('[AutoTranslate] Failed:', errorText);
                let errorData;
                try {
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  errorData = { error: errorText };
                }
                showWarning(`AI 번역 실패: ${errorData.error || errorText.substring(0, 100)}`);
              }
            } catch (aiError) {
              console.error('[AutoTranslate] Error:', aiError);
              showWarning('AI 번역 중 오류가 발생했습니다.');
            }
          })();
        } else {
          console.log('[AutoTranslate] No languages specified, skipping AI translation');
        }

        return true;
      } catch (error) {
        console.error('Error creating translation:', error);
        showError('번역 생성 중 오류가 발생했습니다.');
      } finally {
        isSubmitting.current = false;
      }

      return false;
    },
    [fetchTranslations]
  );

  const handleBulkCreate = useCallback(
    async (
      texts: string[],
      version?: string,
      productCode?: ProductCode,
      scope?: ScopeType,
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
    },
    [fetchTranslations]
  );

  return {
    handleCreate,
    handleBulkCreate,
  };
}
