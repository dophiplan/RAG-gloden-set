import { PRODUCTS, SUPPORTED_LANGUAGES, WORK_SCOPE_OPTIONS as WORK_SCOPE_OPTIONS_TYPE } from '@/types';

// Re-export for convenience
export { PRODUCTS, SUPPORTED_LANGUAGES };

// Product select dropdown options (used in 7+ files)
export const PRODUCT_SELECT_OPTIONS = [
  { value: '', label: '제품 선택' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

// Language select dropdown options
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
];

// Priority select dropdown options
export const PRIORITY_OPTIONS = [
  { value: '긴급', label: '긴급' },
  { value: '상', label: '상' },
  { value: '중', label: '중' },
  { value: '하', label: '하' },
];

// Work scope options - convert to MultiSelectOption format
export const WORK_SCOPE_OPTIONS = WORK_SCOPE_OPTIONS_TYPE.map((scope) => ({
  value: scope,
  label: scope,
}));

// Maximum file size: 4.5MB (Vercel serverless function limit)
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
