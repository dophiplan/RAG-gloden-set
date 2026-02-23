'use client';

import { usePlatforms } from '@/hooks/useReferenceData';

interface PlatformCheckboxGroupProps {
  selectedPlatforms: string[];
  onChange: (platforms: string[]) => void;
  label?: string;
  required?: boolean;
}

export default function PlatformCheckboxGroup({
  selectedPlatforms,
  onChange,
  label = '플랫폼 선택',
  required = false,
}: PlatformCheckboxGroupProps) {
  const { platforms } = usePlatforms();

  const handleToggle = (platformCode: string) => {
    if (selectedPlatforms.includes(platformCode)) {
      onChange(selectedPlatforms.filter(p => p !== platformCode));
    } else {
      onChange([...selectedPlatforms, platformCode]);
    }
  };

  const handleSelectAll = () => {
    onChange(platforms.map(p => p.code));
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
        {platforms
          .sort((a, b) => a.display_order - b.display_order)
          .map((platform) => (
            <button
              key={platform.code}
              type="button"
              onClick={() => handleToggle(platform.code)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedPlatforms.includes(platform.code)
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              {platform.name}
            </button>
          ))}
      </div>

      <p className="text-xs text-gray-500">
        선택된 플랫폼: {selectedPlatforms.length}개
      </p>
    </div>
  );
}
