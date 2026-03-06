import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { priorityCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiCachedSuccess, apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/priorities
 * Fetch all priority levels
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development: Allow bypass for reference data
    if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS !== 'true') {
      return apiUnauthorized();
    }

    const { data: priorities, error } = await supabase
      .from('priority_levels')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: false }); // Highest priority first

    if (error) throw error;

    return apiCachedSuccess({ priorities });
  } catch (error) {
    console.error('Error fetching priorities:', error);
    return apiInternalError('우선순위 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * POST - Create a new priority (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(priorityCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, label, color, sort_order } = body;

    // Check if code already exists
    const { data: existing } = await supabase
      .from('priority_levels')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return apiConflict('이미 존재하는 우선순위 코드입니다.');
    }

    // Insert new priority
    const { data: priority, error } = await supabase
      .from('priority_levels')
      .insert({
        code,
        label,
        color,
        sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ priority });
  } catch (error) {
    console.error('Error creating priority:', error);
    return apiInternalError('우선순위 생성에 실패했습니다.');
  }
}
