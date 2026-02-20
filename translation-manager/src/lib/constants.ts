// @deprecated - TODO: Components should use useProducts() and useLanguages() hooks instead
import { PRODUCTS, SUPPORTED_LANGUAGES, WORK_SCOPE_OPTIONS as WORK_SCOPE_OPTIONS_TYPE } from '@/types';

// Re-export for convenience
// @deprecated - Use useProducts() and useLanguages() hooks in React components instead
export { PRODUCTS, SUPPORTED_LANGUAGES };

// Product select dropdown options (used in 7+ files)
// @deprecated - Components should generate these from useProducts() hook
export const PRODUCT_SELECT_OPTIONS = [
  { value: '', label: '제품 선택' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

// Language select dropdown options
// @deprecated - Components should generate these from useLanguages() hook
export const LANGUAGE_SELECT_OPTIONS = [
  { value: '', label: '모든 언어' },
  ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

// Scope select dropdown options (제품 분류)
export const SCOPE_OPTIONS = [
  { value: '', label: '제품 분류 선택 *' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Solution', label: 'Solution' },
  { value: '정부과제', label: '정부과제' },
  { value: '기타', label: '기타' },
];

// Priority select dropdown options (database codes with Korean labels)
export const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '긴급' },
  { value: 'high', label: '상' },
  { value: 'medium', label: '중' },
  { value: 'low', label: '하' },
];

// Work scope options - convert to MultiSelectOption format
export const WORK_SCOPE_OPTIONS = WORK_SCOPE_OPTIONS_TYPE.map((scope) => ({
  value: scope,
  label: scope,
}));

// Maximum file size: 4.5MB (Vercel serverless function limit)
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Timeout and delay constants (in milliseconds)
export const TIMEOUTS = {
  /** Delay to wait for React state updates to complete before fetching data */
  STATE_UPDATE_DELAY_MS: 150,

  /** Shorter delay for state updates when switching products */
  STATE_UPDATE_SHORT_DELAY_MS: 100,

  /** Duration for undo notification to remain visible */
  UNDO_NOTIFICATION_DURATION_MS: 5000,

  /** Debounce delay for preview updates */
  PREVIEW_DEBOUNCE_DELAY_MS: 500,
} as const;

// Pagination constants
export const PAGINATION = {
  /** Default number of items per page for API responses */
  DEFAULT_PAGE_SIZE: 20,

  /** Maximum number of records to fetch from database for safety */
  MAX_QUERY_LIMIT: 100,

  /** Default limit for glossary suggestions */
  GLOSSARY_SUGGESTION_LIMIT: 100,
} as const;
