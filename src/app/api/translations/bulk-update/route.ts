import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { TranslationStatus, ProductCode } from '@/types';

/**
 * PATCH - Bulk update translations
 * Updates multiple translations at once (product, status, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { translation_ids, product_code, status } = body;

    // Validation
    if (!translation_ids || !Array.isArray(translation_ids) || translation_ids.length === 0) {
      return NextResponse.json(
        { error: 'translation_ids는 필수이며 배열이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!product_code && !status) {
      return NextResponse.json(
        { error: 'product_code 또는 status 중 하나는 필수입니다.' },
        { status: 400 }
      );
    }

    // Use Service for bulk updates
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    const userInfo = {
      userId: user.id,
      userEmail: user.email || '',
    };

    let updatedCount = 0;
    let message = '';

    // Update product if provided
    if (product_code) {
      updatedCount = await service.bulkUpdateProductCodes(
        translation_ids,
        product_code as ProductCode,
        userInfo
      );
      message = `${updatedCount}개 항목의 제품이 업데이트되었습니다.`;
    }

    // Update status if provided
    if (status) {
      const count = await service.bulkUpdateStatus(
        translation_ids,
        status as TranslationStatus,
        userInfo
      );
      updatedCount = count;
      message = `${updatedCount}개 항목의 상태가 업데이트되었습니다.`;
    }

    return NextResponse.json({
      updated: updatedCount,
      message,
    });

  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: '일괄 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
