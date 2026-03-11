import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsLogs(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const translationIds = body.translation_ids || body.ids;

  if (!translationIds || !Array.isArray(translationIds)) {
    throw new ApiError('translation_ids 배열은 필수입니다.', 400);
  }

  const { data, error } = await adminClient
    .from('translation_audit_logs')
    .select('*')
    .in('translation_id', translationIds)
    .order('created_at', { ascending: false });

  if (error) {
    throw new ApiError('로그 조회 중 오류가 발생했습니다.', 500);
  }

  return successResponse({
    logs: data || [],
    count: data?.length || 0,
  });
}
