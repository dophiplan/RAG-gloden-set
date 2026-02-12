import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { productCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { badRequest } from '@/lib/api/middleware';

/**
 * GET - List all products
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development: Allow bypass for reference data
    if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS !== 'true') {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: '제품 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new product (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(productCreateSchema, rawBody);

    if (!validation.success) {
      return badRequest(validation.error, undefined, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, name, description, display_order } = body;

    // Check if code already exists (using regular client with RLS)
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 제품 코드입니다.' },
        { status: 409 }
      );
    }

    // Insert new product (RLS will allow if user is admin)
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: '제품 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
