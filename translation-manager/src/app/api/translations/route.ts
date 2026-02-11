import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationCreateInput, TranslationStatus, ProductCode } from '@/types';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { PAGINATION } from '@/lib/constants';
import { translationCreateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';
import { successResponse, serverError, badRequest } from '@/lib/api/middleware';

// GET - List translations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

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
    const offset = (page - 1) * limit;

    // Build select statement with inner join if filtering by product
    const selectStatement = productCode
      ? `
        *,
        translation_results (*),
        translation_products!inner (*)
      `
      : `
        *,
        translation_results (*),
        translation_products (*)
      `;

    let query = supabase
      .from('translations')
      .select(selectStatement, { count: 'exact' })
      .order('completion_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (language) {
      // Filter by translation_results table - translations that have a result in the specified language
      query = query.eq('translation_results.language_code', language);
    }

    if (productCode) {
      // Filter by translation_products table using inner join
      query = query.eq('translation_products.product_code', productCode);
    }

    if (requestId) {
      query = query.eq('request_id', requestId);
    }

    if (scope) {
      query = query.eq('scope', scope);
    }

    if (version) {
      query = query.ilike('version', `%${version}%`);
    }

    if (createdAfter) {
      query = query.gte('created_at', createdAfter);
    }

    if (createdBefore) {
      query = query.lte('created_at', createdBefore);
    }

    if (search) {
      // Search in both source_text and translated_text
      query = query.or(`source_text.ilike.%${search}%,translation_results.translated_text.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Fetch last audit log for each translation
    const translationIds = data?.map((t) => t.id) || [];
    let auditsMap: Record<string, { user_name: string | null; user_email: string | null; created_at: string }> = {};

    if (translationIds.length > 0) {
      // Get latest audit log for each translation
      const { data: audits } = await supabase
        .from('translation_audit_logs')
        .select('translation_id, user_name, user_email, created_at')
        .in('translation_id', translationIds)
        .order('created_at', { ascending: false });

      if (audits) {
        // Group by translation_id and take the first (most recent)
        audits.forEach((audit) => {
          if (!auditsMap[audit.translation_id]) {
            auditsMap[audit.translation_id] = {
              user_name: audit.user_name,
              user_email: audit.user_email,
              created_at: audit.created_at,
            };
          }
        });
      }
    }

    // Add last_audit to each translation
    const translationsWithAudit = data?.map((t) => ({
      ...t,
      last_audit: auditsMap[t.id] || null,
    }));

    return successResponse({
      translations: translationsWithAudit,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return serverError('번역 목록을 불러오는데 실패했습니다.');
  }
}

// POST - Create translation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Check rate limit for API creation
    const rateLimitResult = await enforceRateLimit(user.id, 'api_create');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = validateAndSanitize(translationCreateSchema, rawBody);

    if (!validation.success) {
      return badRequest(validation.error);
    }

    const body = validation.data;

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Sanitize text inputs
    const sanitizedSourceText = sanitizeText(body.source_text);
    const sanitizedContext = body.context ? sanitizeText(body.context) : null;
    const sanitizedVersion = body.version ? sanitizeText(body.version) : null;

    // Check glossary for exact matches before creating translation
    if (body.translations && body.translations.length > 0) {
      const languageCodes = body.translations.map(t => t.language_code);

      let glossaryQuery = supabase
        .from('glossary')
        .select('term, translation, language_code, product_code')
        .eq('term', sanitizedSourceText)
        .eq('approval_status', 'approved') // Only use approved terms
        .in('language_code', languageCodes);

      if (body.product_code) {
        glossaryQuery = glossaryQuery.or(`product_code.eq.${body.product_code},product_code.is.null`);
      }

      const { data: glossaryMatches } = await glossaryQuery;

      if (glossaryMatches && glossaryMatches.length > 0) {
        // Auto-fill from glossary if match found and translation is empty
        body.translations = body.translations.map(tr => {
          const match = glossaryMatches.find(g => g.language_code === tr.language_code);
          if (match && !tr.translated_text) {
            // Increment hit_count (non-blocking)
            void supabase.rpc('increment_glossary_hit_count', {
              p_term: match.term,
              p_language_code: match.language_code
            });

            return { ...tr, translated_text: match.translation };
          }
          return tr;
        });
      }
    }

    // Create translation
    const { data: translation, error: insertError } = await supabase
      .from('translations')
      .insert({
        source_text: sanitizedSourceText,
        context: sanitizedContext,
        version: sanitizedVersion,
        version_updated_at: body.version ? new Date().toISOString() : null,
        product_code: body.product_code || null,
        scope: body.scope || null,
        priority: body.priority || '중',
        user_id: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Create audit log (non-blocking)
    void supabase.from('translation_audit_logs').insert({
      translation_id: translation.id,
      user_id: user.id,
      user_name: userProfile?.name,
      user_email: userProfile?.email || user.email,
      action: 'create',
      new_value: sanitizedSourceText,
    }).then(({ error }) => {
      if (error) {
        console.error('[Audit Log] Failed to log translation creation:', error);
        // Don't throw - audit log failure should not break the main operation
      }
    });

    // If translations are provided, insert them (with sanitization)
    if (body.translations && body.translations.length > 0) {
      const translationResults = body.translations.map((t) => ({
        translation_id: translation.id,
        language_code: t.language_code,
        translated_text: sanitizeText(t.translated_text),
      }));

      const { error: resultsError } = await supabase
        .from('translation_results')
        .insert(translationResults);

      if (resultsError) throw resultsError;
    }

    // Handle product_codes if provided
    if (body.product_codes && body.product_codes.length > 0) {
      const productLinks = (body.product_codes as Array<ProductCode | { code: ProductCode; version?: string }>).map((item) => ({
        translation_id: translation.id,
        product_code: typeof item === 'string' ? item : item.code,
        version: typeof item === 'object' && item.version ? sanitizeText(item.version) : null,
        version_updated_at: typeof item === 'object' && item.version ? new Date().toISOString() : null,
      }));

      await supabase.from('translation_products').insert(productLinks);
    }

    // Fetch complete translation with results
    const { data: completeTranslation } = await supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_products (product_code)
      `)
      .eq('id', translation.id)
      .single();

    return successResponse(completeTranslation, 201);
  } catch (error) {
    console.error('Error creating translation:', error);
    return serverError('번역을 생성하는데 실패했습니다.');
  }
}
