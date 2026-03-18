/**
 * User Import Mappings
 *
 * 한글/영문 입력값을 코드로 매핑
 * 모호한 값은 null 반환 (공백 처리)
 */

// 계정 권한 매핑
export const ACCOUNT_LEVEL_MAPPING: Record<string, string> = {
  // 한글
  마스터: "master",
  중간관리자: "manager",
  사용자: "user",
  // 영문
  master: "master",
  manager: "manager",
  user: "user",
};

// 작업 권한 매핑
export const PERMISSION_MAPPING: Record<string, string> = {
  // 한글
  번역가: "translator",
  번역요청자: "requester",
  번역반영자: "deployer",
  번역검수자: "reviewer",
  // 영문
  translator: "translator",
  requester: "requester",
  deployer: "deployer",
  reviewer: "reviewer",
};

// 번역 언어 매핑
export const TRANSLATOR_LANGUAGE_MAPPING: Record<string, string> = {
  // 한글
  일본어: "ja",
  중국어: "zh",
  중국어간체: "zh",
  중국어간: "zh",
  영어: "en",
  // 영문
  japanese: "ja",
  chinese: "zh",
  english: "en",
  // 코드
  ja: "ja",
  ca: "zh", // CA는 중국어(간체)로 매핑
  en: "en",
};

// 제품 매핑 (제품명 → 코드)
export const PRODUCT_NAME_TO_CODE: Record<string, string> = {
  // 한글
  리모트콜: "RC",
  리모트뷰: "RV",
  모비즌: "mobizen",
  에이전트: "agent",
  리모트미팅: "RM",
  알피스: "rfice",
  레포토: "repoto",
  리모트뷰서포트: "RVS",
  // 영문
  remotecall: "RC",
  remoteview: "RV",
  "remote meeting": "RM",
  rfice: "rfice",
  repoto: "repoto",
  "remoteview support": "RVS",
  // 코드 (그대로 반환)
  RC: "RC",
  RV: "RV",
  RM: "RM",
  RVS: "RVS",
};

// 플랫폼 매핑 (플랫폼명 → 코드)
export const PLATFORM_NAME_TO_CODE: Record<string, string> = {
  // 한글
  안드로이드: "android",
  아이오에스: "ios",
  윈도우: "windows",
  맥: "mac",
  웹: "web",
  백: "backend",
  백엔드: "backend",
  프론트: "frontend",
  프론트엔드: "frontend",
  플러터: "flutter",
  // 영문
  android: "android",
  ios: "ios",
  windows: "windows",
  mac: "mac",
  macos: "mac",
  web: "web",
  backend: "backend",
  frontend: "frontend",
  flutter: "flutter",
};

// 언어 매핑 (언어명 → 코드)
export const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  // 한글
  한국어: "ko",
  일본어: "ja",
  중국어: "zh",
  중국어간체: "zh",
  중국어번체: "zh-TW",
  영어: "en",
  프랑스어: "fr",
  스페인어: "es",
  독일어: "de",
  포르투갈어: "pt",
  // 영문
  korean: "ko",
  japanese: "ja",
  chinese: "zh",
  "chinese simplified": "zh",
  "chinese traditional": "zh-TW",
  english: "en",
  french: "fr",
  spanish: "es",
  german: "de",
  portuguese: "pt",
  // 코드 (그대로 반환)
  ko: "ko",
  ja: "ja",
  zh: "zh",
  "zh-TW": "zh-TW",
  en: "en",
  fr: "fr",
  es: "es",
  de: "de",
  pt: "pt",
};

/**
 * 값을 정규화 (소문자, 공백 제거)
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

/**
 * 계정 권한 매핑
 * - 여러 개 입력된 경우 첫 번째 유효값 반환
 * - 매핑 실패 시 'user' 반환
 */
export function mapAccountLevel(value: string): string {
  if (!value || !value.trim()) return "user";

  const levels = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  // 여러 개 입력된 경우 첫 번째 값만 사용
  const firstLevel = levels[0];
  const normalized = normalize(firstLevel);

  // 매핑 테이블에서 찾기
  for (const [key, code] of Object.entries(ACCOUNT_LEVEL_MAPPING)) {
    if (normalize(key) === normalized) {
      return code;
    }
  }

  // 매핑 실패 시 user 반환
  return "user";
}

/**
 * 작업 권한 매핑 (다중)
 * - 쉼표로 구분된 여러 권한 처리
 * - 모호한 값은 무시
 */
export function mapPermissions(value: string): string[] {
  if (!value || !value.trim()) return [];

  const permissions = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const mapped: string[] = [];

  for (const perm of permissions) {
    const normalized = normalize(perm);

    for (const [key, code] of Object.entries(PERMISSION_MAPPING)) {
      if (normalize(key) === normalized) {
        mapped.push(code);
        break;
      }
    }
    // 매핑 실패한 값은 무시 (모호한 값 공백 처리)
  }

  return [...new Set(mapped)]; // 중복 제거
}

