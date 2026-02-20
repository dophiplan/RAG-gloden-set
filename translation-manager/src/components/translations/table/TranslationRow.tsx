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

const STATUS_ROW_COLORS: Record<TranslationStatus, { bg: string; hover: string }> = {
  re_request: { bg: '#FEF3C7', hover: '#FDE68A' },
  re_deploy_request: { bg: '#FEF3C7', hover: '#FDE68A' },
  pending: { bg: '#FEF3C7', hover: '#FDE68A' },
  in_progress: { bg: '#DBEAFE', hover: '#BFDBFE' },
  reviewed: { bg: '#F3F4F6', hover: '#E5E7EB' },
  deployed: { bg: '#D1FAE5', hover: '#A7F3D0' },
  not_used: { bg: '#1F2937', hover: '#374151' },
};

export interface TranslationRowProps {
  translation: TranslationWithResults;
  isSelected: boolean;
  showProductColumn: boolean;
  displayLanguages: LanguageCode[];
  columnWidths?: { [key: string]: number };
  onToggleSelect: (id: string) => void;
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate: (translationId: string, scope: Scope | null) => Promise<void>;
  onVersionUpdate: (translationId: string, version: string) => Promise<void>;
  onPriorityUpdate?: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onNotesUpdate?: (translationId: string, notes: string) => Promise<void>;
  onDevCodeUpdate?: (translationId: string, devCode: string) => Promise<void>;
  onPlatformsUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onDelete: (id: string) => void;
}

/**
 * Individual translation table row component
 * Memoized to prevent unnecessary re-renders
 */
