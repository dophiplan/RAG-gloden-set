import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEntityConfig } from '../lib/entity-resolver';

interface User {
  id: string;
  email: string;
}

export async function handleBatchRollback(
  body: Record<string, any>,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const { entityType, entityIds } = body;

  if (!entityType || !Array.isArray(entityIds)) {
    return NextResponse.json(
      { error: 'entity_type과 entity_ids 배열은 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    const config = resolveEntityConfig(entityType);
    const results = [];
    const errors = [];

    for (const entityId of entityIds) {
      try {
        // Get latest audit log for this entity
        const { data: auditLog } = await adminClient
          .from(config.auditTable)
          .select('*')
          .eq(config.idField, entityId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (auditLog && auditLog.old_value) {
          // Revert to old value
          await adminClient
            .from(config.table)
            .update({ [config.valueField]: auditLog.old_value })
            .eq('id', entityId);

          results.push({ entityId, reverted: true });
        } else {
          results.push({ entityId, reverted: false, reason: 'No audit log found' });
        }
      } catch (err) {
        errors.push({ entityId, error: (err as Error).message });
      }
    }

    // Record batch rollback operation
    await adminClient.from('rollback_operations').insert({
      entity_type: entityType,
      operation_type: 'batch',
      entity_ids: entityIds,
      user_id: user.id,
      user_email: user.email,
      success_count: results.filter((r: {reverted: boolean}) => r.reverted).length,
      error_count: errors.length,
    });

    return NextResponse.json({
      success: true,
      message: `${results.filter((r: {reverted: boolean}) => r.reverted).length}개 항목이 롤백되었습니다.`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Batch rollback error:', error);
    return NextResponse.json(
      { error: '일괄 롤백 실행에 실패했습니다.' },
      { status: 500 }
    );
  }
}
