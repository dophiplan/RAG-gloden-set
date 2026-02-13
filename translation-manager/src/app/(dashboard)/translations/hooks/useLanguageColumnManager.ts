import { useEffect } from 'react';
import { ProductCode, LanguageCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';

interface UseLanguageColumnManagerParams {
  selectedProduct: ProductCode | null;
  setSelectedLanguageColumns: (languages: LanguageCode[] | null) => void;
}

/**
 * Hook for managing language column display based on product selection
 * Automatically resets language columns when product changes
 */
export function useLanguageColumnManager({
  selectedProduct,
  setSelectedLanguageColumns,
}: UseLanguageColumnManagerParams) {
  const { productsMap } = useProducts();

  // Reset language column selection when product changes
  // Only reset when product actually changes, not when productsMap updates
  useEffect(() => {
    if (selectedProduct && productsMap[selectedProduct]) {
      const product = productsMap[selectedProduct];
      if (product.default_languages && product.default_languages.length > 0) {
        setSelectedLanguageColumns(product.default_languages as LanguageCode[]);
      } else {
        // RC or products without default languages: show default (EN, JA, ZH-CN)
        setSelectedLanguageColumns(['en', 'ja', 'zh-CN']);
      }
    } else {
      // No product selected: show default languages (EN, JA, ZH-CN)
      setSelectedLanguageColumns(['en', 'ja', 'zh-CN']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]); // Only depend on selectedProduct, not productsMap
}
