import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiInternalError } from '@/lib/api/response';

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
      return apiUnauthorized();
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
      return apiNotFound('이슈');
    }

    if (issue.user_id !== user.id && !isMaster(currentUser)) {
      return apiForbidden('권한이 없습니다.');
    }

    const body = await request.json();
    const { resolved, description } = body;

    const updateData: Record<string, unknown> = {};

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

    return apiSuccess({ issue: updatedIssue });

  } catch (error: unknown) {
    console.error('Error updating issue:', error);
    return apiInternalError(error instanceof Error ? error.message : '알 수 없는 오류');
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
      return apiUnauthorized();
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
      return apiNotFound('이슈');
    }

    if (issue.user_id !== user.id && !isMaster(currentUser)) {
      return apiForbidden('권한이 없습니다.');
    }

    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return apiSuccess({ success: true });

  } catch (error: unknown) {
    console.error('Error deleting issue:', error);
    return apiInternalError(error instanceof Error ? error.message : '알 수 없는 오류');
  }
}
