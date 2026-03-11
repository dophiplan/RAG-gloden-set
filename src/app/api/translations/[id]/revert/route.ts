import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';

interface RevertRequest {
  logId: string;
  languageCode: string;
}

/**
 * @deprecated 이 엔드포인트는 /api/rollback으로 통합되었습니다.
 * 마이그레이션: POST /api/rollback
 * Body: { operation: 'single', entityType: 'translation', logId: '...', entityId: '...' }
 */
// POST - Revert to a previous version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: RevertRequest = await request.json();

    if (!body.logId || !body.languageCode) {
      return NextResponse.json(
        { error: '로그 ID와 언어 코드는 필수입니다.' },
        { status: 400 }
      );
    }

    // Use Service to revert translation
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    try {
      const result = await service.revertTranslationResult(body.logId, user.id);

      return NextResponse.json({
        success: true,
        message: '이전 버전으로 복구되었습니다.',
        data: {
          translation_result_id: result.translationResultId,
          previous_text: result.previousText,
          reverted_text: result.revertedText,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Log not found') {
          return NextResponse.json(
            { error: '해당 버전을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        if (error.message === 'ALREADY_AT_VERSION') {
          return NextResponse.json(
            { error: '이미 해당 버전입니다.' },
            { status: 400 }
          );
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reverting translation:', error);
    return NextResponse.json(
      { error: '복구에 실패했습니다.' },
      { status: 500 }
    );
  }
}
