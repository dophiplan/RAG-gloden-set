import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { TranslationStatus, ProductCode } from '@/types';
import { successResponse, serverError, badRequest } from '@/lib/api/middleware';

/**
 * PATCH - Bulk update translations
 * Updates multiple translations at once (product, status, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { translation_ids, product_code, status } = body;

    // Validation
    if (!translation_ids || !Array.isArray(translation_ids) || translation_ids.length === 0) {
      return badRequest('translation_ids는 필수이며 배열이어야 합니다.');
    }

    if (!product_code && !status) {
      return badRequest('product_code 또는 status 중 하나는 필수입니다.');
    }

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    let updatedCount = 0;

    // Update product if provided
    if (product_code) {
      // First, delete existing product associations
      const { error: deleteError } = await supabase
        .from('translation_products')
        .delete()
        .in('translation_id', translation_ids);

      if (deleteError) {
        console.error('Error deleting translation_products:', deleteError);
        throw deleteError;
      }

      // Insert new product associations
      const productLinks = translation_ids.map(id => ({
        translation_id: id,
        product_code: product_code as ProductCode,
      }));

      const { error: insertError } = await supabase
        .from('translation_products')
        .insert(productLinks);

      if (insertError) {
        console.error('Error inserting translation_products:', insertError);
        throw insertError;
      }

      // Create audit logs for product change
      const auditLogs = translation_ids.map(id => ({
        translation_id: id,
        user_id: user.id,
        user_name: userProfile?.name,
        user_email: userProfile?.email || user.email,
        action: 'update',
        field_name: 'product',
        new_value: product_code,
      }));

      await supabase.from('translation_audit_logs').insert(auditLogs);

      updatedCount = translation_ids.length;
    }

    // Update status if provided
    if (status) {
      const { data, error: updateError } = await supabase
        .from('translations')
        .update({
          status: status as TranslationStatus,
          updated_at: new Date().toISOString(),
        })
        .in('id', translation_ids)
        .select('id');

      if (updateError) {
        console.error('Error updating translations:', updateError);
        throw updateError;
      }

      // Create audit logs for status change
      const auditLogs = translation_ids.map(id => ({
        translation_id: id,
        user_id: user.id,
        user_name: userProfile?.name,
        user_email: userProfile?.email || user.email,
        action: 'update',
        field_name: 'status',
        new_value: status,
      }));

      await supabase.from('translation_audit_logs').insert(auditLogs);

      updatedCount = data?.length || 0;
    }

    return successResponse({
      updated: updatedCount,
      message: `${updatedCount}개 항목이 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return serverError('일괄 업데이트 중 오류가 발생했습니다.');
  }
}
