import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { adaptTranslationUpdateRequest } from '../../adapters/request-adapter';
import { adaptTranslationUpdateResponse } from '../../adapters/response-adapter';
import { validateIds } from '../../lib/validation';
import { logTranslationAudit } from '../../lib/audit';
import { ApiError } from '../../lib/response';

export async function translationsUpdate(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();

  // 요청 변환 (하위 호환성)
  const adapted = adaptTranslationUpdateRequest(body);

  // 검증
  if (!validateIds(adapted.ids)) {
    throw new ApiError('ids 또는 translation_ids 배열은 필수입니다.', 400);
  }

  if (!adapted.data || typeof adapted.data !== 'object') {
    throw new ApiError('data 객체는 필수입니다.', 400);
  }

  // audit 메타데이터 추가
  const updateData = {
    ...adapted.data,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  // DB 업데이트
  const { error } = await adminClient
    .from('translations')
    .update(updateData)
    .in('id', adapted.ids);

  if (error) {
    console.error('Bulk update error:', error);
    throw new ApiError('업데이트 중 오류가 발생했습니다.', 500);
  }

  // audit 로깅
  await logTranslationAudit(adminClient, {
    action: 'bulk_update',
    userId: user.id,
    userEmail: user.email,
    affectedIds: adapted.ids,
    newValues: updateData,
  });

  // 응답 변환
  return adaptTranslationUpdateResponse({ updatedCount: adapted.ids.length });
}
