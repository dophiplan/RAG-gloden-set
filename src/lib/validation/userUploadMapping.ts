/**
 * 사용자 엑셀 업로드 한글→코드 매핑 유틸리티
 *
 * 엑셀에 한글 또는 영문으로 입력된 값을 시스템 코드로 변환
 */

// ============================================================================
// 플랫폼 매핑
// ============================================================================

/** 플랫폼 한글/영문 → 코드 매핑 */
export const PLATFORM_MAPPING: Record<string, string> = {
  // 한글
  안드로이드: "android",
  Android: "android",
  아이오에스: "ios",
  iOS: "ios",
  윈도우: "win",
  Windows: "win",
  윈: "win",
  Win: "win",
  맥: "mac",
  Mac: "mac",
  맥오에스: "mac",
  macOS: "mac",
  프론트: "front",
  Front: "front",
  웹: "front",
  Web: "front",
  백엔드: "backend",
  Backend: "backend",
  서버: "backend",
  Server: "backend",
  리눅스: "linux",
  Linux: "linux",
};

// ============================================================================
// 언어 매핑
// ============================================================================

/** 언어 한글/영문 → 코드 매핑 */
export const LANGUAGE_MAPPING: Record<string, string> = {
  // 한글
  한국어: "ko",
  Korean: "ko",
  ko: "ko",
  KO: "ko",
  영어: "en",
  English: "en",
  en: "en",
  EN: "en",
  일본어: "ja",
  Japanese: "ja",
  ja: "ja",
  JA: "ja",
  중국어: "zh",
  Chinese: "zh",
  zh: "zh",
  ZH: "zh",
};

// ============================================================================
// 계정 권한 매핑
// ============================================================================

/** 계정 권한 한글/영문 → 코드 매핑 */
export const ACCOUNT_LEVEL_MAPPING: Record<string, string> = {
  // 한글
  최고관리자: "1st_master",
  "1st 마스터": "1st_master",
  "1st Master": "1st_master",
  마스터: "master",
  Master: "master",
  관리자: "master",
  매니저: "manager",
  Manager: "manager",
  일반: "user",
  사용자: "user",
  User: "user",
  // 코드
  "1st_master": "1st_master",
  master: "master",
  manager: "manager",
  user: "user",
};

// ============================================================================
// 작업 권한 매핑
// ============================================================================

/** 작업 권한 한글/영문 → 코드 매핑 */
export const ROLE_MAPPING: Record<string, string> = {
  // 최고관리자
  최고관리자: "1st_master",
  "1st 마스터": "1st_master",
  "1st Master": "1st_master",
  "1st_master": "1st_master",
  // 마스터
  마스터: "master",
  Master: "master",
  master: "master",
  // 번역가 (일본어)
  일본어번역가: "translator_ja",
  "일본어 번역가": "translator_ja",
  "Japanese Translator": "translator_ja",
  "Translator JA": "translator_ja",
  translator_ja: "translator_ja",
  "번역(일본어)": "translator_ja",
  "번역 JA": "translator_ja",
  // 번역가 (중국어)
  중국어번역가: "translator_zh",
  "중국어 번역가": "translator_zh",
  "Chinese Translator": "translator_zh",
  "Translator ZH": "translator_zh",
  translator_zh: "translator_zh",
  "번역(중국어)": "translator_zh",
  "번역 ZH": "translator_zh",
  // 번역가 (영어)
  영어번역가: "translator_en",
  "영어 번역가": "translator_en",
  "English Translator": "translator_en",
  "Translator EN": "translator_en",
  translator_en: "translator_en",
  "번역(영어)": "translator_en",
  "번역 EN": "translator_en",
  // 검수자 (일본어)
  일본어검수자: "reviewer_ja",
  "일본어 검수자": "reviewer_ja",
  "Japanese Reviewer": "reviewer_ja",
  "Reviewer JA": "reviewer_ja",
  reviewer_ja: "reviewer_ja",
  "검수(일본어)": "reviewer_ja",
  "검수 JA": "reviewer_ja",
  // 검수자 (중국어)
  중국어검수자: "reviewer_zh",
  "중국어 검수자": "reviewer_zh",
  "Chinese Reviewer": "reviewer_zh",
  "Reviewer ZH": "reviewer_zh",
  reviewer_zh: "reviewer_zh",
  "검수(중국어)": "reviewer_zh",
  "검수 ZH": "reviewer_zh",
  // 검수자 (영어)
  영어검수자: "reviewer_en",
  "영어 검수자": "reviewer_en",
  "English Reviewer": "reviewer_en",
  "Reviewer EN": "reviewer_en",
  reviewer_en: "reviewer_en",
  "검수(영어)": "reviewer_en",
  "검수 EN": "reviewer_en",
  // 요청자
  요청자: "requester",
  Requester: "requester",
  requester: "requester",
  의뢰자: "requester",
  // 배포자
  배포자: "deployer",
  Deployer: "deployer",
  deployer: "deployer",
  배포: "deployer",
  // PM
  프로젝트매니저: "pm",
  "프로젝트 매니저": "pm",
  PM: "pm",
  pm: "pm",
  "Project Manager": "pm",
  // PL
  프로젝트리더: "pl",
  "프로젝트 리더": "pl",
  PL: "pl",
  pl: "pl",
  "Project Leader": "pl",
};

