'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';

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

interface GlossaryStatsCardProps {
  selectedProduct?: ProductCode | null;
}

/**
 * Statistics dashboard showing glossary usage and cost savings
 * Displays 4 key sections: Cost savings, Reuse stats, Trends, Language breakdown
 * Can be filtered by product
 */
export default function GlossaryStatsCard({ selectedProduct }: GlossaryStatsCardProps) {
  const [stats, setStats] = useState<GlossaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [selectedProduct]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProduct) {
        params.set('product_code', selectedProduct);
      }
      const response = await fetch(`/api/glossary/stats?${params}`);
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
        <div className="p-4 text-center">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
          <p className="mt-1 text-xs text-gray-500">통계 로딩 중...</p>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Cost Savings */}
      <Card>
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-lg">💰</span>
            <h3 className="text-xs font-medium text-gray-700">예상 절약 비용</h3>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-indigo-600">
              ${stats.estimated_cost_saved.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              약 ₩{krwAmount.toLocaleString()}원
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              용어집 재사용으로 비용 절감
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Reuse Statistics */}
      <Card>
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-lg">🔄</span>
            <h3 className="text-xs font-medium text-gray-700">총 재사용 횟수</h3>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-green-600">
              {stats.total_hits.toLocaleString()}회
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              사용: {stats.used_terms}개 / {stats.approved_terms}개
            </div>
            <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-600 h-1.5 rounded-full"
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
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-lg">📊</span>
            <h3 className="text-xs font-medium text-gray-700">기간별 추세</h3>
          </div>
          <div className="mt-2 space-y-2">
            <div>
              <div className="text-xs text-gray-500">이번 주 신규</div>
              <div className="text-base font-semibold text-blue-600">
                {stats.new_terms_this_week}개
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">이번 달 신규</div>
              <div className="text-base font-semibold text-purple-600">
                {stats.new_terms_this_month}개
              </div>
            </div>
            {stats.pending_terms > 0 && (
              <div className="text-xs text-yellow-600 font-medium mt-1">
                ⚠️ {stats.pending_terms}개 검수 대기
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Language Breakdown */}
      <Card>
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-lg">🌐</span>
            <h3 className="text-xs font-medium text-gray-700">언어별 재사용</h3>
          </div>
          <div className="mt-2 space-y-1.5">
            {sortedLanguages.length > 0 ? (
              sortedLanguages.map(([langCode, count]) => {
                const percentage = totalLanguageHits > 0 ? ((count / totalLanguageHits) * 100).toFixed(0) : 0;
                return (
                  <div key={langCode} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {SUPPORTED_LANGUAGES[langCode as keyof typeof SUPPORTED_LANGUAGES] || langCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-indigo-600 h-1 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-gray-500 text-xs w-10 text-right">
                        {count}회
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400">재사용 기록 없음</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
