'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EditableCell from '@/components/EditableCell';
import EditableProductVersionCell from '@/components/EditableProductVersionCell';
import MultiProductSelect from '@/components/MultiProductSelect';
import Input from '@/components/ui/Input';
import { Translation, TranslationResult, TranslationStatus, SUPPORTED_LANGUAGES, LanguageCode, STATUS_COLORS, TranslationAuditLog, ProductCode, TranslationProduct } from '@/types';

interface TranslationWithResults extends Translation {
  translation_results: TranslationResult[];
  last_audit?: TranslationAuditLog;
}

interface TranslationTableProps {
  translations: TranslationWithResults[];
  onStatusChange: (id: string, status: TranslationStatus) => Promise<void>;
  onTranslationUpdate: (translationId: string, languageCode: LanguageCode, text: string) => Promise<void>;
  onSourceTextUpdate: (translationId: string, sourceText: string) => Promise<void>;
  onVersionUpdate: (translationId: string, version: string) => Promise<void>;
  onProductsUpdate: (translationId: string, products: { code: ProductCode; version: string }[]) => Promise<void>;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onAddToGlossary?: (sourceText: string) => void;
  loading?: boolean;
}

const ALL_LANGUAGES = Object.keys(SUPPORTED_LANGUAGES).filter(
  (code) => code !== 'ko'
) as LanguageCode[];

export default function TranslationTable({
  translations,
  onStatusChange,
  onTranslationUpdate,
  onSourceTextUpdate,
  onVersionUpdate,
  onProductsUpdate,
  onDelete,
  onRefresh,
  onAddToGlossary,
  loading = false,
}: TranslationTableProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showBulkProductModal, setShowBulkProductModal] = useState(false);
  const [bulkProducts, setBulkProducts] = useState<ProductCode[]>([]);
  const [bulkVersion, setBulkVersion] = useState('');

  const toggleLanguage = (lang: LanguageCode) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

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

  const handleAITranslate = useCallback(async () => {
    if (selectedIds.length === 0 || selectedLanguages.length === 0) {
      alert('번역할 항목과 언어를 선택해주세요.');
      return;
    }

    setIsTranslating(true);
    try {
      const selectedTranslations = translations.filter((t) =>
        selectedIds.includes(t.id)
      );

      for (const translation of selectedTranslations) {
        const response = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            translationId: translation.id,
            sourceText: translation.source_text,
            context: translation.context,
            targetLanguages: selectedLanguages,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'AI 번역에 실패했습니다.');
        }
      }

      onRefresh();
      setSelectedIds([]);
    } catch (error) {
      console.error('AI translation error:', error);
      alert(error instanceof Error ? error.message : 'AI 번역 중 오류가 발생했습니다.');
    } finally {
      setIsTranslating(false);
    }
  }, [selectedIds, selectedLanguages, translations, onRefresh]);

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

  const handleBulkProductUpdate = async () => {
    if (selectedIds.length === 0 || bulkProducts.length === 0) {
      alert('번역과 제품을 선택해주세요.');
      return;
    }

    try {
      const productCodes = bulkProducts.map((code) => ({
        code,
        version: bulkVersion.trim() || undefined,
      }));

      const response = await fetch('/api/translations/bulk-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, product_codes: productCodes }),
      });

      if (response.ok) {
        onRefresh();
        setSelectedIds([]);
        setShowBulkProductModal(false);
        setBulkProducts([]);
        setBulkVersion('');
      }
    } catch (error) {
      console.error('Error bulk updating products:', error);
      alert('제품 일괄 변경 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      {/* Language Selection */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-gray-700">번역 대상 언어:</span>
          <div className="flex flex-wrap gap-3">
            {ALL_LANGUAGES.map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLanguages.includes(lang)}
                  onChange={() => toggleLanguage(lang)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {SUPPORTED_LANGUAGES[lang]} ({lang})
                </span>
              </label>
            ))}
          </div>
          <div className="ml-auto">
            <Button
              onClick={handleAITranslate}
              disabled={selectedIds.length === 0 || selectedLanguages.length === 0 || isTranslating}
              loading={isTranslating}
              size="sm"
            >
              🤖 선택 항목 AI 번역
            </Button>
          </div>
        </div>
      </div>

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
              onClick={() => setShowBulkProductModal(true)}
            >
              제품 일괄 변경
            </Button>
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

          {/* Bulk Product Update Modal */}
          {showBulkProductModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">제품 일괄 변경</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      제품 선택
                    </label>
                    <MultiProductSelect
                      selectedProducts={bulkProducts}
                      onProductsChange={setBulkProducts}
                    />
                  </div>
                  <div>
                    <Input
                      label="버전 (선택사항)"
                      value={bulkVersion}
                      onChange={(e) => setBulkVersion(e.target.value)}
                      placeholder="예: 2.0.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      모든 선택된 제품에 동일한 버전이 적용됩니다
                    </p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleBulkProductUpdate}>
                      적용
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowBulkProductModal(false);
                        setBulkProducts([]);
                        setBulkVersion('');
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-700 min-w-[200px]">
                  원문 (ko)
                </th>
                {selectedLanguages.map((lang) => (
                  <th
                    key={lang}
                    className="px-3 py-3 text-left text-sm font-medium text-gray-700 min-w-[200px]"
                  >
                    {SUPPORTED_LANGUAGES[lang]} ({lang})
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-700 w-32">
                  버전
                </th>
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-700 min-w-[150px]">
                  제품
                </th>
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-700 w-28">
                  상태
                </th>
                <th className="px-3 py-3 text-left text-sm font-medium text-gray-700 w-40">
                  마지막 수정
                </th>
                <th className="px-3 py-3 text-right text-sm font-medium text-gray-700 w-20">
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
                      {translation.context && (
                        <p className="text-xs text-gray-500 mt-1 px-2">
                          📝 {translation.context}
                        </p>
                      )}
                      {onAddToGlossary && (
                        <button
                          onClick={() => onAddToGlossary(translation.source_text)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1 px-2"
                        >
                          + 용어집에 추가
                        </button>
                      )}
                    </td>
                    {selectedLanguages.map((lang) => (
                      <td key={lang} className="px-3 py-2 align-top">
                        <EditableCell
                          value={getTranslationForLanguage(translation, lang)}
                          onSave={(newText) =>
                            onTranslationUpdate(translation.id, lang, newText)
                          }
                          placeholder={`${SUPPORTED_LANGUAGES[lang]} 번역 필요`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      <EditableCell
                        value={translation.version || ''}
                        onSave={(newVersion) => onVersionUpdate(translation.id, newVersion)}
                        placeholder="예: 2.0.0"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <EditableProductVersionCell
                        products={translation.translation_products || []}
                        onSave={(newProducts) => onProductsUpdate(translation.id, newProducts)}
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
                        <option value="pending">🟡 번역 요청</option>
                        <option value="reviewed">⚪ 검수 완료</option>
                        <option value="deployed">🟢 반영 완료</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {translation.last_audit ? (
                        <div className="text-xs text-gray-500">
                          <div className="font-medium text-gray-700">
                            {translation.last_audit.user_name || translation.last_audit.user_email || '알 수 없음'}
                          </div>
                          <div>{formatDate(translation.last_audit.created_at)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
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
    </div>
  );
}
