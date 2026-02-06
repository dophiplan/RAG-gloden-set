'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import MultiSelectDropdown, { MultiSelectOption } from '@/components/ui/MultiSelectDropdown';
import DeploymentProgressCell from '@/components/translations/DeploymentProgressCell';
import DeploymentCheckModal from '@/components/translations/DeploymentCheckModal';
import { Translation, TranslationResult, TranslationStatus, SUPPORTED_LANGUAGES, LanguageCode, STATUS_COLORS, ProductCode } from '@/types';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
}

interface TranslationTableV2Props {
  translations: TranslationWithResults[];
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate: (translationId: string, sourceText: string) => Promise<void>;
  onContextUpdate: (translationId: string, context: string) => Promise<void>;
  onScopeUpdate: (translationId: string, scope: 'SaaS' | 'Solution' | null) => Promise<void>;
  onVersionUpdate: (translationId: string, version: string) => Promise<void>;
  onWorkScopeUpdate: (translationId: string, workScope: string[]) => Promise<void>;
  onDevCodeUpdate: (translationId: string, devCode: string) => Promise<void>;
  onNotesUpdate: (translationId: string, notes: string) => Promise<void>;
  onPlatformCompletionUpdate: (translationId: string, platform: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

const TARGET_LANGUAGES: LanguageCode[] = ['ja', 'en', 'zh-CN', 'zh-TW'];

// Work scope options (commonly used platforms)
const WORK_SCOPE_OPTIONS: MultiSelectOption[] = [
  { value: 'Win', label: 'Win' },
  { value: 'Mac', label: 'Mac' },
  { value: 'Front', label: 'Front' },
  { value: 'Back', label: 'Back' },
  { value: 'Android', label: 'Android' },
  { value: 'iOS', label: 'iOS' },
  { value: 'flutter', label: 'flutter' },
  { value: '기타', label: '기타' },
];

export default function TranslationTableV2({
  translations,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onContextUpdate,
  onScopeUpdate,
  onVersionUpdate,
  onWorkScopeUpdate,
  onDevCodeUpdate,
  onNotesUpdate,
  onPlatformCompletionUpdate,
  onDelete,
  onRefresh,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}: TranslationTableV2Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deploymentModalTranslation, setDeploymentModalTranslation] = useState<Translation | null>(null);

  const toggleSelectAll = () => {
    if (selectedIds.length === translations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(translations.map((t) => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getTranslationForLanguage = (
    translation: TranslationWithResults,
    languageCode: LanguageCode
  ): string => {
    const result = translation.translation_results?.find(
      (r) => r.language_code === languageCode
    );
    return result?.translated_text || '';
  };

  const handleBulkStatusChange = async (status: TranslationStatus) => {
    if (selectedIds.length === 0) return;

    try {
      const response = await fetch('/api/translations/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status }),
      });

      if (response.ok) {
        onRefresh();
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('Error bulk updating status:', error);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">로딩 중...</div>
    );
  }

  if (translations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        번역 항목이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-blue-700">
              {selectedIds.length}개 선택됨
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('reviewed')}
            >
              검수 완료로 변경
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatusChange('deployed')}
            >
              반영 완료로 변경
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === translations.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 min-w-[200px]">
                  원문 / 문맥
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 w-24">
                  Scope
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 w-28">
                  Version
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  Work Scope
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 w-32">
                  Dev Code
                </th>
                {TARGET_LANGUAGES.map((lang) => (
                  <th
                    key={lang}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-700 min-w-[180px]"
                  >
                    {SUPPORTED_LANGUAGES[lang]} ({lang})
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 min-w-[120px]">
                  Completion
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 min-w-[150px]">
                  Notes
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 w-28">
                  상태
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-700 w-20">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {translations.map((translation) => {
                const statusInfo = STATUS_COLORS[translation.status];
                return (
                  <tr
                    key={translation.id}
                    className={`
                      ${translation.status === 'pending' ? 'bg-yellow-50' : ''}
                      ${translation.status === 'reviewed' ? 'bg-white' : ''}
                      ${translation.status === 'deployed' ? 'bg-gray-50' : ''}
                      hover:bg-gray-100
                    `}
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(translation.id)}
                        onChange={() => toggleSelect(translation.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <EditableCell
                        value={translation.source_text}
                        onSave={(newText) => onSourceTextUpdate(translation.id, newText)}
                        placeholder="원문을 입력하세요"
                      />
                      <div className="mt-1">
                        <EditableCell
                          value={translation.context || ''}
                          onSave={(newContext) => onContextUpdate(translation.id, newContext)}
                          placeholder="문맥/설명 추가"
                          className="text-xs text-gray-500"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={translation.scope || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          onScopeUpdate(
                            translation.id,
                            value === '' ? null : (value as 'SaaS' | 'Solution')
                          );
                        }}
                        className="text-xs border rounded px-2 py-1 w-full bg-white"
                      >
                        <option value="">-</option>
                        <option value="SaaS">SaaS</option>
                        <option value="Solution">Solution</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <EditableCell
                        value={translation.version || ''}
                        onSave={(newVersion) => onVersionUpdate(translation.id, newVersion)}
                        placeholder="예: 2.0.0"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <MultiSelectDropdown
                        options={WORK_SCOPE_OPTIONS}
                        selected={translation.work_scope || []}
                        onChange={(selected) => onWorkScopeUpdate(translation.id, selected)}
                        placeholder="플랫폼 선택"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <EditableCell
                        value={translation.dev_code || ''}
                        onSave={(newDevCode) => onDevCodeUpdate(translation.id, newDevCode)}
                        placeholder="Dev Code"
                      />
                    </td>
                    {TARGET_LANGUAGES.map((lang) => (
                      <td key={lang} className="px-3 py-2 align-top">
                        <EditableCell
                          value={getTranslationForLanguage(translation, lang)}
                          onSave={(newText) =>
                            onTranslationUpdate(translation.id, lang, newText)
                          }
                          placeholder={`${SUPPORTED_LANGUAGES[lang]} 번역`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      <DeploymentProgressCell
                        translation={translation}
                        onOpenDeploymentModal={setDeploymentModalTranslation}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <EditableCell
                        value={translation.notes || ''}
                        onSave={(newNotes) => onNotesUpdate(translation.id, newNotes)}
                        placeholder="메모 추가"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        value={translation.status}
                        onChange={(e) =>
                          onStatusChange(translation.id, e.target.value as TranslationStatus)
                        }
                        className={`text-xs border rounded px-2 py-1 ${statusInfo.bg} ${statusInfo.text}`}
                      >
                        <option value="pending">번역 요청</option>
                        <option value="reviewed">검수 완료</option>
                        <option value="deployed">반영 완료</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(translation.id)}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              이전
            </Button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* Deployment Check Modal */}
      {deploymentModalTranslation && (
        <DeploymentCheckModal
          isOpen={true}
          translation={deploymentModalTranslation}
          onClose={() => setDeploymentModalTranslation(null)}
          onUpdate={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
