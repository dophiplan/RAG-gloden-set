'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRollback } from '@/hooks/useRollback';
import RollbackConflictModal from '@/components/rollback/RollbackConflictModal';
import DiffView, { UserAvatar, getUserColors } from '@/components/rollback/DiffView';

// Page types for filtering
type PageType = 'all' | 'dashboard' | 'translations' | 'glossary' | 'users' | 'settings' | 'upload' | 'migration';

interface ChangeHistoryItem {
  id: string;
  entity_type: 'translation' | 'glossary' | 'user' | 'setting' | 'migration';
  entity_id: string;
  action: string;
  user_name: string | null;
  user_email: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  page_name: string;
  created_at: string;
  is_rolled_back?: boolean;
}

const pageOptions: Array<{ id: PageType; label: string }> = [
  { id: 'all', label: '전체 변경 이력' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'translations', label: '번역관리' },
  { id: 'glossary', label: '용어집' },
  { id: 'upload', label: '번역 요청' },
  { id: 'users', label: '사용자관리' },
  { id: 'migration', label: '데이터 마이그레이션' },
  { id: 'settings', label: '설정' },
];

const actionLabels: Record<string, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  reject: '거부',
  rollback: '복구',
  import: '가져오기',
  export: '낳내기',
};

const entityTypeLabels: Record<string, string> = {
  translation: '번역',
  glossary: '용어',
  user: '사용자',
  setting: '설정',
  migration: '마이그레이션',
};

