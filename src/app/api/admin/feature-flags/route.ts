/**
 * Feature Flag Admin API
 * 
 * 런타임에 Feature Flag를 제어하는 Admin API
 * 
 * @endpoint GET /api/admin/feature-flags
 * @endpoint POST /api/admin/feature-flags
 * @endpoint DELETE /api/admin/feature-flags
 * 
 * @security Admin Secret (x-admin-secret header) 또는 Master 권한 필요
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  isEnabled,
  getAllFlags,
  setFlag,
  resetFlag,
  resetAllFlags,
  getLastStateChangeAt,
  getRuntimeFlags,
  getEnabledFlags,
  isValidFlag,
  type FeatureFlag,
} from '@/lib/config/feature_flags';
import { logger } from '@/lib/observability/logger';

// ============================================================================
// Security
// ============================================================================

/**
 * 관리자 권한 확인
 */
async function verifyAdminAccess(request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  // 1. Admin Secret 확인 (헤더 기반)
  const adminSecret = process.env.ADMIN_SECRET;
  const headerSecret = request.headers.get('x-admin-secret');

  if (adminSecret && headerSecret === adminSecret) {
    return { authorized: true, userId: 'admin-secret' };
  }

  // 2. 개발 환경에서 Admin Secret이 없는 경우 경고만 출력
  if (!adminSecret && process.env.NODE_ENV === 'development') {
    logger.warn('⚠️  ADMIN_SECRET not set - using session-based auth only');
  }

  // 3. 세션 기반 인증 확인
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { authorized: false, error: 'Unauthorized: No valid session' };
    }

    // Master 권한 확인
    const adminClient = createAdminClient();
    const { data: userData, error: userError } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { authorized: false, error: 'Unauthorized: User not found' };
    }

    const isMaster = userData.roles?.includes('master');
    if (!isMaster) {
      return { authorized: false, error: 'Forbidden: Master role required' };
    }

    return { authorized: true, userId: user.id };
  } catch (error) {
    logger.error('Admin 인증 실패', error as Error);
    return { authorized: false, error: 'Internal authentication error' };
  }
}

// ============================================================================
// GET: 현재 Feature Flag 상태 조회
// ============================================================================

/**
 * @api {get} /api/admin/feature-flags 모든 Feature Flag 상태 조회
 * @apiName GetFeatureFlags
 * @apiGroup Admin
 * @apiPermission master
 * 
 * @apiHeader {String} x-admin-secret Admin Secret (optional if session auth)
 * 
 * @apiSuccess {Object} flags 각 Feature Flag의 활성화 상태
 * @apiSuccess {String[]} enabled 현재 활성화된 플래그 목록
 * @apiSuccess {Object} runtime 런타임으로 설정된 플래그 목록
 * @apiSuccess {String} lastChangedAt 마지막 상태 변경 시간
 * 
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "flags": {
 *         "USE_SQLITE_GLOSSARY": {
 *           "enabled": false,
 *           "source": "default",
 *           "config": { ... }
 *         },
 *         ...
 *       },
 *       "enabled": [],
 *       "runtime": {},
 *       "lastChangedAt": null
 *     }
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAccess(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const flags = getAllFlags();
    const enabled = getEnabledFlags();
    const runtime = getRuntimeFlags();
    const lastChangedAt = getLastStateChangeAt();

    logger.info('Feature Flag 상태 조회', {
      userId: auth.userId,
      enabledCount: enabled.length,
    });

    return NextResponse.json({
      flags,
      enabled,
      runtime,
      lastChangedAt,
    });
  } catch (error) {
    logger.error('Feature Flag 조회 API 오류', error as Error);
    return NextResponse.json(
      { error: 'Failed to retrieve feature flags' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Feature Flag 토글
// ============================================================================

interface PostBody {
  /** 변경할 Feature Flag */
  flag: FeatureFlag;
  /** 활성화 여부 */
  enabled: boolean;
}

