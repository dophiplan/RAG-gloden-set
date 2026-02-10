'use client';

import { LanguageCode, SUPPORTED_LANGUAGES } from '@/types';

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

      <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border">
        {availableLanguages.map((lang) => (
          <label
            key={lang}
            className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded"
          >
            <input
              type="checkbox"
              checked={selectedLanguages.includes(lang)}
              onChange={() => handleToggle(lang)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {SUPPORTED_LANGUAGES[lang]} ({lang})
            </span>
          </label>
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
