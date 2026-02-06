import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';

// PATCH - Update issue (resolve/unresolve)
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

    // Check if user owns the issue or is master
    const { data: issue } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .single();

    if (!issue) {
      return NextResponse.json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (issue.user_id !== user.id && !isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { resolved, description } = body;

    const updateData: any = {};

    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user.id;
      } else {
        updateData.resolved_at = null;
        updateData.resolved_by = null;
      }
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    const { data: updatedIssue, error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ issue: updatedIssue });

  } catch (error: any) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: error.message || '이슈 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete issue
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

    // Check if user owns the issue or is master
    const { data: issue } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .single();

    if (!issue) {
      return NextResponse.json({ error: '이슈를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (issue.user_id !== user.id && !isMaster(currentUser)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting issue:', error);
    return NextResponse.json(
      { error: error.message || '이슈 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
