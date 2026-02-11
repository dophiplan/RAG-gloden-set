/**
 * Email Template Rendering Utilities
 */

// @deprecated - TODO: refactor to pass products as parameter instead of using hardcoded PRODUCTS
import { Translation, ProductCode, PRODUCTS } from '@/types';

export interface TemplateVariables {
  product_name: string;
  version: string;
  language: string;
  language_list: string;
  platform_list: string;
  count: number;
  deadline: string;
  completed_at: string;
  completion_rate: number;
  url: string;
  custom_message: string;
}

/**
 * Render template by replacing {{variable}} placeholders
 */
export function renderTemplate(template: string, variables: Partial<TemplateVariables>): string {
  let result = template;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const replacement = value?.toString() || '';
    result = result.split(placeholder).join(replacement);
  });

  return result;
}

/**
 * Build template variables from translations
 */
export function buildTemplateVariables(
  translations: Translation[],
  options: {
    customMessage?: string;
    deadline?: string;
    completedAt?: string;
    baseUrl?: string;
  } = {}
): Partial<TemplateVariables> {
  // Extract unique products
  const productCodes = new Set<ProductCode>();
  translations.forEach(t => {
    if (t.product_code) productCodes.add(t.product_code);
    t.translation_products?.forEach(tp => productCodes.add(tp.product_code));
  });

  const productNames = Array.from(productCodes)
    .map(code => PRODUCTS[code as keyof typeof PRODUCTS] || code)
    .join(', ');

  // Extract versions
  const versions = new Set<string>();
  translations.forEach(t => {
    if (t.version) versions.add(t.version);
    t.translation_products?.forEach(tp => {
      if (tp.version) versions.add(tp.version);
    });
  });
  const versionStr = Array.from(versions).join(', ') || 'N/A';

  // Extract platforms from work_scope
  const platforms = new Set<string>();
  translations.forEach(t => {
    if (t.work_scope) {
      t.work_scope.forEach(scope => platforms.add(scope));
    }
  });
  const platformList = Array.from(platforms).join(', ') || 'N/A';

  // Calculate average completion rate
  const avgCompletionRate = translations.length > 0
    ? Math.round(translations.reduce((sum, t) => sum + (t.completion_rate || 0), 0) / translations.length)
    : 0;

  const baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    product_name: productNames || 'N/A',
    version: versionStr,
    language: '', // Will be set by specific email type
    language_list: '', // Will be set by specific email type
    platform_list: platformList,
    count: translations.length,
    deadline: options.deadline || '',
    completed_at: options.completedAt || new Date().toISOString(),
    completion_rate: avgCompletionRate,
    url: `${baseUrl}/translations`,
    custom_message: options.customMessage || '',
  };
}

/**
 * Build language list for email
 */
export function buildLanguageList(languageCodes: string[]): string {
  const languageMap: Record<string, string> = {
    'en': 'English',
    'ja': '日本語',
    'zh-CN': '中文(简体)',
    'zh-TW': '中文(繁體)',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'ko': '한국어',
  };

  return languageCodes
    .map(code => languageMap[code] || code)
    .join(', ');
}
