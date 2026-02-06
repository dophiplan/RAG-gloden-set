import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { ProductCode, UserRole } from '@/types';

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
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
    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

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
    const updateData: any = {};

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

  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || '사용자 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
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
    if (!isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

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
    if (id === user.id) {
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

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
