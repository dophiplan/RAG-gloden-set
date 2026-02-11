import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GlossaryCreateInput, LanguageCode, ProductCode } from '@/types';
import { glossaryCreateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { successResponse, serverError, badRequest, conflict } from '@/lib/api/middleware';

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

    let query = supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `, { count: 'exact' });

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (productCode) {
      // Include both specific product terms AND common terms (product_code=null)
      query = query.or(`product_code.eq.${productCode},product_code.is.null`);
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

// POST - Create glossary term
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

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = validateAndSanitize(glossaryCreateSchema, rawBody);

    if (!validation.success) {
      return badRequest(validation.error);
    }

    const body = validation.data;

    // Sanitize text inputs
    const sanitizedTerm = sanitizeText(body.term);
    const sanitizedTranslation = sanitizeText(body.translation);
    const sanitizedContext = body.context ? sanitizeText(body.context) : null;

    // Check for duplicate term (same term, language, and product)
    let duplicateQuery = supabase
      .from('glossary')
      .select('id')
      .eq('term', sanitizedTerm)
      .eq('language_code', body.language_code);

    if (body.product_code) {
      duplicateQuery = duplicateQuery.eq('product_code', body.product_code);
    } else {
      duplicateQuery = duplicateQuery.is('product_code', null);
    }

    const { data: existing } = await duplicateQuery.single();

    if (existing) {
      return conflict('이미 등록된 용어입니다.');
    }

    // Use transaction-safe SQL function to create glossary with products
    const { data, error } = await supabase.rpc('create_glossary_with_products', {
      p_term: sanitizedTerm,
      p_translation: sanitizedTranslation,
      p_product_code: body.product_code || null,
      p_user_id: user.id,
      p_source_type: 'manual',
      p_product_codes: body.product_codes || null,
    });

    if (error) {
      console.error('Error calling create_glossary_with_products:', error);
      throw error;
    }

    // Fetch complete glossary with products
    const { data: completeGlossary } = await supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `)
      .eq('id', data.id)
      .single();

    return successResponse(completeGlossary, 201);
  } catch (error) {
    console.error('Error creating glossary term:', error);
    return serverError('용어를 추가하는데 실패했습니다.');
  }
}
