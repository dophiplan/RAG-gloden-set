import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { FIRST_MASTER_EMAIL } from '@/types/users';

/**
 * PATCH - Update user permissions
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Use admin client for authorization check
    const adminClient = createAdminClient();

    // Check if user is master
    const { data: adminUser } = await adminClient
      .from('users')
      .select('account_level')
      .eq('id', authUser.id)
      .single();

    if (!adminUser || !(adminUser.account_level === 'master' || adminUser.account_level === '1st_master')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { permissions } = body;

    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'permissions 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    // Check if the target user is a master
    const { data: targetUser } = await adminClient
      .from('users')
      .select('email, account_level')
      .eq('id', id)
      .single();

    // Protect 1st_master account from being modified by master users
    const isTargetFirstMaster = targetUser?.email === FIRST_MASTER_EMAIL || targetUser?.account_level === '1st_master';
    const isRequesterFirstMaster = adminUser.account_level === '1st_master';

    if (isTargetFirstMaster && !isRequesterFirstMaster) {
      return NextResponse.json(
        { error: '최고 관리자 계정은 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    // Master users always get all permissions
    const finalPermissions = targetUser?.account_level === 'master'
      ? ['translator', 'reviewer', 'requester', 'deployer']
      : permissions;

    // Update permissions in users table
    const { error } = await adminClient
      .from('users')
      .update({ permissions: finalPermissions })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '권한이 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('Error updating permissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
