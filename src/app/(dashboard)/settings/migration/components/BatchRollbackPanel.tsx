'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-utils';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';

interface Batch {
  id: string;
  operation_type: string;
  user_name: string;
  description: string;
  affected_count: number;
  status: 'running' | 'completed' | 'rolled_back';
  started_at: string;
  completed_at: string | null;
  rolled_back_at: string | null;
}

interface BatchRollbackPanelProps {
  onRollbackComplete?: () => void;
}

export default function BatchRollbackPanel({ onRollbackComplete }: BatchRollbackPanelProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const result = await apiGet<{ batches?: Batch[]; message?: string }>('/api/rollback/batch?limit=50');
      setBatches(result.batches || []);
      // Silently handle empty batches - don't show error to user
    } catch (error) {
      console.error('[BatchRollback] Failed to fetch batches:', error);
      // Graceful degradation - show empty list
      setBatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleRollback = async (batch: Batch) => {
    const confirmed = await showConfirm(
      `"${batch.description}" 작업을 롤백하시겠습니까?\n${batch.affected_count}개 항목이 복구됩니다.`
    );
    
    if (!confirmed) return;

    setIsRollingBack(batch.id);
    try {
      const result = await apiPost<{
        success?: boolean;
        hasConflict?: boolean;
        message?: string;
        successCount?: number;
        failCount?: number;
      }>('/api/rollback/batch', {
        batchId: batch.id,
      });

      if (result.hasConflict) {
        showError('일부 항목에 충돌이 있습니다. 개별적으로 롤백해주세요.');
        return;
      }

      if (result.success) {
        showSuccess(result.message || '롤백이 완료되었습니다.');
        await fetchBatches();
        onRollbackComplete?.();
      } else {
        showError(result.message || '롤백에 실패했습니다.');
      }
    } catch (error) {
      console.error('[BatchRollback] Error:', error);
      showError('롤백 중 오류가 발생했습니다.');
    } finally {
      setIsRollingBack(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">완료</span>;
      case 'rolled_back':
        return <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">롤백됨</span>;
      case 'running':
        return <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">진행중</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{status}</span>;
    }
  };

  const displayBatches = showAll ? batches : batches.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">배치 작업 롤백</h3>
          <p className="text-sm text-gray-500">마이그레이션 등 대량 작업을 한 번에 되돌릴 수 있습니다</p>
        </div>
        <button
          onClick={fetchBatches}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="새로고침"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">배치 작업이 없습니다</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayBatches.map((batch) => (
              <div
                key={batch.id}
                className={`p-4 rounded-lg border ${
                  batch.status === 'rolled_back'
                    ? 'bg-purple-50 border-purple-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(batch.status)}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {batch.description}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <p>작업자: {batch.user_name || 'Unknown'}</p>
                      <p>항목 수: {batch.affected_count}개</p>
                      <p>시작: {formatDate(batch.started_at)}</p>
                      {batch.rolled_back_at && (
                        <p className="text-purple-600">
                          롤백: {formatDate(batch.rolled_back_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {batch.status === 'completed' && (
                    <button
                      onClick={() => handleRollback(batch)}
                      disabled={isRollingBack === batch.id}
                      className="ml-4 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isRollingBack === batch.id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                          처리중
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          롤백
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {batches.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {showAll ? '접기' : `더보기 (${batches.length - 5}개)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
