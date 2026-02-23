'use client';

import { useLanguages } from '@/hooks/useReferenceData';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: 'glossary' | 'translation';
  action?: 'import' | 'skip' | 'merge' | 'overwrite';
}

interface Props {
  entry: PreviewEntry;
  onClose: () => void;
  onSelectAction: (action: 'import' | 'skip' | 'merge' | 'overwrite') => void;
}

export default function DuplicateConflictModal({ entry, onClose, onSelectAction }: Props) {
  const { languagesMap } = useLanguages();
  const isExactMatch = entry.duplicate_status.status === 'exact';
  const existingTranslations = entry.duplicate_status.existing_translations || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#818CF8] to-[#6366F1] text-white px-6 py-4">
          <h2 className="text-xl font-semibold">중복 항목 처리</h2>
          <p className="text-sm mt-1 opacity-90">
            {isExactMatch ? '동일한 항목이 이미 존재합니다.' : '유사한 항목이 존재합니다.'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Source Text */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">원문</h3>
            <p className="text-gray-800">{entry.source_text}</p>
            {entry.context && (
              <p className="text-sm text-gray-600 mt-1">문맥: {entry.context}</p>
            )}
          </div>

          {/* Side by Side Comparison */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* New Data */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 pb-2 border-b">
                새 데이터 (가져오기)
              </h3>
              <div className="space-y-2">
                {Object.entries(entry.translations).map(([langCode, text]) => {
                  const languageName = languagesMap[langCode]?.name;
                  if (!languageName) return null;
                  return (
                    <div key={langCode} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <span className="text-xs font-semibold text-blue-800 bg-blue-200 px-2 py-0.5 rounded">
                          {langCode.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600 ml-2">{languageName}</span>
                      </div>
                      <p className="text-sm text-gray-800">{text}</p>
                    </div>
                  );
                })}
                {Object.keys(entry.translations).length === 0 && (
                  <p className="text-sm text-gray-500">번역이 없습니다.</p>
                )}
              </div>
            </div>

            {/* Existing Data */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 pb-2 border-b">
                기존 데이터
              </h3>
              <div className="space-y-2">
                {Object.entries(existingTranslations).map(([langCode, text]) => {
                  const languageName = languagesMap[langCode]?.name;
                  if (!languageName) return null;
                  const isNewLanguage = !entry.translations[langCode];
                  return (
                    <div
                      key={langCode}
                      className={`rounded-lg p-3 ${
                        isNewLanguage
                          ? 'bg-yellow-50 border border-yellow-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            isNewLanguage
                              ? 'text-yellow-800 bg-yellow-200'
                              : 'text-gray-800 bg-gray-200'
                          }`}
                        >
                          {langCode.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600 ml-2">{languageName}</span>
                        {isNewLanguage && (
                          <span className="text-xs text-yellow-700 ml-auto">새 언어</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800">{text}</p>
                    </div>
                  );
                })}
                {Object.keys(existingTranslations).length === 0 && (
                  <p className="text-sm text-gray-500">기존 번역이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Options */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">처리 방법 선택</h3>
            <div className="space-y-3">
              {/* Skip */}
              <button
                onClick={() => onSelectAction('skip')}
                className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-sm font-bold text-gray-700">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">건너뛰기</p>
                    <p className="text-sm text-gray-600">
                      기존 데이터를 유지하고, 새 데이터는 가져오지 않습니다.
                    </p>
                  </div>
                </div>
              </button>

              {/* Merge */}
              <button
                onClick={() => onSelectAction('merge')}
                className="w-full text-left p-4 border-2 border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-sm font-bold text-blue-700">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">병합</p>
                    <p className="text-sm text-gray-600">
                      기존 번역은 유지하고, 없는 언어의 번역만 추가합니다.
                    </p>
                    {Object.keys(entry.translations).some(
                      (lang) => !existingTranslations[lang]
                    ) && (
                      <p className="text-xs text-blue-700 mt-1">
                        💡 새로 추가될 언어:{' '}
                        {Object.keys(entry.translations)
                          .filter((lang) => !existingTranslations[lang])
                          .map((lang) => lang.toUpperCase())
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Overwrite */}
              <button
                onClick={() => onSelectAction('overwrite')}
                className="w-full text-left p-4 border-2 border-orange-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-sm font-bold text-orange-700">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">덮어쓰기</p>
                    <p className="text-sm text-gray-600">
                      기존 번역을 새 데이터로 완전히 교체합니다.
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      ⚠️ 기존 데이터가 손실됩니다.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
