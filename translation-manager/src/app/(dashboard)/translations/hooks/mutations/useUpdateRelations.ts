import { useCallback } from 'react';
import { ProductCode } from '@/types';
import { showSuccess, showError } from '@/lib/notifications';

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
        const response = await fetch(`/api/translations/${translationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_codes: products }),
        });

        if (response.ok) {
          fetchTranslations();
          showSuccess('제품이 변경되었습니다.');
        } else {
          showError('제품 변경에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error updating products:', error);
        showError('제품 변경 중 오류가 발생했습니다.');
      }
    },
    [fetchTranslations]
  );

  const handlePlatformsUpdate = useCallback(
    async (translationId: string, platformCodes: string[]) => {
      // Platforms update requires server response for relation, so refetch
      try {
        const response = await fetch(`/api/translations/${translationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform_codes: platformCodes }),
        });

        if (response.ok) {
          fetchTranslations();
          showSuccess('플랫폼이 변경되었습니다.');
        } else {
          showError('플랫폼 변경에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error updating platforms:', error);
        showError('플랫폼 변경 중 오류가 발생했습니다.');
      }
    },
    [fetchTranslations]
  );

  return {
    handleProductsUpdate,
    handlePlatformsUpdate,
  };
}
