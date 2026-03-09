'use client';

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr';
import useSWRInfiniteHook from 'swr/infinite';
import { apiGet } from '@/lib/api-utils';

// Global SWR config
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 0,
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

// Generic fetcher
const fetcher = async <T>(url: string): Promise<T> => {
  const result = await apiGet<T>(url);
  return result;
};

// Hook for fetching data with SWR
export function useSWRData<T>(
  key: string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<T>(
    key,
    key ? () => fetcher<T>(key) : null,
    {
      ...defaultConfig,
      ...config,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    revalidate,
  };
}

// Hook for paginated data
interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string | null>;
}

export function useSWRPaginated<T>(
  baseUrl: string,
  params: PaginationParams,
  config?: SWRConfiguration
) {
  const queryString = buildQueryString(params);
  const key = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const { data, error, isLoading, isValidating, mutate: revalidate } = useSWR<{
    data: T[];
    total: number;
    page: number;
    limit: number;
  }>(
    key,
    () => fetcher(key),
    {
      ...defaultConfig,
      keepPreviousData: true,
      ...config,
    }
  );

  return {
    data: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    limit: data?.limit || 20,
    error,
    isLoading,
    isValidating,
    revalidate: () => revalidate?.(),
  };
}

// Hook for infinite scroll
export function useSWRInfinite<T>(
  getKey: (pageIndex: number, previousPageData: T[] | null) => string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfiniteHook<T[]>(
    getKey,
    fetcher,
    {
      ...defaultConfig,
      revalidateFirstPage: false,
      ...config,
    }
  );

  const flattenedData = data ? data.flat() : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const hasMore = data ? data[data.length - 1]?.length > 0 : true;

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setSize(size + 1);
    }
  };

  return {
    data: flattenedData,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    size,
    loadMore,
    revalidate: () => mutate(),
  };
}

// Optimistic update helper
export function optimisticUpdate<T>(
  key: string,
  updater: (current: T | undefined) => T,
  options?: { rollbackOnError?: boolean }
) {
  return globalMutate(
    key,
    async (current: T | undefined) => {
      const updated = updater(current);
      return updated;
    },
    {
      optimisticData: updater,
      rollbackOnError: options?.rollbackOnError ?? true,
      revalidate: false,
    }
  );
}

// Cache invalidation helpers
export function invalidateCache(key: string | RegExp) {
  if (typeof key === 'string') {
    globalMutate(key, undefined, { revalidate: true });
  } else {
    // Invalidate all keys matching pattern using SWR's mutate filter
    globalMutate(
      (k) => typeof k === 'string' && key.test(k),
      undefined,
      { revalidate: true }
    );
  }
}

export function invalidateAll() {
  globalMutate(() => true, undefined, { revalidate: true });
}

// Helper function
function buildQueryString(params: PaginationParams): string {
  const parts: string[] = [];
  
  if (params.page && params.page > 1) {
    parts.push(`page=${params.page}`);
  }
  if (params.limit && params.limit !== 20) {
    parts.push(`limit=${params.limit}`);
  }
  if (params.sort) {
    parts.push(`sort=${params.sort}`);
  }
  if (params.order) {
    parts.push(`order=${params.order}`);
  }
  if (params.search) {
    parts.push(`search=${encodeURIComponent(params.search)}`);
  }
  if (params.filters) {
    Object.entries(params.filters).forEach(([key, value]) => {
      if (value) {
        parts.push(`${key}=${encodeURIComponent(value)}`);
      }
    });
  }
  
  return parts.join('&');
}

export default useSWRData;
