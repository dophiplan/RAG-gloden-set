import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiNotFound } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Auth check with timeout
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 10000)
    );
    
    const { data: { user }, error: authError } = await Promise.race([authPromise, timeoutPromise]) as any;
    
    if (authError || !user) {
      console.error('[Rollback Check] Auth error:', authError);
      return apiUnauthorized();
    }

    // Parse body with error handling
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return apiBadRequest('잘못된 요청 형식입니다.');
    }
    
    const { targetType, auditLogId, targetId } = body;
    
    // Validate required params
    if (!targetType || !auditLogId || !targetId) {
      return apiBadRequest('필수 파라미터가 누락되었습니다. (targetType, auditLogId, targetId)');
    }
    
    // Validate targetType
    if (!['translation', 'glossary'].includes(targetType)) {
      return apiBadRequest('유효하지 않은 targetType입니다. (translation 또는 glossary)');
    }

    // Get original action
    let originalActionAt: string | null = null;
    let originalAction: any = null;
    
    try {
      if (targetType === 'translation') {
        const { data, error } = await supabase.from('translation_audit_logs')
          .select('created_at, is_rolled_back').eq('id', auditLogId).single();
        if (error) throw error;
        originalAction = data;
        originalActionAt = data?.created_at;
      } else if (targetType === 'glossary') {
        const { data, error } = await supabase.from('glossary_audit_logs')
          .select('created_at, is_rolled_back').eq('id', auditLogId).single();
        if (error) throw error;
        originalAction = data;
        originalActionAt = data?.created_at;
      }
    } catch (dbError) {
      console.error('[Rollback Check] DB error fetching original action:', dbError);
      return apiInternalError('원본 작업 조회 중 데이터베이스 오류가 발생했습니다.');
    }

    if (!originalActionAt) {
      return apiNotFound('원본 작업을 찾을 수 없습니다. 이미 삭제되었거나 잘못된 ID입니다.');
    }
    
    // Check if already rolled back
    if (originalAction?.is_rolled_back) {
      return apiSuccess({
        hasConflict: false,
        conflictCount: 0,
        newerActions: [],
        originalActionAt,
        alreadyRolledBack: true,
        message: '이미 롤백된 작업입니다.',
      });
    }

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
