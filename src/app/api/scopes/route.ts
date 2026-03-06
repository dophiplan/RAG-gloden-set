import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { scopeCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiCachedSuccess, apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/scopes
 * Fetch all scope types
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development: Allow bypass for reference data
    if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS !== 'true') {
      return apiUnauthorized();
    }

    const { data: scopes, error } = await supabase
      .from('scopes')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return apiCachedSuccess({ scopes });
  } catch (error) {
    console.error('Error fetching scopes:', error);
    return apiInternalError('분류 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - Create a new scope (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(scopeCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, name, description, sort_order } = body;

    // Check if code already exists
    const { data: existing } = await supabase
      .from('scopes')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return apiConflict('이미 존재하는 분류 코드입니다.');
    }

    // Insert new scope
    const { data: scope, error } = await supabase
      .from('scopes')
      .insert({
        code,
        name,
        description: description || null,
        sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ scope });
  } catch (error) {
    console.error('Error creating scope:', error);
    return apiInternalError('분류 생성에 실패했습니다.');
  }
}
