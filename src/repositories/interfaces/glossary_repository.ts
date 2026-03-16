/**
 * Glossary Repository Interface
 * 
 * 용어집(Glossary) 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class GlossaryRepository implements IGlossaryRepository {
 *   async findById(id: string) { ... }
 *   async create(data, userInfo) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const repo: IGlossaryRepository = new GlossaryRepository(supabase);
 * const term = await repo.create({
 *   term: 'User',
 *   translation: '사용자',
 *   language_code: 'ko'
 * }, { id: 'user-1', email: 'admin@example.com' });
 * ```
 */

import type {
  IBaseRepository,
  IAuditableRepository,
  PaginatedResult,
  UserInfo,
} from './base_repository';

// ============================================================================
// Glossary Entity Types
// ============================================================================

/**
 * 승인 상태
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * 용어집 항목 엔티티
 */
export interface GlossaryTerm {
  /** 항목 ID */
  id: string;
  /** 원문 용어 */
  term: string;
  /** 번역 */
  translation: string;
  /** 컨텍스트 */
  context?: string | null;
  /** 언어 코드 */
  language_code: string;
  /** 제품 코드 */
  product_code?: string | null;
  /** 생성자 ID */
  user_id?: string | null;
  /** 소스 유형 */
  source_type?: string | null;
  /** 가져오기 일시 */
  imported_at?: string | null;
  /** 승인 상태 */
  approval_status?: ApprovalStatus | null;
  /** 승인자 ID */
  approved_by?: string | null;
  /** 승인 일시 */
  approved_at?: string | null;
  /** 생성일시 */
  created_at: string;
  /** 수정일시 */
  updated_at: string;
}

/**
 * 용어집 생성 데이터
 */
export interface GlossaryCreateData {
  /** 원문 용어 (필수) */
  term: string;
  /** 번역 (필수) */
  translation: string;
  /** 컨텍스트 */
  context?: string | null;
  /** 언어 코드 (기본값: 'en') */
  language_code?: string;
  /** 제품 코드 */
  product_code?: string | null;
  /** 다중 제품 코드 */
  product_codes?: string[];
  /** 소스 유형 */
  source_type?: string;
  /** 초기 승인 상태 */
  approval_status?: ApprovalStatus;
}

/**
 * 용어집 업데이트 데이터
 */
export interface GlossaryUpdateData {
  /** 원문 용어 */
  term?: string;
  /** 번역 */
  translation?: string;
  /** 컨텍스트 */
  context?: string | null;
  /** 제품 코드 */
  product_code?: string | null;
  /** 승인 상태 */
  approval_status?: ApprovalStatus;
}

/**
 * 용어집 필터
 */
export interface GlossaryFilters {
  /** 제품 코드 */
  productCode?: string;
  /** 언어 코드 */
  languageCode?: string;
  /** 검색어 (term 또는 translation) */
  search?: string;
  /** 승인 상태 */
  approvalStatus?: ApprovalStatus;
}

/**
 * 용어집 Audit 로그
 */
export interface GlossaryAuditLog {
  /** 로그 ID */
  id: string;
  /** 용어집 항목 ID */
  glossary_term_id: string;
  /** 사용자 ID */
  user_id: string | null;
  /** 사용자 이름 */
  user_name: string | null;
  /** 사용자 이메일 */
  user_email: string | null;
  /** 작업 */
  action: string;
  /** 변경 필드명 */
  field_name: string | null;
  /** 이전 값 */
  old_value: string | null;
  /** 새 값 */
  new_value: string | null;
  /** 메타데이터 */
  metadata: Record<string, unknown> | null;
  /** 생성일시 */
  created_at: string;
}

/**
 * 정확히 일치하는 용어 검색 결과
 */
export type GlossaryExactMatch = GlossaryTerm & { hit_count?: number };

/**
 * 일괄 승인 결과
 */
export interface BulkApproveResult {
  /** 성공한 항목 수 */
  success: number;
  /** 실패한 항목 수 */
  failed: number;
}

// ============================================================================
// Glossary Repository Interface
// ============================================================================

/**
 * 용어집 Repository 인터페이스
 * 
 * 용어집 관리의 모든 데이터 접근을 추상화합니다.
 * Audit 로그가 자동으로 생성됩니다.
 */
export interface IGlossaryRepository
  extends Pick<
    IBaseRepository<GlossaryTerm, GlossaryCreateData, GlossaryUpdateData, GlossaryFilters>,
    'findById'
  >, IAuditableRepository<GlossaryTerm, GlossaryAuditLog> {
  /**
   * 용어집 항목 목록 조회
   * 
   * @param params - 필터 및 페이지네이션 파라미터
   * @returns 항목 목록과 총 개수
   */
  findMany(params: {
    productCode?: string;
    languageCode?: string;
    search?: string;
    approvalStatus?: ApprovalStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: GlossaryTerm[]; count: number | null }>;

  /**
   * 정확히 일치하는 용어 검색
   * 자동 완성 및 용어 자동 매칭에 사용
   * 
   * @param params - 검색 파라미터
   * @returns 일치하는 용어 목록
   */
  findExactMatches(params: {
    term: string;
    languageCodes: string[];
    productCode?: string | null;
    approvalStatus?: ApprovalStatus;
  }): Promise<GlossaryExactMatch[]>;

  /**
   * 조회수 증가
   * 
   * @param term - 용어
   * @param languageCode - 언어 코드
   */
  incrementHitCount(term: string, languageCode: string): Promise<void>;

  /**
   * 용어집 항목 생성 (Audit 로그 포함)
   * 
   * @param data - 생성 데이터
   * @param userInfo - 작업 수행자 정보
   * @returns 생성된 항목
   */
  create(data: GlossaryCreateData, userInfo: UserInfo): Promise<GlossaryTerm>;

  /**
   * 용어집 항목 업데이트 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param updates - 업데이트 데이터
   * @param userInfo - 작업 수행자 정보
   * @param options - 추가 옵션
   * @returns 업데이트된 항목
   */
  updateWithAudit(
    id: string,
    updates: GlossaryUpdateData,
    userInfo: UserInfo,
    options?: {
      oldValue?: string;
      fieldName?: string;
    }
  ): Promise<GlossaryTerm>;

  /**
   * 용어집 항목 삭제 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   */
  deleteWithAudit(id: string, userInfo: UserInfo): Promise<void>;

  /**
   * 용어집 항목 승인 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   * @returns 승인된 항목
   */
  approveWithAudit(id: string, userInfo: UserInfo): Promise<GlossaryTerm>;

  /**
   * 용어집 항목 거부 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   * @returns 거부된 항목
   */
  rejectWithAudit(id: string, userInfo: UserInfo): Promise<GlossaryTerm>;

  /**
   * 일괄 승인 (Audit 로그 포함)
   * 
   * @param ids - 승인할 항목 ID 목록
   * @param userInfo - 작업 수행자 정보
   * @returns 승인 결과
   */
  bulkApproveWithAudit(ids: string[], userInfo: UserInfo): Promise<BulkApproveResult>;

  /**
   * Audit 로그 생성
   * 대량 작업에서 사용
   * 
   * @param data - Audit 로그 데이터
   */
  createAuditLog(data: {
    glossary_term_id: string;
    user_id: string;
    user_name?: string | null;
    user_email: string;
    action: string;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

// ============================================================================
// Glossary Repository Provider Type
// ============================================================================

/**
 * Glossary Repository Provider 함수 타입
 */
export type GlossaryRepositoryProvider = () => IGlossaryRepository;
