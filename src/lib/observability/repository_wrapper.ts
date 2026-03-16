/**
 * Repository Wrapper with Automatic Metrics Collection
 * 
 * Proxy를 사용하여 Repository의 모든 메서드를 자동으로 래핑하고
 * 메트릭을 수집합니다.
 * 
 * @example
 * ```typescript
 * const baseRepo = new SupabaseTranslationRepository(supabase);
 * const instrumentedRepo = withMetrics(baseRepo, 'supabase', 'translations');
 * ```
 */

import { metrics } from './metrics';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface RepositoryMetricsOptions {
  /** 데이터베이스 제공자 (supabase, sqlite 등) */
  provider: string;
  /** 테이블/엔티티 이름 */
  table?: string;
  /** 커스텀 메트릭 이름 접두사 */
  metricPrefix?: string;
  /** 로깅 활성화 여부 */
  enableLogging?: boolean;
  /** 에러 로깅 활성화 여부 */
  enableErrorLogging?: boolean;
}

// 메서드 타입 추론을 위한 유틸리티 타입
type AnyAsyncFunction = (...args: unknown[]) => Promise<unknown>;
type AnyFunction = (...args: unknown[]) => unknown;

// ============================================================================
// Method Classification
// ============================================================================

const QUERY_METHODS = ['find', 'get', 'select', 'count', 'exists'];
const WRITE_METHODS = ['create', 'insert', 'update', 'delete', 'upsert', 'bulk'];

/**
 * 메서드 타입 분류
 */
function classifyMethod(methodName: string): 'query' | 'write' | 'other' {
  const lowerName = methodName.toLowerCase();
  
  if (QUERY_METHODS.some(prefix => lowerName.startsWith(prefix))) {
    return 'query';
  }
  if (WRITE_METHODS.some(prefix => lowerName.startsWith(prefix))) {
    return 'write';
  }
  return 'other';
}

/**
 * 테이블 이름 추정
 */
