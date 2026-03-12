'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: 'glossary' | 'translation';
  action?: 'import' | 'skip' | 'merge' | 'overwrite';
  // 추가 필드
  key?: string;
  product?: string;
  version?: string;
  platform?: string;
}

interface Props {
  entries: PreviewEntry[];
  onUpdateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
  onBulkAction?: (action: string, entryIds: string[]) => void;
}

export default function MigrationPreviewTable({
  entries,
  onUpdateEntry,
  onBulkAction,
}: Props) {
  const [activeTab, setActiveTab] = useState<'translation' | 'glossary'>('translation');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // 탭별 필터링
  const filteredEntries = entries.filter(e => 
    (e.category || e.suggested_category) === activeTab
  );

  // 페이지네이션
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  // 체크박스 토글
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // 전체 선택
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedEntries.map(e => e.id));
    }
  };

  // 번역관리 → 용어집 등록
  const handleRegisterGlossary = (entry: PreviewEntry) => {
    onUpdateEntry(entry.id, { category: 'glossary', action: 'import' });
  };

  // 용어집 → 번역 요청 (일괄)
  const handleRequestTranslation = () => {
    if (selectedIds.length === 0) {
      alert('번역을 요청할 항목을 선택해주세요.');
      return;
    }
    selectedIds.forEach(id => {
      onUpdateEntry(id, { category: 'translation', action: 'import' });
    });
    setSelectedIds([]);
    alert(`${selectedIds.length}개 항목을 번역관리로 이동했습니다.`);
  };

  // 중복 상태 배지
  const getDuplicateBadge = (status: 'exact' | 'similar' | 'new') => {
    const badges = {
      exact: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '동일 항목 있음' },
      similar: { bg: 'bg-blue-100', text: 'text-blue-800', label: '유사 항목 있음' },
      new: { bg: 'bg-green-100', text: 'text-green-800', label: '신규' },
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* 탭 전환 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('translation'); setSelectedIds([]); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'translation'
                ? 'bg-[#818CF8] text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            번역관리 ({entries.filter(e => (e.category || e.suggested_category) === 'translation').length})
          </button>
          <button
            onClick={() => { setActiveTab('glossary'); setSelectedIds([]); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'glossary'
                ? 'bg-[#818CF8] text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            용어집 ({entries.filter(e => (e.category || e.suggested_category) === 'glossary').length})
          </button>
        </div>

        {/* 용어집 탭에서 번역 요청 버튼 */}
        {activeTab === 'glossary' && selectedIds.length > 0 && (
          <Button onClick={handleRequestTranslation} variant="primary" size="sm">
            번역 요청 ({selectedIds.length}개)
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {activeTab === 'glossary' && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedEntries.length && paginatedEntries.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">KEY/ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">원문</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                  {activeTab === 'translation' ? '번역어' : '번역어(KO/EN/JA)'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">제품</th>
                {activeTab === 'translation' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">버전</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'translation' ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    {activeTab === 'glossary' && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(entry.id)}
                          onChange={() => toggleSelection(entry.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{entry.key || entry.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={entry.source_text}>
                      {entry.source_text}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {activeTab === 'translation' ? (
                        // 번역관리: 첫 번째 번역어만
                        Object.values(entry.translations)[0] || '-'
                      ) : (
                        // 용어집: 모든 번역어 요약
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(entry.translations).slice(0, 3).map(([lang, text]) => (
                            <span key={lang} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                              {lang.toUpperCase()}
                            </span>
                          ))}
                          {Object.keys(entry.translations).length > 3 && (
                            <span className="text-xs text-gray-400">+{Object.keys(entry.translations).length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.product || '-'}</td>
                    {activeTab === 'translation' && (
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.version || '-'}</td>
                    )}
                    <td className="px-4 py-3">
                      {getDuplicateBadge(entry.duplicate_status.status)}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'translation' ? (
                        // 번역관리: 용어집 등록 버튼
                        <Button
                          onClick={() => handleRegisterGlossary(entry)}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                        >
                          용어집 등록
                        </Button>
                      ) : (
                        // 용어집: 개별 번역 요청
                        <Button
                          onClick={() => onUpdateEntry(entry.id, { category: 'translation', action: 'import' })}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        >
                          번역 요청
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {currentPage} / {totalPages} 페이지 (총 {filteredEntries.length}개)
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
