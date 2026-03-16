/**
 * Dark Launch Utility (Read Operations)
 * 
 * 읽기 작업에 대해 Provider를 Shadow 모드로 실행하고 결과를 비교.
 * 실제 응답은 Legacy로 반환하되, Provider 결과를 로깅하여 검증.
 * 
 * @example
 * ```typescript
 * return darkLaunchRead(
 *   () => getUsersLegacy(request),
 *   () => getUsersWithProvider(request),
 *   { operation: 'getUsers', endpoint: '/api/users' }
 * );
 * ```
 */

import { logger } from '@/lib/observability/logger';
import { isEnabled } from '@/lib/config/feature_flags';
import { recordDarkLaunchMetric } from './metrics-store';

export interface DarkLaunchOptions {
  /** 작업 이름 */
  operation: string;
  /** API 엔드포인트 경로 */
  endpoint?: string;
}

export interface DarkLaunchResult<T> {
  legacyResult: T;
  providerResult?: T;
  match: boolean;
  duration: number;
}

/**
 * Dark Launch로 읽기 작업 실행
 * @param legacyOperation Legacy 읽기 작업
 * @param providerOperation Provider 읽기 작업
 * @param options Dark Launch 옵션
 * @returns Legacy 결과 (실제 응답용)
 */
export async function darkLaunchRead<T>(
  legacyOperation: () => Promise<T>,
  providerOperation: () => Promise<T>,
  options: DarkLaunchOptions
): Promise<T> {
  const { operation, endpoint } = options;
  const startTime = Date.now();

  // 1. Legacy로 실제 실행 (이 결과를 반환)
  const legacyResult = await legacyOperation();
  const legacyDuration = Date.now() - startTime;

  // 2. Dark Launch가 활성화된 경우에만 Provider로 실행
  if (!isEnabled('FF_USERS_DARK_LAUNCH')) {
    return legacyResult;
  }

  // 3. Provider로 Shadow 실행 (비동기, 결과 무시)
  const providerStartTime = Date.now();
  try {
    const providerResult = await providerOperation();
    const providerDuration = Date.now() - providerStartTime;

    // 4. 결과 비교
    const match = compareResults(legacyResult, providerResult);

    // 5. 로깅
    logger.info('[DarkLaunch] Comparison result', {
      operation,
      endpoint,
      match,
      legacyDuration,
      providerDuration,
      totalDuration: Date.now() - startTime,
    });

    // 6. 불일치 시 경고 로깅
    if (!match) {
      logDarkLaunchMismatch(operation, endpoint, legacyResult, providerResult);
    }
    
    // 메트릭 기록
    recordDarkLaunchMetric({
      match,
      legacyDuration,
      providerDuration,
    });
  } catch (error) {
    // Provider 실패는 무시 (로깅만)
    logger.warn('[DarkLaunch] Provider operation failed (ignored)', {
      operation,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - providerStartTime,
    });
    
    // 메트릭 기록
    recordDarkLaunchMetric({
      match: false,
      providerError: true,
    });
  }

  return legacyResult;
}

/**
 * 결과 비교
 */
function compareResults<T>(legacy: T, provider: T): boolean {
  try {
    // JSON 직렬화 후 비교 (Date, undefined 등 처리)
    const legacyJson = JSON.stringify(legacy, replacer);
    const providerJson = JSON.stringify(provider, replacer);
    return legacyJson === providerJson;
  } catch {
    return false;
  }
}

/**
 * JSON replacer (Date 처리 등)
 */
function replacer(key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * 불일치 로깅
 */
function logDarkLaunchMismatch<T>(
  operation: string,
  endpoint: string | undefined,
  legacy: T,
  provider: T
): void {
  logger.warn('[DarkLaunch] MISMATCH DETECTED', {
    operation,
    endpoint,
    legacy: JSON.stringify(legacy).slice(0, 1000), // 로그 크기 제한
    provider: JSON.stringify(provider).slice(0, 1000),
    timestamp: new Date().toISOString(),
  });

  // TODO: 불일치가 임계치 초과 시 알림 발송
  // alertDarkLaunchMismatch(operation, endpoint);
}
