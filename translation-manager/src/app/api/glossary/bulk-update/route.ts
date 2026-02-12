import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { ProductCode } from '@/types';
import { successResponse, serverError, badRequest } from '@/lib/api/middleware';

/**
 * PATCH - Bulk update glossary terms
 * Updates multiple glossary terms at once (product, approval_status)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { glossary_ids, product_codes, approval_status } = body;

    // Validation
    if (!glossary_ids || !Array.isArray(glossary_ids) || glossary_ids.length === 0) {
      return badRequest('glossary_ids는 필수이며 배열이어야 합니다.');
    }

    if (!product_codes && !approval_status) {
      return badRequest('product_codes 또는 approval_status 중 하나는 필수입니다.');
    }

    let updatedCount = 0;

    // Update products if provided
    if (product_codes && Array.isArray(product_codes) && product_codes.length > 0) {
      // First, delete existing product associations for these glossary terms
      const { error: deleteError } = await supabase
        .from('glossary_products')
        .delete()
        .in('glossary_id', glossary_ids);

      if (deleteError) {
        console.error('Error deleting old glossary products:', deleteError);
        throw deleteError;
      }

      // Then, insert new product associations
      const productLinks = glossary_ids.flatMap(glossary_id =>
        product_codes.map(product_code => ({
          glossary_id,
          product_code: product_code as ProductCode,
        }))
      );

      const { error: insertError, count } = await supabase
        .from('glossary_products')
        .insert(productLinks);

      if (insertError) {
        console.error('Error inserting new glossary products:', insertError);
        throw insertError;
      }

      // Update the glossary updated_at timestamp
      await supabase
        .from('glossary')
        .update({ updated_at: new Date().toISOString() })
        .in('id', glossary_ids);

      updatedCount = glossary_ids.length;
    }

    // Update approval_status if provided
    if (approval_status) {
      const { error: updateError, count } = await supabase
        .from('glossary')
        .update({
          approval_status: approval_status as 'approved' | 'rejected' | 'pending',
          updated_at: new Date().toISOString(),
        })
        .in('id', glossary_ids);

      if (updateError) {
        console.error('Error updating glossary approval status:', updateError);
        throw updateError;
      }

      updatedCount = count || 0;
    }

    return successResponse({
      updated: updatedCount,
      message: `${updatedCount}개 용어가 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return serverError('일괄 업데이트 중 오류가 발생했습니다.');
  }
}
