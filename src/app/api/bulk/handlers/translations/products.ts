import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { validateIds } from '../../lib/validation';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsProducts(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();

  const ids = body.ids || body.translation_ids;

  if (!validateIds(ids)) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  if (!body.product_code) {
    throw new ApiError('product_code는 필수입니다.', 400);
  }

  const operation = body.operation || 'add';
  const results = [];

  for (const id of ids) {
    if (operation === 'add') {
      // 중복 체크
      const { data: existing } = await adminClient
        .from('translation_products')
        .select('*')
        .eq('translation_id', id)
        .eq('product_code', body.product_code)
        .single();

      if (!existing) {
        const { error } = await adminClient
          .from('translation_products')
          .insert({
            translation_id: id,
            product_code: body.product_code,
            created_by: user.id,
          });

        results.push({ id, added: !error, error });
      } else {
        results.push({ id, added: false, reason: 'Already exists' });
      }
    } else if (operation === 'remove') {
      const { error } = await adminClient
        .from('translation_products')
        .delete()
        .eq('translation_id', id)
        .eq('product_code', body.product_code);

      results.push({ id, removed: !error });
    }
  }

  return successResponse({
    operation,
    product_code: body.product_code,
    results,
  });
}
