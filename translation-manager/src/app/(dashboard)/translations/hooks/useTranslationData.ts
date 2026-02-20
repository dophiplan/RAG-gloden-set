import { useState, useCallback, useEffect } from 'react';
import { TranslationStatus, ProductCode, TranslationResult, Translation, TranslationAuditLog, ScopeType } from '@/types';
import { buildApiUrl } from '@/lib/api/query-builder';

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
  scopeFilter: ScopeType;
  versionFilter: string;
  page: number;
  setTotalPages: (pages: number) => void;
  createdAfter?: string;
  createdBefore?: string;
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
  createdAfter,
  createdBefore,
}: UseTranslationDataParams) {
  const [translations, setTranslations] = useState<TranslationWithAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    reviewed: 0,
    deployed: 0,
  });

  const fetchTranslations = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/translations', {
        status: statusFilter,
        language: languageFilter,
        search: searchTerm,
        product_code: selectedProduct,
        request_id: requestIdFilter,
        scope: scopeFilter,
        version: versionFilter,
        created_after: createdAfter,
        created_before: createdBefore,
        page: page.toString(),
      });

      const response = await fetch(url, { signal });
      if (response.ok) {
        const data = await response.json();

        // Only update state if not aborted
        if (!signal?.aborted) {
          setTranslations(data.translations);
          setTotalPages(data.totalPages);

          setStats({
            total: data.total || 0,
            pending: data.stats?.pending || 0,
            reviewed: data.stats?.reviewed || 0,
            deployed: data.stats?.deployed || 0,
          });
        }
      } else {
        console.error('API Error:', response.status, response.statusText);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching translations:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, languageFilter, searchTerm, selectedProduct, requestIdFilter, scopeFilter, versionFilter, page, setTotalPages, createdAfter, createdBefore]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTranslations(controller.signal);

    return () => {
      // Cancel fetch on unmount or dependency change
      controller.abort();
    };
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