/**
 * 번역 언어 매핑 (다중)
 * - 쉼표로 구분된 여러 언어 처리
 * - 모호한 값은 무시
 */
export function mapTranslatorLanguages(value: string): string[] {
  if (!value || !value.trim()) return [];

  const languages = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const mapped: string[] = [];

  for (const lang of languages) {
    const normalized = normalize(lang);

    for (const [key, code] of Object.entries(TRANSLATOR_LANGUAGE_MAPPING)) {
      if (normalize(key) === normalized) {
        mapped.push(code);
        break;
      }
    }
    // 매핑 실패한 값은 무시 (모호한 값 공백 처리)
  }

  return [...new Set(mapped)]; // 중복 제거
}

/**
 * 제품 매핑 (다중)
 * - 쉼표로 구분된 여러 제품 처리
 * - 제품명 또는 코드 모두 입력 가능
 * - 유효한 제품 코드만 반환
 */
export function mapProducts(value: string, validProducts: string[]): string[] {
  if (!value || !value.trim()) return [];

  const products = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const mapped: string[] = [];

  for (const product of products) {
    const normalized = normalize(product);

    // 먼저 매핑 테이블에서 찾기
    let found = false;
    for (const [key, code] of Object.entries(PRODUCT_NAME_TO_CODE)) {
      if (normalize(key) === normalized) {
        // 매핑된 코드가 유효한 제품 목록에 있는지 확인
        if (validProducts.includes(code)) {
          mapped.push(code);
        }
        found = true;
        break;
      }
    }

    // 매핑 테이블에 없으면 원본 값이 유효한 제품 코드인지 확인
    if (!found) {
      const upperProduct = product.toUpperCase();
      if (
        validProducts.includes(upperProduct) ||
        validProducts.includes(product)
      ) {
        mapped.push(
          validProducts.includes(upperProduct) ? upperProduct : product,
        );
      }
      // 매핑 실패하고 유효하지 않은 코드면 무시
    }
  }

  return [...new Set(mapped)]; // 중복 제거
}

/**
 * 플랫폼 매핑 (다중)
 * - 쉼표로 구분된 여러 플랫폼 처리
 * - 유효한 플랫폼 코드만 반환
 */
export function mapPlatforms(
  value: string,
  validPlatforms: string[],
): string[] {
  if (!value || !value.trim()) return [];

  const platforms = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const mapped: string[] = [];

  for (const platform of platforms) {
    const normalized = normalize(platform);

    // 먼저 매핑 테이블에서 찾기
    let found = false;
    for (const [key, code] of Object.entries(PLATFORM_NAME_TO_CODE)) {
      if (normalize(key) === normalized) {
        // 매핑된 코드가 유효한 플랫폼 목록에 있는지 확인
        if (validPlatforms.includes(code)) {
          mapped.push(code);
        }
        found = true;
        break;
      }
    }

    // 매핑 테이블에 없으면 원본 값이 유효한 플랫폼 코드인지 확인
    if (!found) {
      const lowerPlatform = platform.toLowerCase();
      if (
        validPlatforms.includes(lowerPlatform) ||
        validPlatforms.includes(platform)
      ) {
        mapped.push(
          validPlatforms.includes(lowerPlatform) ? lowerPlatform : platform,
        );
      }
      // 매핑 실패하고 유효하지 않은 코드면 무시 (모호한 값 공백 처리)
    }
  }

  return [...new Set(mapped)]; // 중복 제거
}

/**
 * 언어 매핑 (다중)
 * - 쉼표로 구분된 여러 언어 처리
 * - 유효한 언어 코드만 반환
 */
export function mapLanguages(
  value: string,
  validLanguages: string[],
): string[] {
  if (!value || !value.trim()) return [];

  const languages = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const mapped: string[] = [];

  for (const lang of languages) {
    const normalized = normalize(lang);

    // 먼저 매핑 테이블에서 찾기
    let found = false;
    for (const [key, code] of Object.entries(LANGUAGE_NAME_TO_CODE)) {
      if (normalize(key) === normalized) {
        // 매핑된 코드가 유효한 언어 목록에 있는지 확인
        if (validLanguages.includes(code)) {
          mapped.push(code);
        }
        found = true;
        break;
      }
    }

    // 매핑 테이블에 없으면 원본 값이 유효한 언어 코드인지 확인
    if (!found) {
      if (validLanguages.includes(lang)) {
        mapped.push(lang);
      }
      // 매핑 실패하고 유효하지 않은 코드면 무시 (모호한 값 공백 처리)
    }
  }

  return [...new Set(mapped)]; // 중복 제거
}
