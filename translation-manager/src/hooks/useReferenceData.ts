import useSWR from 'swr';
import { Product as ProductType } from '@/types/products';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.error || 'API 요청 실패';
    const error = new Error(
      res.status === 401
        ? '인증이 필요합니다. 다시 로그인해주세요.'
        : `${errorMessage} (${res.status})`
    );
    (error as any).status = res.status;
    (error as any).info = errorData;
    console.error(`[fetcher] Failed to fetch ${url}:`, {
      status: res.status,
      error: errorMessage,
      data: errorData
    });
    throw error;
  }
  return res.json();
};

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  default_languages: string[] | null;
}

export interface Language {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface Platform {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface TranslationStatus {
  id: string;
  code: string;
  label_ko: string;
  label_en: string;
  color: string;
  bg_color: string;
  text_color: string;
  sort_order: number;
}

export interface PriorityLevel {
  id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface Scope {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
}

/**
 * Hook to fetch and cache all products
 */
export function useProducts() {
  const { data, error, isLoading } = useSWR<{ products: Product[] }>(
    '/api/products',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[useProducts] Failed to fetch products:', err);
      },
    }
  );

  const products = data?.products || [];
  const isEmpty = !isLoading && !error && products.length === 0;

  return {
    products,
    productsMap: products.reduce((acc, p) => {
      acc[p.code] = p;
      return acc;
    }, {} as Record<string, Product>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch and cache all languages
 */
export function useLanguages() {
  const { data, error, isLoading } = useSWR<{ languages: Language[] }>(
    '/api/languages',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[useLanguages] Failed to fetch languages:', err);
      },
    }
  );

  const languages = data?.languages || [];
  const isEmpty = !isLoading && !error && languages.length === 0;

  return {
    languages,
    languagesMap: languages.reduce((acc, l) => {
      acc[l.code] = l;
      return acc;
    }, {} as Record<string, Language>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch and cache all platforms
 */
export function usePlatforms() {
  const { data, error, isLoading } = useSWR<{ platforms: Platform[] }>(
    '/api/platforms',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[usePlatforms] Failed to fetch platforms:', err);
      },
    }
  );

  const platforms = data?.platforms || [];
  const isEmpty = !isLoading && !error && platforms.length === 0;

  return {
    platforms,
    platformsMap: platforms.reduce((acc, p) => {
      acc[p.code] = p;
      return acc;
    }, {} as Record<string, Platform>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch and cache all translation statuses
 */
export function useStatuses() {
  const { data, error, isLoading } = useSWR<{ statuses: TranslationStatus[] }>(
    '/api/statuses',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[useStatuses] Failed to fetch statuses:', err);
      },
    }
  );

  const statuses = data?.statuses || [];
  const isEmpty = !isLoading && !error && statuses.length === 0;

  return {
    statuses,
    statusesMap: statuses.reduce((acc, s) => {
      acc[s.code] = s;
      return acc;
    }, {} as Record<string, TranslationStatus>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch and cache all priority levels
 */
export function usePriorities() {
  const { data, error, isLoading } = useSWR<{ priorities: PriorityLevel[] }>(
    '/api/priorities',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[usePriorities] Failed to fetch priorities:', err);
      },
    }
  );

  const priorities = data?.priorities || [];
  const isEmpty = !isLoading && !error && priorities.length === 0;

  return {
    priorities,
    prioritiesMap: priorities.reduce((acc, p) => {
      acc[p.code] = p;
      return acc;
    }, {} as Record<string, PriorityLevel>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch and cache all scopes
 */
export function useScopes() {
  const { data, error, isLoading } = useSWR<{ scopes: Scope[] }>(
    '/api/scopes',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[useScopes] Failed to fetch scopes:', err);
      },
    }
  );

  const scopes = data?.scopes || [];
  const isEmpty = !isLoading && !error && scopes.length === 0;

  return {
    scopes,
    scopesMap: scopes.reduce((acc, s) => {
      acc[s.code] = s;
      return acc;
    }, {} as Record<string, Scope>),
    isLoading,
    error,
    isEmpty,
  };
}

/**
 * Hook to fetch all reference data at once
 */
export function useAllReferenceData() {
  const products = useProducts();
  const languages = useLanguages();
  const platforms = usePlatforms();
  const statuses = useStatuses();
  const priorities = usePriorities();
  const scopes = useScopes();

  const hasError =
    products.error ||
    languages.error ||
    platforms.error ||
    statuses.error ||
    priorities.error ||
    scopes.error;

  const isLoading =
    products.isLoading ||
    languages.isLoading ||
    platforms.isLoading ||
    statuses.isLoading ||
    priorities.isLoading ||
    scopes.isLoading;

  return {
    products: products.products,
    productsMap: products.productsMap,
    languages: languages.languages,
    languagesMap: languages.languagesMap,
    platforms: platforms.platforms,
    platformsMap: platforms.platformsMap,
    statuses: statuses.statuses,
    statusesMap: statuses.statusesMap,
    priorities: priorities.priorities,
    prioritiesMap: priorities.prioritiesMap,
    scopes: scopes.scopes,
    scopesMap: scopes.scopesMap,
    isLoading,
    hasError,
    errors: {
      products: products.error,
      languages: languages.error,
      platforms: platforms.error,
      statuses: statuses.error,
      priorities: priorities.error,
      scopes: scopes.error,
    },
  };
}
