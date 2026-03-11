import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { handleSingleRollback } from './handlers/single';
import { handleBatchRollback } from './handlers/batch';
import { handleDateBasedRollback } from './handlers/date-based';

/**
 * Unified Rollback API
 * 
 * Consolidates all rollback operations into a single API
 */

// GET - List rollback operations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (!adminClient) {
      return NextResponse.json({ error: '관리자 클라이언트를 생성할 수 없습니다.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = adminClient
      .from('rollback_operations')
      .select('*')
      .order('created_at', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      operations: data || [],
      total: count || 0,
      limit,
      offset,
    });

  } catch (error) {
    console.error('Error listing rollback operations:', error);
    return NextResponse.json(
      { error: '롤백 작업 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST - Execute rollback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (!adminClient) {
      return NextResponse.json({ error: '관리자 클라이언트를 생성할 수 없습니다.' }, { status: 500 });
    }

    const body = await request.json();
    const { operation } = body;

    if (!operation) {
      return NextResponse.json(
        { error: 'operation은 필수입니다. (single, batch, date-based)' },
        { status: 400 }
      );
    }

    // Route to appropriate handler
    switch (operation) {
      case 'single':
        return handleSingleRollback(body, user, adminClient);

      case 'batch':
        return handleBatchRollback(body, user, adminClient);

      case 'date-based':
        return handleDateBasedRollback(body, user, adminClient);

      default:
        return NextResponse.json(
          { error: '유효하지 않은 operation입니다. (single, batch, date-based)' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error executing rollback:', error);
    return NextResponse.json(
      { error: '롤백 실행에 실패했습니다.' },
      { status: 500 }
    );
  }
}
