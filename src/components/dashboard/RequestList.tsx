'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardRequest } from '@/types/translations';
import { TranslationStatus, PRIORITY_LABELS } from '@/types/translations';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import { showSuccess, showError } from '@/lib/notifications';
import { TIMEOUTS } from '@/lib/constants';
import { apiPatch, apiPost, apiDelete } from '@/lib/api-utils';

interface RequestListProps {
  requests: DashboardRequest[];
  loading?: boolean;
  onStatusChange?: (id: string, newStatus: TranslationStatus) => Promise<void>;
}

// User-friendly error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      return '네트워크 연결을 확인해주세요';
    }
    if (message.includes('unauthorized') || message.includes('403')) {
      return '접근 권한이 없습니다';
    }
    if (message.includes('not found') || message.includes('404')) {
      return '요청을 찾을 수 없습니다';
    }
    if (message.includes('timeout')) {
      return '요청 시간이 초과되었습니다. 다시 시도해주세요';
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '알 수 없는 오류가 발생했습니다';
};

export default function RequestList({ requests, loading = false, onStatusChange }: RequestListProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TranslationStatus>('pending');
  const [startingId, setStartingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [undoInfo, setUndoInfo] = useState<{
    request_id: string;
    old_status: string;
    undo_expires_at: string;
  } | null>(null);

  const tabs = [
    { status: 'pending' as const, label: '요청' },
    { status: 'in_progress' as const, label: '진행중' },
    { status: 'reviewed' as const, label: '검수중' },
    { status: 'deployed' as const, label: '반영완료' },
  ];

  // Clear selection when tab changes
  const handleTabChange = useCallback((status: TranslationStatus) => {
    setActiveTab(status);
    setSelectedRequests(new Set());
  }, []);

  // Filter requests by active tab
  const filteredRequests = (requests || []).filter(req => req.status === activeTab);

  // Check if all current filtered requests are selected
  const allSelected = filteredRequests.length > 0 &&
    filteredRequests.every(req => selectedRequests.has(req.id));

  // Toggle all selection
  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set((filteredRequests || []).map(req => req.id)));
    }
  }, [allSelected, filteredRequests]);

  // Toggle individual selection
  const toggleSelect = useCallback((requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  }, [selectedRequests]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleRowClick = useCallback((request: DashboardRequest) => {
    // Navigate to translations page with request filter
    const params = new URLSearchParams({
      request_id: request.id,
    });

    // Also add product filter if available
    if ((request.products || []).length > 0) {
      params.set('product', (request.products || [])[0]?.code);
    }

    router.push(`/translations?${params.toString()}`);
  }, [router]);

  const handleStartWork = useCallback(async (request: DashboardRequest) => {
    // Prevent multiple simultaneous clicks
    if (startingId) return;

    setStartingId(request.id);

    try {
      const result = await apiPatch<{ request_id: string; old_status: string; undo_expires_at: string }>(`/api/dashboard/requests/${request.id}/status`, {
        status: 'in_progress',
      });

      // Show success with undo option
      setUndoInfo(result);
      showSuccess('작업을 시작했습니다', {
        action: {
          label: '실행 취소',
          onClick: () => handleUndo(result),
        },
        duration: TIMEOUTS.UNDO_NOTIFICATION_DURATION_MS,
      });

      // Navigate to translations page with filter
      const params = new URLSearchParams({ request_id: request.id });
      if ((request.products || []).length > 0) {
        params.set('product', (request.products || [])[0]?.code);
      }
      router.push(`/translations?${params.toString()}`);

      // Auto-clear undo info after expiry
      setTimeout(() => setUndoInfo(null), TIMEOUTS.UNDO_NOTIFICATION_DURATION_MS);

    } catch (error) {
      console.error('Failed to start work:', error);
      const userMessage = getErrorMessage(error);
      showError(`작업 시작에 실패했습니다: ${userMessage}`);
    } finally {
      setStartingId(null);
    }
  }, [startingId, router]);

  const handleUndo = useCallback(async (info: {
    request_id: string;
    old_status: string;
    undo_expires_at: string;
  }) => {
    try {
      await apiPost(`/api/dashboard/requests/${info.request_id}/status/undo`, {
        old_status: info.old_status,
        undo_expires_at: info.undo_expires_at,
      });

      setUndoInfo(null);
      showSuccess('실행 취소되었습니다');

      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Undo failed:', error);
      const userMessage = getErrorMessage(error);
      showError(`실행 취소에 실패했습니다: ${userMessage}`);
    }
  }, []);

  const handleDelete = useCallback(async (request: DashboardRequest) => {
    // Prevent multiple simultaneous clicks
    if (deletingId) return;

    // Confirm deletion
    const confirmed = window.confirm(
      `이 요청을 삭제하시겠습니까?\n\n` +
      `- 텍스트 수: ${request.translation_count}개\n` +
      `- 요청자: ${request.requester.name || request.requester.email}\n\n` +
      `삭제된 데이터는 복구할 수 없습니다.`
    );

    if (!confirmed) return;

    setDeletingId(request.id);

    try {
      await apiDelete(`/api/dashboard/requests/${request.id}`);

      showSuccess('요청이 삭제되었습니다');

      // Refresh the page
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete request:', error);
      const userMessage = getErrorMessage(error);
      showError(`요청 삭제에 실패했습니다: ${userMessage}`);
    } finally {
      setDeletingId(null);
    }
  }, [deletingId]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRequests.size === 0 || isBulkDeleting) return;

    // Calculate total translations
    const selectedRequestsData = (filteredRequests || []).filter(req =>
      selectedRequests.has(req.id)
    );
    const totalTranslations = selectedRequestsData.reduce(
      (sum, req) => sum + req.translation_count,
      0
    );

    // Confirm deletion
    const confirmed = window.confirm(
      `선택한 ${selectedRequests.size}개의 요청을 삭제하시겠습니까?\n\n` +
      `- 총 텍스트 수: ${totalTranslations}개\n\n` +
      `삭제된 데이터는 복구할 수 없습니다.`
    );

    if (!confirmed) return;

    setIsBulkDeleting(true);

    try {
      // Delete all selected requests in parallel
      const deletePromises = Array.from(selectedRequests).map(requestId =>
        apiDelete(`/api/dashboard/requests/${requestId}`)
      );

      await Promise.all(deletePromises);

      showSuccess(`${selectedRequests.size}개의 요청이 삭제되었습니다`);

      // Clear selection and refresh
      setSelectedRequests(new Set());
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete requests:', error);
      const userMessage = getErrorMessage(error);
      showError(`요청 삭제에 실패했습니다: ${userMessage}`);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [selectedRequests, isBulkDeleting, filteredRequests]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>요청 리스트</CardTitle>
        </CardHeader>
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" role="status" aria-label="로딩 중"></div>
          <p className="mt-4 text-text-secondary">로딩 중...</p>
        </div>
      </Card>
    );
  }

  // Calculate counts for each tab
  const safeRequests = requests || [];
  const counts = {
    pending: (safeRequests || []).filter(r => r.status === 'pending').length,
    in_progress: (safeRequests || []).filter(r => r.status === 'in_progress').length,
    reviewed: (safeRequests || []).filter(r => r.status === 'reviewed').length,
    deployed: (safeRequests || []).filter(r => r.status === 'deployed').length,
  };

  return (
    <Card padding="none">
      <CardHeader className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle>요청 리스트</CardTitle>
          {selectedRequests.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedRequests.size}개 선택됨
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkDelete}
                loading={isBulkDeleting}
                disabled={isBulkDeleting}
                className="bg-red-50 text-red-600 hover:bg-red-100"
              >
                선택 항목 삭제
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Tab Navigation */}
      <div className="px-6 flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.status}
            onClick={() => handleTabChange(tab.status)}
            className={`
              px-4 py-2 font-semibold text-sm transition-all
              ${
                activeTab === tab.status
                  ? 'border-b-2 border-primary text-primary-active'
                  : 'text-text-secondary hover:text-primary-active'
              }
            `}
          >
            {tab.label} ({counts[tab.status]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th scope="col" className="w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  aria-label="모든 항목 선택"
                />
              </th>
              <th scope="col" className="text-left">중요도</th>
              <th scope="col" className="text-left">제품</th>
              <th scope="col" className="text-left">제품분류</th>
              <th scope="col" className="text-left">버전</th>
              <th scope="col" className="text-left">요청자</th>
              <th scope="col" className="text-left">요청한 날짜</th>
              <th scope="col" className="text-left">요청완료일</th>
              <th scope="col" className="text-left">텍스트 수</th>
              <th scope="col" className="text-left">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-text-secondary">
                  최근 요청이 없습니다
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => {
                    // Navigate if not pending (pending uses button instead)
                    if (activeTab !== 'pending') {
                      handleRowClick(request);
                    }
                  }}
                  className={activeTab !== 'pending' ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(request.id)}
                      onChange={() => toggleSelect(request.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      aria-label={`${request.id} 선택`}
                    />
                  </td>
                  <td>
                    <Badge className={PRIORITY_LABELS[request.priority].color}>
                      {request.priority}
                    </Badge>
                  </td>
                  <td>
                    {request.products.length > 0
                      ? (request.products || []).map(p => p.name).join(', ')
                      : '-'}
                  </td>
                  <td>
                    {request.products[0]?.category || '-'}
                  </td>
                  <td>
                    {request.products[0]?.version || '-'}
                  </td>
                  <td>
                    {request.requester.name || request.requester.email}
                  </td>
                  <td>{formatDate(request.request_date)}</td>
                  <td>
                    {request.deployed_at ? formatDate(request.deployed_at) : '-'}
                  </td>
                  <td className="font-semibold text-primary-active">
                    {request.translation_count}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between gap-4">
                      {activeTab === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartWork(request)}
                          loading={startingId === request.id}
                          disabled={startingId !== null}
                        >
                          시작
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(request)}
                        loading={deletingId === request.id}
                        disabled={deletingId !== null || startingId === request.id}
                        className="text-red-600 hover:bg-red-50 ml-auto"
                        title="삭제"
                        aria-label="삭제"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
