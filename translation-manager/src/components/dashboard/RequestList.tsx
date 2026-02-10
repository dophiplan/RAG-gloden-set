'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardRequest } from '@/types/translations';
import { TranslationStatus, PRIORITY_LABELS } from '@/types/translations';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';

interface RequestListProps {
  requests: DashboardRequest[];
  loading?: boolean;
  onStatusChange?: (id: string, newStatus: TranslationStatus) => Promise<void>;
}

export default function RequestList({ requests, loading = false, onStatusChange }: RequestListProps) {
  const [activeTab, setActiveTab] = useState<TranslationStatus>('pending');
  const [startingId, setStartingId] = useState<string | null>(null);

  const tabs = [
    { status: 'pending' as const, label: '요청' },
    { status: 'in_progress' as const, label: '진행중' },
    { status: 'reviewed' as const, label: '검수중' },
    { status: 'deployed' as const, label: '반영완료' },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleStartWork = async (id: string) => {
    if (!onStatusChange) return;

    setStartingId(id);
    try {
      await onStatusChange(id, 'in_progress');
    } catch (error) {
      console.error('Failed to start work:', error);
    } finally {
      setStartingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>요청 리스트</CardTitle>
        </CardHeader>
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7BC96F]"></div>
          <p className="mt-4 text-[#64748B]">로딩 중...</p>
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

  // Filter requests by active tab
  const filteredRequests = requests.filter(req => req.status === activeTab);

  return (
    <Card padding="none">
      <CardHeader className="px-6 pt-6">
        <CardTitle>요청 리스트</CardTitle>
      </CardHeader>

      {/* Tab Navigation */}
      <div className="px-6 flex border-b border-[#C8E6C9]">
        {tabs.map(tab => (
          <button
            key={tab.status}
            onClick={() => setActiveTab(tab.status)}
            className={`
              px-4 py-2 font-semibold text-sm transition-all
              ${
                activeTab === tab.status
                  ? 'border-b-2 border-[#7BC96F] text-[#5FA654]'
                  : 'text-[#64748B] hover:text-[#5FA654]'
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
              <th className="text-left">중요도</th>
              <th className="text-left">제품</th>
              <th className="text-left">제품분류</th>
              <th className="text-left">버전</th>
              <th className="text-left">요청자</th>
              <th className="text-left">요청한 날짜</th>
              <th className="text-left">요청완료일</th>
              {activeTab === 'pending' && <th className="text-left">작업</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'pending' ? 8 : 7}>
                  최근 요청이 없습니다
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id}>
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
                  {activeTab === 'pending' && (
                    <td>
                      <Button
                        size="sm"
                        onClick={() => handleStartWork(request.id)}
                        loading={startingId === request.id}
                      >
                        시작
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
