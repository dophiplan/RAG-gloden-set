import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiBadRequest, apiInternalError } from '@/lib/api/response';

/**
 * @deprecated 이 엔드포인트는 /api/rollback으로 통합되었습니다.
 * 마이그레이션: POST /api/rollback
 * Body: { operation: 'date-based', entityType: 'translation|glossary', date: 'YYYY-MM-DD' }
 * 
 * 날짜별로 모든 작업을 롤백합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { targetDate, entityTypes = ['translation', 'glossary'] } = await request.json();

    if (!targetDate) {
      return apiBadRequest('날짜를 지정해주세요.');
    }

    // 날짜 범위 계산 (해당 날짜의 시작~끝)
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    let rolledBackCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 번역 롤백
    if (entityTypes.includes('translation')) {
      const { data: translationLogs, error: translationError } = await supabase
        .from('translation_audit_logs')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_rolled_back', false)
        .neq('action', 'rollback')
        .neq('action', 'delete')
        .order('created_at', { ascending: false });

      if (!translationError && translationLogs) {
        for (const log of translationLogs) {
          try {
            const success = await rollbackTranslation(supabase, log);
            if (success) rolledBackCount++;
            else failedCount++;
          } catch (e) {
            failedCount++;
            errors.push(`Translation ${log.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
      }
    }

    // 용어집 롤백
    if (entityTypes.includes('glossary')) {
      const { data: glossaryLogs, error: glossaryError } = await supabase
        .from('glossary_audit_logs')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .eq('is_rolled_back', false)
        .neq('action', 'rollback')
        .neq('action', 'delete')
        .order('created_at', { ascending: false });

      if (!glossaryError && glossaryLogs) {
        for (const log of glossaryLogs) {
          try {
            const success = await rollbackGlossary(supabase, log);
            if (success) rolledBackCount++;
            else failedCount++;
          } catch (e) {
            failedCount++;
            errors.push(`Glossary ${log.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }
      }
    }

    return apiSuccess({
      success: true,
      rolledBackCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch rollback by date error:', error);
    return apiInternalError('날짜별 롤백 중 오류가 발생했습니다.');
  }
}

async function rollbackTranslation(supabase: Awaited<ReturnType<typeof createClient>>, log: Record<string, unknown>): Promise<boolean> {
  const targetId = log.translation_id as string;
  const action = log.action as string;
  const oldValue = log.old_value as string | null;

  if (action === 'create') {
    // 생성된 항목 삭제
    await supabase.from('translation_results').delete().eq('translation_id', targetId);
    const { error } = await supabase.from('translations').delete().eq('id', targetId);
    if (error) throw error;
  } else if (action === 'update' && oldValue !== null) {
    // 수정된 항목 복원
    const { error } = await supabase
      .from('translations')
      .update({ text: oldValue, updated_at: new Date().toISOString() })
      .eq('id', targetId);
    if (error) throw error;
  } else {
    return false;
  }

  // 롤백 표시
  await supabase
    .from('translation_audit_logs')
    .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
    .eq('id', log.id as string);

  // 롤백 로그 생성
  await supabase.from('translation_audit_logs').insert({
    translation_id: targetId,
    user_id: log.user_id,
    user_name: log.user_name,
    action: 'rollback',
    field_name: log.field_name,
    old_value: log.new_value,
    new_value: oldValue,
    rollback_source_log_id: log.id as string,
  });

  return true;
}

async function rollbackGlossary(supabase: Awaited<ReturnType<typeof createClient>>, log: Record<string, unknown>): Promise<boolean> {
  const targetId = log.glossary_term_id as string;
  const action = log.action as string;
  const fieldName = log.field_name as string;
  const oldValue = log.old_value as string | null;

  if (action === 'create') {
    // 생성된 항목 삭제
    const { error } = await supabase.from('glossary').delete().eq('id', targetId);
    if (error) throw error;
  } else if (action === 'update' && oldValue !== null) {
    // 특정 필드 복원
    const updateData: Record<string, string> = {};
    updateData[fieldName] = oldValue;
    const { error } = await supabase.from('glossary').update(updateData).eq('id', targetId);
    if (error) throw error;
  } else {
    return false;
  }

  // 롤백 표시
  await supabase
    .from('glossary_audit_logs')
    .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
    .eq('id', log.id as string);

  // 롤백 로그 생성
  await supabase.from('glossary_audit_logs').insert({
    glossary_term_id: targetId,
    user_id: log.user_id,
    user_name: log.user_name,
    action: 'rollback',
    field_name: fieldName,
    old_value: log.new_value,
    new_value: oldValue,
    rollback_source_log_id: log.id as string,
  });

  return true;
}
