import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { LanguageCode, ProductCode } from '@/types';
import { sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { apiSuccess, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';
import { GlossaryRepository } from '@/repositories';

/**
 * GET - 용어집 목록 조회
 * @param request - Next.js 요청 객체
 * @returns 용어집 목록 및 페이지네이션 정보
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('language') as LanguageCode | null;
    const productCode = searchParams.get('product_code') as ProductCode | null;
    const search = searchParams.get('search');
    const sourceType = searchParams.get('source_type');
    const approvalStatus = searchParams.get('approval_status');
    const importedAfter = searchParams.get('imported_after');
    const importedBefore = searchParams.get('imported_before');
    const sort = searchParams.get('sort') || 'term';

    // 페이지네이션 파라미터
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    // 제품 필터링 시 inner join 사용
    const selectStatement = productCode
      ? `
        *,
        glossary_products!inner (product_code)
      `
      : `
        *,
        glossary_products (product_code)
      `;

    let query = supabase
      .from('glossary')
      .select(selectStatement, { count: 'exact' });

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (productCode) {
      query = query.eq('glossary_products.product_code', productCode);
    }

    if (sourceType && ['manual', 'excel_import', 'ai_generated'].includes(sourceType)) {
      query = query.eq('source_type', sourceType);
    }

    if (approvalStatus && ['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      query = query.eq('approval_status', approvalStatus);
    }

    if (importedAfter) {
      query = query.gte('imported_at', importedAfter);
    }

    if (importedBefore) {
      query = query.lte('imported_at', importedBefore);
    }

    if (search) {
      query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
    }

    // 정렬 적용
    if (sort === 'hit_count') {
      query = query.order('hit_count', { ascending: false });
    } else if (sort === 'imported_at') {
      query = query.order('imported_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('term', { ascending: true });
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return apiSuccess({
      terms: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error fetching glossary:', error);
    return apiInternalError('용어집을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - 용어 생성 (AI 번역 포함)
 * @param request - Next.js 요청 객체
 * @returns 생성된 용어 목록
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    // 용어 생성 rate limit 확인
    const rateLimitResult = await enforceRateLimit(user.id, 'glossary_create');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { 
      sourceText, 
      context, 
      product_code, 
      product_codes,
      targetLanguages 
    } = body;

    // 필수 필드 검증
    if (!sourceText || !sourceText.trim()) {
      return apiBadRequest('원문을 입력해주세요.');
    }

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return apiBadRequest('번역할 언어를 선택해주세요.');
    }

    // 텍스트 입력 정제
    const sanitizedSourceText = sanitizeText(sourceText);
    const sanitizedContext = context ? sanitizeText(context) : null;

    // 중복 용어 확인 (동일한 용어와 제품)
    let duplicateQuery = supabase
      .from('glossary')
      .select('id')
      .eq('term', sanitizedSourceText);

    if (product_code) {
      duplicateQuery = duplicateQuery.eq('product_code', product_code);
    } else {
      duplicateQuery = duplicateQuery.is('product_code', null);
    }

    const { data: existing } = await duplicateQuery.limit(1).single();

    if (existing) {
      return apiConflict('이미 등록된 용어입니다.');
    }

    // 감사 로그용 사용자 프로필 조회
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const repository = new GlossaryRepository(supabase);
    const createdTerms = [];

    // 각 대상 언어에 대해 AI 번역 수행
    for (const langCode of targetLanguages) {
      try {
        // Kimi AI를 통한 번역 호출
        const { translateWithProvider } = await import('@/lib/ai');
        const aiTranslations = await translateWithProvider('kimi', {
          sourceText: sanitizedSourceText,
          context: sanitizedContext,
          targetLanguages: [langCode],
          glossaryTerms: [],
          translationMemory: [],
          corrections: [],
          apiKey: process.env.KIMI_API_KEY || '',
        });

        const translatedText = aiTranslations[0]?.translatedText || sanitizedSourceText;

        // 해당 언어로 용어 생성
        const term = await repository.create(
          {
            term: sanitizedSourceText,
            translation: translatedText,
            context: sanitizedContext,
            language_code: langCode as LanguageCode,
            product_code: product_code,
            product_codes: product_codes,
            source_type: 'ai_generated',
            approval_status: 'pending', // 모든 새 용어는 보류 상태로 시작
          },
          {
            id: user.id,
            name: userProfile?.name,
            email: user.email,
          }
        );

        createdTerms.push(term);
      } catch (translationError) {
        console.error(`Error translating to ${langCode}:`, translationError);
        // 하나가 실패해도 다른 언어는 계속 진행
      }
    }

    if (createdTerms.length === 0) {
      return apiInternalError('용어 생성에 실패했습니다.');
    }

    return apiSuccess({
      terms: createdTerms,
      message: `${createdTerms.length}개 언어로 용어가 추가되었습니다.`,
    });
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return apiInternalError('용어를 추가하는데 실패했습니다.');
  }
}
