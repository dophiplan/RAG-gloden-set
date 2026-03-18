/**
 * 사용자 엑셀 업로드 유효성 검사 스키마
 *
 * Zod를 사용한 선언적 유효성 검사
 * 프론트엔드/백엔드 공통 사용 가능
 */

import { z } from "zod";

// ============================================================================
// 기본 스키마 정의
// ============================================================================

/** 계정 권한 레벨 */
export const AccountLevelSchema = z.enum(
  ["1st_master", "master", "manager", "user"],
  {
    message:
      "유효하지 않은 계정 권한입니다. (1st_master, master, manager, user)",
  },
);

/** 사용자 역할 */
export const UserRoleSchema = z.enum(
  [
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
  ],
  {
    message: "유효하지 않은 작업 권한입니다.",
  },
);

/** 언어 코드 */
export const LanguageCodeSchema = z.enum(["ko", "en", "ja", "zh"], {
  message: "유효하지 않은 언어 코드입니다. (ko, en, ja, zh)",
});

// ============================================================================
// 엑셀 행 데이터 스키마
// ============================================================================

/**
 * 단일 사용자 업로드 데이터 스키마
 *
 * 엑셀 한 행의 데이터를 검증
 */
export const UserUploadRowSchema = z.object({
  /** 계정 권한 (필수) */
  account_level: AccountLevelSchema,

  /** 담당 제품 (선택, 콤마 구분) */
  products: z.string().optional().transform(parseCommaSeparated),

  /** 사용자 이름 (필수) */
  name: z
    .string()
    .min(1, "이름은 필수입니다")
    .max(100, "이름은 100자 이하여야 합니다"),

  /** 이메일 주소 (필수, 유니크) */
  email: z
    .string()
    .min(1, "이메일은 필수입니다")
    .email("유효한 이메일 형식이 아닙니다")
    .max(255, "이메일은 255자 이하여야 합니다")
    .transform((email) => email.toLowerCase().trim()),

  /** 담당 플랫폼 (선택, 콤마 구분) */
  platforms: z.string().optional().transform(parseCommaSeparated),

  /** 작업 언어 (선택, 콤마 구분) */
  languages: z.string().optional().transform(parseCommaSeparated),

  /** 작업 권한 (필수, 콤마 구분) */
  roles: z
    .string()
    .min(1, "작업 권한은 필수입니다")
    .transform(parseCommaSeparated)
    .refine((arr) => arr.length > 0, "최소 하나의 작업 권한이 필요합니다"),

  /** 번역 가능 언어 (선택, 콤마 구분) */
  translator_languages: z.string().optional().transform(parseCommaSeparated),
});

/**
 * 검증된 사용자 업로드 데이터
 */
export const ValidatedUserUploadSchema = z.object({
  account_level: AccountLevelSchema,
  products: z.array(z.string()).default([]),
  name: z.string(),
  email: z.string().email(),
  platforms: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  roles: z.array(UserRoleSchema),
  translator_languages: z.array(LanguageCodeSchema).default([]),
});

/**
 * 사용자 업로드 배열 스키마
 */
export const UserUploadArraySchema = z.object({
  users: z.array(UserUploadRowSchema).min(1, "최소 1명의 사용자가 필요합니다"),
});

// ============================================================================
// 타입 정의
// ============================================================================

export type UserUploadRow = z.infer<typeof UserUploadRowSchema>;
export type ValidatedUserUpload = z.infer<typeof ValidatedUserUploadSchema>;
export type UserUploadArray = z.infer<typeof UserUploadArraySchema>;

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 콤마로 구분된 문자열을 배열로 파싱
 *
 * @param value - 콤마로 구분된 문자열 또는 undefined
 * @returns 정제된 문자열 배열
 *
 * @example
 * parseCommaSeparated('Win, Mac, Android') // ['Win', 'Mac', 'Android']
 * parseCommaSeparated('') // []
 * parseCommaSeparated(undefined) // []
 */
function parseCommaSeparated(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }

  return value
    .split(/[,，、]/) // 영문 콤마, 한글 콤마, 일본어 중점 모두 지원
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * 엑셀 행 데이터 검증 결과
 */
export interface ValidationResult<T> {
  /** 검증 성공 여부 */
  success: boolean;
  /** 검증된 데이터 (성공 시) */
  data?: T;
  /** 검증 오류 목록 (실패 시) */
  errors?: ValidationError[];
}

export interface ValidationError {
  /** 오류 발생 필드 경로 */
  path: string;
  /** 오류 메시지 */
  message: string;
}

// ============================================================================
// 검증 함수
// ============================================================================