export default function GlobalChangeHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageType>('all');
  const [history, setHistory] = useState<ChangeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageHistory, setPageHistory] = useState<Record<PageType, ChangeHistoryItem[]>>({
    all: [],
    dashboard: [],
    translations: [],
    glossary: [],
    users: [],
    settings: [],
    upload: [],
    migration: [],
  });
  
  // 선택된 이력 (diff 뷰용)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  
  // 롤백 상태 관리
  const [currentRollbackType, setCurrentRollbackType] = useState<'translation' | 'glossary'>('translation');
  
  const translationRollback = useRollback('translation', () => {
    fetchAllHistory();
    setSelectedItemId(null);
  });
  
  const glossaryRollback = useRollback('glossary', () => {
    fetchAllHistory();
    setSelectedItemId(null);
  });

  const supabase = createClient();
  
  // 현재 선택된 타입의 롤백 훅 반환
  const getCurrentRollback = () => {
    return currentRollbackType === 'translation' ? translationRollback : glossaryRollback;
  };

  // Fetch all change history
  const fetchAllHistory = async () => {
    setIsLoading(true);
    try {
      // Fetch from all audit log tables
      const [
        { data: translationLogs },
        { data: glossaryLogs },
      ] = await Promise.all([
        supabase
          .from('translation_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('glossary_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const allItems: ChangeHistoryItem[] = [
        ...(translationLogs || []).map((log: Record<string, unknown>) => ({
          id: log.id as string,
          entity_type: 'translation' as const,
          entity_id: (log.translation_id || log.entity_id) as string,
          action: log.action as string,
          user_name: log.user_name as string | null,
          user_email: (log.user_email || 'unknown') as string,
          field_name: log.field_name as string | null,
          old_value: log.old_value as string | null,
          new_value: log.new_value as string | null,
          page_name: 'translations',
          created_at: log.created_at as string,
          is_rolled_back: (log.is_rolled_back as boolean) || false,
        })),
        ...(glossaryLogs || []).map((log: Record<string, unknown>) => ({
          id: log.id as string,
          entity_type: 'glossary' as const,
          entity_id: log.glossary_term_id as string,
          action: log.action as string,
          user_name: log.user_name as string | null,
          user_email: (log.user_email || 'unknown') as string,
          field_name: log.field_name as string | null,
          old_value: log.old_value as string | null,
          new_value: log.new_value as string | null,
          page_name: 'glossary',
          created_at: log.created_at as string,
          is_rolled_back: (log.is_rolled_back as boolean) || false,
        })),
      ];

      // Sort by created_at desc
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setHistory(allItems.slice(0, 100));
      
      // Organize by page
      const byPage: Record<PageType, ChangeHistoryItem[]> = {
        all: allItems,
        dashboard: [],
        translations: (allItems || []).filter(i => i.page_name === 'translations'),
        glossary: (allItems || []).filter(i => i.page_name === 'glossary'),
        users: [],
        settings: [],
        upload: [],
        migration: [],
      };
      
      setPageHistory(byPage);
    } catch (error) {
      console.error('Failed to fetch change history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch history when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchAllHistory();
    }
  }, [isOpen]);

  // Prevent body scroll and dim sidebar when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.setAttribute('data-history-open', 'true');
    } else {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-history-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.removeAttribute('data-history-open');
    };
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const currentHistory = pageHistory[selectedPage] || [];
  const currentPageLabel = pageOptions.find(p => p.id === selectedPage)?.label || '변경 이력';
  
  // 선택된 아이템 찾기
  const selectedItem = useMemo(() => {
    return currentHistory.find(item => item.id === selectedItemId);
  }, [currentHistory, selectedItemId]);

  return (
    <>
      {/* Change History Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
        title="변경 이력"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline">변경 이력</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Right Side Panel - Google Style */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-900">변경 이력</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Page Selector */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
            조회할 페이지 선택
          </label>
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value as PageType)}
            style={{ 
              width: '100%', 
              padding: '10px 16px', 
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: 'white'
            }}
          >
            <option value="all">전체 변경 이력</option>
            <option value="dashboard">대시보드</option>
            <option value="translations">번역관리</option>
            <option value="glossary">용어집</option>
            <option value="upload">번역 요청</option>
            <option value="users">사용자관리</option>
            <option value="migration">데이터 마이그레이션</option>
            <option value="settings">설정</option>
          </select>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : (currentHistory || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 bg-white rounded-xl border border-gray-200">
              <svg className="w-12 h-12 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">
                {selectedPage === 'all' 
                  ? '변경 이력이 없습니다'
                  : `${pageOptions.find(p => p.id === selectedPage)?.label.replace(/^[^\s]+\s/, '')}의 변경 이력이 없습니다`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(currentHistory || []).map((item) => {
                const colors = getUserColors(item.user_name || item.user_email);
                const isSelected = selectedItemId === item.id;
                
                return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                  className={`bg-white p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? `${colors.border} shadow-md ring-1 ring-${colors.border.replace('border-', '')}` 
                      : 'border-gray-200 hover:border-amber-300 hover:shadow-sm'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserAvatar 
                        userName={item.user_name} 
                        userEmail={item.user_email} 
                        size="sm" 
                      />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.action === 'create' ? 'bg-green-100 text-green-700' :
                        item.action === 'update' ? 'bg-blue-100 text-blue-700' :
                        item.action === 'delete' ? 'bg-red-100 text-red-700' :
                        item.action === 'rollback' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {actionLabels[item.action] || item.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {entityTypeLabels[item.entity_type] || item.entity_type}
                      </span>
                      {selectedPage === 'all' && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {pageOptions.find(p => p.id === item.page_name)?.label.replace(/^[^\s]+\s/, '') || item.page_name}
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  {/* User Name Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                      {item.user_name || item.user_email}
                    </span>
                  </div>

                  {/* Diff View (when selected) */}
                  {isSelected && item.field_name && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      {/* Field Name Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {item.field_name}
                        </span>
                        <span className="text-xs text-gray-400">필드 변경 상세</span>
                      </div>
                      
                      {/* Diff View */}
                      <DiffView
                        oldValue={item.old_value || null}
                        newValue={item.new_value || null}
                        userName={item.user_name}
                        showInline={false}
                      />
                      
                      {/* Rollback Button - 선택된 항목에만 표시 */}
                      {!item.is_rolled_back && item.action !== 'rollback' && item.action !== 'delete' && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const targetType = item.entity_type === 'translation' ? 'translation' : 'glossary';
                              setCurrentRollbackType(targetType);
                              const rollback = targetType === 'translation' ? translationRollback : glossaryRollback;
                              
                              const result = await rollback.rollbackWithConfirm(
                                item.id,
                                item.entity_id,
                                { fieldName: item.field_name }
                              );
                              
                              if (result) {
                                fetchAllHistory();
                              }
                            }}
                            disabled={getCurrentRollback().isLoading || getCurrentRollback().isChecking}
                            className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            이 버전으로 롤백
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Collapsed View (not selected) */}
                  {!isSelected && item.field_name && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                          {item.field_name}
                        </span>
                        <span className="text-xs text-gray-400">클릭하여 변경 내용 보기</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {item.old_value || '(없음)'} → {item.new_value || '(없음)'}
                      </p>
                    </div>
                  )}

                  {/* Rollback indicator */}
                  {item.action === 'rollback' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-purple-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      이전 버전으로 복구됨
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
          <p className="text-xs text-gray-500">
            총 <span className="font-medium text-gray-900">{(currentHistory || []).length}</span>개의 변경 이력
          </p>
          <button
            onClick={() => fetchAllHistory()}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            새로고침
          </button>
        </div>
      </div>
      
      {/* Rollback Conflict Modal */}
      {translationRollback.showConflictModal && (
        <RollbackConflictModal
          isOpen={translationRollback.showConflictModal}
          conflicts={translationRollback.conflicts}
          onResolve={(resolution) => {
            translationRollback.resolveAndExecute(resolution);
          }}
        />
      )}
      
      {glossaryRollback.showConflictModal && (
        <RollbackConflictModal
          isOpen={glossaryRollback.showConflictModal}
          conflicts={glossaryRollback.conflicts}
          onResolve={(resolution) => {
            glossaryRollback.resolveAndExecute(resolution);
          }}
        />
      )}
    </>
  );
}