const TranslationRow = memo(function TranslationRow({
  translation,
  isSelected,
  showProductColumn,
  displayLanguages,
  columnWidths = {},
  onToggleSelect,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onContextUpdate,
  onScopeUpdate,
  onVersionUpdate,
  onPriorityUpdate,
  onNotesUpdate,
  onDevCodeUpdate,
  onPlatformsUpdate,
  onDelete,
}: TranslationRowProps) {
  const { productsMap } = useProducts();
  const { platformsMap } = usePlatforms();
  const statusInfo = STATUS_COLORS[translation.status];
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Get product names from translation_products
  const productNames =
    translation.translation_products
      ?.map((tp) => {
        const productCode = tp.product_code;
        return productsMap[productCode]?.name || productCode;
      })
      .join(', ') || '-';

  const colors = STATUS_ROW_COLORS[translation.status];
  const isNotUsed = translation.status === 'not_used';

  // Get selected platform codes
  const selectedPlatformCodes =
    translation.translation_platforms?.map((tp) => tp.platform_code) || [];

  // Calculate platform completion rate
  const platformCompletions = translation.platform_completions || {};
  const completedCount = selectedPlatformCodes.filter(
    (code) => platformCompletions[code]?.completed
  ).length;
  const totalCount = selectedPlatformCodes.length;
  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Handle platform selection
  const handlePlatformToggle = (platformCode: string) => {
    const newCodes = selectedPlatformCodes.includes(platformCode)
      ? selectedPlatformCodes.filter((code) => code !== platformCode)
      : [...selectedPlatformCodes, platformCode];
    onPlatformsUpdate?.(translation.id, newCodes);
  };

  // Helper to get cell style with width
  const getCellStyle = (columnKey: string) => {
    const width = columnWidths[columnKey];
    // Default width for actions column if not in columnWidths
    if (columnKey === 'actions' && !width) {
      return { width: '50px', minWidth: '50px', maxWidth: '50px' };
    }
    return width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : {};
  };

  return (
    <tr
      style={{ backgroundColor: isHovered ? colors.hover : colors.bg }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`transition-colors duration-150 ${
        isNotUsed ? 'text-white line-through' : ''
      }`}
    >
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('checkbox')}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(translation.id)}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('priority')}>
        <select
          value={translation.priority || 'medium'}
          onChange={(e) =>
            onPriorityUpdate?.(translation.id, e.target.value as PriorityLevel)
          }
          className="text-xs border rounded px-1 py-0.5 w-full bg-white"
        >
          <option value="urgent">긴급</option>
          <option value="high">상</option>
          <option value="medium">중</option>
          <option value="low">하</option>
        </select>
      </td>
      {showProductColumn && (
        <td className="px-0.5 py-0.5 align-top" style={getCellStyle('product')}>
          <div className="text-xs truncate">{productNames}</div>
        </td>
      )}
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('scope')}>
        <select
          value={translation.scope || ''}
          onChange={(e) => {
            const value = e.target.value;
            onScopeUpdate(
              translation.id,
              value === '' ? null : (value as Scope)
            );
          }}
          className="text-xs border rounded px-1 py-0.5 w-full bg-white"
        >
          <option value="">-</option>
          <option value="SaaS">SaaS</option>
          <option value="Solution">Solution</option>
          <option value="정부과제">정부과제</option>
          <option value="기타">기타</option>
        </select>
      </td>
      <td className="px-2 py-2 align-top relative" style={getCellStyle('platform')}>
        <div className="relative group">
          <button
            onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
            className="text-xs border rounded px-1 py-0.5 w-full bg-white text-left hover:bg-gray-50 flex items-center justify-between"
          >
            <span className="truncate">
              {selectedPlatformCodes.length > 0
                ? selectedPlatformCodes
                    .map((code) => platformsMap[code]?.name || code)
                    .join(', ')
                : '플랫폼 선택'}
            </span>
            <svg
              className="w-4 h-4 ml-1 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Platform completion rate tooltip */}
          {selectedPlatformCodes.length > 0 && (
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-30 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3">
              <div className="mb-2 font-semibold border-b border-gray-700 pb-2">
                플랫폼 반영 현황 ({completedCount}/{totalCount}) - {completionRate}%
              </div>
              <div className="space-y-1">
                {selectedPlatformCodes.map((code) => {
                  const isCompleted = platformCompletions[code]?.completed;
                  const completedAt = platformCompletions[code]?.completed_at;
                  return (
                    <div key={code} className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        {isCompleted ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-gray-500">○</span>
                        )}
                        {platformsMap[code]?.name || code}
                      </span>
                      {isCompleted && completedAt && (
                        <span className="text-gray-400 text-xs">
                          {new Date(completedAt).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Arrow */}
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          )}
          {showPlatformDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPlatformDropdown(false)}
              />
              <div className="absolute z-20 mt-1 w-48 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {Object.values(platformsMap)
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((platform) => (
                    <label
                      key={platform.code}
                      className="flex items-center px-1.5 py-0.5 hover:bg-gray-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatformCodes.includes(platform.code)}
                        onChange={() => handlePlatformToggle(platform.code)}
                        className="rounded border-gray-300 text-blue-600 mr-2"
                      />
                      <span className="text-xs">{platform.name}</span>
                    </label>
                  ))}
              </div>
            </>
          )}
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('version')}>
        <div className="text-xs">
          <EditableCell
            value={translation.version || ''}
            onSave={(newVersion) => onVersionUpdate(translation.id, newVersion)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('sourceText')}>
        <div className="text-xs">
          <EditableCell
            value={translation.source_text}
            onSave={(newSourceText) =>
              onSourceTextUpdate(translation.id, newSourceText)
            }
            placeholder="원문"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('context')}>
        <div className="text-xs truncate">
          <EditableCell
            value={translation.context || ''}
            onSave={(newContext) => onContextUpdate(translation.id, newContext)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('devCode')}>
        <div className="text-xs truncate">
          <EditableCell
            value={translation.dev_code || ''}
            onSave={(newCode) => onDevCodeUpdate?.(translation.id, newCode)}
            placeholder="KEY/id"
            className="text-xs text-gray-600 font-mono"
          />
        </div>
      </td>
      {displayLanguages.map((lang) => {
        const result = getTranslationResultForLanguage(lang);
        const curre[기밀마스킹]ext = getTranslationForLanguage(lang);
        return (
          <td key={lang} className="px-0.5 py-0.5 align-top" style={getCellStyle(`lang_${lang}`)}>
            <div className="text-xs">
              <EditableCell
                value={curre[기밀마스킹]ext}
                onSave={(newText) =>
                  onTranslationUpdate(translation.id, lang, newText)
                }
                placeholder="-"
              />
              {result?.source_type && (
                <div className="mt-1">
                  <TranslationSourceBadge sourceType={result.source_type} />
                </div>
              )}
            </div>
          </td>
        );
      })}

      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('status')}>
        <select
          value={translation.status}
          onChange={(e) =>
            onStatusChange(translation.id, e.target.value as TranslationStatus)
          }
          className={`text-xs border rounded px-1 py-0.5 w-full ${statusInfo.bg} ${statusInfo.text}`}
        >
          <option value="re_request">재요청</option>
          <option value="re_deploy_request">재반영요청</option>
          <option value="pending">요청</option>
          <option value="in_progress">진행 중</option>
          <option value="reviewed">검수</option>
          <option value="deployed">반영</option>
          <option value="not_used">사용안함</option>
        </select>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('notes')}>
        <div className="text-xs truncate">
          <EditableCell
            value={translation.notes || ''}
            onSave={(newNotes) => onNotesUpdate?.(translation.id, newNotes)}
            placeholder="-"
          />
        </div>
      </td>
      <td className="px-0.5 py-0.5 align-top" style={getCellStyle('actions')}>
        <button
          onClick={() => onDelete(translation.id)}
          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
          title="삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
});

export default TranslationRow;
