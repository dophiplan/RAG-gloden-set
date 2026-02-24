import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { languageCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest } from '@/lib/api/response';

/**
 * GET - List all languages
 */
export async function GET(request: NextRequest) {
  try {
    // Use admin client to bypass RLS for reference data
    const adminClient = createAdminClient();

    const { data: languages, error } = await adminClient
      .from('languages')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return apiSuccess({ languages });
  } catch (error) {
    console.error('Error fetching languages:', error);
    return apiInternalError('언어 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - Create a new language (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(languageCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, name, description, display_order } = body;

    // Check if code already exists (using regular client with RLS)
    const { data: existing } = await supabase
      .from('languages')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return apiBadRequest('이미 존재하는 언어 코드입니다.');
    }

    // Insert new language (RLS will allow if user is admin)
    const { data: language, error } = await supabase
      .from('languages')
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ language });
  } catch (error) {
    console.error('Error creating language:', error);
    return apiInternalError('언어 생성에 실패했습니다.');
  }
}
