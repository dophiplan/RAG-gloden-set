import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { canManageUsers } from '@/lib/permissions';

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication and master permission
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    // Development mode bypass
    let currentUser: any = null;
    let isDevBypass = false;
    
    if ((authError || !authUser) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
      console.warn('⚠️  DEV MODE: Auth bypass enabled for /api/admin/users/bulk-update');
      isDevBypass = true;
      currentUser = {
        id: 'dev-mode-user',
        account_level: '1st_master',
        roles: ['1st_master'],
      };
    } else if (authError || !authUser) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // Fetch current user if not in dev bypass mode
    if (!isDevBypass) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, account_level, roles')
        .eq('id', authUser!.id)
        .single();
      currentUser = userData;
    }

    if (!currentUser || !canManageUsers(currentUser as any)) {
      console.log('User permission check failed:', {
        userId: currentUser?.id,
        email: currentUser?.email,
        account_level: currentUser?.account_level,
        roles: currentUser?.roles
      });
      return NextResponse.json(
        { error: '권한이 없습니다. Master 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_ids, account_level, roles, work_products, work_scope, work_languages } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Prevent users from changing their own account level (security protection)
    // Skip this check in dev bypass mode
    const isChangingSelf = !isDevBypass && user_ids.length === 1 && user_ids[0] === authUser?.id;
    if (isChangingSelf && account_level !== undefined) {
      return NextResponse.json(
        { error: '본인의 계정 권한은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Protect 1st master from being demoted by non-1st-master users
    if (account_level !== undefined) {
      const adminClient = createAdminClient();
      const { data: selectedUsers } = await adminClient
        .from('users')
        .select('id, account_level')
        .in('id', user_ids);

      // Check if current user is 1st_master
      const isCurrentUser1stMaster = currentUser?.account_level === '1st_master';

      // Only 1st_master can change other 1st_master's account level
      // Non-1st-master users cannot change 1st_master's account level
      const has1stMasterTarget = selectedUsers?.some(u => u.account_level === '1st_master');
      if (has1stMasterTarget && !isCurrentUser1stMaster) {
        return NextResponse.json(
          { error: '1st Master의 계정 권한은 변경할 수 없습니다.' },
          { status: 403 }
        );
      }
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (account_level !== undefined) updates.account_level = account_level;
    if (roles !== undefined) updates.roles = roles;
    if (work_products !== undefined) updates.work_products = work_products;
    if (work_scope !== undefined) updates.work_scope = work_scope;
    if (work_languages !== undefined) updates.work_languages = work_languages;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: '업데이트할 필드가 없습니다.' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Update all selected users
    const { data, error } = await adminClient
      .from('users')
      .update(updates)
      .in('id', user_ids)
      .select();

    if (error) {
      console.error('Error updating users:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_count: data.length,
      users: data,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
