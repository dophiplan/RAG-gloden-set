import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { ProductCode } from '@/types';

interface BulkProductUpdateInput {
  ids: string[];
  product_codes: { code: ProductCode; version?: string }[];
}

// PATCH - Bulk update products
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

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

    // Use Service for bulk product update
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    const updatedCount = await service.bulkUpdateProductCodesWithVersions(
      body.ids,
      body.product_codes,
      {
        userId: user.id,
        userEmail: user.email || '',
      }
    );

    return NextResponse.json({
      success: true,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    return NextResponse.json(
      { error: '제품을 일괄 변경하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
