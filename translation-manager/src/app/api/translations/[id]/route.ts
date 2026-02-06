import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationUpdateInput } from '@/types';

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
        translation_results (*)
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
    const body: TranslationUpdateInput & { version_updated_at?: string | null } = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.source_text !== undefined) updateData.source_text = body.source_text.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.version !== undefined) updateData.version = body.version?.trim() || null;
    if (body.version_updated_at !== undefined) updateData.version_updated_at = body.version_updated_at;

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

    // Fetch updated translation with products
    const { data: updatedTranslation } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_products (*)
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

    const { error } = await supabase
      .from('translations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json(
      { error: '번역을 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
