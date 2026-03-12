'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { apiFetch } from '@/lib/api-utils';

// 중간 말줄임표 유틸리티 - 앞뒤 각각 prefix/suffix 글자 수 지정
function truncateMiddle(text: string, prefix: number = 8, suffix: number = 8): string {
  if (!text || text.length <= prefix + suffix + 3) return text || '';
  return text.slice(0, prefix) + '...' + text.slice(-suffix);
}

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
  glossaryIds?: string[]; // 용어집에 추가된 항목 ID들
}

interface Props {
  entries: TranslationEntry[];
  onUpdateEntry: (id: string, updates: Partial<TranslationEntry>) => void;
  onBulkAction?: (action: 'skip' | 'glossary', entryIds: string[]) => void;
  versionEntries?: { [version: string]: TranslationEntry[] }; // 버전별 entries
  products?: { code: string; name: string }[]; // 제품 목록
  selectedProduct?: string; // 선택된 제품 코드
}

export default function MigrationClassifyTable({
  entries,
  onUpdateEntry,
  onBulkAction,
  versionEntries,
  products,
  selectedProduct,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeVersion, setActiveVersion] = useState<string>(''); // 현재 선택된 버전 탭
  const [addingToGlossary, setAddingToGlossary] = useState<Set<string>>(new Set()); // 용어집 추가 중인 항목
  const [removingFromGlossary, setRemovingFromGlossary] = useState<Set<string>>(new Set()); // 용어집 삭제 중인 항목
  const itemsPerPage = 20;

  // 용어집에 항목 추가
  const addToGlossary = async (entry: TranslationEntry) => {
    if (addingToGlossary.has(entry.id)) return;
    
    setAddingToGlossary(prev => new Set(prev).add(entry.id));
    
    try {
      // 제품 코드 목록 - 선택된 제품만 사용
      const productCodes = selectedProduct ? [selectedProduct] : (entry.product ? [entry.product] : []);
      
      // 번역 언어 코드 목록
      const targetLanguages = Object.keys(entry.translations).filter(lang => lang !== 'ko');
      
      // 용어집 API 호출 - product_code도 함께 전달 (stats API 필터링용)
      const result = await apiFetch<{ terms: { id: string }[] }>('/api/glossary', {
        method: 'POST',
        body: JSON.stringify({
          sourceText: entry.source_text,
          context: entry.context,
          product_code: productCodes[0] || null,  // 첫 번째 제품을 주 제품으로
          product_codes: productCodes,
          targetLanguages: targetLanguages,
        }),
      });
      
      // 성공 시 action 업데이트 및 glossaryIds 저장
      const glossaryIds = result.terms?.map((t: { id: string }) => t.id) || [];
      onUpdateEntry(entry.id, { action: 'glossary', glossaryIds });
    } catch (error) {
      console.error('용어집 추가 실패:', error);
      alert('용어집 추가에 실패했습니다.');
    } finally {
      setAddingToGlossary(prev => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  // 용어집에서 항목 삭제
  const removeFromGlossary = async (entry: TranslationEntry) => {
    if (!entry.glossaryIds || entry.glossaryIds.length === 0) {
      // ID가 없으면 그냥 action만 변경
      onUpdateEntry(entry.id, { action: 'import' });
      return;
    }
    
    if (removingFromGlossary.has(entry.id)) return;
    
    setRemovingFromGlossary(prev => new Set(prev).add(entry.id));
    
    try {
      // 모든 glossary ID에 대해 삭제 API 호출
      await Promise.all(
        entry.glossaryIds!.map(id => 
          apiFetch(`/api/glossary/${id}`, { method: 'DELETE' })
        )
      );
      
      // 성공 시 action 업데이트 및 glossaryIds 제거
      onUpdateEntry(entry.id, { action: 'import', glossaryIds: undefined });
    } catch (error) {
      console.error('용어집 삭제 실패:', error);
      alert('용어집에서 삭제하는데 실패했습니다.');
    } finally {
      setRemovingFromGlossary(prev => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  // 실제 데이터에서 사용되는 언어 코드들 추출
  const getUsedLanguages = (): { code: string; label: string }[] => {
    const languageSet = new Set<string>();
    
    // 모든 entries에서 translations 키 수집
    const allEntries = versionEntries 
      ? Object.values(versionEntries).flat()
      : entries;
    
    allEntries.forEach(entry => {
      if (entry.translations) {
        Object.keys(entry.translations).forEach(langCode => {
          if (langCode !== 'ko') { // 원문과 동일한 한국어 제외
            languageSet.add(langCode);
          }
        });
      }
    });
    
    // 언어 코드 레이블 매핑
    const labelMap: Record<string, string> = {
      'en': 'EN',
      'ja': 'JA',
      'zh-CN': 'ZH-CN',
      'zh-TW': 'ZH-TW',
      'de': 'DE',
      'es': 'ES',
      'pt': 'PT',
      'fr': 'FR',
      'ko': 'KO',
    };
    
    return Array.from(languageSet).map(code => ({
      code,
      label: labelMap[code] || code.toUpperCase(),
    }));
  };

  const usedLanguages = getUsedLanguages();

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

  // 일괴 용어집 토글
  const handleBulkGlossaryToggle = () => {
    if (selectedIds.length === 0) return;
    
    // 선택된 항목들이 모두 용어집 상태인지 확인
    const allGlossary = selectedIds.every(id => {
      const entry = activeEntries.find(e => e.id === id);
      return entry?.action === 'glossary';
    });
    
    if (allGlossary) {
      // 모두 용어집이면 해제 (import로 변경)
      selectedIds.forEach(id => {
        onUpdateEntry(id, { action: 'import' });
      });
    } else {
      // 아니면 용어집 추가
      selectedIds.forEach(id => {
        onUpdateEntry(id, { action: 'glossary' });
      });
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

  // 액션 배지 (용어집추가 라벨 제거)
  const getActionBadge = (action?: string) => {
    if (action === 'skip') {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600">제외</span>;
    }
    return null; // glossary는 라벨 없음, 버튼으로 표시
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
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">제품분류</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">플랫폼</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">버전</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[200px]">원문</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">설명</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">KEY/ID</th>
                {usedLanguages.map(lang => (
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
                  <td colSpan={17} className="px-4 py-8 text-center text-gray-500">
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
                    <td className="px-3 py-3 text-sm text-gray-900">
                      {entry.product || activeVersion || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{entry.platform || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{entry.version || '-'}</td>
                    <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap overflow-hidden" title={entry.source_text}>
                      {truncateMiddle(entry.source_text, 10, 10)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap overflow-hidden" title={entry.context}>
                      {entry.context ? truncateMiddle(entry.context, 8, 8) : '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600 font-mono">{entry.key || entry.id.slice(0, 8)}</td>
                    {usedLanguages.map(lang => (
                      <td key={lang.code} className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap overflow-hidden" title={entry.translations[lang.code]}>
                        {entry.translations[lang.code] ? truncateMiddle(entry.translations[lang.code], 6, 6) : '-'}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {entry.note || '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        {/* 액션 버튼들 */}
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action)}
                          <div className="flex gap-1">
                            {/* 이미 용어집에 존재하는 경우 */}
                            {entry.duplicate_status.status === 'exact' ? (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                용어O
                              </span>
                            ) : (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (entry.action === 'glossary') {
                                    // 이미 추가됨 → 해제 (용어집에서 삭제)
                                    removeFromGlossary(entry);
                                  } else {
                                    // 용어집에 추가 (API 호출)
                                    addToGlossary(entry);
                                  }
                                }}
                                variant={entry.action === 'glossary' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="text-xs px-2 py-1"
                                loading={addingToGlossary.has(entry.id) || removingFromGlossary.has(entry.id)}
                                disabled={addingToGlossary.has(entry.id) || removingFromGlossary.has(entry.id)}
                              >
                                {entry.action === 'glossary' ? '추가됨' : '용어집'}
                              </Button>
                            )}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateEntry(entry.id, { action: 'skip' });
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-xs px-2 py-1 text-red-600 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
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
              <Button 
                onClick={handleBulkGlossaryToggle} 
                variant={selectedIds.every(id => activeEntries.find(e => e.id === id)?.action === 'glossary') ? 'secondary' : 'primary'}
                size="sm"
              >
                {selectedIds.every(id => activeEntries.find(e => e.id === id)?.action === 'glossary') ? '추가됨' : '용어집 추가'}
              </Button>
              <Button onClick={handleBulkSkip} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
