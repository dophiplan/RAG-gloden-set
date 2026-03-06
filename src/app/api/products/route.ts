import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { productCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiCachedSuccess, apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';

/**
 * GET - List all products
 */
export async function GET(request: NextRequest) {
  try {
    // Use admin client to bypass RLS for reference data
    const adminClient = createAdminClient();

    const { data: products, error } = await adminClient
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    // Cache for 5 minutes (static reference data)
    return apiCachedSuccess({ products }, undefined, 300);
  } catch (error) {
    console.error('Error fetching products:', error);
    return apiInternalError('제품 목록을 불러오는데 실패했습니다.');
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
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
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
      return apiConflict('이미 존재하는 제품 코드입니다.');
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

    return apiSuccess({ product });
  } catch (error) {
    console.error('Error creating product:', error);
    return apiInternalError('제품 생성에 실패했습니다.');
  }
}
