/**
 * Common types shared across the application
 */

/**
 * Product scope type - stored in DB as lowercase English codes
 * Displayed in UI with Korean or English labels
 */
export type ScopeType = '' | 'saas' | 'solution' | 'government' | 'other';

/**
 * Scope display labels for UI
 */
export const SCOPE_LABELS: Record<ScopeType, { ko: string; en: string }> = {
  '': { ko: '전체', en: 'All' },
  saas: { ko: 'SaaS', en: 'SaaS' },
  solution: { ko: 'Solution', en: 'Solution' },
  government: { ko: '정부과제', en: 'Government' },
  other: { ko: '기타', en: 'Other' },
};

/**
 * Get display label for scope
 */
export function getScopeLabel(scope: ScopeType, lang: 'ko' | 'en' = 'ko'): string {
  return SCOPE_LABELS[scope]?.[lang] || scope;
}
