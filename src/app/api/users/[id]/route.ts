import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { ProductCode, UserRole } from '@/types';
import { isEnabled } from '@/lib/config/feature_flags';
import { shadowWrite } from '@/lib/pilot/shadow-mode';
import { dualWrite } from '@/lib/pilot/dual-write';
import { darkLaunchRead } from '@/lib/pilot/dark-launch';
import { createDatabaseProviderFromEnv } from '@/lib/database/provider';
import { requireMasterRole } from '@/lib/api-auth';
import { logger } from '@/lib/observability/logger';

// ============================================================================
// GET - Get user by ID with Full Cutover support
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. 인증/권한 체크 (공통)
  const supabase = await createClient();
  const auth = await requireMasterRole(supabase);
  if (auth.error) return auth.error;

  // 2. Full Cutover 우선 체크
  const useFullCutover = isEnabled('FF_USERS_FULL_CUTOVER');

  if (useFullCutover) {
    try {
      const result = await getUserByIdWithProvider(id);
      return result;
    } catch (error) {
      // Fallback to Legacy
      logger.warn('[FullCutover] GET Fallback to Legacy', { error, userId: id });
      return getUserByIdLegacy(id, supabase);
    }
  }

  // 3. Dark Launch 적용 (기존 로직)
  const useDarkLaunch = isEnabled('FF_USERS_DARK_LAUNCH');

  if (useDarkLaunch) {
    return darkLaunchRead(
      () => getUserByIdLegacy(id, supabase),
      () => getUserByIdWithProvider(id),
      { operation: 'getUserById', endpoint: '/api/users/:id' }
    );
  }

  // 4. 기존 방식
  return getUserByIdLegacy(id, supabase);
}

