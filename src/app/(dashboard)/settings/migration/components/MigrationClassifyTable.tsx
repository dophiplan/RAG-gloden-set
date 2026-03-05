'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';

interface TranslationEntry {
  id: string;
  source_text: string;
  context?: string;
  key?: string;
  product?: string;
  platform?: string;
  version?: string;
  note?: string;
  translations: Record<string, string>;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
  };
  action?: 'import' | 'skip' | 'glossary';
  duplicate_action?: 'skip' | 'overwrite' | 'merge';
}

interface Props {
  entries: TranslationEntry[];
  onUpdateEntry: (id: string, updates: Partial<TranslationEntry>) => void;
  onBulkAction?: (action: 'skip' | 'glossary', entryIds: string[]) => void;
  versionEntries?: { [version: string]: TranslationEntry[] }; // 버전별 entries
}

// 지원 언어 목록 (ko 제외 - 원문과 동일)
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: 'JA' },
  { code: 'zh-CN', label: 'ZH-CN' },
  { code: 'zh-TW', label: 'ZH-TW' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
  { code: 'fr', label: 'FR' },
];

export default function MigrationClassifyTable({
  entries,
  onUpdateEntry,
  onBulkAction,
  versionEntries,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeVersion, setActiveVersion] = useState<string>(''); // 현재 선택된 버전 탭
  const itemsPerPage = 20;

  // 버전 목록
  const versions = versionEntries && Object.keys(versionEntries).length > 0 
    ? Object.keys(versionEntries) 
    : [];
  
  // 초기 버전 설정
  useEffect(() => {
    if (versions.length > 0 && !activeVersion) {
      setActiveVersion(versions[0]);
    }
  }, [versions, activeVersion]);

  // 현재 표시할 entries 결정
  let activeEntries: TranslationEntry[];
  
  if (versions.length > 0 && versionEntries && activeVersion && versionEntries[activeVersion]) {
    // 버전별 entries 사용
    activeEntries = versionEntries[activeVersion];
  } else {
    // 기본 entries 사용
    activeEntries = entries;
  }
  
  // 페이지네이션
  const totalPages = Math.ceil(activeEntries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = activeEntries.slice(startIndex, startIndex + itemsPerPage);

  // 체크박스 토글 (행 클릭 시)
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // 현재 페이지 선택 상태 계산
  const currentPageIds = paginatedEntries.map(e => e.id);
  const selectedCountOnPage = currentPageIds.filter(id => selectedIds.includes(id)).length;
  const isAllSelectedOnPage = selectedCountOnPage === currentPageIds.length && currentPageIds.length > 0;
  const isIndeterminate = selectedCountOnPage > 0 && selectedCountOnPage < currentPageIds.length;

  // 전체 선택/해제 (현재 페이지 기준)
  const toggleSelectAll = () => {
    if (isAllSelectedOnPage) {
      // 현재 페이지 항목만 해제
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // 현재 페이지 항목 추가 (중복 제거)
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  // 행 클릭 핸들러 (체크박스 토글)
  const handleRowClick = (id: string) => {
    toggleSelection(id);
  };

  // 일괴 제외
  const handleBulkSkip = () => {
    if (selectedIds.length === 0) {
      alert('제외할 항목을 선택해주세요.');
      return;
    }
    if (confirm(`${selectedIds.length}개 항목을 마이그레이션 대상에서 제외하시겠습니까?`)) {
      selectedIds.forEach(id => {
        onUpdateEntry(id, { action: 'skip' });
      });
      setSelectedIds([]);
    }
  };

  // 일괴 용어집 추가
  const handleBulkGlossary = () => {
    if (selectedIds.length === 0) {
      alert('용어집에 추가할 항목을 선택해주세요.');
      return;
    }
    if (confirm(`${selectedIds.length}개 항목을 번역관리와 용어집에 동시 추가하시겠습니까?`)) {
      selectedIds.forEach(id => {
        onUpdateEntry(id, { action: 'glossary' });
      });
      setSelectedIds([]);
    }
  };

  // 중복 상태 배지
  const getDuplicateBadge = (status: 'exact' | 'similar' | 'new') => {
    const badges = {
      exact: { bg: 'bg-red-100', text: 'text-red-800', label: '동일' },
      similar: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '유사' },
      new: { bg: 'bg-green-100', text: 'text-green-800', label: '신규' },
    };
    const badge = badges[status];
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // 액션 배지
  const getActionBadge = (action?: string) => {
    if (action === 'glossary') {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">용어집추가</span>;
    }
    if (action === 'skip') {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">제외</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">-</span>;
  };

  return (
    <div className="space-y-4">
      {/* 버전별 탭 */}
      {versions.length > 0 && (
        <div className="border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-1">
            {versions.map((version, index) => {
              const count = versionEntries?.[version]?.length || 0;
              const isActive = activeVersion === version;
              // 버전 값이 없으면 "기타 N"으로 표시
              const displayLabel = version && version.trim() !== '' ? version : `기타 ${index + 1}`;
              return (
                <button
                  key={version || `fallback-${index}`}
                  onClick={() => {
                    setActiveVersion(version);
                    setCurrentPage(1);
                    setSelectedIds([]);
                  }}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                    isActive
                      ? 'bg-[#818CF8] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {displayLabel}
                  <span className={`ml-1 text-xs ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 제외된 항목 수 표시 */}
      {entries.filter(e => e.action === 'skip').length > 0 && (
        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
          제외된 항목: {entries.filter(e => e.action === 'skip').length}개
          <button 
            onClick={() => entries.filter(e => e.action === 'skip').forEach(e => onUpdateEntry(e.id, { action: undefined }))}
            className="ml-2 text-blue-600 hover:underline"
          >
            모두 되살리기
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelectedOnPage}
                    ref={el => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">중복</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">제품분류</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">플랫폼</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">버전</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[200px]">원문</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">설명</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">KEY/ID</th>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <th key={lang.code} className="px-2 py-3 text-left text-xs font-semibold text-gray-700 w-16">
                    {lang.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">비고</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr 
                    key={entry.id} 
                    onClick={() => handleRowClick(entry.id)}
                    className={`hover:bg-gray-50 cursor-pointer ${entry.action === 'glossary' ? 'bg-blue-50' : ''} ${selectedIds.includes(entry.id) ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => toggleSelection(entry.id)}
                        className="rounded border-gray-300 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3">
                      {getDuplicateBadge(entry.duplicate_status.status)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">{entry.product || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{entry.platform || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{entry.version || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-900 max-w-xs truncate" title={entry.source_text}>
                      {entry.source_text}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate" title={entry.context}>
                      {entry.context || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 font-mono">{entry.key || entry.id.slice(0, 8)}</td>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <td key={lang.code} className="px-2 py-3 text-sm text-gray-600">
                        {entry.translations[lang.code] || '-'}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {entry.note || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        {/* 중복인 경우 중복 처리 방법 선택 */}
                        {entry.duplicate_status.status === 'exact' && (
                          <div className="flex items-center gap-1">
                            <select
                              value={entry.duplicate_action || 'skip'}
                              onChange={(e) => onUpdateEntry(entry.id, { 
                                duplicate_action: e.target.value as 'skip' | 'overwrite' | 'merge',
                                action: e.target.value === 'skip' ? 'skip' : 'import'
                              })}
                              className="text-xs border rounded px-2 py-1 bg-white"
                            >
                              <option value="skip">중복-걄너뛰기</option>
                              <option value="overwrite">중복-덮어쓰기</option>
                              <option value="merge">중복-병합</option>
                            </select>
                          </div>
                        )}
                        
                        {/* 일반 액션 버튼들 */}
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action)}
                          <div className="flex gap-1">
                            <Button
                              onClick={() => onUpdateEntry(entry.id, { action: 'glossary' })}
                              variant={entry.action === 'glossary' ? 'primary' : 'ghost'}
                              size="sm"
                              className="text-xs px-2 py-1"
                            >
                              용어집
                            </Button>
                            <Button
                              onClick={() => onUpdateEntry(entry.id, { action: 'skip' })}
                              variant="ghost"
                              size="sm"
                              className="text-xs px-2 py-1 text-red-600 hover:text-red-700"
                            >
                              제외
                            </Button>
                          </div>
                        </div>
                      </div>
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
              {currentPage} / {totalPages} 페이지 (총 {activeEntries.length}개)
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

      {/* 하단 액션 바 - 번역관리와 동일한 UI */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isAllSelectedOnPage}
                ref={el => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 w-4 h-4"
              />
              <span className="text-sm text-gray-700">
                {selectedIds.length}개 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleBulkGlossary} variant="primary" size="sm">
                용어집 추가
              </Button>
              <Button onClick={handleBulkSkip} variant="secondary" size="sm">
                제외
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
