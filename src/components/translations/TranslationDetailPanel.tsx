'use client';

import { useState, useCallback } from 'react';
import { apiPatch } from '@/lib/api-utils';
import { useAutoSave } from '@/app/(dashboard)/translations/hooks/useAutoSave';
import { usePlatformDeployStatus } from '@/app/(dashboard)/translations/hooks/usePlatformDeployStatus';
import { usePlatforms } from '@/hooks/useReferenceData';
import { Translation, TranslationResult, LanguageCode } from '@/types';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationDetailPanelProps {
  translation: TranslationWithResults;
  displayLanguages: LanguageCode[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<TranslationWithResults>) => void;
}

export function TranslationDetailPanel({
  translation,
  displayLanguages,
  onClose,
  onUpdate,
}: TranslationDetailPanelProps) {
  const [localTranslation, setLocalTranslation] = useState<TranslationWithResults>(translation);
  const { platforms: allPlatforms } = usePlatforms();
  const { status: deployStatus, updatePlatformStatus } = usePlatformDeployStatus(translation.id);

  // Auto-save for context
  const { triggerSave: saveContext, saveStatus: contextSaveStatus } = useAutoSave({
    onSave: async (context: string) => {
      await apiPatch(`/api/translations/${translation.id}`, { context });
      onUpdate(translation.id, { context });
    },
    debounceMs: 500,
  });

  // Auto-save for translation
  const handleTranslationUpdate = useCallback(async (languageCode: LanguageCode, text: string) => {
    await apiPatch(`/api/translations/${translation.id}/results`, {
      language_code: languageCode,
      translated_text: text,
    });
    
    // Update local state
    const newResults = localTranslation.translation_results.map((r) =>
      r.language_code === languageCode ? { ...r, translated_text: text } : r
    );
    setLocalTranslation({ ...localTranslation, translation_results: newResults });
    onUpdate(translation.id, { translation_results: newResults });
  }, [translation.id, localTranslation, onUpdate]);

  // Handle platform toggle
  const handlePlatformToggle = useCallback(async (platformCode: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await updatePlatformStatus(platformCode, newStatus);
      onUpdate(translation.id, {});
    } catch (error) {
      console.error('Error updating platform status:', error);
    }
  }, [updatePlatformStatus, onUpdate, translation.id]);

  const platformMap = new Map(allPlatforms.map(p => [p.code, p.name]));
  const progress = deployStatus?.progress || 0;
  const allCompleted = deployStatus?.all_completed || false;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900">번역 상세</h3>
          <SaveStatusIndicator status={contextSaveStatus.status} />
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Source Text (Read-only) */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            원문
          </label>
          <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
            {localTranslation.source_text}
          </div>
        </div>

        {/* Context (Auto-save) */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            설명
          </label>
          <textarea
            value={localTranslation.context || ''}
            onChange={(e) => {
              const newContext = e.target.value;
              setLocalTranslation({ ...localTranslation, context: newContext });
              saveContext(newContext);
            }}
            className="w-full text-sm text-gray-700 bg-white p-3 rounded border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="설명을 입력하세요..."
          />
        </div>

        {/* Platform Deploy Checklist (Only for re_request status) */}
        {localTranslation.status === 're_request' && deployStatus && (
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                플랫폼 배포 상태
              </h4>
              <span className={`text-xs font-bold ${allCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                {progress}%
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${allCompleted ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Platform checkboxes */}
            <div className="flex flex-wrap gap-2">
              {deployStatus.platforms.map((platform) => (
                <label
                  key={platform.platform_code}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-pointer transition-colors ${
                    platform.deploy_status === 'completed'
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={platform.deploy_status === 'completed'}
                    onChange={() => handlePlatformToggle(platform.platform_code, platform.deploy_status)}
                    className="rounded border-gray-300 text-green-600 w-4 h-4"
                  />
                  <span className="text-xs font-medium">
                    {platformMap.get(platform.platform_code) || platform.platform_code}
                  </span>
                </label>
              ))}
            </div>

            {allCompleted && (
              <div className="flex items-center gap-1 text-xs text-green-600 mt-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                모든 플랫폼 배포 완료
              </div>
            )}
          </div>
        )}

        {/* Translations */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            번역
          </h4>
          <div className="space-y-3">
            {displayLanguages.map((lang) => {
              const result = localTranslation.translation_results.find(r => r.language_code === lang);
              const labels: Record<string, string> = { en: '영어', ja: '일본어', zh: '중국어' };
              
              return (
                <div key={lang} className="bg-gray-50 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{labels[lang] || lang}</span>
                    {result?.source_type && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {result.source_type}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={result?.translated_text || ''}
                    onChange={(e) => handleTranslationUpdate(lang, e.target.value)}
                    className="w-full text-sm text-gray-800 bg-white p-2 rounded border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`${labels[lang] || lang} 번역...`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Meta */}
        <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
          <div>상태: {localTranslation.status}</div>
          <div>요청일: {new Date(localTranslation.created_at).toLocaleDateString('ko-KR')}</div>
          <div>수정일: {new Date(localTranslation.updated_at).toLocaleDateString('ko-KR')}</div>
        </div>
      </div>
    </div>
  );
}

// Save status indicator component
function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;
  
  const styles = {
    saving: 'text-blue-600',
    saved: 'text-green-600',
    error: 'text-red-600',
  };
  
  const labels = {
    saving: '저장 중...',
    saved: '저장됨',
    error: '저장 실패',
  };

  return (
    <span className={`text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
