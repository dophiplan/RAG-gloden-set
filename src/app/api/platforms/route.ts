import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { platformCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiCachedSuccess, apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';

/**
 * GET - List all platforms
 */
export async function GET() {
  try {
    // Use admin client to bypass RLS for reference data
    const adminClient = createAdminClient();

    const { data: platforms, error } = await adminClient
      .from('platforms')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;

    return apiCachedSuccess({ platforms });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return apiInternalError('플랫폼 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - Create a new platform (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(platformCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, name, description, display_order } = body;

    // Check if code already exists (using regular client with RLS)
    const { data: existing } = await supabase
      .from('platforms')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return apiConflict('이미 존재하는 플랫폼 코드입니다.');
    }

    // Insert new platform (RLS will allow if user is admin)
    const { data: platform, error } = await supabase
      .from('platforms')
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ platform });
  } catch (error) {
    console.error('Error creating platform:', error);
    return apiInternalError('플랫폼 추가에 실패했습니다.');
  }
}
