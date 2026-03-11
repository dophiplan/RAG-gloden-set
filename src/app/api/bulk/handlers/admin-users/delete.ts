import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function adminUsersDelete(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const ids = body.ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  const service = new UsersService(adminClient);
  
  const result = await service.deleteUsers(ids, user.id);

  if (!result.success) {
    throw new ApiError(
      `삭제 중 오류가 발생했습니다: ${result.errors?.join(', ')}`,
      400
    );
  }

  return successResponse({
    message: `${result.count}명의 사용자가 삭제되었습니다.`,
    deletedCount: result.count,
    requestedCount: ids.length,
  });
}
