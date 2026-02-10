'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Card, { CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import QuickActions from '@/components/dashboard/QuickActions';
import RequestList from '@/components/dashboard/RequestList';
import type { DashboardRequest } from '@/types/translations';

interface DashboardStats {
  total: number;
  pending: number;
  in_progress: number;
  reviewed: number;
  deployed: number;
  glossaryCount: number;
  recentActivity: {
    id: string;
    action: string;
    text: string;
    created_at: string;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [statsRes, requestsRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/dashboard/requests'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          setRequests(requestsData.requests);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleStatusChange = async (id: string, newStatus: import('@/types/translations').TranslationStatus) => {
    try {
      const response = await fetch(`/api/translations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Status change error:', error.error || 'Failed to update status');
        return;
      }

      // Refresh requests data
      const requestsRes = await fetch('/api/dashboard/requests');
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.requests);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="대시보드"
        subtitle="번역 현황을 한눈에 확인하세요."
      >
        <div className="flex flex-col items-center justify-center h-64">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-3 border-[#818CF8]"></div>
          <p className="mt-4 text-[#64748B]">로딩 중...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="대시보드"
      subtitle="번역 현황을 한눈에 확인하세요."
      quickActions={<QuickActions glossaryCount={stats?.glossaryCount} />}
    >
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#64748B]">전체 번역</p>
                <p className="text-3xl font-bold text-[#1E293B]">{stats?.total || 0}</p>
              </div>
              <div className="p-3 bg-[#E0E7FF] rounded-full">
                <svg className="w-6 h-6 text-[#818CF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-amber-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#64748B]">요청</p>
                <p className="text-3xl font-bold text-amber-600">{stats?.pending || 0}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-blue-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#64748B]">진행중</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.in_progress || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#64748B]">검수중</p>
                <p className="text-3xl font-bold text-[#475569]">{stats?.reviewed || 0}</p>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-full">
                <svg className="w-6 h-6 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-emerald-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#64748B]">반영완료</p>
                <p className="text-3xl font-bold text-emerald-600">{stats?.deployed || 0}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Request List - Full Width */}
        <div className="w-full">
          <RequestList requests={requests} loading={loading} onStatusChange={handleStatusChange} />
        </div>

        {/* Supported Languages */}
        <Card>
          <CardTitle>지원 언어</CardTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="info">한국어 (ko)</Badge>
            <Badge variant="info">English (en)</Badge>
            <Badge variant="info">日本語 (ja)</Badge>
            <Badge variant="info">中文简体 (zh-CN)</Badge>
            <Badge variant="info">中文繁體 (zh-TW)</Badge>
            <Badge variant="info">Español (es)</Badge>
            <Badge variant="info">Français (fr)</Badge>
            <Badge variant="info">Deutsch (de)</Badge>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
