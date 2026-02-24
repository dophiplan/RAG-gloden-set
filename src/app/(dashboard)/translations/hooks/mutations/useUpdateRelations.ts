import { useCallback } from 'react';
import { ProductCode } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';
import { apiPatch } from '@/lib/api-utils';

interface UseUpdateRelationsParams {
  fetchTranslations: () => Promise<void>;
}

/**
 * Hook for updating translation relations (products and platforms)
 * These require server-side updates and refetch
 */
export function useUpdateRelations({ fetchTranslations }: UseUpdateRelationsParams) {
  const handleProductsUpdate = useCallback(
    async (translationId: string, products: { code: ProductCode; version: string }[]) => {
      // Products update requires server response for relation, so refetch
      try {
        await apiPatch(`/api/translations/${translationId}`, { product_codes: products });
        fetchTranslations();
        showSuccess('제품이 변경되었습니다.');
      } catch (error) {
        console.error('Error updating products:', error);
        showError('제품 변경에 실패했습니다.');
      }
    },
    [fetchTranslations]
  );

  const handlePlatformsUpdate = useCallback(
    async (translationId: string, platformCodes: string[]) => {
      // Platforms update requires server response for relation, so refetch
      try {
        await apiPatch(`/api/translations/${translationId}`, { platform_codes: platformCodes });
        fetchTranslations();
        showSuccess('플랫폼이 변경되었습니다.');
      } catch (error) {
        console.error('Error updating platforms:', error);
        showError('플랫폼 변경에 실패했습니다.');
      }
    },
    [fetchTranslations]
  );

  return {
    handleProductsUpdate,
    handlePlatformsUpdate,
  };
}
