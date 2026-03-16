/**
 * Supabase Extension Interfaces
 * 
 * Supabase 특화 기능(upsert, rpc 등)을 위한 확장 인터페이스
 * 
 * 일반적인 Repository 인터페이스와 분리하여,
 * 다른 데이터베이스 제공자로 마이그레이션 시 영향을 최소화합니다.
 * 
 * @example
 * ```typescript
 * // Supabase 특화 기능이 필요한 경우
 * class SupabaseGlossaryRepository 
 *   implements IGlossaryRepository, ISupabaseRpcRepository {
 *   
 *   async incrementHitCount(term: string, languageCode: string) {
 *     return this.rpc('increment_hit_count', { 
 *       p_term: term, 
 *       p_language_code: languageCode 
 *     });
 *   }
 * }
 * ```
 */

// ============================================================================
// Supabase Upsert Interface
// ============================================================================

/**
 * Upsert 옵션
 */
export interface UpsertOptions {
  /** 충돌 시 업데이트할 컬럼 */
  onConflict?: string;
  /** 중복 시 무시 */
  ignoreDuplicates?: boolean;
}

/**
 * Supabase Upsert 기능 인터페이스
 * 
 * @template T - Entity 타입
 * @template CreateData - 생성/업데이트 데이터 타입
 */
export interface ISupabaseUpsertRepository<T, CreateData = Partial<T>> {
  /**
   * Upsert (Insert or Update)
   * 
   * @param data - 생성/업데이트 데이터
   * @param options - Upsert 옵션
   * @returns 생성되거나 업데이트된 항목
   */
  upsert(data: CreateData, options?: UpsertOptions): Promise<T>;

  /**
   * 다중 Upsert
   * 
   * @param items - 생성/업데이트 데이터 목록
   * @param options - Upsert 옵션
   * @returns 생성되거나 업데이트된 항목 목록
   */
  upsertMany(items: CreateData[], options?: UpsertOptions): Promise<T[]>;
}

// ============================================================================
// Supabase RPC Interface
// ============================================================================

/**
 * RPC 호출 옵션
 */
export interface RpcOptions {
  /** 호출 파라미터 */
  params?: Record<string, unknown>;
  /** 헤더 옵션 */
  headers?: Record<string, string>;
}

/**
 * Supabase RPC 기능 인터페이스
 * 
 * 데이터베이스 함수를 호출하는 기능
 */
export interface ISupabaseRpcRepository {
  /**
   * RPC 함수 호출
   * 
   * @param functionName - 함수명
   * @param params - 함수 파라미터
   * @returns 함수 반환값
   */
  rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<T>;

  /**
   * RPC 함수 호출 (옵션 포함)
   * 
   * @param functionName - 함수명
   * @param options - RPC 옵션
   * @returns 함수 반환값
   */
  rpcWithOptions<T = unknown>(functionName: string, options?: RpcOptions): Promise<T>;
}

// ============================================================================
// Supabase Realtime Interface
// ============================================================================

/**
 * 실시간 이벤트 타입
 */
export type RealtimeEve[기밀마스킹]ype = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * 실시간 구독 콜백
 */
export type RealtimeCallback<T> = (payload: {
  eve[기밀마스킹]ype: RealtimeEve[기밀마스킹]ype;
  new: T | null;
  old: T | null;
}) => void;

/**
 * Supabase Realtime 기능 인터페이스
 * 
 * 실시간 구독 기능
 */
export interface ISupabaseRealtimeRepository<T> {
  /**
   * 실시간 변경 구독
   * 
   * @param callback - 이벤트 콜백
   * @param eve[기밀마스킹]ypes - 구독할 이벤트 타입
   * @returns 구독 해제 함수
   */
  subscribe(
    callback: RealtimeCallback<T>,
    eve[기밀마스킹]ypes?: RealtimeEve[기밀마스킹]ype[]
  ): () => void;

  /**
   * 특정 ID에 대한 실시간 변경 구독
   * 
   * @param id - 항목 ID
   * @param callback - 이벤트 콜백
   * @returns 구독 해제 함수
   */
  subscribeToId(id: string, callback: RealtimeCallback<T>): () => void;

  /**
   * 모든 구독 해제
   */
  unsubscribeAll(): void;
}

// ============================================================================
// Supabase Batch Interface
// ============================================================================

/**
 * 배치 작업 결과
 */
export interface BatchResult<T> {
  /** 성공한 항목들 */
  success: T[];
  /** 실패한 항목들 */
  failed: Array<{ item: T; error: string }>;
  /** 성공한 수 */
  successCount: number;
  /** 실패한 수 */
  failedCount: number;
}

/**
 * Supabase 배치 작업 인터페이스
 * 
 * 대량 데이터 처리 최적화
 */
export interface ISupabaseBatchRepository<T, CreateData = Partial<T>> {
  /**
   * 배치 크기 (기본값: 100)
   */
  readonly batchSize: number;

  /**
   * 배치 단위로 생성
   * 
   * @param items - 생성할 항목 목록
   * @returns 배치 작업 결과
   */
  createInBatches(items: CreateData[]): Promise<BatchResult<T>>;

  /**
   * 배치 단위로 업데이트
   * 
   * @param ids - 업데이트할 ID 목록
   * @param updates - 업데이트 데이터
   * @returns 배치 작업 결과
   */
  updateInBatches(ids: string[], updates: Partial<T>): Promise<BatchResult<T>>;

  /**
   * 배치 단위로 삭제
   * 
   * @param ids - 삭제할 ID 목록
   * @returns 삭제된 ID 목록
   */
  deleteInBatches(ids: string[]): Promise<string[]>;
}

// ============================================================================
// Combined Supabase Repository Interface
// ============================================================================

/**
 * 모든 Supabase 확장 기능을 포함하는 인터페이스
 * 
 * @template T - Entity 타입
 * @template CreateData - 생성 데이터 타입
 */
export interface ISupabaseExtendedRepository<T, CreateData = Partial<T>>
  extends ISupabaseUpsertRepository<T, CreateData>,
    ISupabaseRpcRepository,
    ISupabaseRealtimeRepository<T>,
    ISupabaseBatchRepository<T, CreateData> {}
