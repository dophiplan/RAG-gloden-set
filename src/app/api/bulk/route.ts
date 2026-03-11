import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { handlerRegistry } from './handlers';
import { errorResponse } from './lib/response';

/**
 * Unified Bulk Operations API
 * 
 * Consolidates all bulk operation endpoints into a single API
 * 
 * Endpoints being consolidated:
 * - POST /api/translations/bulk-create -> POST /api/bulk?type=translations&action=create
 * - POST /api/translations/bulk-update -> POST /api/bulk?type=translations&action=update
 * - POST /api/translations/bulk-delete -> POST /api/bulk?type=translations&action=delete
 * - POST /api/translations/bulk-revert -> POST /api/bulk?type=translations&action=revert
 * - POST /api/translations/bulk-products -> POST /api/bulk?type=translations&action=products
 * - POST /api/translations/bulk-logs -> POST /api/bulk?type=translations&action=logs
 * - POST /api/glossary/bulk -> POST /api/bulk?type=glossary&action=create
 * - POST /api/glossary/bulk-update -> POST /api/bulk?type=glossary&action=update
 * - POST /api/glossary/bulk-revert -> POST /api/bulk?type=glossary&action=revert
 * - POST /api/users/bulk-upload -> POST /api/bulk?type=users&action=upload
 * - POST /api/admin/users/bulk-delete -> POST /api/bulk?type=admin-users&action=delete
 * - POST /api/admin/users/bulk-update -> POST /api/bulk?type=admin-users&action=update
 */

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const action = searchParams.get('action');

    if (!type || !action) {
      return NextResponse.json(
        { error: 'type과 action 쿼리 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (!adminClient) {
      return NextResponse.json(
        { error: '관리자 클라이언트를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    // Route to appropriate handler
    const handlerKey = `${type}:${action}`;
    const handler = handlerRegistry[handlerKey];

    if (!handler) {
      return NextResponse.json(
        { error: `지원하지 않는 작업입니다: ${type}/${action}` },
        { status: 400 }
      );
    }

    return await handler(request, user, adminClient);

  } catch (error) {
    console.error('Error in bulk operation:', error);
    return errorResponse(error);
  }
}
