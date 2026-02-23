import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication and master permission
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (!currentUser || !isMaster(currentUser)) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_ids } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Prevent deleting self
    if (user_ids.includes(currentUser.id)) {
      return NextResponse.json(
        { error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Delete from auth.users (this will cascade to public.users via trigger)
    const errors = [];
    for (const userId of user_ids) {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`Error deleting user ${userId}:`, error);
        errors.push({ userId, error: error.message });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: '일부 사용자 삭제에 실패했습니다.',
          errors,
          deleted_count: user_ids.length - errors.length,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      deleted_count: user_ids.length,
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
