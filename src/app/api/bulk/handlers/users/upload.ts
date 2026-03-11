import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UsersService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function usersUpload(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const { users: userList } = body;

  if (!userList || !Array.isArray(userList) || userList.length === 0) {
    throw new ApiError('users 배열은 필수입니다.', 400);
  }

  const service = new UsersService(adminClient);
  
  const result = await service.uploadUsers(userList, user.id);

  if (!result.success) {
    throw new ApiError(
      `사용자 등록 중 오류가 발생했습니다: ${result.errors?.join(', ')}`,
      500
    );
  }

  return successResponse({
    message: `${result.count}명의 사용자가 등록되었습니다.`,
    count: result.count,
    requestedCount: userList.length,
    errors: result.errors,
  }, 201);
}
