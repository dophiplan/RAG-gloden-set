import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LanguageCode, ProductCode } from '@/types';
import { sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { successResponse, serverError, badRequest, conflict } from '@/lib/api/middleware';
import { GlossaryRepository } from '@/repositories';
// AI translation is done dynamically to avoid top-level import issues

// GET - List glossary terms
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    // Build select statement with inner join if filtering by product
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
      // Filter by glossary_products table
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

    // Apply sorting
    if (sort === 'hit_count') {
      query = query.order('hit_count', { ascending: false });
    } else if (sort === 'imported_at') {
      query = query.order('imported_at', { ascending: false, nullsFirst: false });
    } else {
      query = query.order('term', { ascending: true });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse({
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
    return serverError('용어집을 불러오는데 실패했습니다.');
  }
}

// POST - Create glossary term with AI translation for all languages
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Check rate limit for glossary creation
    const rateLimitResult = await enforceRateLimit(user.id, 'glossary_create');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse request body
    const body = await request.json();
    const { 
      sourceText, 
      context, 
      product_code, 
      product_codes,
      targetLanguages 
    } = body;

    // Validate required fields
    if (!sourceText || !sourceText.trim()) {
      return badRequest('원문을 입력해주세요.');
    }

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return badRequest('번역할 언어를 선택해주세요.');
    }

    // Sanitize text inputs
    const sanitizedSourceText = sanitizeText(sourceText);
    const sanitizedContext = context ? sanitizeText(context) : null;

    // Check for duplicate term (same term and product)
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
      return conflict('이미 등록된 용어입니다.');
    }

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const repository = new GlossaryRepository(supabase);
    const createdTerms = [];

    // Translate for each target language using AI
    for (const langCode of targetLanguages) {
      try {
        // Call Kimi AI for translation
        // Note: Using the translateWithProvider pattern
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

        // Create glossary term for this language
        const term = await repository.create(
          {
            term: sanitizedSourceText,
            translation: translatedText,
            context: sanitizedContext,
            language_code: langCode as LanguageCode,
            product_code: product_code,
            product_codes: product_codes,
            source_type: 'ai_generated',
            approval_status: 'pending', // All new terms start as pending
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
        // Continue with other languages even if one fails
      }
    }

    if (createdTerms.length === 0) {
      return serverError('용어 생성에 실패했습니다.');
    }

    return successResponse({
      terms: createdTerms,
      message: `${createdTerms.length}개 언어로 용어가 추가되었습니다.`,
    }, 201);
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return serverError('용어를 추가하는데 실패했습니다.');
  }
}
