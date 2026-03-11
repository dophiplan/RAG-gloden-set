import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GlossaryService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function glossaryRevert(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const ids = body.ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  const service = new GlossaryService(adminClient);
  
  const results = await service.revertBulk(ids, {
    id: user.id,
    email: user.email,
  });

  const successCount = results.filter(r => r.reverted).length;
  const errorCount = results.length - successCount;

  return successResponse({
    message: `${successCount}개 용어가 복원되었습니다.`,
    results,
    successCount,
    errorCount,
  });
}
