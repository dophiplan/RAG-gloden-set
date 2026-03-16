/**
 * Dual Write Utility
 * 
 * 쓰기 작업을 Legacy(Supabase)와 Provider(SQLite)에 동시에 실행.
 * Legacy가 Source of Truth.
 */

import { logger } from '@/lib/observability/logger';
import { isEnabled } from '@/lib/config/feature_flags';
import { recordDualWriteMetric } from './metrics-store';

export interface DualWriteOptions {
  operation: string;
  entityType: string;
  entityId: string;
  alertOnFailure?: boolean;
}

export interface DualWriteResult<T> {
  success: boolean;
  legacyResult?: T;
  providerResult?: T;
  legacySuccess: boolean;
  providerSuccess: boolean;
  requiresRecovery: boolean;
  error?: Error;
}

/**
 * Dual Write로 작업 실행
 * 
 * 1. Legacy(Supabase) 먼저 실행 (Source of Truth)
 * 2. Provider(SQLite) 실행
 * 3. Provider 실패 시 알림 + 복구 필요 플래그
 */
export async function dualWrite<T>(
  legacyOperation: () => Promise<T>,
  providerOperation: () => Promise<T>,
  options: DualWriteOptions
): Promise<DualWriteResult<T>> {
  const { operation, entityType, entityId, alertOnFailure = true } = options;
  const startTime = Date.now();

  // Feature Flag 체크
  if (!isEnabled('FF_USERS_DUAL_WRITE')) {
    const legacyResult = await legacyOperation();
    return {
      success: true,
      legacyResult,
      legacySuccess: true,
      providerSuccess: false,
      requiresRecovery: false,
    };
  }

  // 1. Legacy 먼저 실행 (Source of Truth)
  let legacyResult: T;
  try {
    legacyResult = await legacyOperation();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error(
      '[DualWrite] Legacy operation failed',
      errorObj,
      { operation, entityType, entityId }
    );
    
    recordDualWriteMetric({
      legacySuccess: false,
      providerSuccess: false,
      requiresRecovery: false,
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      legacySuccess: false,
      providerSuccess: false,
      error: errorObj,
      requiresRecovery: false,
    };
  }

  // 2. Provider 실행
  let providerResult: T | undefined;
  let providerSuccess = false;
  
  try {
    providerResult = await providerOperation();
    providerSuccess = true;
    
    logger.info('[DualWrite] Both operations succeeded', {
      operation,
      entityType,
      entityId,
      duration: Date.now() - startTime,
    });
    
    recordDualWriteMetric({
      legacySuccess: true,
      providerSuccess: true,
      requiresRecovery: false,
      duration: Date.now() - startTime,
    });
    
  } catch (error) {
    // Provider 실패 - 데이터 불일치 발생!
    providerSuccess = false;
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error(
      '[DualWrite] Provider operation failed - DATA INCONSISTENCY',
      errorObj,
      { operation, entityType, entityId }
    );

    // 알림 발송
    if (alertOnFailure) {
      alertDualWriteFailure(operation, entityType, entityId, error);
    }

    // 복구 필요 기록
    recordInconsistency(operation, entityType, entityId, legacyResult, error);

    recordDualWriteMetric({
      legacySuccess: true,
      providerSuccess: false,
      requiresRecovery: true,
      duration: Date.now() - startTime,
    });

    // Legacy는 성공했으므로 사용자에게는 성공으로 응답
    return {
      success: true,
      legacyResult,
      providerResult,
      legacySuccess: true,
      providerSuccess: false,
      error: errorObj,
      requiresRecovery: true,
    };
  }

  return {
    success: true,
    legacyResult,
    providerResult,
    legacySuccess: true,
    providerSuccess: true,
    requiresRecovery: false,
  };
}

/**
 * 데이터 불일치 기록
 */
async function recordInconsistency<T>(
  operation: string,
  entityType: string,
  entityId: string,
  legacyData: T,
  error: unknown
): Promise<void> {
  logger.warn('[DualWrite] Recording inconsistency for recovery', {
    operation,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  });
  // TODO: 별도 테이블에 기록
}

/**
 * Dual Write 실패 알림
 */
function alertDualWriteFailure(
  operation: string,
  entityType: string,
  entityId: string,
  error: unknown
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error(
    '[DualWrite] ALERT: Data inconsistency detected',
    errorObj,
    { operation, entityType, entityId, severity: 'HIGH' }
  );
  // TODO: Slack/Email 알림
}
