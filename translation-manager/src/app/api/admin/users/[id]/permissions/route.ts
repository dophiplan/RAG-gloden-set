import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

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

    // Check if user is master (has 'admin' or 'master' role)
    const { data: adminUser } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', authUser.id)
      .single();

    if (!adminUser || !(adminUser.roles?.includes('admin') || adminUser.roles?.includes('master'))) {
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
      .select('roles')
      .eq('id', id)
      .single();

    // Master users always get all permissions
    const finalPermissions = targetUser?.roles?.includes('master')
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
