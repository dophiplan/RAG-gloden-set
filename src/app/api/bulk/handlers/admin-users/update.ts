import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function adminUsersUpdate(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const { ids, data: updateData } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  if (!updateData || typeof updateData !== 'object') {
    throw new ApiError('data 객체는 필수입니다.', 400);
  }

  const service = new UsersService(adminClient);
  
  const result = await service.updateUsers(ids, updateData, user.id);

  if (!result.success) {
    throw new ApiError(
      `업데이트 중 오류가 발생했습니다: ${result.errors?.join(', ')}`,
      400
    );
  }

  return successResponse({
    message: `${result.count}명의 사용자가 업데이트되었습니다.`,
    updatedCount: result.count,
    requestedCount: ids.length,
  });
}