/**
 * 단일 행 데이터 검증
 *
 * @param row - 엑셀에서 파싱된 행 데이터
 * @param rowIndex - 행 번호 (오류 메시지용)
 * @returns 검증 결과
 *
 * @example
 * ```typescript
 * const result = validateExcelRow({
 *   account_level: 'user',
 *   name: '홍길동',
 *   email: 'hong@example.com',
 *   roles: 'translator_ja',
 * }, 2);
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateExcelRow(
  row: unknown,
  rowIndex: number,
): ValidationResult<ValidatedUserUpload> {
  const result = UserUploadRowSchema.safeParse(row);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((err) => ({
        path: String(err.path.join(".")),
        message: `${rowIndex}행: ${err.message}`,
      })),
    };
  }

  // Zod 변환 후 추가 검증
  const validated: ValidatedUserUpload = {
    account_level: result.data.account_level,
    products: result.data.products || [],
    name: result.data.name,
    email: result.data.email,
    platforms: result.data.platforms || [],
    languages: result.data.languages || [],
    roles: result.data.roles as unknown as ValidatedUserUpload["roles"],
    translator_languages: (result.data.translator_languages || []).filter(
      (lang) => ["ko", "en", "ja", "zh"].includes(lang),
    ) as ValidatedUserUpload["translator_languages"],
  };

  return {
    success: true,
    data: validated,
  };
}

/**
 * 전체 업로드 데이터 검증
 *
 * @param data - 엑셀에서 파싱된 전체 데이터
 * @returns 검증 결과 (전체 + 개별 행)
 *
 * @example
 * ```typescript
 * const result = validateUploadData([
 *   { account_level: 'user', name: '홍길동', email: 'hong@example.com', roles: 'translator_ja' },
 *   { account_level: 'manager', name: '김철수', email: 'kim@example.com', roles: 'master' },
 * ]);
 * ```
 */
export function validateUploadData(data: unknown[]): {
  valid: boolean;
  rows: Array<{
    rowIndex: number;
    success: boolean;
    data?: ValidatedUserUpload;
    errors?: ValidationError[];
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    uniqueEmails: string[];
    duplicateEmails: string[];
  };
} {
  const rows: Array<{
    rowIndex: number;
    success: boolean;
    data?: ValidatedUserUpload;
    errors?: ValidationError[];
  }> = [];

  const emails: string[] = [];
  const emailSet = new Set<string>();
  const duplicateEmails: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const rowIndex = i + 2; // 헤더(1행) 고려
    const result = validateExcelRow(data[i], rowIndex);

    rows.push({
      rowIndex,
      success: result.success,
      data: result.data,
      errors: result.errors,
    });

    if (result.success && result.data) {
      const email = result.data.email;
      emails.push(email);

      if (emailSet.has(email)) {
        duplicateEmails.push(email);
      } else {
        emailSet.add(email);
      }
    }
  }

  const validRows = rows.filter((r) => r.success);

  return {
    valid: rows.every((r) => r.success) && duplicateEmails.length === 0,
    rows,
    summary: {
      total: data.length,
      valid: validRows.length,
      invalid: data.length - validRows.length,
      uniqueEmails: Array.from(emailSet),
      duplicateEmails: Array.from(new Set(duplicateEmails)),
    },
  };
}

/**
 * 플랫폼 코드 유효성 검사
 *
 * @param platforms - 검증할 플랫폼 코드 배열
 * @param validPlatformCodes - 유효한 플랫폼 코드 집합
 * @returns 유효하지 않은 플랫폼 코드 목록
 */
export function validatePlatformCodes(
  platforms: string[],
  validPlatformCodes: Set<string>,
): string[] {
  return platforms.filter((code) => !validPlatformCodes.has(code));
}

/**
 * 제품 코드 유효성 검사
 *
 * @param products - 검증할 제품 코드 배열
 * @param validProductCodes - 유효한 제품 코드 집합
 * @returns 유효하지 않은 제품 코드 목록
 */
export function validateProductCodes(
  products: string[],
  validProductCodes: Set<string>,
): string[] {
  return products.filter((code) => !validProductCodes.has(code));
}

// ============================================================================
// 엑셀 파싱 유틸리티
// ============================================================================

/**
 * 엑셀 워크시트를 JSON으로 변환
 *
 * @param buffer - 엑셀 파일 ArrayBuffer
 * @param headerRow - 헤더 행 번호 (기본값: 1)
 * @returns 파싱된 JSON 데이터
 */
