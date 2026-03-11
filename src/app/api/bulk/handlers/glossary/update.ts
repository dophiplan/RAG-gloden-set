import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GlossaryService } from '@/services';
import type { User } from '../../types';
import { validateItems } from '../../lib/validation';
import { ApiError, successResponse } from '../../lib/response';

export async function glossaryUpdate(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const items = body.items || [];

  if (!validateItems(items)) {
    throw new ApiError('items 배열은 필수입니다.', 400);
  }

  const service = new GlossaryService(adminClient);
  
  // Type assertion for items with id
  const itemsWithId = items as Array<{ id: string } & Record<string, unknown>>;
  
  const results = await service.updateBulk(itemsWithId, {
    id: user.id,
    email: user.email,
  });

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;

  return successResponse({
    message: `${successCount}개 업데이트 성공, ${errorCount}개 실패`,
    results,
  });
}
