/**
 * API Route Helpers
 * 
 * API 라우트에서 Observability를 쉽게 사용할 수 있는 헬퍼 함수
 * 
 * @example
 * ```typescript
 * import { withApiInstrumentation } from '@/lib/observability/api_helpers';
 * 
 * export const GET = withApiInstrumentation(
 *   async (request) => {
 *     // 비즈니스 로직
 *     return Response.json(data);
 *   },
 *   { component: 'TranslationApi' }
 * );
 * ```
 */

import { logger, getContextLogger, extractContextFromRequest, generateRequestId } from './logger';
import { metrics } from './metrics';
import type { NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface ApiInstrumentationOptions {
  /** 컴포넌트 이름 (로깅용) */
  component?: string;
  /** 커스텀 비즈니스 메트릭 기록 함수 */
  recordMetrics?: (data: unknown, duration: number) => void;
  /** 에러 발생 시 추가 처리 */
  onError?: (error: Error, duration: number) => void;
}

export interface ApiHandler {
  (request: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<Response>;
}

// ============================================================================
// API Route Wrapper
// ============================================================================

/**
 * API 라우트 자동 계측
 * 
 * - 요청/응답 로깅
 - 지연 시간 측정
 - 에러 추적
 * - 메트릭 기록
 */
export function withApiInstrumentation(
  handler: ApiHandler,
  options: ApiInstrumentationOptions = {}
): ApiHandler {
  const { component = 'ApiRoute', recordMetrics, onError } = options;

  return async function (request: NextRequest, context?: { params?: Promise<Record<string, string>> }): Promise<Response> {
    const start = Date.now();
    const path = request.nextUrl.pathname;
    const method = request.method;
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    
    // 요청 컨텍스트 로거 생성
    const requestLogger = getContextLogger(component);
    
    // 요청 시작 로그
    requestLogger.info(`${method} ${path} started`, {
      requestId,
      path,
      method,
      query: Object.fromEntries(request.nextUrl.searchParams),
    });

    try {
      // 핸들러 실행
      const response = await handler(request, context);
      const duration = Date.now() - start;
      
      // 성공 메트릭 기록
      metrics.recordApiLatency(path, method, duration, response.status);
      
      // 커스텀 메트릭 기록 (옵션)
      if (recordMetrics) {
        try {
          // 응답 본문 파싱 (JSON인 경우)
          if (response.headers.get('content-type')?.includes('application/json')) {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            recordMetrics(data, duration);
          }
        } catch {
          // 메트릭 기록 실패는 무시
        }
      }

      // 응답 로그
      const baseLogContext = {
        requestId,
        path,
        method,
        statusCode: response.status,
        duration,
      };
      
      if (response.status >= 500) {
        requestLogger.error(`${method} ${path} completed with server error`, new Error(`HTTP ${response.status}`), baseLogContext);
      } else if (response.status >= 400) {
        requestLogger.warn(`${method} ${path} completed with client error`, baseLogContext);
      } else {
        requestLogger.info(`${method} ${path} completed`, baseLogContext);
      }

      // 요청 ID 헤더 추가
      response.headers.set('x-request-id', requestId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      
      // 에러 메트릭 기록
      metrics.recordApiLatency(path, method, duration, 500);
      metrics.recordError('api', component);
      
      // 에러 로그
      requestLogger.error(
        `${method} ${path} failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          requestId,
          path,
          method,
          duration,
        }
      );

      // 커스텀 에러 처리
      if (onError && error instanceof Error) {
        onError(error, duration);
      }

      throw error;
    }
  };
}

// ============================================================================
// Repository Usage Helper
// ============================================================================

import { withMetrics } from './repository_wrapper';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Repository 생성 및 계측 헬퍼
 * 
 * @example
 * ```typescript
 * const repo = createRepository(
 *   supabase,
 *   SupabaseTranslationRepository,
 *   'translations'
 * );
 * ```
 */
export function createRepository<T extends object>(
  supabase: SupabaseClient,
  RepositoryClass: new (client: SupabaseClient) => T,
  tableName: string,
  provider: string = 'supabase'
): T {
  const repo = new RepositoryClass(supabase);
  return withMetrics(repo, provider, tableName);
}

// ============================================================================
// Performance Monitoring
// ============================================================================

interface PerformanceEntry {
  name: string;
  startTime: number;
  duration: number;
}

const performanceEntries: PerformanceEntry[] = [];
const MAX_ENTRIES = 1000;

/**
 * 성능 측정 데코레이터 (런타임)
 */
export function measure<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T
): T {
  return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    const start = performance.now();
    try {
      return (await fn(...args)) as ReturnType<T>;
    } finally {
      const duration = performance.now() - start;
      performanceEntries.push({
        name,
        startTime: Date.now(),
        duration,
      });
      
      // 오래된 엔트리 제거
      if (performanceEntries.length > MAX_ENTRIES) {
        performanceEntries.shift();
      }
      
      // 느린 작업 경고
      if (duration > 1000) {
        logger.warn(`Slow operation detected: ${name}`, {
          duration: Math.round(duration),
          threshold: 1000,
        });
      }
    }
  } as T;
}

/**
 * 성능 리포트 가져오기
 */
export function getPerformanceReport(): {
  entries: PerformanceEntry[];
  slowOperations: PerformanceEntry[];
  averageDuration: number;
} {
  const slowOperations = performanceEntries.filter(e => e.duration > 500);
  const averageDuration = performanceEntries.length > 0
    ? performanceEntries.reduce((sum, e) => sum + e.duration, 0) / performanceEntries.length
    : 0;

  return {
    entries: [...performanceEntries],
    slowOperations,
    averageDuration: Math.round(averageDuration),
  };
}

// ============================================================================
// Error Tracking
// ============================================================================

interface ErrorEntry {
  timestamp: number;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

const errorEntries: ErrorEntry[] = [];
const MAX_ERROR_ENTRIES = 100;

/**
 * 에러 추적
 */
export function trackError(
  error: Error,
  context?: Record<string, unknown>
): void {
  errorEntries.push({
    timestamp: Date.now(),
    message: error.message,
    stack: error.stack,
    context,
  });

  if (errorEntries.length > MAX_ERROR_ENTRIES) {
    errorEntries.shift();
  }

  metrics.recordError(error.name, context?.component as string || 'unknown');
}

/**
 * 에러 리포트 가져오기
 */
export function getErrorReport(): {
  recent: ErrorEntry[];
  count: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  
  for (const entry of errorEntries) {
    const type = entry.message.split(':')[0] || 'Unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    recent: [...errorEntries].reverse(),
    count: errorEntries.length,
    byType,
  };
}