function inferTableName(methodName: string, provider: string): string {
  // 메서드 이름에서 테이블 이름 추정
  const patterns = [
    /^(?:find|get|create|update|delete|bulk)(\w+?)(?:By|With|Where|Many|One)?$/i,
    /^(\w+?)(?:Repository|Repo)$/i,
  ];

  for (const pattern of patterns) {
    const match = methodName.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  // 기본값: provider 이름 사용
  return provider;
}

// ============================================================================
// Repository Wrapper
// ============================================================================

/**
 * Repository에 자동 계측 추가
 * 
 * @param repository - 원본 Repository 인스턴스
 * @param provider - 데이터베이스 제공자 이름
 * @param defaultTable - 기본 테이블 이름 (옵션)
 * @returns 계측된 Repository Proxy
 */
export function withMetrics<T extends object>(
  repository: T,
  provider: string,
  defaultTable?: string
): T {
  // 메트릭스 비활성화 시 원본 반환
  if (!metrics.isEnabled()) {
    return repository;
  }

  return new Proxy(repository, {
    get(target, prop: string | symbol) {
      const value = (target as Record<string | symbol, unknown>)[prop];

      // 메서드가 아니면 그대로 반환
      if (typeof value !== 'function') {
        return value;
      }

      // 내장 메서드나 private 메서드 스킵
      if (typeof prop !== 'string' || prop.startsWith('_') || prop === 'constructor') {
        return value;
      }

      // 래핑된 메서드 반환
      return async function (...args: unknown[]) {
        const startTime = Date.now();
        const methodType = classifyMethod(prop as string);
        const table = defaultTable || inferTableName(prop as string, provider);
        const operation = prop as string;

        try {
          // 원본 메서드 실행
          const result = await (value as AnyAsyncFunction).apply(target, args);

          // 성공 메트릭 기록
          const duration = Date.now() - startTime;
          metrics.recordQueryDuration(provider, table, duration, operation);

          // 디버그 로그
          if (process.env.LOG_LEVEL === 'debug') {
            logger.debug(`Repository ${operation} completed`, {
              provider,
              table,
              operation,
              duration,
            });
          }

          return result;
        } catch (error) {
          // 에러 메트릭 기록
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          metrics.recordQueryDuration(provider, table, duration, operation);
          metrics.recordQueryError(provider, table, errorMessage);

          // 에러 로그
          logger.error(
            `Repository ${operation} failed`,
            error instanceof Error ? error : new Error(String(error)),
            {
              provider,
              table,
              operation,
              duration,
            }
          );

          throw error;
        }
      };
    },
  }) as T;
}

// ============================================================================
// Advanced Repository Wrapper with Custom Options
// ============================================================================

/**
 * 고급 Repository 계측 (옵션 지원)
 * 
 * @param repository - 원본 Repository 인스턴스
 * @param options - 계측 옵션
 * @returns 계측된 Repository Proxy
 */
export function withMetricsAdvanced<T extends object>(
  repository: T,
  options: RepositoryMetricsOptions
): T {
  const {
    provider,
    table: defaultTable,
    enableLogging = true,
    enableErrorLogging = true,
  } = options;

  if (!metrics.isEnabled()) {
    return repository;
  }

  return new Proxy(repository, {
    get(target, prop: string | symbol) {
      const value = (target as Record<string | symbol, unknown>)[prop];

      if (typeof value !== 'function') {
        return value;
      }

      if (typeof prop !== 'string' || prop.startsWith('_') || prop === 'constructor') {
        return value;
      }

      return async function (...args: unknown[]) {
        const startTime = Date.now();
        const table = defaultTable || inferTableName(prop as string, provider);
        const operation = prop as string;

        try {
          const result = await (value as AnyAsyncFunction).apply(target, args);
          const duration = Date.now() - startTime;

          metrics.recordQueryDuration(provider, table, duration, operation);

          if (enableLogging && process.env.LOG_LEVEL === 'debug') {
            logger.debug(`Repository ${operation} completed`, {
              provider,
              table,
              operation,
              duration,
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          metrics.recordQueryDuration(provider, table, duration, operation);
          metrics.recordQueryError(provider, table, errorMessage);

          if (enableErrorLogging) {
            logger.error(
              `Repository ${operation} failed`,
              error instanceof Error ? error : new Error(String(error)),
              {
                provider,
                table,
                operation,
                duration,
              }
            );
          }

          throw error;
        }
      };
    },
  }) as T;
}

// ============================================================================
// Batch Operation Wrapper
// ============================================================================

/**
 * 배치 작업 계측
 * 
 * @param operation - 실행할 작업 함수
 * @param options - 계측 옵션
 * @returns 작업 결과
 */
export async function withBatchMetrics<T>(
  operation: () => Promise<T>,
  options: {
    provider: string;
    table: string;
    operationName: string;
    itemCount: number;
  }
): Promise<T> {
  const { provider, table, operationName, itemCount } = options;
  const startTime = Date.now();

  try {
    const result = await operation();
    const duration = Date.now() - startTime;

    metrics.recordQueryDuration(provider, table, duration, operationName);
    
    logger.info(`Batch ${operationName} completed`, {
      provider,
      table,
      operation: operationName,
      duration,
      itemCount,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    metrics.recordQueryDuration(provider, table, duration, operationName);
    metrics.recordQueryError(provider, table, errorMessage);

    logger.error(
      `Batch ${operationName} failed`,
      error instanceof Error ? error : new Error(String(error)),
      {
        provider,
        table,
        operation: operationName,
        duration,
        itemCount,
      }
    );

    throw error;
  }
}

// ============================================================================
// Repository Factory Helper
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Repository 타입 생성자
 */
export type RepositoryConstructor<T> = new (client: SupabaseClient) => T;

/**
 * 계측된 Repository 생성 팩토리
 * 
 * @param RepositoryClass - Repository 클래스
 * @param client - Supabase 클라이언트
 * @param provider - 데이터베이스 제공자
 * @param table - 테이블 이름
 * @returns 계측된 Repository 인스턴스
 */
export function createInstrumentedRepository<T extends object>(
  RepositoryClass: RepositoryConstructor<T>,
  client: SupabaseClient,
  provider: string,
  table: string
): T {
  const repository = new RepositoryClass(client);
  return withMetrics(repository, provider, table);
}

// ============================================================================
// Query Builder Wrapper
// ============================================================================

/**
 * 쿼리 빌더 계측
 * 
 * @param queryBuilder - 쿼리 빌더 함수
 * @param options - 계측 옵션
 * @returns 계측된 쿼리 결과
 */
export async function instrumentQuery<T>(
  queryBuilder: () => Promise<T>,
  options: {
    provider: string;
    table: string;
    operation: string;
  }
): Promise<T> {
  return withBatchMetrics(queryBuilder, {
    ...options,
    operationName: options.operation,
    itemCount: 1,
  });
}