// ============================================================================
// 번역 언어 매핑 (translator_languages)
// ============================================================================

/** 번역 언어 한글/영문 → 코드 매핑 (ja, ca, en만 허용) - 소문자 통일 */
export const TRANSLATOR_LANGUAGE_MAPPING: Record<string, string> = {
  // 일본어
  일본어: "ja",
  Japanese: "ja",
  JA: "ja",
  ja: "ja",
  Ja: "ja",
  // 중국어 (간체)
  중국어: "ca",
  Chinese: "ca",
  CA: "ca",
  ca: "ca",
  Ca: "ca",
  "중국어(간체)": "ca",
  "Simplified Chinese": "ca",
  // 영어
  영어: "en",
  English: "en",
  EN: "en",
  en: "en",
  En: "en",
};

// ============================================================================
// 허용된 코드 목록
// ============================================================================

/** 유효한 계정 권한 목록 */
export const VALID_ACCOUNT_LEVELS = ["1st_master", "master", "manager", "user"];

/** 유효한 작업 권한 목록 */
export const VALID_ROLES = [
  "1st_master",
  "master",
  "translator_ja",
  "translator_zh",
  "translator_en",
  "reviewer_ja",
  "reviewer_zh",
  "reviewer_en",
  "requester",
  "deployer",
  "pm",
  "pl",
];

/** 유효한 번역 언어 목록 - 소문자 통일 */
export const VALID_TRANSLATOR_LANGUAGES = ["ja", "ca", "en"];

// ============================================================================
// 매핑 함수
// ============================================================================

/**
 * 한글/영문 값을 코드로 변환
 *
 * @param value - 입력값
 * @param mapping - 매핑 테이블
 * @param validCodes - 유효한 코드 목록
 * @returns 변환된 코드 또는 null (모호한 경우)
 *
 * @example
 * mapToCode('안드로이드', PLATFORM_MAPPING) // 'android'
 * mapToCode('Android', PLATFORM_MAPPING) // 'android'
 * mapToCode('모름', PLATFORM_MAPPING) // null
 */
export function mapToCode(
  value: string,
  mapping: Record<string, string>,
  validCodes?: string[],
): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();

  // 1. 정확한 매핑 찾기
  const mapped = mapping[trimmed];
  if (mapped) {
    return mapped;
  }

  // 2. 이미 유효한 코드인지 확인
  if (validCodes?.includes(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }

  // 3. 대소문자 무시하고 매핑 테이블에서 찾기
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, code] of Object.entries(mapping)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return code;
    }
  }

  // 4. 모호함 - null 반환 (공백 처리)
  return null;
}

/**
 * 콤마로 구분된 여러 값을 코드로 변환
 *
 * @param value - 콤마로 구분된 입력값
 * @param mapping - 매핑 테이블
 * @param validCodes - 유효한 코드 목록
 * @returns 변환된 코드 배열 (모호한 값은 제외)
 *
 * @example
 * mapCommaSeparatedToCodes('안드로이드, iOS, Windows', PLATFORM_MAPPING)
 * // ['android', 'ios', 'win']
 */
export function mapCommaSeparatedToCodes(
  value: string | undefined,
  mapping: Record<string, string>,
  validCodes?: string[],
): string[] {
  if (!value || value.trim() === "") {
    return [];
  }

  return value
    .split(/[,，、]/) // 영문 콤마, 한글 콤마, 일본어 중점 모두 지원
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => mapToCode(item, mapping, validCodes))
    .filter((code): code is string => code !== null);
}

/**
 * 플랫폼 문자열을 코드 배열로 변환
 */
export function mapPlatforms(value: string | undefined): string[] {
  return mapCommaSeparatedToCodes(value, PLATFORM_MAPPING);
}

/**
 * 언어 문자열을 코드 배열로 변환
 */
