import { useState, useCallback, useEffect } from 'react';
import { apiGet } from '@/lib/api-utils';
import { ProductCode } from '@/types';

export interface TranslationStats {
  pending: number;
  in_progress: number;
  reviewed: number;
  re_request: number;
  deployed: number;
  not_used: number;
  re_deploy_request: number;
  total: number;
}

export function useTranslationStats(selectedProduct: ProductCode | null | undefined) {
  const [stats, setStats] = useState<TranslationStats>({
    pending: 0,
    in_progress: 0,
    reviewed: 0,
    re_request: 0,
    deployed: 0,
    not_used: 0,
    re_deploy_request: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedProduct
        ? `/api/translations/stats?product_code=${selectedProduct}`
        : '/api/translations/stats';
      
      const data = await apiGet<TranslationStats>(url);
      setStats(data);
    } catch (error) {
      console.error('Error fetching translation stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    refreshStats: fetchStats,
  };
}
