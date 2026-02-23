import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { apiSuccess, apiNotFound, apiInternalError, apiConflict } from '@/lib/api/response';
import { GlossaryRepository } from '@/repositories';

interface GlossaryUpdateInput {
  term?: string;
  translation?: string;
  context?: string;
  updated_at?: string; // For optimistic locking
}

// GET - Get single glossary term
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse ? unauthorizedResponse() : apiInternalError('Unauthorized');
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('용어');
      }
      throw error;
    }

    return apiSuccess(data);
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return apiInternalError('용어를 불러오는데 실패했습니다.');
  }
}

// PATCH - Update glossary term
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse ? unauthorizedResponse() : apiInternalError('Unauthorized');
    }

    const { id } = await params;
    const body: GlossaryUpdateInput = await request.json();

    // Optimistic Locking: Check for concurrent edits if updated_at is provided
    if (body.updated_at) {
      const { data: currentData, error: fetchError } = await supabase
        .from('glossary')
        .select('updated_at')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return apiNotFound('용어');
        }
        throw fetchError;
      }

      // Compare timestamps (allow 1 second tolerance)
      const clie[기밀마스킹]imestamp = new Date(body.updated_at).getTime();
      const serverTimestamp = new Date(currentData.updated_at).getTime();

      if (Math.abs(serverTimestamp - clie[기밀마스킹]imestamp) > 1000) {
        return apiConflict(
          '다른 사용자가 이 용어를 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
          {
            serverUpdatedAt: currentData.updated_at,
            clientUpdatedAt: body.updated_at,
          }
        );
      }
    }

    // Use repository with audit logging
    const repository = new GlossaryRepository(supabase);
    
    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const updateData: Record<string, unknown> = {};
    if (body.term !== undefined) updateData.term = body.term.trim();
    if (body.translation !== undefined) updateData.translation = body.translation.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;

    const term = await repository.updateWithAudit(
      id,
      updateData as any,
      {
        id: user.id,
        name: userProfile?.name,
        email: user.email,
      }
    );

    return apiSuccess(term);
  } catch (error) {
    console.error('Error updating glossary term:', error);
    return apiInternalError('용어를 업데이트하는데 실패했습니다.');
  }
}

// DELETE - Delete glossary term
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse ? unauthorizedResponse() : apiInternalError('Unauthorized');
    }

    const { id } = await params;

    // Use repository with audit logging
    const repository = new GlossaryRepository(supabase);
    
    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    await repository.deleteWithAudit(id, {
      id: user.id,
      name: userProfile?.name,
      email: user.email,
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Error deleting glossary term:', error);
    return apiInternalError('용어를 삭제하는데 실패했습니다.');
  }
}
