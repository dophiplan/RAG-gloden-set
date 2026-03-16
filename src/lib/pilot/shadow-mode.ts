/**
 * Shadow Mode Utility
 * 
 * 새 Provider로 쓰기를 시도하되, 실제 반영은 Legacy로 수행.
 * 결과를 비교하고 로깅만 수행 (롤백 예정)
 */

import { logger } from '@/lib/observability/logger';
import { isEnabled } from '@/lib/config/feature_flags';
import { recordShadowModeMetric } from './metrics-store';

export interface ShadowModeOptions {
  operation: string;
  entityType: string;
  entityId: string;
}

export interface ShadowModeResult<T> {
  legacyResult: T;
  providerResult?: T;
  match: boolean;
  duration: number;
}

/**
 * Shadow Mode로 작업 실행
 * @param operation 작업 함수 (Legacy)
 * @param shadowOperation 작업 함수 (Provider)
 * @param options Shadow Mode 옵션
 * @returns Legacy 결과
 */
export async function shadowWrite<T>(
  operation: () => Promise<T>,
  shadowOperation: () => Promise<T>,
  options: ShadowModeOptions
): Promise<T> {
  const { operation: opName, entityType, entityId } = options;
  const startTime = Date.now();
  
  // 1. Legacy로 실제 실행 (이 결과를 반환)
  const legacyResult = await operation();
  const legacyDuration = Date.now() - startTime;
  
  // 2. Shadow Mode가 활성화된 경우에만 Provider로 실행
  if (!isEnabled('FF_USERS_SHADOW_MODE')) {
    return legacyResult;
  }
  
  // 3. Provider로 Shadow 실행 (비동기, 결과 무시)
  const shadowStartTime = Date.now();
  try {
    const providerResult = await shadowOperation();
    const shadowDuration = Date.now() - shadowStartTime;
    
    // 4. 결과 비교
    const match = compareResults(legacyResult, providerResult);
    
    // 5. 로깅
    logger.info('[ShadowMode] Comparison result', {
      operation: opName,
      entityType,
      entityId,
      match,
      legacyDuration,
      shadowDuration,
      totalDuration: Date.now() - startTime,
    });
    
    // 6. 불일치 시 경고 로깅
    if (!match) {
      logShadowMismatch(opName, entityType, entityId, legacyResult, providerResult);
    }
    
    // 메트릭 기록
    recordShadowModeMetric({
      match,
      error: false,
    });
    
  } catch (error) {
    // Shadow 실패는 무시 (로깅만)
    logger.warn('[ShadowMode] Shadow operation failed (ignored)', {
      operation: opName,
      entityType,
      entityId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - shadowStartTime,
    });
    
    // 메트릭 기록
    recordShadowModeMetric({
      match: false,
      error: true,
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
function logShadowMismatch<T>(
  operation: string,
  entityType: string,
  entityId: string,
  legacy: T,
  provider: T
): void {
  logger.warn('[ShadowMode] MISMATCH DETECTED', {
    operation,
    entityType,
    entityId,
    legacy: JSON.stringify(legacy),
    provider: JSON.stringify(provider),
    timestamp: new Date().toISOString(),
  });
  
  // TODO: 불일치가 임계치 초과 시 알림 발송
  // alertShadowMismatch(operation, entityType, entityId);
}

/**
 * Shadow Mode 통계 조회
 */
export async function getShadowModeStats(): Promise<{
  totalOperations: number;
  matchCount: number;
  mismatchCount: number;
  errorCount: number;
}> {
  // TODO: 실제 통계 구현 (메트릭 저장 필요)
  return {
    totalOperations: 0,
    matchCount: 0,
    mismatchCount: 0,
    errorCount: 0,
  };
}