export async function parseExcelToJson(
  buffer: ArrayBuffer,
  headerRow: number = 1,
): Promise<unknown[]> {
  // 동적 임포트 (서버/클라이언트 환경 모두 지원)
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(worksheet, {
    header: headerRow === 1 ? undefined : headerRow - 1,
    defval: "", // 빈 셀은 빈 문자열로
    raw: false, // 모든 값을 문자열로
  });
}

/**
 * 엑셀 템플릿 생성
 *
 * @returns 엑셀 파일 Buffer
 */
export async function generateExcelTemplate(): Promise<Buffer> {
  const XLSX = await import("xlsx");

  // 예시 데이터 (한글/영문 코드 모두 지원)
  const templateData = [
    {
      계정권한: "user (또는: 일반, 사용자)",
      제품: "RC,RV (제품 코드)",
      이름: "홍길동",
      이메일: "hong@example.com",
      "담당 플랫폼": "Android, iOS (또는: 안드로이드, 아이오에스)",
      언어: "ko, en, ja (또는: 한국어, 영어, 일본어)",
      작업권한: "translator_ja (또는: 일본어번역가)",
      번역언어: "JA (또는: 일본어) - JA, CA, EN만 허용",
    },
    {
      계정권한: "manager (또는: 매니저)",
      제품: "RM (제품 코드)",
      이름: "김철수",
      이메일: "kim@example.com",
      "담당 플랫폼": "Win, Mac, Front (또는: 윈도우, 맥, 프론트)",
      언어: "ko, en (또는: 한국어, 영어)",
      작업권한: "master, requester (또는: 마스터, 요청자)",
      번역언어: "",
    },
    {
      계정권한: "master (또는: 마스터, 관리자)",
      제품: "RC,RM,RV (여러 제품)",
      이름: "관리자",
      이메일: "admin@example.com",
      "담당 플랫폼": "Android, iOS, Win, Mac, Linux (또는 한글)",
      언어: "ko, en, ja, zh (또는: 한국어, 영어, 일본어, 중국어)",
      작업권한: "master, pm, deployer (여러 권한)",
      번역언어: "",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // 컬럼 너비 설정
  const colWidths = [
    { wch: 25 }, // 계정권한
    { wch: 25 }, // 제품
    { wch: 15 }, // 이름
    { wch: 25 }, // 이메일
    { wch: 40 }, // 담당 플랫폼
    { wch: 35 }, // 언어
    { wch: 40 }, // 작업권한
    { wch: 30 }, // 번역언어
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "사용자 템플릿");

  // 가이드 시트 추가
  const guideData = [
    { 항목: "=== 입력 가이드 ===", 설명: "" },
    { 항목: "", 설명: "" },
    {
      항목: "[계정 권한]",
      설명: "user(일반), manager(매니저), master(관리자), 1st_master(최고관리자)",
    },
    {
      항목: "[제품]",
      설명: "설정 > 제품 관리에 등록된 제품 코드 (콤마로 구분)",
    },
    { 항목: "[이름]", 설명: "사용자 이름 (필수)" },
    { 항목: "[이메일]", 설명: "이메일 주소 (필수, 중복 불가)" },
    {
      항목: "[담당 플랫폼]",
      설명: "Android/안드로이드, iOS/아이오에스, Win/윈도우, Mac/맥, Front/프론트, Linux/리눅스",
    },
    {
      항목: "[언어]",
      설명: "ko/한국어, en/영어, ja/일본어, zh/중국어 (콤마로 구분)",
    },
    {
      항목: "[작업 권한]",
      설명: "master/마스터, translator_ja/일본어번역가, reviewer_ja/일본어검수자, requester/요청자, deployer/배포자, pm/프로젝트매니저, pl/프로젝트리더 (콤마로 구분)",
    },
    {
      항목: "[번역 언어]",
      설명: "번역가 권한 시 필수. JA(일본어), CA(중국어), EN(영어)만 허용 (콤마로 구분)",
    },
    { 항목: "", 설명: "" },
    { 항목: "=== 중복 처리 규칙 ===", 설명: "" },
    {
      항목: "이메일 일치 시",
      설명: "기존 사용자 정보 업데이트 (비밀번호는 변경되지 않음)",
    },
    { 항목: "신규 사용자", 설명: "초기 비밀번호는 111111로 자동 설정" },
    { 항목: "", 설명: "" },
    { 항목: "=== 주의사항 ===", 설명: "" },
    { 항목: "최대 건수", 설명: "500건 (100건씩 배치 처리)" },
    { 항목: "파일 크기", 설명: "10MB 이하" },
    { 항목: "지원 형식", 설명: ".xlsx, .xls" },
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideData);
  guideSheet["!cols"] = [{ wch: 20 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, "입력 가이드");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
