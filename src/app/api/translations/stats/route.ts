import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api/response';
import { TranslationCrudService } from '@/services';
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

    // Use Service to get stats
    const service = new TranslationCrudService(dataClient);
    const stats = await service.getStats(productCode || undefined);

    return apiSuccess(stats);

  } catch (error) {
    console.error('Error fetching translation stats:', error);
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
