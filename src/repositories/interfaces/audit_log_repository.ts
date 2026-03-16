/**
 * Audit Log Repository Interface
 * 
 * Audit 로그 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class AuditLogRepository implements IAuditLogRepository {
 *   async create(data) { ... }
 *   async createMany(items) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const repo: IAuditLogRepository = new AuditLogRepository(supabase);
 * await repo.create({
 *   translation_id: 'trans-1',
 *   action: 'update',
 *   user_email: 'user@example.com'
 * });
 * ```
 */

import type { PaginatedResult, PaginationParams } from './base_repository';
import type { TranslationAuditLog, AuditLogCreateData, AuditAction } from '@/types';

// ============================================================================
// Audit Log Grouped Result Types
// ============================================================================

/**
 * 번역 ID별로 그룹화된 Audit 로그
 */
export interface GroupedAuditLogs {
  /** 번역 ID별 로그 맵 */
  byTranslationId: Map<string, TranslationAuditLog[]>;
  /** 각 번역의 최신 로그 */
  latestByTranslationId: Map<string, TranslationAuditLog>;
  /** 전체 로그 목록 */
  allLogs: TranslationAuditLog[];
}

// ============================================================================
// Audit Log Repository Interface
// ============================================================================

/**
 * Audit Log Repository 인터페이스
 * 
 * Audit 로그의 생성과 조회를 담당합니다.
 * 생성 작업은 non-blocking (에러를 throw하지 않음)
 */
export interface IAuditLogRepository {
  /**
   * Audit 로그 생성 (non-blocking)
   * 
   * 에러는 로깅되지만 throw되지 않습니다.
   * 
   * @param data - Audit 로그 데이터
   */
  create(data: AuditLogCreateData): Promise<void>;

  /**
   * 다중 Audit 로그 생성 (non-blocking, 배치 처리)
   * 
   * @param items - 생성할 Audit 로그 목록
   * @param batchSize - 배치 크기 (기본값: 100)
   */
  createMany(items: AuditLogCreateData[], batchSize?: number): Promise<void>;

  /**
   * 특정 번역의 Audit 로그 조회
   * 
   * @param translationId - 번역 ID
   * @returns Audit 로그 목록 (최신순)
   */
  getByTranslationId(translationId: string): Promise<TranslationAuditLog[]>;

  /**
   * 다중 번역의 Audit 로그 조회 (배치 처리)
   * 
   * @param translationIds - 번역 ID 목록
   * @param options - 옵션 (batchSize)
   * @returns Audit 로그 목록 (최신순)
   */
  getByTranslationIds(
    translationIds: string[],
    options?: { batchSize?: number }
  ): Promise<TranslationAuditLog[]>;

  /**
   * 번역별 최신 Audit 로그 조회
   * 
   * N+1 쿼리 방지를 위해 단일 쿼리로 처리
   * 
   * @param translationIds - 번역 ID 목록
   * @returns 번역 ID별 최신 Audit 로그 맵
   */
  getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>>;

  /**
   * 페이지네이션으로 Audit 로그 조회
   * 
   * @param params - 페이지네이션 파라미터
   * @returns 페이지네이션된 결과
   */
  getWithPagination(
    params?: PaginationParams
  ): Promise<PaginatedResult<TranslationAuditLog>>;

  /**
   * 번역 ID별로 그룹화된 Audit 로그 조회
   * 
   * @param translationIds - 번역 ID 목록
   * @returns 그룹화된 Audit 로그
   */
  getGroupedByTranslation(translationIds: string[]): Promise<GroupedAuditLogs>;

  /**
   * 특정 번역의 Audit 로그 수 조회
   * 
   * @param translationId - 번역 ID
   * @returns 로그 수
   */
  countByTranslationId(translationId: string): Promise<number>;
}

// ============================================================================
// Translation Audit Repository Interface (Backward Compatible)
// ============================================================================

/**
 * Translation Audit Repository 인터페이스
 * 
 * 하위 호환성을 위한 래퍼 인터페이스
 * @deprecated IAuditLogRepository 사용 권장
 */
export interface ITranslationAuditRepository {
  /**
   * Audit 로그 생성 (non-blocking)
   */
  create(data: AuditLogCreateData): Promise<void>;

  /**
   * 번역별 최신 Audit 로그 조회
   */
  getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>>;

  /**
   * 특정 번역의 Audit 로그 조회
   */
  getByTranslationId(translationId: string): Promise<TranslationAuditLog[]>;

  /**
   * 페이지네이션으로 Audit 로그 조회
   */
  getWithPagination(
    page?: number,
    limit?: number
  ): Promise<{ data: TranslationAuditLog[]; count: number | null }>;
}

// ============================================================================
// Extended Translation Audit Repository Interface
// ============================================================================

import type { TranslationAuditLogCreateData, TranslationAuditStats } from '@/types';

/**
 * 확장된 Translation Audit Repository 인터페이스
 * 
 * SQLite 구현체를 위한 추가 메서드를 포함합니다.
 */
export interface IExtendedTranslationAuditRepository extends ITranslationAuditRepository {
  /**
   * Audit 로그 생성 후 반환
   * 
   * @param data - Audit 로그 생성 데이터
   * @returns 생성된 Audit 로그
   */
  create(data: TranslationAuditLogCreateData): Promise<TranslationAuditLog>;

  /**
   * 번역 ID로 Audit 이력 조회 (limit 지원)
   * 
   * @param translationId - 번역 ID
   * @param limit - 최대 조회 개수
   * @returns Audit 로그 목록 (최신순)
   */
  findByTranslationId(translationId: string, limit?: number): Promise<TranslationAuditLog[]>;

  /**
   * 사용자별 Audit 이력 조회
   * 
   * @param userId - 사용자 ID
   * @param limit - 최대 조회 개수
   * @returns Audit 로그 목록 (최신순)
   */
  findByUserId(userId: string, limit?: number): Promise<TranslationAuditLog[]>;

  /**
   * 최근 Audit 이력 조회
   * 
   * @param limit - 최대 조회 개수
   * @returns Audit 로그 목록 (최신순)
   */
  findRecent(limit?: number): Promise<TranslationAuditLog[]>;

  /**
   * 특정 기간 내 Audit 조회
   * 
   * @param startDate - 시작일 (ISO 8601)
   * @param endDate - 종료일 (ISO 8601)
   * @returns Audit 로그 목록 (최신순)
   */
  findByDateRange(startDate: string, endDate: string): Promise<TranslationAuditLog[]>;

  /**
   * Audit Log 통계 조회
   * 
   * @param translationId - 특정 번역 ID (선택적)
   * @returns 통계 정보
   */
  getStats(translationId?: string): Promise<TranslationAuditStats>;
}

// ============================================================================
// Audit Log Repository Provider Types
// ============================================================================

/**
 * Audit Log Repository Provider 함수 타입
 */
export type AuditLogRepositoryProvider = () => IAuditLogRepository;

/**
 * Translation Audit Repository Provider 함수 타입
 */
export type TranslationAuditRepositoryProvider = () => ITranslationAuditRepository;
