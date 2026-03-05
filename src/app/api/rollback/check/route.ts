import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiUnauthorized();

    const body = await request.json();
    const { targetType, auditLogId, targetId } = body;
    if (!targetType || !auditLogId || !targetId) {
      return apiBadRequest('필수 파라미터가 누락되었습니다.');
    }

    // Get original action
    let originalActionAt: string | null = null;
    if (targetType === 'translation') {
      const { data } = await supabase.from('translation_audit_logs')
        .select('created_at').eq('id', auditLogId).single();
      originalActionAt = data?.created_at;
    } else if (targetType === 'glossary') {
      const { data } = await supabase.from('glossary_audit_logs')
        .select('created_at').eq('id', auditLogId).single();
      originalActionAt = data?.created_at;
    }

    if (!originalActionAt) return apiBadRequest('원본 작업을 찾을 수 없습니다.');

    // Check for newer actions
    let newerActions: any[] = [];
    if (targetType === 'translation') {
      const { data } = await supabase.from('translation_audit_logs')
        .select('id, action, field_name, old_value, new_value, user_name, created_at')
        .eq('translation_id', targetId).gt('created_at', originalActionAt)
        .eq('is_rolled_back', false).order('created_at', { ascending: true });
      newerActions = data || [];
    } else if (targetType === 'glossary') {
      const { data } = await supabase.from('glossary_audit_logs')
        .select('id, action, field_name, old_value, new_value, user_name, created_at')
        .eq('glossary_term_id', targetId).gt('created_at', originalActionAt)
        .eq('is_rolled_back', false).order('created_at', { ascending: true });
      newerActions = data || [];
    }

    return apiSuccess({
      hasConflict: newerActions.length > 0,
      conflictCount: newerActions.length,
      newerActions: newerActions.map(a => ({
        id: a.id, action: a.action, field: a.field_name,
        user: a.user_name, at: a.created_at,
        changes: { from: a.old_value, to: a.new_value }
      })),
      originalActionAt
    });
  } catch (error) {
    return apiInternalError('충돌 검사 중 오류가 발생했습니다.');
  }
}
