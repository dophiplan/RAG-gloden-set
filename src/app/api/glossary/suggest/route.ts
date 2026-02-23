import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { suggestGlossaryTerms } from '@/lib/glossary/term-detector';
import { LanguageCode, ProductCode } from '@/types';
import { PAGINATION } from '@/lib/constants';
import { apiSuccess, apiUnauthorized, apiInternalError } from '@/lib/api/response';

/**
 * GET - 제안된 용어 목록 가져오기
 * Query params:
 *   - language: 언어 코드 (optional)
 *   - product_code: 제품 코드 (optional)
 *   - limit: 최대 개수 (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('language') as LanguageCode | null;
    const productCode = searchParams.get('product_code') as ProductCode | null;
    const limit = parseInt(searchParams.get('limit') || String(PAGINATION.DEFAULT_PAGE_SIZE), 10);

    // 용어 제안 가져오기
    const suggestions = await suggestGlossaryTerms(
      languageCode || undefined,
      productCode || undefined,
      limit
    );

    return apiSuccess({ suggestions });
  } catch (error) {
    console.error('Error fetching glossary suggestions:', error);
    return apiInternalError('용어 제안을 불러오는데 실패했습니다.');
  }
}
