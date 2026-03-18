/**
 * Language code mapping utilities for migration preview
 */

// Android 리소스 폼 → 시스템 언어 코드 매핑
export const ANDROID_RESOURCE_MAP: Record<string, string> = {
  'values': 'en',
  'values-ko': 'ko',
  'values-ja': 'ja',
  'values-zh': 'zh-CN',
  'values-zh-rCN': 'zh-CN',
  'values-zh-rHK': 'zh-HK',
  'values-zh-rTW': 'zh-TW',
  'values-th': 'th',
  'values-vi': 'vi',
  'values-in': 'id',
  'values-id': 'id',
  'values-ms': 'ms',
  'values-hi': 'hi',
  'values-en': 'en',
  'values-en-rUS': 'en',
  'values-en-rGB': 'en',
  'values-de': 'de',
  'values-fr': 'fr',
  'values-es': 'es',
  'values-it': 'it',
  'values-pt': 'pt',
  'values-pt-rBR': 'pt',
  'values-ru': 'ru',
  'values-pl': 'pl',
  'values-tr': 'tr',
  'values-nl': 'nl',
  'values-sv': 'sv',
  'values-da': 'da',
  'values-fi': 'fi',
  'values-no': 'no',
  'values-cs': 'cs',
  'values-el': 'el',
  'values-hu': 'hu',
  'values-ro': 'ro',
  'values-ar': 'ar',
  'values-fa': 'fa',
  'values-he': 'he',
  'values-iw': 'he',
  'values-uk': 'uk',
};

const DIRECT_LANG_CODES: Record<string, string> = {
  'ko': 'ko', 'en': 'en', 'ja': 'ja', 'es': 'es', 'fr': 'fr',
  'de': 'de', 'pt': 'pt', 'it': 'it', 'ru': 'ru', 'zh': 'zh-CN',
  'th': 'th', 'vi': 'vi', 'id': 'id', 'ms': 'ms', 'hi': 'hi',
  'pl': 'pl', 'tr': 'tr', 'nl': 'nl', 'sv': 'sv', 'da': 'da',
  'fi': 'fi', 'no': 'no', 'cs': 'cs', 'el': 'el', 'hu': 'hu',
  'ro': 'ro', 'ar': 'ar', 'fa': 'fa', 'he': 'he', 'uk': 'uk',
};

/**
 * 컬럼명을 시스템 언어 코드로 변환
 */
export function mapColumnToLangCode(column: string): string | null {
  if (ANDROID_RESOURCE_MAP[column]) {
    return ANDROID_RESOURCE_MAP[column];
  }
  
  if (DIRECT_LANG_CODES[column]) {
    return DIRECT_LANG_CODES[column];
  }
  
  return extractLanguageCodeFromColumnName(column);
}

/**
 * 컬럼명에서 언어 코드 추출 (예: "translated_text_ko" → "ko")
 */
export function extractLanguageCodeFromColumnName(columnName: string): string | null {
  const patterns = [
    /^translated_text_([a-z]{2}(-[A-Z]{2})?)$/,
    /^translation_([a-z]{2}(-[A-Z]{2})?)$/,
    /^text_([a-z]{2}(-[A-Z]{2})?)$/,
    /_([a-z]{2}(-[A-Z]{2})?)$/,
  ];

  for (const pattern of patterns) {
    const match = columnName.match(pattern);
    if (match) {
      const code = match[1];
      return DIRECT_LANG_CODES[code] || code;
    }
  }

  return null;
}

/**
 * 내용 기반 언어 감지
 */
export function detectLanguageByContent(text: string): string | null {
  if (!text) return null;

  // 한국어
  if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) return 'ko';
  // 일본어
  if (/[ぁ-ん|ァ-ン|一-龥]/.test(text)) return 'ja';
  // 중국어
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  // 태국어
  if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
  // 아랍어
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  // 히브리어
  if (/[\u0590-\u05ff]/.test(text)) return 'he';
  // 힌디어
  if (/[\u0900-\u097f]/.test(text)) return 'hi';
  // 러시아어
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';
  // 그리스어
  if (/[\u0370-\u03ff]/.test(text)) return 'el';

  return null;
}

/**
 * 샘플들에서 언어 코드 감지
 */
export function detectLanguageFromSamples(samples: string[]): string | null {
  for (const sample of samples) {
    const detected = detectLanguageByContent(sample);
    if (detected) return detected;
  }
  return null;
}
