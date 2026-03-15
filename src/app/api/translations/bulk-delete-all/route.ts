import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ProductCode } from '@/types';

/**
 * DELETE /api/translations/bulk-delete-all
 * Delete all translations (1st_master+ only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    // Check if user has 1st_manager, master, or admin role
    const authClient = adminClient || supabase;
    const { data: userProfile } = await authClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const userRoles = userProfile?.roles || [];
    
    // DEBUG: Log user roles for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Bulk Delete All] User roles:', JSON.stringify(userRoles));
      console.log('[Bulk Delete All] includes 1st_master:', userRoles.includes('1st_master'));
    }
    
    const canDeleteAll = 
      userRoles.includes('1st_master') || 
      userRoles.includes('master') || 
      userRoles.includes('admin');

    if (!canDeleteAll) {
      console.log('[Bulk Delete All] Permission denied. Roles:', userRoles);
      return apiError('FORBIDDEN', '1st_master 이상만 전체 삭제가 가능합니다.', 403);
    }

    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code') as ProductCode | null;

    // Use admin client to bypass RLS
    const dataClient = adminClient || supabase;
    let deletedCount = 0;

    if (productCode) {
      // Delete translations for specific product
      // 1. Get translation IDs for this product
      const { data: translationIds } = await dataClient
        .from('translation_products')
        .select('translation_id')
        .eq('product_code', productCode);

      if (translationIds && translationIds.length > 0) {
        const ids = translationIds.map(t => t.translation_id);
        
        // 2. Delete translation_results first (FK constraint)
        await dataClient
          .from('translation_results')
          .delete()
          .in('translation_id', ids);

        // 3. Delete translation_products
        await dataClient
          .from('translation_products')
          .delete()
          .eq('product_code', productCode);

        // 4. Delete translations
        const { error } = await dataClient
          .from('translations')
          .delete()
          .in('id', ids);

        if (error) throw error;
        deletedCount = ids.length;
      }
    } else {
      // Delete ALL translations (1st_manager+ only)
      // Use RPC for truncate-like operation
      // 1. Delete all translation_results using not-is filter
      const { error: rError } = await dataClient
        .from('translation_results')
        .delete()
        .not('id', 'is', null);
      
      if (rError) console.error('Error deleting translation_results:', rError);

      // 2. Delete all translation_products
      const { error: tpError } = await dataClient
        .from('translation_products')
        .delete()
        .not('id', 'is', null);
      
      if (tpError) console.error('Error deleting translation_products:', tpError);

      // 3. Delete all translations and get count
      const { error: tError, count } = await dataClient
        .from('translations')
        .delete()
        .not('id', 'is', null);

      if (tError) throw tError;
      deletedCount = count || 0;
    }

    return apiSuccess({ 
      deleted: deletedCount,
      product_code: productCode,
      message: productCode 
        ? `${productCode} 제품의 ${deletedCount}개 항목이 삭제되었습니다.`
        : `${deletedCount}개 항목이 전체 삭제되었습니다.`
    });

  } catch (error) {
    console.error('Error deleting translations:', error);
    return apiError('INTERNAL_ERROR', '삭제 중 오류가 발생했습니다.', 500);
  }
}
