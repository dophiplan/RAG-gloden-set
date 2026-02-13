'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardRequest } from '@/types/translations';
import { TranslationStatus, PRIORITY_LABELS } from '@/types/translations';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import { showSuccess, showError } from '@/lib/notifications';
import { TIMEOUTS } from '@/lib/constants';

interface RequestListProps {
  requests: DashboardRequest[];
  loading?: boolean;
  onStatusChange?: (id: string, newStatus: TranslationStatus) => Promise<void>;
}

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
  const handleTabChange = (status: TranslationStatus) => {
    setActiveTab(status);
    setSelectedRequests(new Set());
  };

  // Filter requests by active tab
  const filteredRequests = requests.filter(req => req.status === activeTab);

  // Check if all current filtered requests are selected
  const allSelected = filteredRequests.length > 0 &&
    filteredRequests.every(req => selectedRequests.has(req.id));

  // Toggle all selection
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(filteredRequests.map(req => req.id)));
    }
  };

  // Toggle individual selection
  const toggleSelect = (requestId: string) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleRowClick = (request: DashboardRequest) => {
    // Navigate to translations page with request filter
    const params = new URLSearchParams({
      request_id: request.id,
    });

    // Also add product filter if available
    if (request.products.length > 0) {
      params.set('product', request.products[0].code);
    }

    router.push(`/translations?${params.toString()}`);
  };

  const handleStartWork = async (request: DashboardRequest) => {
    setStartingId(request.id);

    try {
      const response = await fetch(`/api/dashboard/requests/${request.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      if (!response.ok) {
        throw new Error('Failed to start work');
      }

      const result = await response.json();

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
      if (request.products.length > 0) {
        params.set('product', request.products[0].code);
      }
      router.push(`/translations?${params.toString()}`);

      // Auto-clear undo info after expiry
      setTimeout(() => setUndoInfo(null), TIMEOUTS.UNDO_NOTIFICATION_DURATION_MS);

    } catch (error) {
      console.error('Failed to start work:', error);
      showError('작업 시작에 실패했습니다');
    } finally {
      setStartingId(null);
    }
  };

  const handleUndo = async (info: any) => {
    try {
      const response = await fetch(`/api/dashboard/requests/${info.request_id}/status/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_status: info.old_status,
          undo_expires_at: info.undo_expires_at,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Undo failed');
      }

      setUndoInfo(null);
      showSuccess('실행 취소되었습니다');

      // Refresh the page
      window.location.reload();
    } catch (error: any) {
      showError(error.message || '실행 취소에 실패했습니다');
    }
  };

  const handleDelete = async (request: DashboardRequest) => {
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
      const response = await fetch(`/api/dashboard/requests/${request.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      showSuccess('요청이 삭제되었습니다');

      // Refresh the page
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to delete request:', error);
      showError(error.message || '요청 삭제에 실패했습니다');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRequests.size === 0) return;

    // Calculate total translations
    const selectedRequestsData = filteredRequests.filter(req =>
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
        fetch(`/api/dashboard/requests/${requestId}`, {
          method: 'DELETE',
        }).then(response => {
          if (!response.ok) {
            throw new Error(`Failed to delete request ${requestId}`);
          }
          return response.json();
        })
      );

      await Promise.all(deletePromises);

      showSuccess(`${selectedRequests.size}개의 요청이 삭제되었습니다`);

      // Clear selection and refresh
      setSelectedRequests(new Set());
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to delete requests:', error);
      showError(error.message || '일부 요청 삭제에 실패했습니다');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    reviewed: requests.filter(r => r.status === 'reviewed').length,
    deployed: requests.filter(r => r.status === 'deployed').length,
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
                <td colSpan={10}>
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
                      ? request.products.map(p => p.name).join(', ')
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
                        >
                          시작
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(request)}
                        disabled={deletingId === request.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                        title="삭제"
                        aria-label="삭제"
                      >
                        {deletingId === request.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="삭제 중"></div>
                        ) : (
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
                        )}
                      </button>
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