export function mapLanguages(value: string | undefined): string[] {
  return mapCommaSeparatedToCodes(value, LANGUAGE_MAPPING, [
    "ko",
    "en",
    "ja",
    "zh",
  ]);
}

/**
 * 계정 권한 문자열을 코드로 변환
 */
export function mapAccountLevel(value: string | undefined): string | null {
  if (!value) return null;
  return mapToCode(value, ACCOUNT_LEVEL_MAPPING, VALID_ACCOUNT_LEVELS);
}

/**
 * 작업 권한 문자열을 코드 배열로 변환
 */
export function mapRoles(value: string | undefined): string[] {
  return mapCommaSeparatedToCodes(value, ROLE_MAPPING, VALID_ROLES);
}

/**
 * 번역 언어 문자열을 코드 배열로 변환 (JA, CA, EN만 허용)
 */
export function mapTranslatorLanguages(value: string | undefined): string[] {
  return mapCommaSeparatedToCodes(
    value,
    TRANSLATOR_LANGUAGE_MAPPING,
    VALID_TRANSLATOR_LANGUAGES,
  );
}

// ============================================================================
// 엑셀 행 데이터 변환
// ============================================================================

/**
 * 엑셀 행 데이터의 한글 값을 코드로 변환
 *
 * @param row - 엑셀에서 파싱된 행 데이터
 * @returns 코드로 변환된 행 데이터
 *
 * @example
 * const row = {
 *   '계정권한': '일반',
 *   '담당 플랫폼': '안드로이드, iOS',
 *   '언어': '한국어, 영어',
 *   '작업권한': '번역가',
 *   '번역언어': '일본어',
 * };
 * const converted = convertExcelRowToCodes(row);
 * // {
 * //   account_level: 'user',
 * //   platforms: ['android', 'ios'],
 * //   languages: ['ko', 'en'],
 * //   roles: ['translator_ja'],
 * //   translator_languages: ['JA'],
 * // }
 */
export function convertExcelRowToCodes(row: Record<string, unknown>): {
  account_level?: string;
  products?: string[];
  platforms?: string[];
  languages?: string[];
  roles?: string[];
  translator_languages?: string[];
} {
  const result: ReturnType<typeof convertExcelRowToCodes> = {};

  // 계정 권한
  const accountLevel =
    row["계정권한"] || row["account_level"] || row["계정 권한"];
  if (typeof accountLevel === "string") {
    const mapped = mapAccountLevel(accountLevel);
    if (mapped) result.account_level = mapped;
  }

  // 제품 (코드로 입력 가정, 매핑 없음)
  const products = row["제품"] || row["products"] || row["담당 제품"];
  if (typeof products === "string") {
    result.products = products
      .split(/[,，、]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // 플랫폼
  const platforms =
    row["담당플랫폼"] ||
    row["platforms"] ||
    row["담당 플랫폼"] ||
    row["플랫폼"];
  if (typeof platforms === "string") {
    result.platforms = mapPlatforms(platforms);
  }

  // 언어
  const languages = row["언어"] || row["languages"] || row["작업 언어"];
  if (typeof languages === "string") {
    result.languages = mapLanguages(languages);
  }

  // 작업 권한
  const roles =
    row["작업권한"] || row["roles"] || row["작업 권한"] || row["권한"];
  if (typeof roles === "string") {
    result.roles = mapRoles(roles);
  }

  // 번역 언어
  const translatorLangs =
    row["번역언어"] || row["translator_languages"] || row["번역 언어"];
  if (typeof translatorLangs === "string") {
    result.translator_languages = mapTranslatorLanguages(translatorLangs);
  }

  return result;
}

/**
 * 원본 엑셀 데이터를 코드 변환된 데이터로 매핑
 *
 * @param data - 엑셀에서 파싱된 전체 데이터
 * @returns 코드로 변환된 데이터 배열
 */
export function convertExcelDataToCodes(
  data: Record<string, unknown>[],
): Array<Record<string, unknown>> {
  return data.map((row) => {
    const converted = convertExcelRowToCodes(row);

    return {
      ...row,
      // 코드 변환된 값으로 덮어쓰기
      account_level:
        converted.account_level ?? row["계정권한"] ?? row["account_level"],
      products: converted.products ?? row["제품"] ?? row["products"],
      platforms:
        converted.platforms ??
        row["담당플랫폼"] ??
        row["platforms"] ??
        row["담당 플랫폼"],
      languages: converted.languages ?? row["언어"] ?? row["languages"],
      roles:
        converted.roles ?? row["작업권한"] ?? row["roles"] ?? row["작업 권한"],
      translator_languages:
        converted.translator_languages ??
        row["번역언어"] ??
        row["translator_languages"],
    };
  });
}
