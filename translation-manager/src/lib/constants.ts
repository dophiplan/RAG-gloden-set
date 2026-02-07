import { PRODUCTS, SUPPORTED_LANGUAGES } from '@/types';

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

// Maximum file size: 4.5MB (Vercel serverless function limit)
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
