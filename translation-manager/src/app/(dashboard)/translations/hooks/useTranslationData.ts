import { useState, useCallback, useEffect } from 'react';
import { TranslationStatus, ProductCode, TranslationResult, Translation, TranslationAuditLog } from '@/types';

export interface TranslationWithAudit extends Translation {
  translation_results: TranslationResult[];
  last_audit?: TranslationAuditLog;
}

interface Stats {
  total: number;
  pending: number;
  reviewed: number;
  deployed: number;
}

interface UseTranslationDataParams {
  statusFilter: TranslationStatus | '';
  searchTerm: string;
  selectedProduct: ProductCode | null;
  page: number;
  setTotalPages: (pages: number) => void;
}

export function useTranslationData({
  statusFilter,
  searchTerm,
  selectedProduct,
  page,
  setTotalPages,
}: UseTranslationDataParams) {
  const [translations, setTranslations] = useState<TranslationWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    reviewed: 0,
    deployed: 0,
  });

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (selectedProduct) params.set('product_code', selectedProduct);
      params.set('page', page.toString());

      const response = await fetch(`/api/translations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTranslations(data.translations);
        setTotalPages(data.totalPages);

        setStats({
          total: data.total || 0,
          pending: data.stats?.pending || 0,
          reviewed: data.stats?.reviewed || 0,
          deployed: data.stats?.deployed || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, selectedProduct, page, setTotalPages]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  return {
    translations,
    setTranslations,
    loading,
    stats,
    fetchTranslations,
  };
}
