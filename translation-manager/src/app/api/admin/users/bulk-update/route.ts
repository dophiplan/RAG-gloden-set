import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';

export async function PATCH(request: NextRequest) {
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
    const { user_ids, roles, work_products, work_scope, work_languages } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: any = {};
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
