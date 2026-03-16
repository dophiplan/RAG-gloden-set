/**
 * 마이그레이션 관련 타입 정의
 * 
 * 중앙화된 타입 정의로 일관성 유지
 */

import { ProductCode } from './products';

/**
 * 마이그레이션 항목 액션 타입
 */
export type MigrationAction = 'import' | 'skip' | 'merge' | 'overwrite';

/**
 * 마이그레이션 항목 카테고리
 */
export type MigrationCategory = 'glossary' | 'translation';

/**
 * 중복 상태 타입
 */
export interface DuplicateStatus {
  status: 'exact' | 'fuzzy' | 'similar' | 'new';
  existingId?: string;
  existing_id?: string;
  sourceText?: string;
  existing_translations?: Record<string, string>;
  similarity?: number;
  where?: 'glossary' | 'translation' | 'both';
}

/**
 * 마이그레이션 미리보기 항목
 * 
 * 마이그레이션 과정에서 사용되는 개별 항목의 타입
 * - UI 컴포넌트, Context, API 모두에서 사용
 */
export interface PreviewEntry {
  /** 고유 ID */
  id: string;
  
  /** 원문 (소스 텍스트) */
  source_text: string;
  
  /** 번역 데이터 (언어코드: 번역문) */
  translations: Record<string, string>;
  
  /** 컨텍스트/설명 */
  context?: string;
  
  /** 제품 (레거시 필드) */
  product?: string;
  
  /** 제품 분류 */
  product_category?: string;
  
  /** 버전 */
  version?: string;
  
  /** 카테고리 (glossary 또는 translation) */
  category: MigrationCategory;
  
  /** 시스템 제안 카테고리 */
  suggested_category?: MigrationCategory;
  
  /** 사용자 선택 액션 */
  action?: MigrationAction;
  
  /** 중복 상태 */
  duplicate_status?: DuplicateStatus;
  
  /** 원본 행 번호 */
  row_number?: number;
  
  /** 플랫폼 정보 */
  platform?: string;
}

/**
 * 필드 매핑 설정
 */
export interface FieldMapping {
  /** 원문 필드 */
  source?: string;
  
  /** 번역 필드 (언어코드: 컬럼명) */
  translations: Record<string, string>;
  
  /** 메타데이터 필드 */
  metadata: {
    context?: string;
    product_category?: string;
    platform?: string;
    version?: string;
  };
}

/**
 * 버전별 필드 매핑
 */
export type VersionMappings = Record<string, FieldMapping>;

/**
 * 마이그레이션 커밋 요청 항목
 */
export interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  product_category?: string;
  translations: Record<string, string>;
  category: MigrationCategory;
  action: MigrationAction;
}

/**
 * 마이그레이션 커밋 응답
 */
export interface CommitResponse {
  success: boolean;
  batchId?: string;
  processingTimeMs?: number;
  product_code?: ProductCode | string;
  version?: string | null;
  imported?: number;
  glossary?: {
    created: number;
    skipped: number;
    errors: { row: number; message: string }[];
  };
  translations?: {
    created: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
  };
}

/**
 * 마이그레이션 요약 정보
 */
export interface MigrationSummary {
  total: number;
  newEntries: number;
  duplicates: number;
  conflicts: number;
  glossaryCount: number;
  translationCount: number;
}

/**
 * 시트 데이터 (Excel/CSV 파싱 결과)
 */
export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: Record<string, string | number | undefined>[];
  rowCount: number;
}
