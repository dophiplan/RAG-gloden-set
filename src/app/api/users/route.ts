import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { ProductCode, UserRole } from '@/types';
import { requireMasterRole } from '@/lib/api-auth';
import { apiSuccess, apiInternalError } from '@/lib/api/response';

// GET - List users with filters and search
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireMasterRole(supabase);

    if (auth.error) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);

    // Parse filters
    const workProductsParam = searchParams.get('work_products');
    const workScopeParam = searchParams.get('work_scope');
    const rolesParam = searchParams.get('roles');
    const workLanguagesParam = searchParams.get('work_languages');
    const search = searchParams.get('search');

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Start building query
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters with AND condition
    // Filter by work_products (array contains)
    if (workProductsParam) {
      const workProducts = workProductsParam.split(',').map(p => p.trim());
      for (const product of workProducts) {
        query = query.contains('work_products', [product]);
      }
    }

    // Filter by work_scope (array contains)
    if (workScopeParam) {
      const workScope = workScopeParam.split(',').map(s => s.trim());
      for (const scope of workScope) {
        query = query.contains('work_scope', [scope]);
      }
    }

    // Filter by roles (array contains)
    if (rolesParam) {
      const roles = rolesParam.split(',').map(r => r.trim());
      for (const role of roles) {
        query = query.contains('roles', [role]);
      }
    }

    // Filter by work_languages (array contains)
    if (workLanguagesParam) {
      const workLanguages = workLanguagesParam.split(',').map(l => l.trim());
      for (const lang of workLanguages) {
        query = query.contains('work_languages', [lang]);
      }
    }

    // Apply search (partial match on name or email)
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) throw error;

    return apiSuccess({
      users: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    return apiInternalError(
      error instanceof Error ? error.message : '알 수 없는 오류'
    );
  }
}
