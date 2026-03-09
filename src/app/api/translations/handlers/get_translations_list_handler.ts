import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { apiSuccess, apiInternalError } from '@/lib/api/response';
import { PAGINATION } from '@/lib/constants';
import { TranslationStatus, ProductCode, ScopeType } from '@/types';

/**
 * Handler for GET /api/translations
 * Lists translations with filtering and pagination
 */
export async function handleGetTranslationsList(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse ? unauthorizedResponse() : apiInternalError('Unauthorized');
    }

    // Use admin client to bypass RLS for data fetching
    const dataClient = adminClient || createAdminClient();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TranslationStatus | null;
    const language = searchParams.get('language');
    const search = searchParams.get('search');
    const productCode = searchParams.get('product_code') as ProductCode | null;
    const requestId = searchParams.get('request_id');
    const rawScope = searchParams.get('scope');
    // Convert legacy scope values to new format
    const scopeMap: Record<string, ScopeType> = {
      'SaaS': 'saas',
      'Solution': 'solution',
      '정부과제': 'government',
      '기타': 'other',
      'saas': 'saas',
      'solution': 'solution',
      'government': 'government',
      'other': 'other',
    };
    const scope = rawScope ? scopeMap[rawScope] || null : null;
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

    // Call service with admin client to bypass RLS
    const service = new TranslationCrudService(dataClient);
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
