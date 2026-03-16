/**
 * Base Repository Interfaces
 * 
 * 제네릭 기반 공통 Repository 인터페이스 정의.
 * 모든 Repository는 이 인터페이스를 구현하거나 확장해야 합니다.
 * 
 * @example
 * ```typescript
 * // 기본 사용
 * class UserRepository implements IBaseRepository<User, CreateData, UpdateData, Filters> {
 *   // implementation
 * }
 * 
 * // 확장 사용
 * interface IUserRepository extends IBaseRepository<User, CreateData, UpdateData, Filters> {
 *   findByEmail(email: string): Promise<User | null>;
 * }
 * ```
 */

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * 페이지네이션 파라미터
 */
export interface PaginationParams {
  /** 페이지 번호 (1-based) */
  page: number;
  /** 페이지당 항목 수 */
  limit: number;
}

/**
 * 페이지네이션된 결과
 */
export interface PaginatedResult<T> {
  /** 데이터 목록 */
  data: T[];
  /** 전체 항목 수 (null if not requested) */
  count: number | null;
}

// ============================================================================
// Base Repository Interface
// ============================================================================

/**
 * 기본 Repository 인터페이스
 * 
 * @template T - Entity 타입
 * @template CreateData - 생성 데이터 타입
 * @template UpdateData - 업데이트 데이터 타입
 * @template Filters - 필터 타입
 */
export interface IBaseRepository<
  T,
  CreateData = Partial<T>,
  UpdateData = Partial<T>,
  Filters = Record<string, unknown>
> {
  /**
   * ID로 단일 항목 조회
   * 
   * @param id - 항목 ID
   * @returns 항목 또는 null (찾을 수 없는 경우)
   */
  findById(id: string): Promise<T | null>;

  /**
   * 필터와 페이지네이션으로 항목 목록 조회
   * 
   * @param filters - 필터 조건
   * @param pagination - 페이지네이션 파라미터
   * @returns 페이지네이션된 결과
   */
  findMany(
    filters?: Filters,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<T>>;

  /**
   * 새 항목 생성
   * 
   * @param data - 생성 데이터
   * @returns 생성된 항목
   */
  create(data: CreateData): Promise<T>;

  /**
   * 다중 항목 생성
   * 
   * @param items - 생성할 항목 목록
   * @returns 생성된 항목 목록
   */
  createMany(items: CreateData[]): Promise<T[]>;

  /**
   * 항목 업데이트
   * 
   * @param id - 항목 ID
   * @param updates - 업데이트 데이터
   * @returns 업데이트된 항목
   */
  update(id: string, updates: UpdateData): Promise<T>;

  /**
   * 다중 항목 업데이트
   * 
   * @param ids - 업데이트할 항목 ID 목록
   * @param updates - 업데이트 데이터
   * @returns 업데이트된 항목 수
   */
  updateMany(ids: string[], updates: UpdateData): Promise<number>;

  /**
   * 항목 삭제
   * 
   * @param id - 삭제할 항목 ID
   */
  delete(id: string): Promise<void>;

  /**
   * 다중 항목 삭제
   * 
   * @param ids - 삭제할 항목 ID 목록
   * @returns 삭제된 항목 수
   */
  deleteMany(ids: string[]): Promise<number>;
}

// ============================================================================
// Read-only Repository Interface
// ============================================================================

/**
 * 읽기 전용 Repository 인터페이스
 * 쓰기 작업이 필요 없는 경우 사용
 * 
 * @template T - Entity 타입
 * @template Filters - 필터 타입
 */
export interface IReadOnlyRepository<T, Filters = Record<string, unknown>> {
  /**
   * ID로 단일 항목 조회
   */
  findById(id: string): Promise<T | null>;

  /**
   * 필터와 페이지네이션으로 항목 목록 조회
   */
  findMany(
    filters?: Filters,
    pagination?: Partial<PaginationParams>
  ): Promise<PaginatedResult<T>>;
}

// ============================================================================
// Write-only Repository Interface
// ============================================================================

/**
 * 쓰기 전용 Repository 인터페이스
 * 감사 로그 등 읽기가 필요 없는 경우 사용
 * 
 * @template T - Entity 타입
 * @template CreateData - 생성 데이터 타입
 */
export interface IWriteOnlyRepository<T, CreateData = Partial<T>> {
  /**
   * 새 항목 생성
   */
  create(data: CreateData): Promise<T>;

  /**
   * 다중 항목 생성
   */
  createMany(items: CreateData[]): Promise<T[]>;
}

// ============================================================================
// Repository with Audit Interface
// ============================================================================

/**
 * 사용자 정보 타입 (Audit 로그용)
 */
export interface UserInfo {
  /** 사용자 ID */
  id: string;
  /** 사용자 이름 */
  name?: string | null;
  /** 사용자 이메일 */
  email: string;
}

/**
 * Audit 로그를 지원하는 Repository 인터페이스
 * 
 * @template T - Entity 타입
 * @template AuditLog - Audit 로그 타입
 */
export interface IAuditableRepository<T, AuditLog = unknown> {
  /**
   * Audit 로그 생성
   * 
   * @param action - 수행된 작업
   * @param details - 작업 상세 정보
   * @param performedBy - 작업 수행자 ID
   */
  createAuditLog(
    action: string,
    details: Record<string, unknown>,
    performedBy: string | null
  ): Promise<void>;

  /**
   * 특정 항목의 Audit 이력 조회
   * 
   * @param entityId - 항목 ID
   * @param limit - 최대 조회 수
   * @returns Audit 로그 목록
   */
  getAuditHistory(entityId: string, limit?: number): Promise<AuditLog[]>;

  /**
   * 최근 변경사항 조회
   * 
   * @param limit - 최대 조회 수
   * @returns Audit 로그 목록
   */
  getRecentChanges(limit?: number): Promise<AuditLog[]>;
}

// ============================================================================
// Optimistic Locking Interface
// ============================================================================

/**
 * 낙관적 잠금 옵션
 */
export interface OptimisticLockOptions {
  /** 예상 버전 번호 (버전 기반 잠금용) */
  expectedVersion?: number;
  /** 예상 타임스탬프 (타임스탬프 기반 잠금용) */
  expectedTimestamp?: string;
  /** 잠금 검사 스킵 (관리자 작업용) */
  skipLockCheck?: boolean;
}

/**
 * 낙관적 잠금 결과
 */
export interface LockCheckResult {
  /** 잠금 검사 성공 여부 */
  success: boolean;
  /** 충돌 시 현재 데이터 */
  currentData?: unknown;
  /** 충돌 메시지 */
  message?: string;
}

/**
 * 낙관적 잠금을 지원하는 Repository 인터페이스
 * 
 * @template T - Entity 타입
 */
export interface ILockableRepository<T> {
  /**
   * 낙관적 잠금으로 업데이트
   * 
   * @param id - 항목 ID
   * @param updates - 업데이트 데이터
   * @param options - 잠금 옵션
   * @returns 업데이트된 항목
   * @throws EDIT_CONFLICT 충돌 발생 시
   */
  updateWithLock(
    id: string,
    updates: Partial<T>,
    options?: OptimisticLockOptions
  ): Promise<T>;

  /**
   * 버전 충돌 여부 확인
   * 
   * @param id - 항목 ID
   * @param expectedVersion - 예상 버전
   * @param expectedTimestamp - 예상 타임스탬프
   * @returns 잠금 검사 결과
   */
  checkVersion(
    id: string,
    expectedVersion?: number,
    expectedTimestamp?: string
  ): Promise<LockCheckResult>;
}
