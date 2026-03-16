/**
 * User Repository Interface
 * 
 * 사용자 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class UserRepository implements IUserRepository {
 *   async findById(id: string) { ... }
 *   async findByEmail(email: string) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const userRepo: IUserRepository = new UserRepository(supabase);
 * const user = await userRepo.findByEmail('user@example.com');
 * ```
 */

import type {
  IBaseRepository,
  IAuditableRepository,
  PaginatedResult,
  PaginationParams,
  UserInfo,
} from './base_repository';

// ============================================================================
// User Entity Types
// ============================================================================

/**
 * 사용자 역할
 */
export type UserRole = 'admin' | 'translator' | 'reviewer' | 'user';

/**
 * 사용자 상태
 */
export type UserStatus = 'active' | 'inactive' | 'pending';

/**
 * 사용자 엔티티
 */
export interface User {
  /** 사용자 ID (UUID) */
  id: string;
  /** 이메일 주소 */
  email: string;
  /** 전체 이름 */
  full_name: string | null;
  /** 사용자 역할 */
  role: UserRole;
  /** 계정 상태 */
  status: UserStatus;
  /** 아바타 URL */
  avatar_url: string | null;
  /** 생성일시 */
  created_at: string;
  /** 수정일시 */
  updated_at: string;
  /** 마지막 로그인 일시 */
  last_sign_in_at: string | null;
}

/**
 * 사용자 생성 데이터
 */
export interface UserCreateData {
  /** 이메일 주소 (필수) */
  email: string;
  /** 전체 이름 */
  full_name?: string | null;
  /** 사용자 역할 (기본값: 'user') */
  role?: UserRole;
  /** 계정 상태 (기본값: 'pending') */
  status?: UserStatus;
  /** 아바타 URL */
  avatar_url?: string | null;
}

/**
 * 사용자 업데이트 데이터
 */
export interface UserUpdateData {
  /** 이메일 주소 */
  email?: string;
  /** 전체 이름 */
  full_name?: string | null;
  /** 사용자 역할 */
  role?: UserRole;
  /** 계정 상태 */
  status?: UserStatus;
  /** 아바타 URL */
  avatar_url?: string | null;
}

/**
 * 사용자 필터
 */
export interface UserFilters {
  /** 역할 필터 */
  role?: string;
  /** 상태 필터 */
  status?: string;
  /** 검색어 (이메일 또는 이름) */
  search?: string;
}

/**
 * 사용자 Audit 로그
 */
export interface UserAuditLog {
  /** 로그 ID */
  id: string;
  /** 대상 사용자 ID */
  user_id: string | null;
  /** 수행된 작업 */
  action: string;
  /** 작업 상세 */
  details: Record<string, unknown> | null;
  /** 작업 수행자 ID */
  performed_by: string | null;
  /** 생성일시 */
  created_at: string;
}

// ============================================================================
// User Repository Interface
// ============================================================================

/**
 * 사용자 Repository 인터페이스
 * 
 * 사용자 관리의 모든 데이터 접근을 추상화합니다.
 */
export interface IUserRepository
  extends Pick<
      IBaseRepository<User, UserCreateData, UserUpdateData, UserFilters>,
      'findById' | 'findMany' | 'create' | 'createMany' | 'updateMany' | 'deleteMany'
    >,
    IAuditableRepository<User, UserAuditLog> {
  /**
   * 이메일로 사용자 조회
   * 
   * @param email - 사용자 이메일
   * @returns 사용자 또는 null
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * 사용자 업데이트
   * 
   * @param id - 사용자 ID
   * @param data - 업데이트 데이터
   * @returns 업데이트된 사용자 또는 null (존재하지 않는 경우)
   */
  update(id: string, data: UserUpdateData): Promise<User | null>;

  /**
   * 사용자 삭제
   * 
   * @param id - 사용자 ID
   * @returns 삭제 성공 여부
   */
  delete(id: string): Promise<boolean>;

  /**
   * 사용자 Audit 로그 조회
   * 
   * @param userId - 사용자 ID (선택사항, 없으면 전체 조회)
   * @param limit - 최대 조회 수
   * @returns Audit 로그 목록
   */
  getAuditLogs(userId?: string, limit?: number): Promise<UserAuditLog[]>;
}

// ============================================================================
// User Repository Provider Type
// ============================================================================

/**
 * User Repository Provider 함수 타입
 */
export type UserRepositoryProvider = () => IUserRepository;
