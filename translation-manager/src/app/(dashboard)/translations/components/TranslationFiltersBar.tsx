import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { TranslationStatus, LanguageCode, SUPPORTED_LANGUAGES } from '@/types';
import { LANGUAGE_SELECT_OPTIONS } from '@/lib/constants';

interface TranslationFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  languageFilter: string;
  onLanguageFilterChange: (value: string) => void;
  statusFilter: TranslationStatus | '';
  onStatusFilterChange: (value: TranslationStatus | '') => void;
  selectedLanguageColumns: LanguageCode[] | null;
  onLanguageColumnsChange: (languages: LanguageCode[] | null) => void;
  availableLanguages: LanguageCode[];
}

export default function TranslationFiltersBar({
  searchTerm,
  onSearchChange,
  languageFilter,
  onLanguageFilterChange,
  statusFilter,
  onStatusFilterChange,
  selectedLanguageColumns,
  onLanguageColumnsChange,
  availableLanguages,
}: TranslationFiltersBarProps) {
  const handleLanguageToggle = (lang: LanguageCode) => {
    if (!selectedLanguageColumns) {
      // If null (all selected), start with all available languages minus the clicked one
      const newSelection = availableLanguages.filter(l => l !== lang);
      onLanguageColumnsChange(newSelection.length === 0 ? null : newSelection);
    } else {
      // Toggle the language
      const newSelection = selectedLanguageColumns.includes(lang)
        ? selectedLanguageColumns.filter(l => l !== lang)
        : [...selectedLanguageColumns, lang];

      // If all languages are selected, set to null (show all)
      if (newSelection.length === availableLanguages.length) {
        onLanguageColumnsChange(null);
      } else if (newSelection.length === 0) {
        // Don't allow deselecting all languages
        return;
      } else {
        onLanguageColumnsChange(newSelection);
      }
    }
  };

  const isLanguageSelected = (lang: LanguageCode) => {
    if (!selectedLanguageColumns) return true; // null means all selected
    return selectedLanguageColumns.includes(lang);
  };

  return (
    <Card>
      <div className="space-y-4">
        {/* Language column selector - moved to top */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700">표시할 언어:</span>
            <button
              onClick={() => onLanguageColumnsChange(null)}
              className="text-xs text-blue-600 hover:text-blue-700 underline"
            >
              전체 선택
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableLanguages.map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                title={SUPPORTED_LANGUAGES[lang]}
              >
                <input
                  type="checkbox"
                  checked={isLanguageSelected(lang)}
                  onChange={() => handleLanguageToggle(lang)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  {lang.toUpperCase()}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-4 border-t pt-4">
          {/* 모든 언어 */}
          <div className="w-40">
            <Select
              value={languageFilter}
              onChange={(e) => onLanguageFilterChange(e.target.value)}
              options={LANGUAGE_SELECT_OPTIONS}
            />
          </div>
          {/* 모든 상태 */}
          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as TranslationStatus | '')}
              options={[
                { value: '', label: '모든 상태' },
                { value: 'pending', label: '번역 요청' },
                { value: 'reviewed', label: '검수 완료' },
                { value: 'deployed', label: '반영 완료' },
              ]}
            />
          </div>
          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="원문 또는 번역문 검색..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
