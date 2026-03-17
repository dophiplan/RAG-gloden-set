'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getAllDisplayableLanguages } from '@/lib/product-languages';
// TranslationTablePagination import 제거 - 커스텀 페이지네이션 사용
import type { PreviewEntry, VersionEntries } from '../../contexts/MigrationContext';

// Debug logging helper - only in development
const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};

interface PreviewCommitStepProps {
  previewData?: PreviewEntry[];
  versionEntries?: VersionEntries;
  selectedIds: string[];
  isLoading?: boolean;
  onToggleSelected: (id: string) => void;
  onSelectAll: () => void;
  onClearSelected: () => void;
  onUpdateEntry: (id: string, updates: Partial<PreviewEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onBulkUpdate: (category: 'glossary' | 'translation') => void;
  onBulkDelete?: (ids: string[]) => void;
}

const ITEMS_PER_PAGE = 10;

export default function PreviewCommitStep({
  previewData,
  versionEntries,
  selectedIds,
  isLoading = false,
  onToggleSelected,
  onSelectAll,
  onClearSelected,
  onUpdateEntry,
  onDeleteEntry,
  onBulkUpdate,
  onBulkDelete,
}: PreviewCommitStepProps) {
  const hasVersionData = versionEntries && Object.keys(versionEntries).length > 0;
  const versions = hasVersionData ? Object.keys(versionEntries!) : [];
  const [activeVersion, setActiveVersion] = useState<string>('all');
  const [activeView, setActiveView] = useState<'basic' | 'translations'>('basic');
  const [currentPage, setCurrentPage] = useState(1);

  // 버전 목록이 변경될 때 activeVersion 업데이트
  useEffect(() => {
    if (versions.length > 0) {
      // 현재 선택된 버전이 유효하지 않으면 첫 번째 버전 또는 'all'로 설정
      if (activeVersion !== 'all' && !versions.includes(activeVersion)) {
        setActiveVersion(versions[0]);
      }
    } else {
      setActiveVersion('all');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, activeVersion]);

  const currentEntries = useMemo(() => {
    let entries: PreviewEntry[];
    if (hasVersionData && activeVersion !== 'all') {
      entries = versionEntries![activeVersion] || [];
    } else if (hasVersionData) {
      entries = Object.values(versionEntries!).flat();
    } else {
      entries = previewData || [];
    }
    // DEBUG: Log first entry (development only)
    if (entries.length > 0) {
      debug('[PreviewCommitStep] First entry:', {
        version: entries[0].version,
        product: entries[0].product,
        product_category: entries[0].product_category,
        key: entries[0].key,
        source_text: entries[0].source_text?.substring(0, 30)
      });
    }
    // Excel 순서 그대로 (첫 행이 첫 페이지)
    return entries;
  }, [hasVersionData, versionEntries, activeVersion, previewData]);

  const totalPages = Math.ceil(currentEntries.length / ITEMS_PER_PAGE);

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentEntries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentEntries, currentPage]);

