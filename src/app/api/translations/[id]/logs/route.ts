import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - 특정 번역의 모든 변경 이력 조회 (번역 수정 + 상태 변경 등)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: translationId } = await params;
    const { searchParams } = new URL(request.url);
    const languageCode = searchParams.get('language');

    const allLogs: any[] = [];

    // 1. translation_audit_logs 조회 (상태 변경, 원문 수정 등)
    const { data: auditLogs } = await supabase
      .from('translation_audit_logs')
      .select('*')
      .eq('translation_id', translationId)
      .order('created_at', { ascending: false });

    if (auditLogs) {
      auditLogs.forEach(log => {
        let changeDescription = '';

        if (log.field_name === 'status') {
          const statusLabels: Record<string, string> = {
            pending: '요청',
            in_progress: '진행 중',
            reviewed: '검수',
            deployed: '반영',
            re_request: '재요청',
            not_used: '사용안함',
            re_deploy_request: '재반영요청',
          };
          changeDescription = `상태: ${statusLabels[log.old_value] || log.old_value} → ${statusLabels[log.new_value] || log.new_value}`;
        } else if (log.field_name === 'source_text') {
          changeDescription = `원문 수정`;
        } else if (log.field_name === 'context') {
          changeDescription = `설명 수정`;
        } else if (log.field_name === 'priority') {
          changeDescription = `중요도: ${log.old_value} → ${log.new_value}`;
        } else if (log.field_name === 'scope') {
          changeDescription = `제품분류: ${log.old_value || '-'} → ${log.new_value || '-'}`;
        } else {
          changeDescription = `${log.field_name} 수정`;
        }

        allLogs.push({
          id: log.id,
          type: 'audit',
          action: log.action,
          fieldName: log.field_name,
          changeDescription,
          previousValue: log.old_value,
          newValue: log.new_value,
          createdAt: log.created_at,
          changedBy: log.user_name || log.user_email || 'Unknown',
        });
      });
    }

    // 2. translation_logs 조회 (번역 텍스트 변경) - 특정 언어만
    if (languageCode) {
      const { data: translationResult } = await supabase
        .from('translation_results')
        .select('id')
        .eq('translation_id', translationId)
        .eq('language_code', languageCode)
        .single();

      if (translationResult) {
        const { data: translationLogs } = await supabase
          .from('translation_logs')
          .select('*')
          .eq('translation_result_id', translationResult.id)
          .order('created_at', { ascending: false });

        if (translationLogs) {
          // 사용자 이름 조회
          const userIds = [...new Set(translationLogs.map(log => log.changed_by).filter(Boolean))];
          const { data: users } = await supabase
            .from('users')
            .select('id, name')
            .in('id', userIds);

          const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

          translationLogs.forEach(log => {
            allLogs.push({
              id: log.id,
              type: 'translation',
              action: 'update',
              fieldName: 'translated_text',
              changeDescription: `${languageCode.toUpperCase()} 번역 수정`,
              previousValue: log.previous_text,
              newValue: log.new_text,
              createdAt: log.created_at,
              changedBy: userMap.get(log.changed_by) || 'Unknown',
            });
          });
        }

        // 현재 번역 결과도 포함
        const { data: currentResult } = await supabase
          .from('translation_results')
          .select('translated_text, reviewer_id, reviewed_at')
          .eq('id', translationResult.id)
          .single();

        if (currentResult && currentResult.reviewed_at) {
          const { data: reviewerUser } = await supabase
            .from('users')
            .select('name')
            .eq('id', currentResult.reviewer_id)
            .single();

          allLogs.push({
            id: 'current',
            type: 'translation',
            action: 'current',
            fieldName: 'translated_text',
            changeDescription: `${languageCode.toUpperCase()} 현재 번역`,
            previousValue: null,
            newValue: currentResult.translated_text,
            createdAt: currentResult.reviewed_at,
            changedBy: reviewerUser?.name || 'Unknown',
          });
        }
      }
    }

    // 시간순 정렬 (최신순)
    allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allLogs);
  } catch (error) {
    console.error('Error fetching translation logs:', error);
    return NextResponse.json(
      { error: '변경 이력을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
