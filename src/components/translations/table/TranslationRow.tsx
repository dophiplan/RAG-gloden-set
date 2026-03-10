'use client';

import { useState, memo } from 'react';
import EditableCell from '@/components/EditableCell';
import TranslationSourceBadge from '@/components/translations/TranslationSourceBadge';
import {
  Translation,
  TranslationResult,
  TranslationStatus,
  LanguageCode,
  STATUS_COLORS,
  PriorityLevel,
  Scope,
} from '@/types';
import { useProducts, usePlatforms } from '@/hooks/useReferenceData';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationRowProps {
  page?: 'info' | 'translations';
  translation: TranslationWithResults;
  isSelected: boolean;

  displayLanguages?: LanguageCode[];
  columnWidths?: { [key: string]: number };
  onToggleSelect: (id: string) => void;
  onStatusChange?: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate?: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate?: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate?: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate?: (translationId: string, scope: Scope | null) => Promise<void>;
  onVersionUpdate?: (translationId: string, version: string) => Promise<void>;
  onPriorityUpdate?: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onDevCodeUpdate?: (translationId: string, devCode: string) => Promise<void>;
  onPlatformsUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onDelete?: (id: string) => void;
  onAddToGlossary?: (translation: TranslationWithResults) => void;
  onHistoryClick?: (translationId: string) => void;
  onRefresh?: () => void;
}

/**
 * Slide View Translation Row
 * Page 1 (info): Basic Info
 * Page 2 (translations): Source + Language translations
 */
