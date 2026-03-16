/**
 * Feature Flag System
 * 
 * 안전한 롤백을 위한 Feature Flag 관리 시스템
 * 
 * @example
 * ```typescript
 * // 기본 사용법
 * if (isEnabled('USE_SQLITE_GLOSSARY')) {
 *   // SQLite glossary 기능 사용
 * }
 * 
 * // 사용자별 점진적 롤아웃
 * if (isEnabledForUser('USE_SQLITE_GLOSSARY', userId)) {
 *   // 특정 사용자만 활성화
 * }
 * 
 * // 환경변수로 오버라이드
 * // FF_USE_SQLITE_GLOSSARY=true npm run dev
 * ```
 */

import { logger } from '@/lib/observability/logger';

// ============================================================================
// Feature Flag Types
// ============================================================================

/**
 * 사용 가능한 Feature Flag 목록
 */
export type FeatureFlag =
  | 'USE_SQLITE_GLOSSARY'
  | 'USE_SQLITE_TRANSLATION_AUDIT'
  | 'USE_PROVIDER_PATTERN_USERS'
  | 'USE_PROVIDER_PATTERN_TRANSLATIONS'
  | 'FF_PILOT_HEALTH_API'
  | 'FF_PILOT_PLATFORMS_API'
  // ============================================
  // /api/users Shadow Mode Flags
  // 위험도: HIGH - 순서대로 진행 필요
  // 진입 조건: 이전 단계 검증 완료 후 수동 활성화
  // ============================================
  | 'FF_USERS_SHADOW_MODE'      // 위험도: LOW  - SQLite 병행쓰기+비교만 수행
  | 'FF_USERS_DARK_LAUNCH'      // 위험도: MED  - 병렬 실행, 결과는 Supabase 사용
  | 'FF_USERS_DUAL_WRITE'       // 위험도: HIGH - 양쪽 동시 쓰기, Supabase 기준
  | 'FF_USERS_FULL_CUTOVER';    // 위험도: CRIT - 완전 전환, 롤백 플랜 필수

/**
 * Feature Flag 설정
 */
export interface FeatureFlagConfig {
  /** 기본값 (false = 비활성화) */
  defaultValue: boolean;
  /** 설명 */
  description: string;
  /** 점진적 롤아웃 비율 (0-100, undefined = 전체 적용) */
  rolloutPercentage?: number;
  /** 생성일 */
  createdAt: string;
  /** 만료일 (선택적 - 플래그 정리용) */
  expiresAt?: string;
}

// ============================================================================
// Feature Flag Definitions
// ============================================================================

/**
 * Feature Flag 정의
 * 
 * 모든 플래그는 기본적으로 비활성화(false)되어 있어야 합니다.
 * 활성화는 환경변수나 Admin API를 통해 제어됩니다.
 */
