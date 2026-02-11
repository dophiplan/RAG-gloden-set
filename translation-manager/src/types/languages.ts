// @deprecated Use useLanguages() hook instead - languages are now fetched from DB
// Keeping for backward compatibility during migration
export const SUPPORTED_LANGUAGES = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁體)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
} as const;

// @deprecated Use string type instead - languages are dynamic
export type LanguageCode = string;

// Work language options
export const WORK_LANGUAGE_OPTIONS = [
  '전체',
  '영어',
  '일본어',
  '중국어',
  '프랑스어',
  '포르투갈어',
  '독일어',
] as const;
