import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiNotFound } from '@/lib/api/response';

/**
 * @deprecated 이 엔드포인트는 /api/rollback으로 통합되었습니다.
 * 마이그레이션: POST /api/rollback
 * Body: { operation: 'batch', entityType: 'translation|glossary', entityIds: [...] }
 */
// POST - Execute batch rollback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiUnauthorized();

    const body = await request.json();
    const { batchId, targetType } = body;

    if (!batchId) {
      return apiBadRequest('배치 ID가 필요합니다.');
    }

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('operation_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return apiNotFound('배치를 찾을 수 없습니다.');
    }

    if (batch.status === 'rolled_back') {
      return apiBadRequest('이미 롤백된 배치입니다.');
    }

    // Get all audit logs for this batch
    let auditLogs: any[] = [];
    
    if (!targetType || targetType === 'translation') {
      const { data } = await supabase
        .from('translation_audit_logs')
        .select('*')
        .eq('batch_operation_id', batchId)
        .eq('is_rolled_back', false)
        .order('created_at', { ascending: false });
      auditLogs = [...auditLogs, ...(data || []).map(log => ({ ...log, targetType: 'translation' }))];
    }
    
    if (!targetType || targetType === 'glossary') {
      const { data } = await supabase
        .from('glossary_audit_logs')
        .select('*')
        .eq('batch_operation_id', batchId)
        .eq('is_rolled_back', false)
        .order('created_at', { ascending: false });
      auditLogs = [...auditLogs, ...(data || []).map(log => ({ ...log, targetType: 'glossary' }))];
    }

    if (auditLogs.length === 0) {
      return apiBadRequest('롤백할 작업이 없습니다.');
    }

    // Check for conflicts (newer modifications after this batch)
    const conflicts: any[] = [];
    for (const log of auditLogs) {
      const targetId = log.targetType === 'translation' ? log.translation_id : log.glossary_term_id;
      
      let newerActions: any[] = [];
      if (log.targetType === 'translation') {
        const { data } = await supabase.from('translation_audit_logs')
          .select('id, action, field_name, user_name, created_at')
          .eq('translation_id', targetId)
          .gt('created_at', log.created_at)
          .eq('is_rolled_back', false)
          .order('created_at', { ascending: true });
        newerActions = data || [];
      } else {
        const { data } = await supabase.from('glossary_audit_logs')
          .select('id, action, field_name, user_name, created_at')
          .eq('glossary_term_id', targetId)
          .gt('created_at', log.created_at)
          .eq('is_rolled_back', false)
          .order('created_at', { ascending: true });
        newerActions = data || [];
      }
      
      if (newerActions.length > 0) {
        conflicts.push({
          logId: log.id,
          targetId,
          targetType: log.targetType,
          newerActions,
        });
      }
    }

    // Return conflict info if any
    if (conflicts.length > 0) {
      return apiSuccess({
        hasConflict: true,
        conflictCount: conflicts.length,
        conflicts,
        message: '일부 항목에 충돌이 있습니다.',
      });
    }

    // Execute rollback for each audit log
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const log of auditLogs) {
      try {
        const targetId = log.targetType === 'translation' ? log.translation_id : log.glossary_term_id;
        
        // Restore original value
        if (log.targetType === 'translation') {
          if (log.field_name === 'source_text' || log.field_name === 'migration') {
            // For migration, delete the created translation
            if (log.action === 'create') {
              await supabase.from('translation_results')
                .delete()
                .eq('translation_id', targetId);
              await supabase.from('translations')
                .delete()
                .eq('id', targetId);
            } else {
              await supabase.from('translations')
                .update({ source_text: log.old_value })
                .eq('id', targetId);
            }
          } else if (log.field_name === 'status') {
            await supabase.from('translations')
              .update({ status: log.old_value })
              .eq('id', targetId);
          }
          
          await supabase.from('translation_audit_logs')
            .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
            .eq('id', log.id);
        } else {
          if (log.field_name === 'term') {
            await supabase.from('glossary')
              .update({ term: log.old_value })
              .eq('id', targetId);
          } else if (log.field_name === 'translation') {
            await supabase.from('glossary')
              .update({ translation: log.old_value })
              .eq('id', targetId);
          } else if (log.field_name === 'migration') {
            // For migration, delete the created glossary entry
            if (log.action === 'create') {
              await supabase.from('glossary_products')
                .delete()
                .eq('glossary_id', targetId);
              await supabase.from('glossary')
                .delete()
                .eq('id', targetId);
            }
          }
          
          await supabase.from('glossary_audit_logs')
            .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
            .eq('id', log.id);
        }
        
        successCount++;
      } catch (error) {
        console.error(`[Batch Rollback] Failed to rollback log ${log.id}:`, error);
        failCount++;
        errors.push(`Log ${log.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update batch status
    await supabase.from('operation_batches').update({
      status: 'rolled_back',
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: user.id,
    }).eq('id', batchId);

    // Create rollback operation record
    await supabase.from('rollback_operations').insert({
      user_id: user.id,
      target_type: targetType || 'batch',
      rollback_type: 'batch',
      batch_operation_id: batchId,
      conflict_resolution: 'overwrite',
      status: 'completed',
    });

    return apiSuccess({
      success: true,
      batchId,
      totalCount: auditLogs.length,
      successCount,
      failCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${successCount}개 항목을 롤백했습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`,
    });

  } catch (error) {
    console.error('[Batch Rollback] Error:', error);
    return apiInternalError('배치 롤백 중 오류가 발생했습니다.');
  }
}

// GET - List batch operations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiUnauthorized();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Check if table exists first
    const { error: tableCheckError } = await supabase
      .from('operation_batches')
      .select('id', { count: 'exact', head: true });

    if (tableCheckError) {
      console.error('[Batch List] Table check error:', tableCheckError);
      // Return empty array if table doesn't exist or RLS issue
      return apiSuccess({
        batches: [],
        count: 0,
        message: '배치 테이블이 준비 중입니다.',
      });
    }

    let query = supabase
      .from('operation_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('[Batch List] Query error:', error);
      return apiSuccess({
        batches: [],
        count: 0,
        message: '배치 목록을 가져올 수 없습니다.',
      });
    }

    return apiSuccess({
      batches: batches || [],
      count: batches?.length || 0,
    });

  } catch (error) {
    console.error('[Batch List] Unexpected error:', error);
    return apiSuccess({
      batches: [],
      count: 0,
      message: '배치 목록 조회 중 오류가 발생했습니다.',
    });
  }
}
