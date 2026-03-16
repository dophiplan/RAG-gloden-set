/**
 * Translation Repository Interface
 * 
 * 번역 데이터 관리를 위한 Repository 인터페이스
 * 
 * @example
 * ```typescript
 * // 구현 예시
 * class TranslationRepository implements ITranslationRepository {
 *   async findById(id: string) { ... }
 *   async findMany(filters, pagination) { ... }
 *   // ... other methods
 * }
 * 
 * // 사용 예시
 * const repo: ITranslationRepository = new TranslationRepository(supabase);
 * const result = await repo.findMany(
 *   { status: 'pending', productCode: 'RC' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */

import type {
  IBaseRepository,
  ILockableRepository,
  PaginatedResult,
  PaginationParams,
  OptimisticLockOptions,
} from './base_repository';
import type { Translation, TranslationStatus, ProductCode, PriorityLevel } from '@/types';

// ============================================================================
// Translation Specific Types
// ============================================================================

/**
 * 번역 필터
 */
export interface TranslationFilters {
  /** 상태 필터 */
  status?: TranslationStatus;
  /** 언어 코드 필터 */
  language?: string;
  /** 검색어 (source_text 또는 translated_text) */
  search?: string;
  /** 제품 코드 필터 */
  productCode?: ProductCode;
  /** 요청 ID 필터 */
  requestId?: string;
  /** 스코프 필터 */
  scope?: string;
  /** 버전 필터 */
  version?: string;
  /** 생성일 시작 */
  createdAfter?: string;
  /** 생성일 종료 */
  createdBefore?: string;
}

/**
 * 번역 생성 데이터
 */
export interface TranslationCreateData {
  /** 소스 텍스트 (원문) */
  source_text: string;
  /** 컨텍스트/맥락 */
  context?: string | null;
  /** 버전 */
  version?: string | null;
  /** 버전 업데이트 일시 */
  version_updated_at?: string | null;
  /** 제품 코드 */
  product_code?: ProductCode | null;
  /** 스코프 */
  scope?: string | null;
  /** 우선순위 */
  priority?: PriorityLevel;
  /** 완료 예정일 */
  completion_date?: string | null;
  /** 생성자 ID */
  user_id: string;
  /** 초기 상태 */
  status: TranslationStatus;
}

/**
 * 번역 업데이트 데이터
 */
export type TranslationUpdateData = Partial<Translation>;

// ============================================================================
// Translation Repository Interface
// ============================================================================

/**
 * 번역 Repository 인터페이스
 * 
 * 번역 데이터의 모든 CRUD 작업과 낙관적 잠금을 지원합니다.
 */
export interface ITranslationRepository
  extends Omit<
      IBaseRepository<
        Translation,
        TranslationCreateData,
        TranslationUpdateData,
        TranslationFilters
      >,
      'createMany' | 'updateMany' | 'deleteMany'
    >,
    ILockableRepository<Translation> {
  /**
   * 번역 생성 (단일)
   * 
   * @param data - 생성 데이터
   * @returns 생성된 번역
   */
  create(data: TranslationCreateData): Promise<Translation>;

  /**
   * 번역 업데이트
   * 
   * @param id - 번역 ID
   * @param updates - 업데이트 데이터
   * @returns 업데이트된 번역
   * 
   * @note 낙관적 잠금이 필요한 경우 updateWithLock 사용
   */
  update(id: string, updates: TranslationUpdateData): Promise<Translation>;

  /**
   * 번역 삭제
   * 
   * @param id - 번역 ID
   */
  delete(id: string): Promise<void>;

  /**
   * 다중 상태 일괄 업데이트
   * 
   * @param ids - 업데이트할 번역 ID 목록
   * @param status - 변경할 상태
   */
  bulkUpdateStatus(ids: string[], status: TranslationStatus): Promise<void>;

  /**
   * 필터로 번역 ID 목록 조회
   * 
   * @param filters - 필터 조건
   * @returns 번역 ID 목록
   */
  getIdsByFilter(filters: TranslationFilters): Promise<string[]>;
}

// ============================================================================
// Translation Repository Provider Type
// ============================================================================

/**
 * Translation Repository Provider 함수 타입
 */
export type TranslationRepositoryProvider = () => ITranslationRepository;
