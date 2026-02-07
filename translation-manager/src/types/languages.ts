// Supported languages
export const SUPPORTED_LANGUAGES = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁體)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

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
