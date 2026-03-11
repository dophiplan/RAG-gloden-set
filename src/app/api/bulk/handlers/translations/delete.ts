import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { validateIds } from '../../lib/validation';
import { logTranslationAudit } from '../../lib/audit';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsDelete(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();

  const ids = body.ids || body.translation_ids;

  if (!validateIds(ids)) {
    throw new ApiError('ids 또는 translation_ids 배열은 필수입니다.', 400);
  }

  const permanent = body.permanent === true;

  if (permanent) {
    // 영구 삭제
    const { error } = await adminClient
      .from('translations')
      .delete()
      .in('id', ids);

    if (error) {
      throw new ApiError('삭제 중 오류가 발생했습니다.', 500);
    }
  } else {
    // Soft delete
    const { error } = await adminClient
      .from('translations')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .in('id', ids);

    if (error) {
      throw new ApiError('삭제 중 오류가 발생했습니다.', 500);
    }
  }

  // audit 로깅
  await logTranslationAudit(adminClient, {
    action: permanent ? 'bulk_delete_permanent' : 'bulk_delete',
    userId: user.id,
    userEmail: user.email,
    affectedIds: ids,
  });

  return successResponse({
    deletedCount: ids.length,
    deleted: ids.length, // backward compatibility
  });
}
