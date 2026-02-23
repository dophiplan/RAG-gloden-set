import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { apiSuccess, apiInternalError } from '@/lib/api/response';
import { PAGINATION } from '@/lib/constants';
import { TranslationStatus, ProductCode } from '@/types';

/**
 * Handler for GET /api/translations
 * Lists translations with filtering and pagination
 */
export async function handleGetTranslationsList(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse ? unauthorizedResponse() : apiInternalError('Unauthorized');
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TranslationStatus | null;
    const language = searchParams.get('language');
    const search = searchParams.get('search');
    const productCode = searchParams.get('product_code') as ProductCode | null;
    const requestId = searchParams.get('request_id');
    const scope = searchParams.get('scope') as 'SaaS' | 'Solution' | null;
    const version = searchParams.get('version');
    const createdAfter = searchParams.get('created_after');
    const createdBefore = searchParams.get('created_before');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(PAGINATION.DEFAULT_PAGE_SIZE));

    // Build filters
    const filters = {
      status: status || undefined,
      language: language || undefined,
      search: search || undefined,
      productCode: productCode || undefined,
      requestId: requestId || undefined,
      scope: scope || undefined,
      version: version || undefined,
      createdAfter: createdAfter || undefined,
      createdBefore: createdBefore || undefined,
    };

    // Call service
    const service = new TranslationCrudService(supabase);
    const result = await service.getTranslationsList(filters, { page, limit });

    return apiSuccess({
      translations: result.translations,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return apiInternalError('번역 목록을 불러오는데 실패했습니다.');
  }
}
