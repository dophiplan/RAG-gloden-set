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

// Debug logging helper - only in development
const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationRowProps {
  page?: 'info' | 'translations';
  translation: TranslationWithResults;
  isSelected: boolean;
  displayLanguages?: LanguageCode[];
  onToggleSelect: (id: string) => void;
  onStatusChange?: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate?: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate?: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate?: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate?: (translationId: string, scope: Scope | null) => Promise<void>;
  onVersionUpdate?: (translationId: string, version: string) => Promise<void>;
  onPriorityUpdate?: (translationId: string, priority: PriorityLevel) => Promise<void>;
  onNotesUpdate?: (translationId: string, notes: string) => Promise<void>;
  onDevCodeUpdate?: (translationId: string, devCode: string) => Promise<void>;
  onPlatformsUpdate?: (translationId: string, platformCodes: string[]) => Promise<void>;
  onDelete?: (id: string) => void;
  onAddToGlossary?: (translation: TranslationWithResults) => void;
  onHistoryClick?: (translationId: string) => void;
  onRefresh?: () => void;
}

/**
 * 마이그레이션 스타일 Translation Row
 * 가로 스크롤 없이 한 화면에 표시
 */
const TranslationRow = memo(function TranslationRow({
  page = 'info',
  translation,
  isSelected,
  displayLanguages = [],
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
  onAddToGlossary,
  onHistoryClick,
  onRefresh,
}: TranslationRowProps) {
  const { productsMap } = useProducts();
  const { platformsMap } = usePlatforms();
  const statusInfo = STATUS_COLORS[translation.status];
  const [isDeleting, setIsDeleting] = useState(false);

  const getTranslationForLanguage = (languageCode: LanguageCode): string => {
    const result = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    return result?.translated_text || '';
  };

  const isNotUsed = translation.status === 'not_used';
  const selectedPlatformCodes =
    translation.translation_platforms?.map((tp) => tp.platform_code) || [];

  // 번역 정보 뷰
  if (page === 'translations') {
    debug('[TranslationRow] Rendering translations page:', translation.id);
    return (
      <tr
        className={`transition-colors duration-150 hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50' : ''
        } ${isNotUsed ? 'opacity-50 line-through' : ''}`}
      >
        {/* Checkbox */}
        <td className="w-[28px] px-1 py-1.5 align-middle">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(translation.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </td>

        {/* Source Text - 20% 너비, 폰트 10px */}
        <td className="w-[20%] px-2 py-1.5 align-middle">
          <div className="text-[10px] truncate">
            <EditableSourceCell
              value={translation.source_text}
              onSave={async (v) => {
                await onSourceTextUpdate?.(translation.id, v);
                await onRefresh?.();
              }}
            />
          </div>
        </td>

        {/* Language Translations - 폰트 10px */}
        {displayLanguages.map((lang) => (
          <td key={lang} className="px-1 py-1.5 align-middle">
            <div className="text-[10px] truncate">
              <EditableTranslationCell
                language={lang}
                value={getTranslationForLanguage(lang)}
                onSave={async (v) => {
                  await onTranslationUpdate?.(translation.id, lang, v);
                  await onRefresh?.();
                }}
              />
            </div>
          </td>
        ))}

        {/* Status */}
        <td className="w-[50px] px-1 py-1.5 align-middle">
          <select
            value={translation.status}
            onChange={async (e) => {
              await onStatusChange?.(translation.id, e.target.value as TranslationStatus);
              await onRefresh?.();
            }}
            className={`text-[10px] border rounded px-1 py-0.5 w-full ${statusInfo.bg} ${statusInfo.text}`}
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
        <td className="w-[65px] px-1 py-1.5 align-middle">
          <div className="flex items-center justify-end gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete?.(translation.id); }}
              className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="삭제"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // 기본 정보 뷰
  return (
    <tr
      className={`transition-colors duration-150 hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50' : ''
      } ${isNotUsed ? 'opacity-50 line-through' : ''}`}
    >
      {/* Checkbox */}
      <td className="w-[28px] px-1 py-1.5 align-middle">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(translation.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>

      {/* Priority */}
      <td className="w-[30px] px-1 py-1.5 align-middle text-center">
        <PriorityBadge
          priority={translation.priority || 'medium'}
          onChange={async (p) => {
            await onPriorityUpdate?.(translation.id, p);
            await onRefresh?.();
          }}
        />
      </td>

      {/* Scope */}
      <td className="w-[40px] px-1 py-1.5 align-middle">
        <EditableCell
          value={translation.scope || ''}
          onSave={async (v) => {
            await onScopeUpdate?.(translation.id, v as Scope || null);
            await onRefresh?.();
          }}
          placeholder="-"
        />
      </td>

      {/* Platform */}
      <td className="w-[46px] px-1 py-1.5 align-middle text-[10px] truncate">
        {selectedPlatformCodes.join(', ') || '-'}
      </td>

      {/* Version */}
      <td className="w-[36px] px-1 py-1.5 align-middle">
        <EditableCell
          value={translation.version || ''}
          onSave={async (v) => {
            await onVersionUpdate?.(translation.id, v);
            await onRefresh?.();
          }}
          placeholder="-"
        />
      </td>

      {/* Dev Code (KEY/ID) */}
      <td className="w-[55px] px-1 py-1.5 align-middle">
        <EditableCell
          value={translation.dev_code || ''}
          onSave={async (v) => {
            await onDevCodeUpdate?.(translation.id, v);
            await onRefresh?.();
          }}
          placeholder="-"
        />
      </td>

      {/* Source Text - 25% 너비, 폰트 10px */}
      <td className="w-[25%] px-2 py-1.5 align-middle">
        <div className="text-[10px] truncate">
          <EditableSourceCell
            value={translation.source_text}
            onSave={async (v) => {
              await onSourceTextUpdate?.(translation.id, v);
              await onRefresh?.();
            }}
          />
        </div>
      </td>

      {/* Context */}
      <td className="w-[60px] px-1 py-1.5 align-middle text-[10px]">
        <EditableCell
          value={translation.context || ''}
          onSave={async (v) => {
            await onContextUpdate?.(translation.id, v);
            await onRefresh?.();
          }}
          placeholder="-"
          middleTruncate
          maxLength={10}
        />
      </td>

      {/* Status */}
      <td className="w-[40px] px-1 py-1.5 align-middle">
        <select
          value={translation.status}
          onChange={async (e) => {
            await onStatusChange?.(translation.id, e.target.value as TranslationStatus);
            await onRefresh?.();
          }}
          className={`text-[10px] border rounded px-1 py-0.5 w-full ${statusInfo.bg} ${statusInfo.text}`}
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
      <td className="w-[25px] px-1 py-1.5 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(translation.id); }}
            className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="삭제"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
});

// Priority Badge Component
function PriorityBadge({
  priority,
  onChange,
}: {
  priority: PriorityLevel;
  onChange: (p: PriorityLevel) => void;
}) {
  const colors: Record<PriorityLevel, string> = {
    urgent: 'bg-purple-100 text-purple-700',
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };

  const labels: Record<PriorityLevel, string> = {
    urgent: '긴급',
    high: '높',
    medium: '중',
    low: '낮',
  };

  return (
    <select
      value={priority}
      onChange={(e) => onChange(e.target.value as PriorityLevel)}
      className={`text-[10px] border rounded px-1 py-0.5 ${colors[priority]}`}
    >
      <option value="urgent">{labels.urgent}</option>
      <option value="high">{labels.high}</option>
      <option value="medium">{labels.medium}</option>
      <option value="low">{labels.low}</option>
    </select>
  );
}

// Editable Source Cell
function EditableSourceCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  return (
    <EditableCell
      value={value}
      onSave={onSave}
      className="font-medium"
    />
  );
}

// Editable Translation Cell
function EditableTranslationCell({
  language,
  value,
  onSave,
}: {
  language: LanguageCode;
  value: string;
  onSave: (v: string) => void;
}) {
  return (
    <EditableCell
      value={value}
      onSave={onSave}
      placeholder="-"
      className="text-gray-600"
    />
  );
}

export default TranslationRow;
