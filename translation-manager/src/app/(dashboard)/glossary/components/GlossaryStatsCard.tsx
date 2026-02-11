'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { SUPPORTED_LANGUAGES } from '@/types';

interface GlossaryStats {
  total_terms: number;
  approved_terms: number;
  pending_terms: number;
  rejected_terms: number;
  used_terms: number;
  total_hits: number;
  hits_by_language: Record<string, number>;
  hits_this_week: number;
  hits_this_month: number;
  new_terms_this_week: number;
  new_terms_this_month: number;
  estimated_cost_saved: number;
}

/**
 * Statistics dashboard showing glossary usage and cost savings
 * Displays 4 key sections: Cost savings, Reuse stats, Trends, Language breakdown
 */
export default function GlossaryStatsCard() {
  const [stats, setStats] = useState<GlossaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/glossary/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching glossary stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">통계 로딩 중...</p>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  // Convert KRW (assuming 1 USD = 1300 KRW)
  const krwAmount = Math.round(stats.estimated_cost_saved * 1300);

  // Sort languages by hit count
  const sortedLanguages = Object.entries(stats.hits_by_language)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5 languages

  const totalLanguageHits = sortedLanguages.reduce((sum, [_, count]) => sum + count, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Cost Savings */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">💰</span>
            <h3 className="text-sm font-medium text-gray-700">예상 절약 비용</h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-600">
              ${stats.estimated_cost_saved.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              약 ₩{krwAmount.toLocaleString()}원
            </div>
            <p className="text-xs text-gray-400 mt-2">
              용어집 재사용 덕분에 AI 번역 비용 절감
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Reuse Statistics */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔄</span>
            <h3 className="text-sm font-medium text-gray-700">총 재사용 횟수</h3>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-green-600">
              {stats.total_hits.toLocaleString()}회
            </div>
            <div className="text-sm text-gray-500 mt-1">
              사용된 용어: {stats.used_terms}개 / 전체 {stats.approved_terms}개
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${stats.approved_terms > 0 ? (stats.used_terms / stats.approved_terms) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Trends */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📊</span>
            <h3 className="text-sm font-medium text-gray-700">기간별 추세</h3>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs text-gray-500">이번 주 신규 용어</div>
              <div className="text-lg font-semibold text-blue-600">
                {stats.new_terms_this_week}개
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">이번 달 신규 용어</div>
              <div className="text-lg font-semibold text-purple-600">
                {stats.new_terms_this_month}개
              </div>
            </div>
            {stats.pending_terms > 0 && (
              <div className="text-xs text-yellow-600 font-medium">
                ⚠️ {stats.pending_terms}개 검수 대기
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Language Breakdown */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🌐</span>
            <h3 className="text-sm font-medium text-gray-700">언어별 재사용</h3>
          </div>
          <div className="mt-3 space-y-2">
            {sortedLanguages.length > 0 ? (
              sortedLanguages.map(([langCode, count]) => {
                const percentage = totalLanguageHits > 0 ? ((count / totalLanguageHits) * 100).toFixed(0) : 0;
                return (
                  <div key={langCode} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {SUPPORTED_LANGUAGES[langCode as keyof typeof SUPPORTED_LANGUAGES] || langCode}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-indigo-600 h-1.5 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-gray-500 text-xs w-12 text-right">
                        {count}회 ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400">아직 재사용 기록이 없습니다</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
