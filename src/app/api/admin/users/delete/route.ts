import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { FIRST_MASTER_EMAIL } from '@/types/users';
import type { SupabaseClient } from '@supabase/supabase-js';

// Security: Verify user is master
async function verifyMasterUser(supabase: SupabaseClient): Promise<{ authorized: boolean; userId?: string }> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { authorized: false };
  }

  // Check if user has master or 1st_master role
  const { data: userProfile } = await supabase
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single();

  const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

  return {
    authorized: isMaster,
    userId: user.id
  };
}

/**
 * POST - Delete multiple users (master only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { authorized, userId: currentUserId } = await verifyMasterUser(supabase);
    
    // Get current user info for audit log
    const { data: currentUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', currentUserId || '')
      .single();

    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Master access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '삭제할 사용자를 선택해주세요.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Protect 1st_master account from being deleted
    const { data: targetUsers } = await adminClient
      .from('users')
      .select('id, email, roles')
      .in('id', userIds);

    const hasFirstMaster = targetUsers?.some(
      u => u.email === FIRST_MASTER_EMAIL || u.roles?.includes('1st_master')
    );

    if (hasFirstMaster) {
      return NextResponse.json(
        { error: '최고 관리자 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // Delete users from auth and database (CASCADE will handle user profile)
    let deletedCount = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // Delete from auth (this will cascade to users table due to foreign key)
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);

        if (authError) {
          errors.push(`${userId}: ${authError.message}`);
        } else {
          deletedCount++;
        }
      } catch (error) {
        errors.push(`${userId}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    if (errors.length > 0) {
      console.error('Errors during user deletion:', errors);
    }

    // Create audit logs for deleted users (non-blocking)
    for (const user of targetUsers || []) {
      if (!user.roles?.includes('1st_master')) { // Don't log 1st_master (shouldn't happen due to check above)
        void supabase.from('user_audit_logs').insert({
          user_id: currentUserId,
          user_name: currentUser?.name,
          user_email: currentUser?.email,
          action: 'delete',
          target_user_id: user.id,
          target_user_email: user.email,
          field_name: 'user',
          old_value: JSON.stringify({ email: user.email, roles: user.roles }),
        }).then(({ error }) => {
          if (error) console.error('[Audit Log] Failed to log user deletion:', error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${deletedCount}명의 사용자가 삭제되었습니다.${errors.length > 0 ? ` (실패: ${errors.length}명)` : ''}`,
    });
  } catch (error) {
    console.error('Error deleting users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
