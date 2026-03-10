import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { ProductCode } from '@/types';

/**
 * GET /api/translations/stats
 * Get translation counts by status for the current product
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('product_code') as ProductCode | null;

    // Use admin client to bypass RLS
    const dataClient = adminClient || createAdminClient();

    // Build base query
    let query = dataClient.from('translations').select('status', { count: 'exact' });

    // Apply product filter
    if (productCode) {
      const { data: translationIds } = await dataClient
        .from('translation_products')
        .select('translation_id')
        .eq('product_code', productCode);
      
      if (translationIds && translationIds.length > 0) {
        query = query.in('id', translationIds.map(t => t.translation_id));
      } else {
        // No translations for this product
        return apiSuccess({
          pending: 0,
          in_progress: 0,
          reviewed: 0,
          re_request: 0,
          deployed: 0,
          not_used: 0,
          total: 0,
        });
      }
    }

    // Get all translations
    const { data: translations, error } = await query;

    if (error) {
      console.error('Error fetching stats:', error);
      return apiError('FETCH_FAILED', 'Failed to fetch stats', 500);
    }

    // Count by status
    const counts = {
      pending: 0,
      in_progress: 0,
      reviewed: 0,
      re_request: 0,
      deployed: 0,
      not_used: 0,
    };

    translations?.forEach((t) => {
      if (counts[t.status as keyof typeof counts] !== undefined) {
        counts[t.status as keyof typeof counts]++;
      }
    });

    return apiSuccess({
      ...counts,
      total: translations?.length || 0,
    });

  } catch (error) {
    console.error('Error fetching translation stats:', error);
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
