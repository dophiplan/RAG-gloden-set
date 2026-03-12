'use client';

import React, { useMemo } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  action: 'import' | 'skip' | 'merge' | 'overwrite';
  category?: 'glossary' | 'translation';
}

interface PreviewCommitStepProps {
  previewData: Array<{
    id: string;
    source_text: string;
    context?: string;
    translations: Record<string, string>;
    suggested_category: 'glossary' | 'translation';
    category?: 'glossary' | 'translation';
    duplicate_status: { status: 'exact' | 'similar' | 'new' };
    action: 'import' | 'skip' | 'merge' | 'overwrite';
  }>;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSelectAll: () => void;
  onClearSelected: () => void;
  onUpdateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
  onBulkUpdate: (action: string) => void;
}

export default function PreviewCommitStep({
  previewData,
  selectedIds,
  onToggleSelected,
  onSelectAll,
  onClearSelected,
  onUpdateEntry,
  onBulkUpdate,
}: PreviewCommitStepProps) {
  // Calculate stats
  const stats = useMemo(() => {
    const total = previewData.length;
    const glossary = previewData.filter(
      (e) => (e.category || e.suggested_category) === 'glossary'
    ).length;
    const translation = previewData.filter(
      (e) => (e.category || e.suggested_category) === 'translation'
    ).length;
    const duplicates = previewData.filter(
      (e) => e.duplicate_status.status === 'exact' || e.duplicate_status.status === 'similar'
    ).length;

    return { total, glossary, translation, duplicates };
  }, [previewData]);

  // Get all available languages from translations
  const languages = useMemo(() => {
    const langSet = new Set<string>();
    previewData.forEach((entry) => {
      Object.keys(entry.translations).forEach((lang) => langSet.add(lang));
    });
    return Array.from(langSet);
  }, [previewData]);

  // Duplicate status badge
  const getDuplicateBadge = (status: 'exact' | 'similar' | 'new') => {
    const badges = {
      exact: {
        variant: 'error' as const,
        label: '동일 항목',
        className: 'bg-red-50 text-red-700 border-red-100',
      },
      similar: {
        variant: 'warning' as const,
        label: '유사 항목',
        className: 'bg-amber-50 text-amber-700 border-amber-100',
      },
      new: {
        variant: 'success' as const,
        label: '신규',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
    };
    return badges[status];
  };

  // Category badge
  const getCategoryBadge = (category: 'glossary' | 'translation') => {
    return category === 'glossary'
      ? { label: '용어집', className: 'bg-[#818CF8] text-white' }
      : { label: '번역관리', className: 'bg-blue-500 text-white' };
  };

  // Check if all entries are selected
  const isAllSelected =
    previewData.length > 0 && selectedIds.size === previewData.length;

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="bg-[#818CF8] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <span className="text-[#818CF8] font-semibold text-sm">3</span>
          </div>
          <h2 className="text-lg font-semibold text-white">텍스트 확인</h2>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">전체</p>
          </div>
          <div className="bg-[#818CF8]/10 rounded-lg p-4 text-center border border-[#818CF8]/20">
            <p className="text-2xl font-bold text-[#818CF8]">{stats.glossary}</p>
            <p className="text-sm text-gray-600 mt-1">용어집</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
            <p className="text-2xl font-bold text-blue-600">{stats.translation}</p>
            <p className="text-sm text-gray-600 mt-1">번역관리</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-100">
            <p className="text-2xl font-bold text-amber-600">{stats.duplicates}</p>
            <p className="text-sm text-gray-600 mt-1">중복/유사</p>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={isAllSelected ? onClearSelected : onSelectAll}
              className="w-4 h-4 rounded border-gray-300 text-[#818CF8] focus:ring-[#818CF8]"
            />
            <span className="text-sm text-gray-700">
              {selectedIds.size > 0
                ? `${selectedIds.size}개 선택됨`
                : '전체 선택'}
            </span>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onBulkUpdate('import')}
              >
                가져오기
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onBulkUpdate('skip')}
              >
                건 너뛰기
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onBulkUpdate('merge')}
              >
                병합
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onBulkUpdate('overwrite')}
              >
                덮어쓰기
              </Button>
            </div>
          )}
        </div>

        {/* Preview Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={isAllSelected ? onClearSelected : onSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-[#818CF8] focus:ring-[#818CF8]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    원문
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    컨텍스트
                  </th>
                  {languages.map((lang) => (
                    <th
                      key={lang}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700"
                    >
                      {lang.toUpperCase()}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    중복 상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    분류
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + languages.length}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      미리보기 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  previewData.map((entry) => {
                    const isSelected = selectedIds.has(entry.id);
                    const duplicateBadge = getDuplicateBadge(
                      entry.duplicate_status.status
                    );
                    const categoryBadge = getCategoryBadge(
                      entry.category || entry.suggested_category
                    );

                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-[#818CF8]/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelected(entry.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#818CF8] focus:ring-[#818CF8]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={entry.source_text}>
                            {entry.source_text}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <div
                            className="truncate"
                            title={entry.context || '-'}
                          >
                            {entry.context || '-'}
                          </div>
                        </td>
                        {languages.map((lang) => (
                          <td
                            key={lang}
                            className="px-4 py-3 text-sm text-gray-600 max-w-xs"
                          >
                            <div
                              className="truncate"
                              title={entry.translations[lang] || '-'}
                            >
                              {entry.translations[lang] || '-'}
                            </div>
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${duplicateBadge.className}`}
                          >
                            {duplicateBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${categoryBadge.className}`}
                          >
                            {categoryBadge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Count Footer */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-[#818CF8]/10 border border-[#818CF8]/20 rounded-lg px-4 py-3">
            <span className="text-sm text-gray-700">
              <span className="font-semibold text-[#818CF8]">
                {selectedIds.size}개
              </span>{' '}
              항목이 선택됨
            </span>
            <button
              onClick={onClearSelected}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              선택 해제
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
