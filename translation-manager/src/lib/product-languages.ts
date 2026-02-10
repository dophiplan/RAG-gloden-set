import { ProductCode, LanguageCode } from '@/types';

/**
 * All products now support ALL languages (8 languages total, excluding Korean).
 * This config defines which languages are DEFAULT CHECKED for each product.
 */
export const PRODUCT_DEFAULT_LANGUAGES: Record<ProductCode, LanguageCode[]> = {
  // RC defaults to ALL 8 languages
  RC: ['en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'],

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
 * Languages available for CREATING new translations (excluding Korean)
 * Korean is excluded from new translation creation but can still be displayed/edited
 */
export const CREATABLE_LANGUAGES: LanguageCode[] = [
  'en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'
];

/**
 * All languages for DISPLAY in translation table (including Korean)
 * Korean translations can be viewed and edited, just not created new
 */
export const DISPLAYABLE_LANGUAGES: LanguageCode[] = [
  'ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'fr', 'es', 'pt', 'de'
];

/**
 * Get default checked languages for a product (for creation forms)
 */
export function getDefaultLanguagesForProduct(productCode: ProductCode): LanguageCode[] {
  return PRODUCT_DEFAULT_LANGUAGES[productCode] || ['en', 'ja'];
}

/**
 * Get all selectable languages for CREATING translations (no Korean)
 */
export function getAllSelectableLanguages(): LanguageCode[] {
  return CREATABLE_LANGUAGES;
}

/**
 * Get all displayable languages for translation table (with Korean)
 */
export function getAllDisplayableLanguages(): LanguageCode[] {
  return DISPLAYABLE_LANGUAGES;
}
