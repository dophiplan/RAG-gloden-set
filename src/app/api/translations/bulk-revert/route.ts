import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';

interface BulkRevertRequest {
  revertItems: {
    translationResultId: string;
    revertText: string;
  }[];
}

// POST - Bulk revert translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: BulkRevertRequest = await request.json();
    const { revertItems } = body;

    if (!revertItems?.length) {
      return NextResponse.json(
        { error: '복구할 항목이 없습니다.' },
        { status: 400 }
      );
    }

    // Use Service for bulk revert
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    const result = await service.bulkRevertTranslationResults(revertItems, user.id);

    return NextResponse.json({
      success: true,
      message: `${result.successCount}개 항목이 복구되었습니다.`,
      revertedCount: result.successCount,
      errorCount: result.errorCount,
    });
  } catch (error) {
    console.error('Error bulk reverting translations:', error);
    return NextResponse.json(
      { error: '복구에 실패했습니다.' },
      { status: 500 }
    );
  }
}
