import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { statusCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { badRequest } from '@/lib/api/middleware';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

/**
 * GET /api/statuses
 * Fetch all translation statuses
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: statuses, error } = await supabase
      .from('translation_statuses')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return NextResponse.json(
      { error: '상태 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new status (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(statusCreateSchema, rawBody);

    if (!validation.success) {
      return badRequest(validation.error, undefined, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, label_ko, label_en, color, bg_color, text_color, sort_order } = body;

    // Check if code already exists
    const { data: existing } = await supabase
      .from('translation_statuses')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 상태 코드입니다.' },
        { status: 409 }
      );
    }

    // Insert new status
    const { data: status, error } = await supabase
      .from('translation_statuses')
      .insert({
        code,
        label_ko,
        label_en,
        color: color || null,
        bg_color,
        text_color,
        sort_order,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    console.error('Error creating status:', error);
    return NextResponse.json(
      { error: '상태 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
