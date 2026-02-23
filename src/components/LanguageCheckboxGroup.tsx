'use client';

import { LanguageCode } from '@/types';
import { useLanguages } from '@/hooks/useReferenceData';

interface LanguageCheckboxGroupProps {
  selectedLanguages: LanguageCode[];
  onChange: (languages: LanguageCode[]) => void;
  availableLanguages?: LanguageCode[]; // defaults to all 9 languages
  label?: string;
  required?: boolean;
}

export default function LanguageCheckboxGroup({
  selectedLanguages,
  onChange,
  availableLanguages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'],
  label = '번역 언어 선택',
  required = false,
}: LanguageCheckboxGroupProps) {
  const { languagesMap } = useLanguages();

  const handleToggle = (lang: LanguageCode) => {
    if (selectedLanguages.includes(lang)) {
      onChange(selectedLanguages.filter(l => l !== lang));
    } else {
      onChange([...selectedLanguages, lang]);
    }
  };

  const handleSelectAll = () => {
    onChange(availableLanguages);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:text-blue-700 underline"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-gray-600 hover:text-gray-700 underline"
          >
            전체 해제
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {availableLanguages.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => handleToggle(lang)}
            title={languagesMap[lang]?.name || lang}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              selectedLanguages.includes(lang)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {selectedLanguages.length === 0 && required && (
        <p className="text-xs text-red-600">최소 1개 이상의 언어를 선택해주세요.</p>
      )}

      <p className="text-xs text-gray-500">
        선택된 언어: {selectedLanguages.length}개
      </p>
    </div>
  );
}