export const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  USE_SQLITE_GLOSSARY: {
    defaultValue: false,
    description: 'Use SQLite for Glossary repository instead of Supabase',
    rolloutPercentage: 0, // 0% = 완전히 비활성화
    createdAt: '2026-03-15',
  },
  USE_SQLITE_TRANSLATION_AUDIT: {
    defaultValue: false,
    description: 'Use SQLite for Translation Audit repository instead of Supabase',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  USE_PROVIDER_PATTERN_USERS: {
    defaultValue: false,
    description: 'Use Provider pattern for User repository (allows SQLite/Supabase switching)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  USE_PROVIDER_PATTERN_TRANSLATIONS: {
    defaultValue: false,
    description: 'Use Provider pattern for Translation repository (allows SQLite/Supabase switching)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  FF_PILOT_HEALTH_API: {
    defaultValue: false,
    description: 'Use Provider pattern for /api/health',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  FF_PILOT_PLATFORMS_API: {
    defaultValue: false,
    description: 'Use Provider pattern for /api/platforms (GET only)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  // ============================================
  // /api/users Shadow Mode Flags
  // ============================================
  FF_USERS_SHADOW_MODE: {
    defaultValue: false,
    description: 'Enable Shadow Mode for /api/users writes (SQLite write + compare)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  FF_USERS_DARK_LAUNCH: {
    defaultValue: false,
    description: 'Enable Dark Launch for /api/users reads (parallel execution)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  FF_USERS_DUAL_WRITE: {
    defaultValue: false,
    description: 'Enable Dual Write for /api/users (write to both)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
  FF_USERS_FULL_CUTOVER: {
    defaultValue: false,
    description: 'Enable Full Cutover for /api/users (complete Provider migration)',
    rolloutPercentage: 0,
    createdAt: '2026-03-15',
  },
};

// ============================================================================
// Runtime State (for admin API control)
// ============================================================================

/**
 * 런타임 Feature Flag 상태 저장소
 * 
 * 환경변수 > 런타임 설정 > 기본값 순으로 우선순위가 적용됩니다.
 */
const runtimeFlagState: Map<FeatureFlag, boolean> = new Map();

/**
 * 마지막 상태 변경 시간
 */
let lastStateChangeAt: string | null = null;

// ============================================================================
// Hash Function (for consistent user-based rollout)
// ============================================================================

/**
 * 문자열을 숫자 해시로 변환 (FNV-1a 알고리즘)
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // Convert to unsigned 32-bit
}

/**
 * 사용자 ID를 기반으로 0-99 사이의 일관된 값 생성
 */
function getUserRolloutBucket(userId: string): number {
  return fnv1aHash(userId) % 100;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * 환경변수에서 Feature Flag 값 읽기
 * 
 * 환경변수명: FF_<FLAG_NAME>
 * 예: FF_USE_SQLITE_GLOSSARY=true
 */
function getEnvValue(flag: FeatureFlag): boolean | null {
  const envKey = `FF_${flag}`;
  const envValue = process.env[envKey];

  if (envValue === undefined) {
    return null;
  }

  return envValue.toLowerCase() === 'true' || envValue === '1';
}

/**
 * Feature Flag 활성화 여부 확인
 * 
 * 우선순위:
 * 1. 환경변수 (FF_*)
 * 2. 런타임 설정 (Admin API로 설정)
 * 3. 기본값
 */
export function isEnabled(flag: FeatureFlag): boolean {
  // 1. 환경변수 확인 (최우선)
  const envValue = getEnvValue(flag);
  if (envValue !== null) {
    return envValue;
  }

  // 2. 런타임 설정 확인
  if (runtimeFlagState.has(flag)) {
    return runtimeFlagState.get(flag)!;
  }

  // 3. 기본값 반환
  return FEATURE_FLAGS[flag].defaultValue;
}

/**
 * 사용자별 Feature Flag 활성화 여부 확인
 * 
 * 점진적 롤아웃(rollout percentage)을 고려하여 사용자별로 활성화 여부를 결정합니다.
 * 동일한 사용자 ID는 항상 동일한 결과를 반환합니다.
 * 
 * @param flag - 확인할 Feature Flag
 * @param userId - 사용자 ID
 * @returns 활성화 여부
 * 
 * @example
 * ```typescript
 * // 10%의 사용자에게만 활성화
 * if (isEnabledForUser('NEW_FEATURE', user.id)) {
 *   // 10% 사용자만 이 코드 실행
 * }
 * ```
 */
export function isEnabledForUser(flag: FeatureFlag, userId: string): boolean {
  // 먼저 전체 활성화 여부 확인
  const flagConfig = FEATURE_FLAGS[flag];

  // 환경변수가 설정된 경우 (전체 적용)
  const envValue = getEnvValue(flag);
  if (envValue !== null) {
    return envValue;
  }

  // 런타임 설정이 있는 경우 (전체 적용)
  if (runtimeFlagState.has(flag)) {
    return runtimeFlagState.get(flag)!;
  }

  // 기본값이 false면 점진적 롤아웃도 적용되지 않음
  if (!flagConfig.defaultValue) {
    const percentage = flagConfig.rolloutPercentage ?? 0;
    if (percentage === 0) {
      return false;
    }

    // 사용자 ID를 기반으로 일관된 버킷 할당
    const userBucket = getUserRolloutBucket(userId);
    return userBucket < percentage;
  }

  return flagConfig.defaultValue;
}

/**
 * 모든 Feature Flag 상태 조회
 */
export function getAllFlags(): Record<FeatureFlag, { enabled: boolean; source: 'env' | 'runtime' | 'default'; config: FeatureFlagConfig }> {
  const result = {} as Record<FeatureFlag, { enabled: boolean; source: 'env' | 'runtime' | 'default'; config: FeatureFlagConfig }>;

  for (const flag of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
    const envValue = getEnvValue(flag);
    const runtimeValue = runtimeFlagState.get(flag);

    let source: 'env' | 'runtime' | 'default';
    let enabled: boolean;

    if (envValue !== null) {
      source = 'env';
      enabled = envValue;
    } else if (runtimeValue !== undefined) {
      source = 'runtime';
      enabled = runtimeValue;
    } else {
      source = 'default';
      enabled = FEATURE_FLAGS[flag].defaultValue;
    }

    result[flag] = {
      enabled,
      source,
      config: FEATURE_FLAGS[flag],
    };
  }

  return result;
}

// ============================================================================
// Admin API Functions
// ============================================================================

/**
 * Feature Flag 런타임 상태 변경
 * 
 * @param flag - 변경할 Feature Flag
 * @param enabled - 활성화 여부
 * @param changedBy - 변경자 정보 (로깅용)
 * @returns 변경 성공 여부
 */
export function setFlag(flag: FeatureFlag, enabled: boolean, changedBy?: string): boolean {
  try {
    const previousValue = isEnabled(flag);
    runtimeFlagState.set(flag, enabled);
    lastStateChangeAt = new Date().toISOString();

    // 로깅
    logger.info('Feature Flag 상태 변경', {
      flag,
      previousValue,
      newValue: enabled,
      changedBy: changedBy || 'unknown',
      timestamp: lastStateChangeAt,
    });

    return true;
  } catch (error) {
    logger.error('Feature Flag 상태 변경 실패', error as Error, { flag, enabled });
    return false;
  }
}

/**
 * Feature Flag를 기본값으로 리셋
 * 
 * @param flag - 리셋할 Feature Flag
 * @param changedBy - 변경자 정보 (로깅용)
 */
export function resetFlag(flag: FeatureFlag, changedBy?: string): boolean {
  try {
    const previousValue = runtimeFlagState.get(flag);
    runtimeFlagState.delete(flag);
    lastStateChangeAt = new Date().toISOString();

    logger.info('Feature Flag 리셋', {
      flag,
      previousRuntimeValue: previousValue,
      changedBy: changedBy || 'unknown',
      timestamp: lastStateChangeAt,
    });

    return true;
  } catch (error) {
    logger.error('Feature Flag 리셋 실패', error as Error, { flag });
    return false;
  }
}

/**
 * 모든 Feature Flag를 기본값으로 리셋
 * 
 * @param changedBy - 변경자 정보 (로깅용)
 */
export function resetAllFlags(changedBy?: string): boolean {
  try {
    const previousState = new Map(runtimeFlagState);
    runtimeFlagState.clear();
    lastStateChangeAt = new Date().toISOString();

    logger.info('모든 Feature Flag 리셋', {
      resetCount: previousState.size,
      changedBy: changedBy || 'unknown',
      timestamp: lastStateChangeAt,
    });

    return true;
  } catch (error) {
    logger.error('Feature Flag 전체 리셋 실패', error as Error);
    return false;
  }
}

/**
 * 마지막 상태 변경 시간 조회
 */
export function getLastStateChangeAt(): string | null {
  return lastStateChangeAt;
}

/**
 * 현재 런타임 설정된 플래그 목록 조회
 */
export function getRuntimeFlags(): Record<string, boolean> {
  return Object.fromEntries(runtimeFlagState);
}

// ============================================================================
// Safety Guards
// ============================================================================

/**
 * 모든 Feature Flag가 비활성화되어 있는지 확인
 * (안전한 롤백을 위한 긴급 체크)
 */
export function areAllFlagsDisabled(): boolean {
  return Object.keys(FEATURE_FLAGS).every((flag) => !isEnabled(flag as FeatureFlag));
}

/**
 * 활성화된 Feature Flag 목록 조회
 */
export function getEnabledFlags(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter((flag) => isEnabled(flag));
}

/**
 * Feature Flag 유효성 검사
 */
export function isValidFlag(value: string): value is FeatureFlag {
  return value in FEATURE_FLAGS;
}

// ============================================================================
// React Hook (Client-side support)
// ============================================================================

/**
 * 클라이언트 사이드에서 Feature Flag 상태 가져오기
 * 
 * @note 서버에서 전달된 초기 상태를 사용하거나 API를 호출합니다.
 */
export async function fetchFeatureFlags(): Promise<Record<FeatureFlag, boolean>> {
  try {
    const response = await fetch('/api/admin/feature-flags');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.flags;
  } catch (error) {
    logger.error('Feature Flag 조회 실패', error as Error);
    // 실패 시 모든 플래그 비활성화 (안전한 기본값)
    return Object.keys(FEATURE_FLAGS).reduce((acc, flag) => {
      acc[flag as FeatureFlag] = false;
      return acc;
    }, {} as Record<FeatureFlag, boolean>);
  }
}
