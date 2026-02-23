import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BulkLogsRequest {
  translationIds: string[];
  languageCode: string;
}

// POST - 여러 번역의 버전 히스토리를 한꺼번에 조회
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

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

    // translation_result_ids 조회
    const { data: translationResults } = await supabase
      .from('translation_results')
      .select('id, translation_id, translated_text, reviewer_id, reviewed_at')
      .in('translation_id', translationIds)
      .eq('language_code', languageCode);

    if (!translationResults?.length) {
      return NextResponse.json({ logs: [], translations: [] });
    }

    const resultIds = translationResults.map(r => r.id);

    // 모든 로그 조회 (최신순)
    const { data: logs, error } = await supabase
      .from('translation_logs')
      .select(`
        id,
        translation_result_id,
        previous_text,
        new_text,
        created_at,
        changed_by
      `)
      .in('translation_result_id', resultIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 사용자 이름 조회
    const userIds = [
      ...new Set([
        ...(logs?.map(log => log.changed_by).filter(Boolean) || []),
        ...translationResults.map(r => r.reviewer_id).filter(Boolean)
      ])
    ];
    
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

    // 결과 매핑
    const resultMap = new Map(translationResults.map(r => [r.id, r]));

    // 시간순으로 그룹화된 로그 생성
    const formattedLogs = logs?.map((log) => {
      const result = resultMap.get(log.translation_result_id);
      return {
        id: log.id,
        translationId: result?.translation_id,
        translationResultId: log.translation_result_id,
        previousText: log.previous_text,
        newText: log.new_text,
        createdAt: log.created_at,
        changedBy: userMap.get(log.changed_by) || 'Unknown',
      };
    }) || [];

    // 현재 버전 정보 - reviewed_at이 없는 경우도 포함
    const currentVersions = translationResults
      .filter((result) => result.translated_text) // 빈 텍스트가 아닌 것만
      .map((result) => ({
        translationId: result.translation_id,
        translationResultId: result.id,
        curre[기밀마스킹]ext: result.translated_text,
        updatedAt: result.reviewed_at || null,
        updatedBy: result.reviewer_id ? (userMap.get(result.reviewer_id) || 'Unknown') : '작성자',
      }));

    return NextResponse.json({
      logs: formattedLogs,
      currentVersions,
      totalCount: formattedLogs.length + currentVersions.length,
    });
  } catch (error) {
    console.error('Error fetching bulk translation logs:', error);
    return NextResponse.json(
      { error: '버전 히스토리를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