  // FIXED: totalPages 감소 시 currentPage가 범위를 벗어나지 않도록 유효성 검증
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentEntries, totalPages, currentPage]);

  // 페이지 변경 시 선택 상태 초기화
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onClearSelected();
  };

  // 버전 변경 시 페이지 초기화
  const handleVersionChange = (version: string) => {
    setActiveVersion(version);
    setCurrentPage(1);
    onClearSelected();
  };

  // 모든 표시 가능한 언어 가져오기 (번역관리 테이블과 동일)
  const languages = useMemo(() => {
    return getAllDisplayableLanguages();
  }, []);

  const stats = useMemo(() => {
    const data = currentEntries;
    const total = data.length;
    const duplicateGlossary = data.filter((e) => e.existing_in_glossary).length;
    const newGlossary = data.filter((e) => e.category === 'glossary' && !e.existing_in_glossary).length;
    const duplicateTranslation = data.filter((e) => e.existing_in_translation).length;
    const newTranslation = data.filter((e) => !e.existing_in_glossary && !e.existing_in_translation && e.category === 'translation').length;
    return { total, duplicateGlossary, newGlossary, duplicateTranslation, newTranslation };
  }, [currentEntries]);

  // FIXED: isAllSelected를 현재 페이지 기준(paginatedEntries)으로 수정
  const isAllSelected = paginatedEntries.length > 0 && paginatedEntries.every(entry => selectedIds.includes(entry.id));

  // 상태 배지 스타일 - 텍스트 없이 색상만 표시
  const glossaryStatusDot = (entry: PreviewEntry) => {
    if (entry.existing_in_glossary) {
      return { color: 'bg-red-500', title: '중복 용어 (이미 용어집에 있음)' };
    }
    if (entry.category === 'glossary') {
      return { color: 'bg-emerald-500', title: '신규 용어집' };
    }
    return null;
  };

  const translationStatusDot = (entry: PreviewEntry) => {
    if (entry.existing_in_translation) {
      return { color: 'bg-orange-500', title: '중복 데이터 (이미 번역관리에 있음)' };
    }
    if (!entry.existing_in_glossary && !entry.existing_in_translation) {
      return { color: 'bg-blue-500', title: '신규 데이터' };
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-[#818CF8] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">미리보기 데이터를 불러오는 중...</p>
        </div>
      )}

      {/* Version Tabs */}
      {!isLoading && versions.length > 1 ? (
        <div className="flex items-center gap-2 border-b border-gray-200 pb-0">
          <button
            onClick={() => handleVersionChange('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeVersion === 'all' ? 'border-[#818CF8] text-[#818CF8]' : 'border-transparent text-gray-500'
            }`}
          >
            전체 {stats.total}
          </button>
          {versions.map((version) => (
            <button
              key={version}
              onClick={() => handleVersionChange(version)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeVersion === version ? 'border-[#818CF8] text-[#818CF8]' : 'border-transparent text-gray-500'
              }`}
            >
              {version}
              <span className="ml-1.5 text-xs text-gray-400">({versionEntries![version]?.length || 0})</span>
            </button>
          ))}
        </div>
      ) : !isLoading && (
        // 버전이 1개일 때: 탭 없이 텍스트만 표시
        <div className="text-xs font-medium text-gray-900 py-1">
          전체 {stats.total}
        </div>
      )}

      {/* 상단 영역: 통계 + 뷰 토글 */}
      {!isLoading && (
      <div className="flex items-center justify-between">
        {/* 좌측: 비어있음 (전체 개수는 탭에 표시) */}
        <div></div>
        
        {/* 우측: 통계 + 뷰 토글 */}
        <div className="flex items-center gap-4">
          {/* 통계 정보 - 검은색 텍스트 */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              중복 용어 {stats.duplicateGlossary}
            </span>
            <span className="flex items-center gap-1 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              신규 용어집 {stats.newGlossary}
            </span>
            <span className="flex items-center gap-1 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              신규 데이터 {stats.newTranslation}
            </span>
            <span className="flex items-center gap-1 text-gray-900">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              중복 데이터 {stats.duplicateTranslation}
            </span>
          </div>
          
          {/* 뷰 토글 - 번역 언어가 없으면 번역 정보 버튼 비활성화 */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('basic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'basic' 
                  ? 'bg-white text-[#818CF8] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ● 기본 정보
            </button>
            <button
              onClick={() => setActiveView('translations')}
              disabled={languages.length === 0}
              title={languages.length === 0 ? '매핑된 번역 언어가 없습니다' : ''}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'translations' 
                  ? 'bg-white text-[#818CF8] shadow-sm' 
                  : languages.length === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ● 번역 정보 {languages.length > 0 && `(${languages.length})`}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Table - 번역관리 스타일 */}
      <Card padding="none" className="overflow-hidden">
        {!isLoading && (
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              {activeView === 'basic' ? (
                <tr>
                  <th className="w-[80px] px-2 py-2 text-left font-medium text-gray-700 truncate">버전</th>
                  <th className="w-[100px] px-2 py-2 text-left font-medium text-gray-700 truncate">KEY/ID</th>
                  <th className="w-[200px] px-2 py-2 text-left font-medium text-gray-700 truncate">원문</th>
                  <th className="w-[100px] px-2 py-2 text-left font-medium text-gray-700 truncate">문맥</th>
                  <th className="w-[100px] px-2 py-2 text-left font-medium text-gray-700 truncate">설명</th>
                  <th className="w-[80px] px-2 py-2 text-left font-medium text-gray-700 truncate">플랫폼</th>
                  <th className="w-[60px] px-2 py-2 text-center font-medium text-gray-700 truncate">상태</th>
                  <th className="w-[70px] px-2 py-2 text-center font-medium text-gray-700 truncate">작업</th>
                </tr>
              ) : (
                <tr>
                  <th className="min-w-[200px] px-2 py-2 text-left font-medium text-gray-700 truncate">원문</th>
                  {languages.map((lang) => (
                    <th key={lang} className="min-w-[100px] px-2 py-2 text-left font-medium text-gray-700 truncate">
                      {lang.toUpperCase()}
                    </th>
                  ))}
                  <th className="w-[60px] px-2 py-2 text-center font-medium text-gray-700 truncate">상태</th>
                  <th className="w-[70px] px-2 py-2 text-center font-medium text-gray-700 truncate">작업</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={activeView === 'basic' ? 8 : 2 + languages.length} className="px-4 py-8 text-center text-gray-500">
                    미리보기 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const isGlossarySelected = entry.category === 'glossary';
                  const canAddToGlossary = !entry.existing_in_glossary;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/50">

                      {activeView === 'basic' ? (
                        <>
                          <td className="px-2 py-1.5 text-gray-600 truncate">{entry.version || '-'}</td>
                          <td className="px-2 py-1.5 text-gray-600 truncate" title={entry.key || '-'}>{entry.key || '-'}</td>
                          <td className="px-2 py-1.5 truncate" title={entry.source_text}>
                            <div className="text-xs font-medium truncate">{entry.source_text}</div>
                          </td>
                          <td className="px-2 py-1.5 text-gray-600 truncate" title={entry.context || '-'}>
                            {entry.context || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-gray-600 truncate" title={entry.note || '-'}>
                            {entry.note || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-gray-600 truncate">{entry.platform || '-'}</td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(() => {
                                const glossaryDot = glossaryStatusDot(entry);
                                const transDot = translationStatusDot(entry);
                                return (
                                  <>
                                    {glossaryDot && (
                                      <span
                                        className={`w-2 h-2 rounded-full ${glossaryDot.color}`}
                                        title={glossaryDot.title}
                                      />
                                    )}
                                    {transDot && (
                                      <span
                                        className={`w-2 h-2 rounded-full ${transDot.color}`}
                                        title={transDot.title}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => canAddToGlossary && onUpdateEntry(entry.id, { category: isGlossarySelected ? 'translation' : 'glossary' })}
                                disabled={!canAddToGlossary}
                                className={`p-1 rounded transition-colors ${
                                  !canAddToGlossary ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : isGlossarySelected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-600'
                                }`}
                                title={!canAddToGlossary ? '이미 용어집에 있음' : isGlossarySelected ? '용어집에 추가됨' : '용어집에 추가'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onDeleteEntry(entry.id)}
                                className="p-1 rounded transition-colors bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600"
                                title="삭제"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 truncate" title={entry.source_text}>
                            <div className="text-xs truncate">{entry.source_text}</div>
                          </td>
                          {languages.map((lang) => (
                            <td key={lang} className="px-2 py-1.5 text-gray-600 truncate" title={entry.translations?.[lang] || '-'}>
                              {entry.translations?.[lang] || '-'}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(() => {
                                const glossaryDot = glossaryStatusDot(entry);
                                const transDot = translationStatusDot(entry);
                                return (
                                  <>
                                    {glossaryDot && (
                                      <span
                                        className={`w-2 h-2 rounded-full ${glossaryDot.color}`}
                                        title={glossaryDot.title}
                                      />
                                    )}
                                    {transDot && (
                                      <span
                                        className={`w-2 h-2 rounded-full ${transDot.color}`}
                                        title={transDot.title}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => canAddToGlossary && onUpdateEntry(entry.id, { category: isGlossarySelected ? 'translation' : 'glossary' })}
                                disabled={!canAddToGlossary}
                                className={`p-1 rounded transition-colors ${
                                  !canAddToGlossary ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : isGlossarySelected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-600'
                                }`}
                                title={!canAddToGlossary ? '이미 용어집에 있음' : isGlossarySelected ? '용어집에 추가됨' : '용어집에 추가'}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onDeleteEntry(entry.id)}
                                className="p-1 rounded transition-colors bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600"
                                title="삭제"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </Card>

      {/* Pagination - 숫자 형태 */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            이전
          </button>
          
          <div className="flex items-center gap-1">
            {/* 첫 페이지 */}
            <button
              onClick={() => handlePageChange(1)}
              className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
                currentPage === 1 
                  ? 'bg-[#818CF8] text-white font-medium' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              1
            </button>
            
            {/* 왼쪽 생략 (...) */}
            {currentPage > 4 && (
              <span className="px-1 text-gray-400">...</span>
            )}
            
            {/* 중간 페이지들 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page !== 1 && page !== totalPages && page >= currentPage - 2 && page <= currentPage + 2)
              .map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
                    currentPage === page 
                      ? 'bg-[#818CF8] text-white font-medium' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ))}
            
            {/* 오른쪽 생략 (...) */}
            {currentPage < totalPages - 3 && (
              <span className="px-1 text-gray-400">...</span>
            )}
            
            {/* 마지막 페이지 */}
            {totalPages > 1 && (
              <button
                onClick={() => handlePageChange(totalPages)}
                className={`min-w-[28px] px-2 py-1 text-sm rounded transition-colors ${
                  currentPage === totalPages 
                    ? 'bg-[#818CF8] text-white font-medium' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {totalPages}
              </button>
            )}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            다음
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#818CF8] shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-white text-sm font-bold">
                  {selectedIds.length}
                </span>
                <span className="text-sm font-medium text-white">개 선택됨</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onBulkUpdate('glossary')}
                  className="bg-white text-[#818CF8] hover:bg-gray-100 font-medium"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  용어집에 추가
                </Button>
                {onBulkDelete && (
                  <>
                    <div className="w-px h-6 bg-white/30" />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onBulkDelete(selectedIds)}
                      className="bg-red-600 text-white hover:bg-red-700 border-red-600 font-medium"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      일괄 삭제
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
