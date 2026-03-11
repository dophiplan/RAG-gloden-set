import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';

interface BulkLogsRequest {
  translationIds: string[];
  languageCode: string;
}

// POST - Get bulk translation logs
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: BulkLogsRequest = await request.json();
    const { translationIds, languageCode } = body;

    if (!translationIds?.length || !languageCode) {
      return NextResponse.json(
        { error: '번역 ID 목록과 언어 코드는 필수입니다.' },
        { status: 400 }
      );
    }

    // Use Service to get bulk logs
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);

    const result = await service.getBulkTranslationLogs(translationIds, languageCode);

    return NextResponse.json({
      logs: result.logs,
      currentVersions: result.currentVersions,
      totalCount: result.totalCount,
    });
  } catch (error) {
    console.error('Error fetching bulk translation logs:', error);
    return NextResponse.json(
      { error: '버전 히스토리를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
