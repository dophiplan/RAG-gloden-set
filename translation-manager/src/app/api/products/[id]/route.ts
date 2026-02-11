import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * PATCH - Update a product (master only)
 */
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

    // Check if user is master
    const adminClient = createAdminClient();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

    if (!isMaster) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { code, name, description, display_order } = body;

    // Get current product to check if code is changing
    const { data: currentProduct } = await adminClient
      .from('products')
      .select('code')
      .eq('id', id)
      .single();

    if (!currentProduct) {
      return NextResponse.json({ error: '제품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Check if code is being changed
    const isCodeChanging = code !== undefined && code !== currentProduct.code;
    const is1stMaster = userProfile?.roles?.includes('1st_master');

    if (isCodeChanging) {
      // Check if code is in use (only if not 1st_master)
      if (!is1stMaster) {
        const [translationCheck, glossaryCheck] = await Promise.all([
          adminClient
            .from('translation_products')
            .select('id')
            .eq('product_code', currentProduct.code)
            .limit(1),
          adminClient
            .from('glossary_products')
            .select('id')
            .eq('product_code', currentProduct.code)
            .limit(1)
        ]);

        const isUsed = (translationCheck.data && translationCheck.data.length > 0) ||
                       (glossaryCheck.data && glossaryCheck.data.length > 0);

        if (isUsed) {
          return NextResponse.json(
            { error: '사용 중인 제품 코드는 수정할 수 없습니다.' },
            { status: 400 }
          );
        }
      }

      // If allowed (1st_master or not in use), cascade update
      const [translationUpdate, glossaryUpdate] = await Promise.all([
        adminClient
          .from('translation_products')
          .update({ product_code: code })
          .eq('product_code', currentProduct.code),
        adminClient
          .from('glossary_products')
          .update({ product_code: code })
          .eq('product_code', currentProduct.code)
      ]);

      if (translationUpdate.error || glossaryUpdate.error) {
        console.error('Error cascading product code update:', translationUpdate.error || glossaryUpdate.error);
        return NextResponse.json(
          { error: '제품 코드 업데이트 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
    }

    interface ProductUpdateData {
      code?: string;
      name?: string;
      description?: string | null;
      display_order?: number;
    }

    const updateData: ProductUpdateData = {};
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: product, error } = await adminClient
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: '제품 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a product (master only)
 */
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

    // Check if user is master
    const adminClient = createAdminClient();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

    if (!isMaster) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = await params;

    // Check if product is used in translations
    const { data: usedInTranslations } = await adminClient
      .from('translation_products')
      .select('id')
      .eq('product_code', id)
      .limit(1);

    if (usedInTranslations && usedInTranslations.length > 0) {
      return NextResponse.json(
        { error: '사용 중인 제품은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: '제품 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