// ============================================================================
// PATCH - Update user with Full Cutover support
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 인증/권한 체크 (공통, 항상 수행 - Legacy 방식 유지)
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // Get current user with roles
  const { data: currentUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Only masters can update users
  if (!isMaster(currentUser as any)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // 2. Full Cutover 우선 체크
  const useFullCutover = isEnabled('FF_USERS_FULL_CUTOVER');

  if (useFullCutover) {
    try {
      const result = await updateUserWithProvider(id, request);
      return result;
    } catch (error) {
      // Fallback to Legacy
      logger.warn('[FullCutover] PATCH Fallback to Legacy', { error, userId: id });
      return updateUserLegacy(id, request, supabase);
    }
  }

  // 3. 기존 Flag 체크 순서: Dual Write > Shadow Mode > Legacy
  const useDualWrite = isEnabled('FF_USERS_DUAL_WRITE');
  const useShadowMode = isEnabled('FF_USERS_SHADOW_MODE');

  if (useDualWrite) {
    const result = await dualWrite(
      () => updateUserLegacy(id, request, supabase),
      () => updateUserWithProvider(id, request),
      {
        operation: 'updateUser',
        entityType: 'user',
        entityId: id,
      }
    );

    // 복구 필요 시 로깅
    if (result.requiresRecovery) {
      console.warn('[PATCH /api/users] Recovery required', { userId: id });
    }

    return NextResponse.json({
      user: result.legacyResult,
      _meta: {
        dualWrite: true,
        providerSuccess: result.providerSuccess,
        requiresRecovery: result.requiresRecovery,
      }
    });
  }

  if (useShadowMode) {
    return shadowWrite(
      // Legacy 작업
      () => updateUserLegacy(id, request, supabase),
      // Shadow 작업 (Provider)
      () => updateUserWithProvider(id, request),
      // 옵션
      {
        operation: 'updateUser',
        entityType: 'user',
        entityId: id,
      }
    );
  }

  // 4. 기존 코드 (Shadow Mode 비활성화 시)
  return updateUserLegacy(id, request, supabase);
}

// ============================================================================
// DELETE - Delete user with Full Cutover support
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 인증/권한 체크 (공통)
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // Get current user with roles
  const { data: currentUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Only masters can delete users
  if (!isMaster(currentUser as any)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // 2. Full Cutover 우선 체크
  const useFullCutover = isEnabled('FF_USERS_FULL_CUTOVER');

  if (useFullCutover) {
    try {
      const result = await deleteUserWithProvider(id);
      return result;
    } catch (error) {
      // Fallback to Legacy
      logger.warn('[FullCutover] DELETE Fallback to Legacy', { error, userId: id });
      return deleteUserLegacy(id, user.id, supabase);
    }
  }

  // 3. 기존 Flag 체크 순서: Dual Write > Legacy
  const useDualWrite = isEnabled('FF_USERS_DUAL_WRITE');

  if (useDualWrite) {
    const result = await dualWrite(
      () => deleteUserLegacy(id, user.id, supabase),
      () => deleteUserWithProvider(id),
      {
        operation: 'deleteUser',
        entityType: 'user',
        entityId: id,
      }
    );

    // 복구 필요 시 로깅
    if (result.requiresRecovery) {
      console.warn('[DELETE /api/users] Recovery required', { userId: id });
    }

    return NextResponse.json({
      success: result.legacySuccess,
      _meta: {
        dualWrite: true,
        providerSuccess: result.providerSuccess,
        requiresRecovery: result.requiresRecovery,
      }
    });
  }

  // 4. 기존 방식
  return deleteUserLegacy(id, user.id, supabase);
}

// ============================================================================
// Legacy Implementation (기존 코드 100% 유지)
// ============================================================================

async function updateUserLegacy(
  id: string,
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<NextResponse> {
  try {
    // Check if target user exists
    const { data: targetUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      roles,
      work_products,
      work_scope,
      work_languages,
    } = body as {
      name?: string;
      roles?: UserRole[];
      work_products?: ProductCode[];
      work_scope?: string[];
      work_languages?: string[];
    };

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (roles !== undefined) {
      // Validate roles
      const validRoles: UserRole[] = [
        'master',
        'translator_ja', 'translator_zh', 'translator_en',
        'reviewer_ja', 'reviewer_zh', 'reviewer_en',
        'requester', 'deployer', 'pm', 'pl'
      ];
      const invalidRoles = roles.filter(r => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return NextResponse.json(
          { error: `유효하지 않은 권한: ${invalidRoles.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.roles = roles;
    }

    if (work_products !== undefined) {
      updateData.work_products = work_products;
    }

    if (work_scope !== undefined) {
      updateData.work_scope = work_scope;
    }

    if (work_languages !== undefined) {
      updateData.work_languages = work_languages;
    }

    // Prevent empty updates
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '업데이트할 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user: updatedUser });

  } catch (error: unknown) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Provider-based Implementation (Full Cutover / Shadow Mode / Dual Write용)
// ============================================================================

async function updateUserWithProvider(
  id: string,
  request: NextRequest
): Promise<NextResponse> {
  // 1. Provider 초기화
  const supabase = await createClient();
  const provider = createDatabaseProviderFromEnv(supabase);

  // 2. 요청 파싱 (Legacy와 동일한 파싱 로직)
  const body = await request.json();
  const {
    name,
    roles,
    work_products,
    work_scope,
    work_languages,
  } = body as {
    name?: string;
    roles?: UserRole[];
    work_products?: ProductCode[];
    work_scope?: string[];
    work_languages?: string[];
  };

  // 3. 업데이트 데이터 구성
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (roles !== undefined) {
    updateData.roles = roles;
  }

  if (work_products !== undefined) {
    updateData.work_products = work_products;
  }

  if (work_scope !== undefined) {
    updateData.work_scope = work_scope;
  }

  if (work_languages !== undefined) {
    updateData.work_languages = work_languages;
  }

  // 4. Provider로 업데이트
  const updatedUser = await provider.users.update(id, updateData);

  // 5. 결과 반환 (Legacy와 동일한 형식)
  return NextResponse.json({ user: updatedUser });
}

// ============================================================================
// Legacy Implementation - GET
// ============================================================================

async function getUserByIdLegacy(
  id: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<NextResponse> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// ============================================================================
// Provider Implementation - GET
// ============================================================================

async function getUserByIdWithProvider(id: string): Promise<NextResponse> {
  const supabase = await createClient();
  const provider = createDatabaseProviderFromEnv(supabase);

  const user = await provider.users.findById(id);

  if (!user) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ user });
}

// ============================================================================
// Legacy Implementation - DELETE
// ============================================================================

async function deleteUserLegacy(
  id: string,
  currentUserId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<NextResponse> {
  try {
    // Check if target user exists
    const { data: targetUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Prevent self-deletion
    if (id === currentUserId) {
      return NextResponse.json(
        { error: '자기 자신을 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Provider Implementation - DELETE
// ============================================================================

async function deleteUserWithProvider(id: string): Promise<NextResponse> {
  const supabase = await createClient();
  const provider = createDatabaseProviderFromEnv(supabase);

  await provider.users.delete(id);

  return NextResponse.json({ success: true });
}
