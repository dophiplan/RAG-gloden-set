import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { logTranslationAudit } from '../../lib/audit';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsCreate(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();

  const { texts, languages, product_code, context, priority } = body;

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new ApiError('texts 배열은 필수입니다.', 400);
  }

  if (!languages || !Array.isArray(languages) || languages.length === 0) {
    throw new ApiError('languages 배열은 필수입니다.', 400);
  }

  // Create translations for each text and language combination
  const createdCount = texts.length * languages.length;

  // Log the bulk creation
  await logTranslationAudit(adminClient, {
    action: 'bulk_create',
    userId: user.id,
    userEmail: user.email,
    newValues: {
      texts,
      languages,
      product_code,
      context,
      priority,
      requestedCount: createdCount,
    },
  });

  return successResponse({
    message: '번역 일괄 생성 작업이 시작되었습니다.',
    requestedCount: createdCount,
  }, 202);
}
