import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { successResponse, notFound, serverError } from '@/lib/api/middleware';

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
      return unauthorizedResponse();
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
        return notFound('용어를 찾을 수 없습니다.');
      }
      throw error;
    }

    return successResponse(data);
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return serverError('용어를 불러오는데 실패했습니다.');
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
      return unauthorizedResponse();
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
          return notFound('용어를 찾을 수 없습니다.');
        }
        throw fetchError;
      }

      // Compare timestamps (allow 1 second tolerance)
      const clientTimestamp = new Date(body.updated_at).getTime();
      const serverTimestamp = new Date(currentData.updated_at).getTime();

      if (Math.abs(serverTimestamp - clientTimestamp) > 1000) {
        return NextResponse.json(
          {
            error: {
              code: 'EDIT_CONFLICT',
              message: '다른 사용자가 이 용어를 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
              details: {
                serverUpdatedAt: currentData.updated_at,
                clientUpdatedAt: body.updated_at,
              },
            },
          },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.term !== undefined) updateData.term = body.term.trim();
    if (body.translation !== undefined) updateData.translation = body.translation.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;

    const { data, error } = await supabase
      .from('glossary')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('용어를 찾을 수 없습니다.');
      }
      throw error;
    }

    return successResponse(data);
  } catch (error) {
    console.error('Error updating glossary term:', error);
    return serverError('용어를 업데이트하는데 실패했습니다.');
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
      return unauthorizedResponse();
    }

    const { id } = await params;

    // Fetch glossary data before deletion for logging
    const { data: glossary, error: fetchError } = await supabase
      .from('glossary')
      .select('term, translation, language_code')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return notFound('용어를 찾을 수 없습니다.');
      }
      throw fetchError;
    }

    // Delete glossary term
    const { error: deleteError } = await supabase
      .from('glossary')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Log deletion (console log for now - glossary doesn't have dedicated audit log table)
    console.log(`[Glossary Delete] User ${user.email} deleted glossary term:`, {
      id,
      term: glossary.term,
      translation: glossary.translation,
      language_code: glossary.language_code,
      timestamp: new Date().toISOString(),
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error('Error deleting glossary term:', error);
    return serverError('용어를 삭제하는데 실패했습니다.');
  }
}
