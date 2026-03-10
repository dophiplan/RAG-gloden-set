import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCode, PriorityLevel, ScopeType } from '@/types';
import { TIMEOUTS } from '@/lib/constants';

interface UseUrlParamsHandlerParams {
  selectedProduct: ProductCode | null;
  setSelectedProduct: (product: ProductCode | null) => void;
  requestIdFilter: string | null;
  setRequestIdFilter: (id: string) => void;
  fetchTranslations: () => Promise<void>;
  handleBulkCreate: (texts: string[], version?: string, scope?: ScopeType, priority?: PriorityLevel) => Promise<void>;
}

/**
 * Hook for handling URL parameters
 * Processes URL params for navigation from other pages (upload, dashboard, etc.)
 */
export function useUrlParamsHandler({
  selectedProduct,
  setSelectedProduct,
  requestIdFilter,
  setRequestIdFilter,
  fetchTranslations,
  handleBulkCreate,
}: UseUrlParamsHandlerParams) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const newTexts = searchParams.get('new');
    const version = searchParams.get('version');
    const product = searchParams.get('product') as ProductCode | null;
    const requestId = searchParams.get('request_id');
    const refresh = searchParams.get('refresh');

    // Set product filter FIRST if specified
    if (product && product !== selectedProduct) {
      setSelectedProduct(product);
    }

    // Set request_id filter if specified
    if (requestId && requestId !== requestIdFilter) {
      setRequestIdFilter(requestId);
    }

    // Handle legacy new texts param (if still used)
    if (newTexts) {
      try {
        const texts = JSON.parse(decodeURIComponent(newTexts));
        if (Array.isArray(texts) && texts.length > 0) {
          handleBulkCreate(texts, version || undefined);
        }
      } catch (e) {
        // Ignore parsing errors for legacy param
      }
    }

    // If refresh param exists, trigger fresh data fetch
    // This handles navigation from upload page
    if (refresh) {
      // Wait for product filter to be applied
      setTimeout(() => {
        fetchTranslations();
        // Clean up URL params to avoid re-triggering
        window.history.replaceState(
          {},
          '',
          '/translations' + (product ? `?product=${product}` : '')
        );
      }, TIMEOUTS.STATE_UPDATE_DELAY_MS);
    }
  }, [searchParams]);
}
