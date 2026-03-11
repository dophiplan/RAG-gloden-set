import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GlossaryService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function glossaryDelete(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const ids = body.ids || body.glossary_ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  const service = new GlossaryService(adminClient);
  
  const deletedCount = await service.deleteBulk(ids, {
    id: user.id,
    email: user.email,
  });

  if (deletedCount === 0) {
    throw new ApiError('삭제 중 오류가 발생했습니다.', 500);
  }

  return successResponse({
    message: `${deletedCount}개 용어가 삭제되었습니다.`,
    deletedCount,
    requestedCount: ids.length,
  });
}
