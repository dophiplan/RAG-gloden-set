import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProductCode } from '@/types';

interface BulkProductUpdateInput {
  ids: string[];
  product_codes: { code: ProductCode; version?: string }[];
}

// PATCH - Bulk update products
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: BulkProductUpdateInput = await request.json();

    if (!body.ids || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'ID 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!body.product_codes) {
      return NextResponse.json(
        { error: '제품 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    // Delete existing product associations for all translations
    await supabase
      .from('translation_products')
      .delete()
      .in('translation_id', body.ids);

    // Insert new product associations
    if (body.product_codes.length > 0) {
      const productLinks = body.ids.flatMap((translationId) =>
        body.product_codes.map((item) => ({
          translation_id: translationId,
          product_code: item.code,
          version: item.version || null,
          version_updated_at: item.version ? new Date().toISOString() : null,
        }))
      );

      const { error } = await supabase
        .from('translation_products')
        .insert(productLinks);

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      updated: body.ids.length,
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    return NextResponse.json(
      { error: '제품을 일괄 변경하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
