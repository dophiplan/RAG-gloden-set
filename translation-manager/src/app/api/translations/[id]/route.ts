import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationUpdateInput } from '@/types';
import { TranslationRepository } from '@/repositories';

// GET - Get single translation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_platforms (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '번역을 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching translation:', error);
    return NextResponse.json(
      { error: '번역을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH - Update translation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const body: TranslationUpdateInput & { version_updated_at?: string | null; platform_codes?: string[] } = await request.json();

    // Optimistic Locking: Check for concurrent edits using Repository
    if (body.updated_at) {
      const repository = new TranslationRepository(supabase);
      const lockResult = await repository.checkVersion(id, undefined, body.updated_at);

      if (!lockResult.success) {
        if (lockResult.errorCode === 'RECORD_NOT_FOUND') {
          return NextResponse.json({ error: '번역을 찾을 수 없습니다.' }, { status: 404 });
        }

        return NextResponse.json(
          {
            error: {
              code: lockResult.errorCode || 'EDIT_CONFLICT',
              message: lockResult.message || '다른 사용자가 이 번역을 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
              details: {
                serverUpdatedAt: lockResult.serverTimestamp,
                clientUpdatedAt: body.updated_at,
              },
            },
          },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.source_text !== undefined) updateData.source_text = body.source_text.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scope !== undefined) updateData.scope = body.scope;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null;
    if (body.version !== undefined) updateData.version = body.version?.trim() || null;
    if (body.version_updated_at !== undefined) updateData.version_updated_at = body.version_updated_at;
    if ((body as any).dev_code !== undefined) updateData.dev_code = (body as any).dev_code?.trim() || null;

    const { data, error } = await supabase
      .from('translations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        translation_results (*)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '번역을 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    // Handle product_codes update if provided
    if (body.product_codes !== undefined) {
      // Delete existing product associations
      await supabase
        .from('translation_products')
        .delete()
        .eq('translation_id', id);

      // Insert new product associations with versions
      if (body.product_codes.length > 0) {
        const productLinks = (body.product_codes as Array<string | { code: string; version?: string }>).map((item) => ({
          translation_id: id,
          product_code: typeof item === 'string' ? item : item.code,
          version: typeof item === 'object' && item.version ? item.version : null,
          version_updated_at: typeof item === 'object' && item.version ? new Date().toISOString() : null,
        }));

        await supabase.from('translation_products').insert(productLinks);
      }
    }

    // Handle platform_codes update if provided
    if (body.platform_codes !== undefined) {
      // Delete existing platform associations
      await supabase
        .from('translation_platforms')
        .delete()
        .eq('translation_id', id);

      // Insert new platform associations
      if (body.platform_codes.length > 0) {
        const platformLinks = body.platform_codes.map((platformCode) => ({
          translation_id: id,
          platform_code: platformCode,
        }));

        await supabase.from('translation_platforms').insert(platformLinks);
      }
    }

    // Fetch updated translation with products and platforms
    const { data: updatedTranslation } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_products (*),
        translation_platforms (*)
      `)
      .eq('id', id)
      .single();

    return NextResponse.json(updatedTranslation || data);
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { error: '번역을 업데이트하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete translation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch translation data before deletion for audit log
    const { data: translation, error: fetchError } = await supabase
      .from('translations')
      .select('source_text, context')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '번역을 찾을 수 없습니다.' }, { status: 404 });
      }
      throw fetchError;
    }

    // Delete translation
    const { error } = await supabase
      .from('translations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    // Create audit log (non-blocking)
    void supabase.from('translation_audit_logs').insert({
      translation_id: id,
      user_id: user.id,
      user_name: userProfile?.name,
      user_email: user.email,
      action: 'delete',
      old_value: translation.source_text,
      field_name: 'entire_record',
    }).then(({ error }) => {
      if (error) {
        console.error('[Audit Log] Failed to log translation deletion:', error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json(
      { error: '번역을 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
