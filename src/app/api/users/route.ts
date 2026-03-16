import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireMasterRole } from '@/lib/api-auth';
import { apiSuccess, apiInternalError } from '@/lib/api/response';
import { isEnabled } from '@/lib/config/feature_flags';
import { darkLaunchRead } from '@/lib/pilot/dark-launch';
import { createDatabaseProviderFromEnv } from '@/lib/database/provider';
import { logger } from '@/lib/observability/logger';

// ============================================================================
// GET - List users with Full Cutover support
// ============================================================================

export async function GET(request: NextRequest) {
  // 1. 인증/권한 체크 (공통)
  const supabase = await createClient();
  const auth = await requireMasterRole(supabase);

  if (auth.error) {
    return auth.error;
  }

  // 2. Full Cutover 우선 체크
  const useFullCutover = isEnabled('FF_USERS_FULL_CUTOVER');

  if (useFullCutover) {
    try {
      const result = await getUsersWithProvider(request, auth.user, auth.adminClient);
      return result;
    } catch (error) {
      // Fallback to Legacy
      logger.warn('[FullCutover] GET /api/users Fallback to Legacy', { error });
      return getUsersLegacy(request, auth.user, auth.adminClient);
    }
  }

  // 3. Dark Launch 적용 (기존 로직)
  const useDarkLaunch = isEnabled('FF_USERS_DARK_LAUNCH');

  if (useDarkLaunch) {
    return darkLaunchRead(
      // Legacy 읽기
      () => getUsersLegacy(request, auth.user, auth.adminClient),
      // Provider 읽기
      () => getUsersWithProvider(request, auth.user, auth.adminClient),
      // 옵션
      {
        operation: 'getUsers',
        endpoint: '/api/users',
      }
    );
  }

  // 4. 기존 코드 (Dark Launch 비활성화 시)
  return getUsersLegacy(request, auth.user, auth.adminClient);
}

// ============================================================================
// Legacy Implementation (기존 코드 100% 유지)
// ============================================================================

async function getUsersLegacy(
  request: NextRequest,
  user: { id: string; email?: string },
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const workProductsParam = searchParams.get('work_products');
    const workScopeParam = searchParams.get('work_scope');
    const rolesParam = searchParams.get('roles');
    const workLanguagesParam = searchParams.get('work_languages');
    const search = searchParams.get('search');

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Start building query
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters with AND condition
    // Filter by work_products (array contains)
    if (workProductsParam) {
      const workProducts = workProductsParam.split(',').map(p => p.trim());
      for (const product of workProducts) {
        query = query.contains('work_products', [product]);
      }
    }

    // Filter by work_scope (array contains)
    if (workScopeParam) {
      const workScope = workScopeParam.split(',').map(s => s.trim());
      for (const scope of workScope) {
        query = query.contains('work_scope', [scope]);
      }
    }

    // Filter by roles (array contains)
    if (rolesParam) {
      const roles = rolesParam.split(',').map(r => r.trim());
      for (const role of roles) {
        query = query.contains('roles', [role]);
      }
    }

    // Filter by work_languages (array contains)
    if (workLanguagesParam) {
      const workLanguages = workLanguagesParam.split(',').map(l => l.trim());
      for (const lang of workLanguages) {
        query = query.contains('work_languages', [lang]);
      }
    }

    // Apply search (partial match on name or email)
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) throw error;

    return apiSuccess({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    return apiInternalError(
      error instanceof Error ? error.message : '알 수 없는 오류'
    );
  }
}

// ============================================================================
// Provider-based Implementation (Full Cutover / Dark Launch용)
// ============================================================================

async function getUsersWithProvider(
  request: NextRequest,
  user: { id: string; email?: string },
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<NextResponse> {
  try {
    // 1. Provider 초기화
    const provider = createDatabaseProviderFromEnv(supabase);

    // 2. 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || undefined;

    // 3. Provider로 조회
    const result = await provider.users.findMany(
      {
        search,
      },
      { page, limit }
    );

    // 4. 결과 반환 (Legacy와 동일한 형식)
    return apiSuccess({
      users: result.data,
      pagination: {
        page,
        limit,
        total: result.count || 0,
        totalPages: Math.ceil((result.count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching users with provider:', error);
    return apiInternalError(
      error instanceof Error ? error.message : '알 수 없는 오류'
    );
  }
}
