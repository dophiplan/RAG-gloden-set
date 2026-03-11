import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GlossaryService } from '@/services';
import type { User } from '../../types';
import { ApiError, successResponse } from '../../lib/response';

export async function glossaryCreate(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const { items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError('items 배열은 필수입니다.', 400);
  }

  const service = new GlossaryService(adminClient);
  
  const { terms, errors } = await service.createBulk(items, {
    id: user.id,
    email: user.email,
  });

  if (errors.length > 0 && terms.length === 0) {
    throw new ApiError(`용어집 생성 중 오류가 발생했습니다: ${errors[0].error}`, 500);
  }

  return successResponse({
    message: `${terms.length}개 용어가 생성되었습니다.`,
    data: terms,
    errors: errors.length > 0 ? errors : undefined,
  }, 201);
}
