'use client';

import { useEffect, useState, memo } from 'react';
import Card from '@/components/ui/Card';
import Tooltip from '@/components/ui/Tooltip';
import { ProductCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';
import { apiGet } from '@/lib/api-utils';

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
  product_stats: Record<string, { new_count: number; total_count: number }>;
}

interface GlossaryStatsCardProps {
  selectedProduct?: ProductCode | null;
  stats?: {
    total_terms: number;
    approved_terms: number;
    pending_terms: number;
    rejected_terms: number;
    not_used_terms?: number;
  } | null;
}

/**
 * Statistics dashboard showing glossary usage and cost savings
 * Displays 4 key sections: Cost savings, Reuse stats, Trends, Language breakdown
 * Can be filtered by product
 */
function GlossaryStatsCard({ selectedProduct, stats: externalStats }: GlossaryStatsCardProps) {
  const { products, productsMap } = useProducts();
  const [stats, setStats] = useState<GlossaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'usd' | 'krw'>('usd');
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  // 외부에서 stats가 제공되면 사용, 아니면 API에서 가져옴
  useEffect(() => {
    if (externalStats) {
      // 외부 stats가 변경되면 날씨 데이터와 병합
      setStats(prev => prev ? { ...prev, ...externalStats } : externalStats as GlossaryStats);
      setLoading(false);
    } else {
      fetchStats();
    }
  }, [selectedProduct, externalStats]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProduct) {
        params.set('product_code', selectedProduct);
      }
      const result = await apiGet(`/api/glossary/stats?${params}`) as { data?: GlossaryStats } & GlossaryStats;
      const data = result.data || result;
      setStats(data);
    } catch (error) {
      console.error('Error fetching glossary stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} padding="none">
            <div className="px-4 py-1.5 animate-pulse">
              <div className="flex items-center justify-between mb-1">
                <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                <div className="w-10 h-3 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-0.5">
                <div className="w-20 h-10 bg-gray-200 rounded"></div>
                <div className="w-20 h-2 bg-gray-200 rounded"></div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Convert KRW (assuming 1 USD = 1300 KRW) - handle undefined
  const estimatedCostSaved = stats.estimated_cost_saved ?? 0;
  const krwAmount = Math.round(estimatedCostSaved * 1300);

  // Sort languages by hit count (handle null/undefined)
  const sortedLanguages = Object.entries(stats.hits_by_language || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5 languages

  const totalLanguageHits = sortedLanguages.reduce((sum, [_, count]) => sum + count, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Cost Savings */}
      <Card padding="none" className="bg-gradient-to-br from-gray-50 to-white">
        <div className="px-4 py-1.5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-gray-700">절감</span>
              <div className="flex gap-0.5 bg-white rounded border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setCurrency('krw')}
                  className={`px-1 py-0.5 text-xs font-medium transition-colors ${
                    currency === 'krw'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ₩
                </button>
                <button
                  onClick={() => setCurrency('usd')}
                  className={`px-1 py-0.5 text-xs font-medium transition-colors ${
                    currency === 'usd'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  $
                </button>
              </div>
            </div>
            <Tooltip content="용어집 재사용으로 절약한 AI 번역 비용 (총 재사용 횟수 × 평균 언어 수 × 언어당 비용)">
              <div className="text-5xl font-bold text-gray-800 cursor-help leading-none">
                {currency === 'usd'
                  ? `$${estimatedCostSaved.toFixed(1)}`
                  : `₩${krwAmount.toLocaleString()}`
                }
              </div>
            </Tooltip>
          </div>
          <p className="text-xs text-gray-400 pt-0.5 border-t border-gray-100 leading-tight">
            용어집 재사용으로 비용 절감
          </p>
        </div>
      </Card>

      {/* 2. Reuse Statistics */}
      <Card padding="none" className="bg-gradient-to-br from-gray-50 to-white">
        <div className="px-4 py-1.5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">재사용 횟수</span>
            <Tooltip content="용어집에 저장된 번역이 실제 번역에 재사용된 총 횟수">
              <div className="text-5xl font-bold text-gray-800 cursor-help leading-none">
                {(stats.total_hits ?? 0).toLocaleString()}
              </div>
            </Tooltip>
          </div>
          <div className="flex items-center text-xs text-gray-400 gap-1.5 pt-0.5 border-t border-gray-100">
            <span className="whitespace-nowrap">사용 용어</span>
            <Tooltip content="실제로 번역에 재사용된 용어 수 / 승인된 전체 용어 수">
              <span className="font-medium text-gray-700 cursor-help whitespace-nowrap">
                {stats.used_terms ?? 0} / {stats.approved_terms ?? 0}
              </span>
            </Tooltip>
            <div className="flex-1 min-w-0 bg-gray-200 rounded-full h-0.5">
              <div
                className="bg-gray-600 h-0.5 rounded-full transition-all"
                style={{
                  width: `${(stats.approved_terms ?? 0) > 0 ? ((stats.used_terms ?? 0) / (stats.approved_terms ?? 1)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Trends */}
      <Card padding="none" className="bg-gradient-to-br from-gray-50 to-white">
        <div className="px-4 py-1.5 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">신규 용어</span>
            <Tooltip content="이번 달(1일~현재)에 용어집에 새로 추가된 용어 수">
              <div className="text-5xl font-bold text-gray-800 cursor-help leading-none">
                {stats.new_terms_this_month ?? 0}
              </div>
            </Tooltip>
          </div>
          <div className="pt-0.5 border-t border-gray-100 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">이번 주</span>
              <Tooltip content="최근 7일간 새로 추가된 용어 수">
                <span className="text-xs font-semibold text-gray-700 cursor-help">
                  {stats.new_terms_this_week ?? 0}개
                </span>
              </Tooltip>
            </div>
            {(stats.pending_terms ?? 0) > 0 && (
              <div className="flex items-center justify-between bg-gray-50 px-1 py-0.5 rounded">
                <span className="text-xs text-gray-600">⚠️ 검수 대기</span>
                <span className="text-xs font-semibold text-gray-700">{stats.pending_terms ?? 0}개</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Product Activity */}
      <Card padding="none" className="bg-gradient-to-br from-gray-50 to-white">
        <div className="px-4 py-1.5 flex flex-col justify-between h-full">
          <div className="mb-0.5">
            <span className="text-xs font-semibold text-gray-700">제품별 활동</span>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-[35px]">
            {(() => {
              // 실제 등록된 제품 기준으로 Mock 데이터 생성
              const productCodes = products.map(p => p.code);
              const colors = [
                'text-red-500', 'text-blue-500', 'text-purple-500', 'text-green-500',
                'text-yellow-500', 'text-pink-500', 'text-indigo-500', 'text-orange-500', 'text-teal-500'
              ];
              const sizes = ['text-5xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base'];

              const positions = [
                { top: '45%', left: '35%' },   // RC
                { top: '25%', left: '65%' },   // RV
                { top: '15%', left: '25%' },   // RM
                { top: '70%', left: '60%' },   // Rfice
                { top: '80%', left: '25%' },   // repoto
                { top: '12%', left: '50%' },   // RVS
                { top: '55%', left: '75%' },   // mobizen
                { top: '35%', left: '15%' },   // agent
                { top: '88%', left: '48%' },   // marketing
              ];

              const productData = productCodes.map((code, index) => {
                // API에서 가져온 실제 데이터 사용
                const apiData = stats.product_stats?.[code] || { new_count: 0, total_count: 0 };
                const isInactive = apiData.new_count === 0;

                return {
                  code,
                  newCount: apiData.new_count,
                  totalCount: apiData.total_count,
                  isInactive,
                  color: isInactive ? 'text-gray-400' : colors[index % colors.length],
                  size: sizes[Math.min(index, sizes.length - 1)],
                  position: positions[index],
                };
              });

              // 데이터가 전혀 없는 경우 Empty State 표시
              const hasAnyData = productData.some(p => p.totalCount > 0);

              if (!hasAnyData) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-1">
                    <div className="text-2xl mb-0.5" style={{ fontFamily: '"Comic Sans MS", cursive' }}>
                      📊
                    </div>
                    <div className="text-xs font-semibold text-gray-600" style={{ fontFamily: '"Comic Sans MS", cursive' }}>
                      아직 번역 활동이 없습니다
                    </div>
                  </div>
                );
              }

              return (
                <div className="absolute inset-0">
                  {productData.map((product) => {
                    const isHovered = hoveredProduct === product.code;
                    const isDimmed = hoveredProduct && !isHovered;

                    return (
                      <div
                        key={product.code}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-500 ease-out"
                        style={{ top: product.position.top, left: product.position.left }}
                        onMouseEnter={() => setHoveredProduct(product.code)}
                        onMouseLeave={() => setHoveredProduct(null)}
                      >
                        <div className="flex flex-col items-center">
                          <div
                            className={`font-extrabold tracking-tight transition-all duration-500 ease-out select-none ${
                              isDimmed
                                ? 'text-gray-800 opacity-15 scale-75 blur-[1px]'
                                : product.isInactive
                                  ? 'text-gray-400 opacity-50'
                                  : `${product.color} ${product.size}`
                            } ${
                              isHovered
                                ? product.isInactive
                                  ? 'scale-110 opacity-70'
                                  : 'scale-125 -rotate-6 drop-shadow-lg'
                                : 'hover:scale-105'
                            }`}
                            style={{ fontFamily: '"Comic Sans MS", "Apple Color Emoji", cursive' }}
                          >
                            {product.code}
                          </div>
                          <div
                            className={`text-sm font-bold mt-1.5 transition-all duration-300 ${
                              isHovered
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-2 pointer-events-none'
                            } ${product.isInactive ? 'text-gray-500' : ''}`}
                            style={{
                              color: product.isInactive ? undefined : product.color.replace('text-', ''),
                              fontFamily: '"Comic Sans MS", cursive'
                            }}
                          >
                            {product.newCount} / {product.totalCount}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="pt-0.5 border-t border-gray-100">
            <div className="text-xs text-gray-400 text-center leading-tight">
              신규 / 전체 번역
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default memo(GlossaryStatsCard);
