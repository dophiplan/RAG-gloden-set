import { ProductCode, LanguageCode } from '@/types';

/**
 * All products now support ALL languages (9 languages total).
 * This config defines which languages are DEFAULT CHECKED for each product.
 */
export const PRODUCT_DEFAULT_LANGUAGES: Record<ProductCode, LanguageCode[]> = {
  // RC defaults to ALL 9 languages
  RC: ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'],

  // All other products default to en, ja (but can select any)
  RV: ['en', 'ja'],
  RM: ['en', 'ja'],
  Rfice: ['en', 'ja'],
  repoto: ['en', 'ja'],
  RVS: ['en', 'ja'],
  mobizen: ['en', 'ja'],
  agent: ['en', 'ja'],
  marketing: ['en', 'ja'],
};

/**
 * All languages available for selection (9 languages total)
 */
export const ALL_LANGUAGES: LanguageCode[] = [
  'ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'
];

/**
 * Get default checked languages for a product (for creation forms)
 */
export function getDefaultLanguagesForProduct(productCode: ProductCode): LanguageCode[] {
  return PRODUCT_DEFAULT_LANGUAGES[productCode] || ['en', 'ja'];
}

/**
 * Get all selectable languages (always returns all 9)
 */
export function getAllSelectableLanguages(): LanguageCode[] {
  return ALL_LANGUAGES;
}

/**
 * Get union of all default languages (for "전체" view default)
 */
export function getAllDefaultLanguages(): LanguageCode[] {
  return ALL_LANGUAGES;
}

/**
 * Get all displayable languages for translation table (same as selectable)
 */
export function getAllDisplayableLanguages(): LanguageCode[] {
  return ALL_LANGUAGES;
}
