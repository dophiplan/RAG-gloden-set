'use client';

import { useCallback, useMemo } from 'react';
import { TranslationStatus, ProductCode, TranslationResult, Translation, TranslationAuditLog, ScopeType } from '@/types';
import { buildApiUrl } from '@/lib/api/query-builder';
import { useSWRData, invalidateCache } from '@/hooks/useSWRData';
import { mutate } from 'swr';

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

interface TranslationResponse {
  translations: TranslationWithAudit[];
  totalPages?: number;
  total?: number;
  stats?: {
    pending?: number;
    reviewed?: number;
    deployed?: number;
  };
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

export function useTranslationDataSWR({
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
  // Build cache key
  const url = useMemo(() => {
    return buildApiUrl('/api/translations', {
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
  }, [
    statusFilter,
    languageFilter,
    searchTerm,
    selectedProduct,
    requestIdFilter,
    scopeFilter,
    versionFilter,
    createdAfter,
    createdBefore,
    page,
  ]);

  // Use SWR for data fetching
  const { data, error, isLoading, isValidating, revalidate } = useSWRData<TranslationResponse>(
    url,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      onSuccess: (response) => {
        if (response.totalPages) {
          setTotalPages(response.totalPages);
        }
      },
    }
  );

  // Memoized stats
  const stats = useMemo(
    () => ({
      total: data?.total || 0,
      pending: data?.stats?.pending || 0,
      reviewed: data?.stats?.reviewed || 0,
      deployed: data?.stats?.deployed || 0,
    }),
    [data]
  );

  // Optimistic update helper
  const optimisticUpdate = useCallback(
    (updater: (translations: TranslationWithAudit[]) => TranslationWithAudit[]) => {
      mutate(
        url,
        async (current: TranslationResponse | undefined) => {
          if (!current) return current;
          return {
            ...current,
            translations: updater(current.translations || []),
          };
        },
        { revalidate: false }
      );
    },
    [url]
  );

  // Refresh function
  const refresh = useCallback(() => {
    revalidate();
  }, [revalidate]);

  // Invalidate all translation caches
  const invalidateAll = useCallback(() => {
    invalidateCache(/\/api\/translations/);
  }, []);

  return {
    translations: data?.translations || [],
    stats,
    loading: isLoading,
    validating: isValidating,
    error,
    refresh,
    optimisticUpdate,
    invalidateAll,
  };
}

// Hook for single translation with caching
export function useTranslationSWR(translationId: string | null) {
  const url = translationId ? `/api/translations/${translationId}` : null;
  
  const { data, error, isLoading, revalidate } = useSWRData<TranslationWithAudit>(
    url,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    translation: data,
    loading: isLoading,
    error,
    refresh: revalidate,
  };
}

// Hook for translation audit logs with caching
export function useTranslationAuditLogsSWR(translationId: string | null) {
  const url = translationId ? `/api/translations/${translationId}/logs` : null;
  
  const { data, error, isLoading, revalidate } = useSWRData<TranslationAuditLog[]>(
    url,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    logs: data || [],
    loading: isLoading,
    error,
    refresh: revalidate,
  };
}

export default useTranslationDataSWR;