const TranslationRow = memo(function TranslationRow({
  page = 'info',
  translation,
  isSelected,
  displayLanguages = [],
  columnWidths = {},
  onToggleSelect,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onContextUpdate,
  onScopeUpdate,
  onVersionUpdate,
  onPriorityUpdate,
  onDevCodeUpdate,
  onPlatformsUpdate,
  onDelete,
  onAddToGlossary,
  onHistoryClick,
  onRefresh,
}: TranslationRowProps) {
  const { productsMap } = useProducts();
  const { platformsMap } = usePlatforms();
  const statusInfo = STATUS_COLORS[translation.status];
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getTranslationForLanguage = (languageCode: LanguageCode): string => {
    const result = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    return result?.translated_text || '';
  };

  const getTranslationResultForLanguage = (
    languageCode: LanguageCode
  ): TranslationResult | undefined => {
    return translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
  };

  // Product info removed - determined by page context

  const isNotUsed = translation.status === 'not_used';
  const selectedPlatformCodes =
    translation.translation_platforms?.map((tp) => tp.platform_code) || [];

  const getCellStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    return width ? { width: `${width}px`, minWidth: `${width}px` } : {};
  };

  // Page 2: Translations Row
  if (page === 'translations') {
    return (
      <tr
        className={`transition-colors duration-150 hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        } ${isNotUsed ? 'opacity-50 line-through' : ''}`}
      >
        {/* Checkbox */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('checkbox')}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(translation.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </td>

        {/* Source Text */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('sourceText')}>
          <EditableSourceCell
            value={translation.source_text}
            onSave={async (v) => {
              await onSourceTextUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
          />
        </td>

        {/* Language Translations */}
        {displayLanguages.map((lang) => (
          <td key={lang} className="px-2 py-2 align-middle" style={getCellStyle(`lang_${lang}`)}>
            <EditableTranslationCell
              language={lang}
              value={getTranslationForLanguage(lang)}
              onSave={async (v) => {
                await onTranslationUpdate?.(translation.id, lang, v);
                await onRefresh?.();
              }}
            />
          </td>
        ))}

        {/* Actions */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('actions')}>
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(translation.id); }}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="삭제"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Page 1: Info Row (기본)
  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        } ${isNotUsed ? 'opacity-50 line-through' : ''}`}
      >
        {/* Checkbox */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('checkbox')}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(translation.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </td>

        {/* Priority */}
        <td className="px-2 py-2 align-middle text-center" style={getCellStyle('priority')}>
          <PriorityBadge
            level={translation.priority || 'medium'}
            onChange={async (p) => {
              await onPriorityUpdate?.(translation.id, p);
              await onRefresh?.();
            }}
          />
        </td>


        {/* Scope */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('scope')}>
          <select
            value={translation.scope || ''}
            onChange={async (e) => {
              await onScopeUpdate?.(translation.id, e.target.value === '' ? null : e.target.value as Scope);
              await onRefresh?.();
            }}
            className="text-xs border-0 bg-transparent p-0 cursor-pointer text-gray-700 hover:text-blue-600"
          >
            <option value="">-</option>
            <option value="SaaS">SaaS</option>
            <option value="Solution">솔루션</option>
            <option value="정부과제">정부</option>
            <option value="기타">기타</option>
          </select>
        </td>

        {/* Platform */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('platform')}>
          <EditablePlatformCell
            selectedCodes={selectedPlatformCodes}
            platformsMap={platformsMap}
            onSave={(codes) => onPlatformsUpdate?.(translation.id, codes)}
          />
        </td>

        {/* Version */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('version')}>
          <EditableTextCell
            value={translation.version || ''}
            onSave={async (v) => {
              await onVersionUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
            maxLength={8}
          />
        </td>

        {/* KEY/ID */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('devCode')}>
          <EditableTextCell
            value={translation.dev_code || ''}
            onSave={async (v) => {
              await onDevCodeUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
            maxLength={15}
          />
        </td>

        {/* Source Text */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('sourceText')}>
          <EditableTextCell
            value={translation.source_text}
            onSave={async (v) => {
              await onSourceTextUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
            maxLength={40}
          />
        </td>

        {/* Context / Description */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('context')}>
          <EditableTextCell
            value={translation.context || ''}
            onSave={async (v) => {
              await onContextUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
            placeholder="-"
            maxLength={30}
          />
        </td>

        {/* Status */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('status')}>
          <select
            value={translation.status}
            onChange={async (e) => {
              await onStatusChange?.(translation.id, e.target.value as TranslationStatus);
              await onRefresh?.();
            }}
            className={`text-xs border rounded px-1.5 py-0.5 w-full ${statusInfo.bg} ${statusInfo.text}`}
          >
            <option value="pending">요청</option>
            <option value="in_progress">진행</option>
            <option value="reviewed">검토</option>
            <option value="deployed">완료</option>
            <option value="re_request">재요청</option>
            <option value="not_used">미사용</option>
          </select>
        </td>

        {/* Actions */}
        <td className="px-2 py-2 align-middle" style={getCellStyle('actions')}>
          <div className="flex items-center justify-end gap-1">
            {onAddToGlossary && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToGlossary(translation); }}
                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                title="용어집에 추가"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}
            {onHistoryClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onHistoryClick(translation.id); }}
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="히스토리"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (isDeleting) return;
                setIsDeleting(true);
                try { await onDelete?.(translation.id); }
                finally { setIsDeleting(false); }
              }}
              disabled={isDeleting}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="삭제"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    </>
  );
});

// Sub-components
const PriorityBadge = ({ level, onChange }: { level: PriorityLevel; onChange: (p: PriorityLevel) => void }) => {
  const icons: Record<PriorityLevel, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  return (
    <select
      value={level}
      onChange={(e) => onChange(e.target.value as PriorityLevel)}
      className="text-xs bg-transparent border-0 p-0 cursor-pointer hover:opacity-70"
      style={{ width: 'auto' }}
    >
      <option value="urgent">{icons.urgent}</option>
      <option value="high">{icons.high}</option>
      <option value="medium">{icons.medium}</option>
      <option value="low">{icons.low}</option>
    </select>
  );
};

const TruncatedText = ({ text, maxLength = 30, cellKey }: { text: string; maxLength?: number; cellKey: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isTruncated = text.length > maxLength;
  const displayText = isTruncated ? text.slice(0, maxLength) + '...' : text;

  return (
    <div
      className="relative"
      onMouseEnter={() => isTruncated && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-xs text-gray-800">{displayText || '-'}</span>
      {showTooltip && (
        <div className="absolute z-50 left-0 bottom-full mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs whitespace-normal break-words">
          {text}
          <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

const EditableTextCell = ({ value, onSave, placeholder = '-', maxLength = 30 }: { value: string; onSave: (val: string) => void; placeholder?: string; maxLength?: number }) => {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <EditableCell
        value={value}
        onSave={(newVal) => { onSave(newVal); setIsEditing(false); }}
        placeholder={placeholder}
      />
    );
  }
  return (
    <div onDoubleClick={() => setIsEditing(true)} className="cursor-text">
      <TruncatedText text={value || placeholder} maxLength={maxLength} cellKey={value} />
    </div>
  );
};

const EditableSourceCell = ({ value, onSave }: { value: string; onSave: (val: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <EditableCell
        value={value}
        onSave={(newVal) => { onSave(newVal); setIsEditing(false); }}
        placeholder="원문"
      />
    );
  }
  return (
    <div onDoubleClick={() => setIsEditing(true)} className="cursor-text">
      <span className="text-xs text-gray-800">{value || '-'}</span>
    </div>
  );
};

const EditableTranslationCell = ({ language, value, onSave }: { language: string; value: string; onSave: (val: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <EditableCell
        value={value}
        onSave={(newVal) => { onSave(newVal); setIsEditing(false); }}
        placeholder="-"
      />
    );
  }
  return (
    <div onDoubleClick={() => setIsEditing(true)} className="cursor-text">
      <span className="text-xs text-gray-800">{value || '-'}</span>
    </div>
  );
};

const EditablePlatformCell = ({ selectedCodes, platformsMap, onSave }: { selectedCodes: string[]; platformsMap: Record<string, { name: string; code: string; display_order: number }>; onSave: (codes: string[]) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempSelected, setTempSelected] = useState<string[]>(selectedCodes);
  const [showTooltip, setShowTooltip] = useState(false);

  if (isEditing) {
    return (
      <div className="relative bg-white border border-blue-500 rounded p-2 shadow-lg z-50 min-w-[200px]">
        <div className="max-h-40 overflow-y-auto space-y-1">
          {Object.values(platformsMap)
            .sort((a, b) => a.display_order - b.display_order)
            .map((platform) => (
              <label key={platform.code} className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={tempSelected.includes(platform.code)}
                  onChange={() => {
                    setTempSelected((prev) =>
                      prev.includes(platform.code) ? prev.filter((c) => c !== platform.code) : [...prev, platform.code]
                    );
                  }}
                  className="rounded border-gray-300 text-blue-600 mr-2"
                />
                <span>{platform.name}</span>
              </label>
            ))}
        </div>
        <div className="flex gap-2 mt-2 pt-2 border-t">
          <button onClick={() => { onSave(tempSelected); setIsEditing(false); }} className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">저장</button>
          <button onClick={() => { setTempSelected(selectedCodes); setIsEditing(false); }} className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">취소</button>
        </div>
      </div>
    );
  }

  // 플랫폼 표시: 첫 번째 + 나머지 개수
  const platformNames = selectedCodes.map((c) => platformsMap[c]?.name || c);
  const displayText = platformNames.length === 0
    ? '-'
    : platformNames.length === 1
      ? platformNames[0]
      : `${platformNames[0]} +${platformNames.length - 1}`;

  const fullText = platformNames.join(', ');
  const hasTooltip = platformNames.length > 1;

  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      className="cursor-text relative"
      onMouseEnter={() => hasTooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-xs text-gray-800">{displayText}</span>
      {showTooltip && hasTooltip && (
        <div className="absolute z-50 left-0 bottom-full mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs whitespace-normal break-words">
          {fullText}
          <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default TranslationRow;
