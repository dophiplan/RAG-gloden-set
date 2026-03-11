import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
}

export async function handleDateBasedRollback(
  body: Record<string, any>,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const { entityType, date } = body;

  if (!entityType || !date) {
    return NextResponse.json(
      { error: 'entity_type과 date는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    const rollbackDate = new Date(date);

    // Determine tables based on entityType
    const table = entityType === 'translation' ? 'translations' : 'glossary';
    const auditTable = entityType === 'translation' 
      ? 'translation_audit_logs' 
      : 'glossary_audit_logs';
    const idField = entityType === 'translation' ? 'translation_id' : 'glossary_term_id';
    const valueField = entityType === 'translation' ? 'source_text' : 'translation';

    // Find all operations after the specified date
    const { data: operations, error } = await adminClient
      .from(auditTable)
      .select(`*, ${idField}`)
      .gt('created_at', rollbackDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const uniqueEntities = [...new Set((operations || []).map((op: Record<string, unknown>) => op[idField]))];
    const results = [];

    // Revert each entity to its state at the specified date
    for (const entityId of uniqueEntities) {
      const entityOps = (operations || []).filter((op: Record<string, unknown>) => op[idField] === entityId);

      if (entityOps.length > 0) {
        // Get the oldest operation (closest to target date)
        const targetOp = entityOps[entityOps.length - 1];

        await adminClient
          .from(table)
          .update({ [valueField]: targetOp.old_value })
          .eq('id', entityId);

        results.push({ entityId, reverted: true, toValue: targetOp.old_value });
      }
    }

    // Record date-based rollback operation
    await adminClient.from('rollback_operations').insert({
      entity_type: entityType,
      operation_type: 'date-based',
      target_date: date,
      user_id: user.id,
      user_email: user.email,
      affected_count: results.length,
    });

    return NextResponse.json({
      success: true,
      message: `${results.length}개 항목이 ${date} 시점으로 롤백되었습니다.`,
      results,
    });

  } catch (error) {
    console.error('Date-based rollback error:', error);
    return NextResponse.json(
      { error: '날짜 기반 롤백 실행에 실패했습니다.' },
      { status: 500 }
    );
  }
}
