import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { validateIds } from '../../lib/validation';
import { logTranslationAudit } from '../../lib/audit';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsStatus(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();

  const ids = body.ids || body.translation_ids;

  if (!validateIds(ids)) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  if (!body.status) {
    throw new ApiError('status는 필수입니다.', 400);
  }

  const updateData = {
    status: body.status,
    status_updated_at: new Date().toISOString(),
    status_updated_by: user.id,
    status_reason: body.reason || null,
  };

  const { error } = await adminClient
    .from('translations')
    .update(updateData)
    .in('id', ids);

  if (error) {
    throw new ApiError('상태 변경 중 오류가 발생했습니다.', 500);
  }

  await logTranslationAudit(adminClient, {
    action: 'bulk_status_change',
    userId: user.id,
    userEmail: user.email,
    affectedIds: ids,
    newValues: updateData,
  });

  return successResponse({
    updatedCount: ids.length,
    status: body.status,
  });
}