/**
 * @api {post} /api/admin/feature-flags Feature Flag 상태 변경
 * @apiName SetFeatureFlag
 * @apiGroup Admin
 * @apiPermission master
 * 
 * @apiHeader {String} x-admin-secret Admin Secret (optional if session auth)
 * @apiHeader {String} Content-Type application/json
 * 
 * @apiParam {String} flag 변경할 Feature Flag 이름
 * @apiParam {Boolean} enabled 활성화 여부
 * 
 * @apiSuccess {Boolean} success 성공 여부
 * @apiSuccess {String} flag 변경된 플래그 이름
 * @apiSuccess {Boolean} enabled 새로운 상태
 * @apiSuccess {String} changedBy 변경자 ID
 * 
 * @apiError {String} error 오류 메시지
 * @apiError {String} details 상세 오류 정보
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAccess(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json() as PostBody;
    const { flag, enabled } = body;

    // 유효성 검사
    if (!flag || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body. Required: flag (string), enabled (boolean)' },
        { status: 400 }
      );
    }

    if (!isValidFlag(flag)) {
      const validFlags = Object.keys(getAllFlags()).join(', ');
      return NextResponse.json(
        { error: `Invalid flag: ${flag}. Valid flags: ${validFlags}` },
        { status: 400 }
      );
    }

    // Feature Flag 변경
    const success = setFlag(flag, enabled, auth.userId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update feature flag' },
        { status: 500 }
      );
    }

    // 환경변수로 오버라이드된 경우 경고
    const envKey = `FF_${flag}`;
    if (process.env[envKey] !== undefined) {
      logger.warn(`Feature Flag '${flag}' is overridden by environment variable ${envKey}`, {
        envValue: process.env[envKey],
        runtimeValue: enabled,
      });
    }

    return NextResponse.json({
      success: true,
      flag,
      enabled,
      changedBy: auth.userId,
      note: process.env[envKey] !== undefined 
        ? `Note: This flag is currently overridden by environment variable ${envKey}=${process.env[envKey]}` 
        : undefined,
    });
  } catch (error) {
    logger.error('Feature Flag 변경 API 오류', error as Error);
    return NextResponse.json(
      { error: 'Failed to update feature flag', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Feature Flag 리셋
// ============================================================================

interface DeleteBody {
  /** 리셋할 Feature Flag (undefined = 전체 리셋) */
  flag?: FeatureFlag;
}

/**
 * @api {delete} /api/admin/feature-flags Feature Flag 리셋
 * @apiName ResetFeatureFlag
 * @apiGroup Admin
 * @apiPermission master
 * 
 * @apiHeader {String} x-admin-secret Admin Secret (optional if session auth)
 * @apiHeader {String} Content-Type application/json
 * 
 * @apiParam {String} [flag] 리셋할 Feature Flag 이름 (미지정 시 전체 리셋)
 * 
 * @apiSuccess {Boolean} success 성공 여부
 * @apiSuccess {String} [flag] 리셋된 플래그 이름
 * @apiSuccess {String} changedBy 변경자 ID
 * @apiSuccess {String} message 결과 메시지
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAccess(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json() as DeleteBody;
    const { flag } = body;

    if (flag) {
      // 단일 플래그 리셋
      if (!isValidFlag(flag)) {
        return NextResponse.json(
          { error: `Invalid flag: ${flag}` },
          { status: 400 }
        );
      }

      const success = resetFlag(flag, auth.userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to reset feature flag' },
          { status: 500 }
        );
      }

      logger.info(`Feature Flag '${flag}' 리셋`, { userId: auth.userId });

      return NextResponse.json({
        success: true,
        flag,
        changedBy: auth.userId,
        message: `Flag '${flag}' has been reset to default value`,
      });
    } else {
      // 전체 리셋
      const success = resetAllFlags(auth.userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to reset all feature flags' },
          { status: 500 }
        );
      }

      logger.info('모든 Feature Flag 리셋', { userId: auth.userId });

      return NextResponse.json({
        success: true,
        changedBy: auth.userId,
        message: 'All feature flags have been reset to default values',
      });
    }
  } catch (error) {
    logger.error('Feature Flag 리셋 API 오류', error as Error);
    return NextResponse.json(
      { error: 'Failed to reset feature flag', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
