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
  languageFilter: string;
  searchTerm: string;
  selectedProduct: ProductCode | null;
  requestIdFilter: string | null;
  scopeFilter: 'SaaS' | 'Solution' | '';
  versionFilter: string;
  page: number;
  setTotalPages: (pages: number) => void;
}

export function useTranslationData({
  statusFilter,
  languageFilter,
  searchTerm,
  selectedProduct,
  requestIdFilter,
  scopeFilter,
  versionFilter,
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
      if (languageFilter) params.set('language', languageFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (selectedProduct) params.set('product_code', selectedProduct);
      if (requestIdFilter) params.set('request_id', requestIdFilter);
      if (scopeFilter) params.set('scope', scopeFilter);
      if (versionFilter) params.set('version', versionFilter);
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
  }, [statusFilter, languageFilter, searchTerm, selectedProduct, requestIdFilter, scopeFilter, versionFilter, page, setTotalPages]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const updateLocalTranslation = useCallback((
    id: string,
    updates: Partial<TranslationWithAudit>
  ) => {
    setTranslations((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  return {
    translations,
    setTranslations,
    loading,
    stats,
    fetchTranslations,
    updateLocalTranslation,
  };
}
