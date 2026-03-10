import { useCallback } from 'react';
import { ProductCode } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';
import { apiPatch } from '@/lib/api-utils';

interface UseUpdateRelationsParams {
  handleRefresh: () => void;
}

/**
 * Hook for updating translation relations (products and platforms)
 * These require server-side updates and refetch
 */
export function useUpdateRelations({ handleRefresh }: UseUpdateRelationsParams) {
  const handleProductsUpdate = useCallback(
    async (translationId: string, products: { code: ProductCode; version: string }[]) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { product_codes: products });
        handleRefresh(); // Refresh both translations and stats
        showSuccess('제품이 변경되었습니다.');
      } catch (error) {
        console.error('Error updating products:', error);
        showError('제품 변경에 실패했습니다.');
        throw error;
      }
    },
    [handleRefresh]
  );

  const handlePlatformsUpdate = useCallback(
    async (translationId: string, platformCodes: string[]) => {
      try {
        await apiPatch(`/api/translations/${translationId}`, { platform_codes: platformCodes });
        handleRefresh(); // Refresh both translations and stats
        showSuccess('플랫폼이 변경되었습니다.');
      } catch (error) {
        console.error('Error updating platforms:', error);
        showError('플랫폼 변경에 실패했습니다.');
        throw error;
      }
    },
    [handleRefresh]
  );

  return {
    handleProductsUpdate,
    handlePlatformsUpdate,
  };
}
