import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest } from '@/lib/api/response';

/**
 * @deprecated 이 엔드포인트는 /api/rollback으로 통합되었습니다.
 * 마이그레이션: POST /api/rollback
 * Body: { operation: 'single', entityType: 'translation|glossary', entityId: '...', logId: '...' }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiUnauthorized();

    const body = await request.json();
    const { targetType, auditLogId, targetId, conflictResolution } = body;
    if (!targetType || !auditLogId || !targetId || !conflictResolution) {
      return apiBadRequest('필수 파라미터가 누락되었습니다.');
    }

    // Get original action data
    let originalAction: any = null;
    if (targetType === 'translation') {
      const { data } = await supabase.from('translation_audit_logs')
        .select('*').eq('id', auditLogId).single();
      originalAction = data;
    } else if (targetType === 'glossary') {
      const { data } = await supabase.from('glossary_audit_logs')
        .select('*').eq('id', auditLogId).single();
      originalAction = data;
    }

    if (!originalAction) return apiBadRequest('원본 작업을 찾을 수 없습니다.');

    // Create rollback operation record
    const { data: rollbackOp, error: rollbackError } = await supabase
      .from('rollback_operations')
      .insert({
        user_id: user.id,
        target_type: targetType,
        rollback_type: 'individual',
        original_action_id: auditLogId,
        rolled_back_data: originalAction,
        conflict_resolution: conflictResolution,
        status: 'completed'
      })
      .select()
      .single();

    if (rollbackError || !rollbackOp) {
      return apiInternalError('롤백 작업 기록 생성 실패');
    }

    // Execute rollback based on target type
    let result: any = null;
    
    if (targetType === 'translation') {
      // Restore original value
      if (originalAction.field_name === 'source_text') {
        await supabase.from('translations')
          .update({ source_text: originalAction.old_value })
          .eq('id', targetId);
      } else if (originalAction.field_name === 'status') {
        await supabase.from('translations')
          .update({ status: originalAction.old_value })
          .eq('id', targetId);
      }
      // Mark as rolled back
      await supabase.from('translation_audit_logs')
        .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
        .eq('id', auditLogId);
    } else if (targetType === 'glossary') {
      // Similar for glossary
      if (originalAction.field_name === 'term') {
        await supabase.from('glossary')
          .update({ term: originalAction.old_value })
          .eq('id', targetId);
      } else if (originalAction.field_name === 'translation') {
        await supabase.from('glossary')
          .update({ translation: originalAction.old_value })
          .eq('id', targetId);
      }
      await supabase.from('glossary_audit_logs')
        .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
        .eq('id', auditLogId);
    }

    return apiSuccess({
      message: '롤백이 완료되었습니다.',
      rollbackId: rollbackOp.id,
      rolledBackField: originalAction.field_name,
      restoredValue: originalAction.old_value
    });

  } catch (error) {
    console.error('Rollback error:', error);
    return apiInternalError('롤백 실행 중 오류가 발생했습니다.');
  }
}
