import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TranslationCrudService } from '@/services';

interface User {
  id: string;
  email: string;
}

export async function handleSingleRollback(
  body: Record<string, any>,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const { entityType, entityId, logId } = body;

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: 'entity_type과 entity_id는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    let result;
    let auditLog = null;

    if (entityType === 'translation') {
      if (!logId) {
        return NextResponse.json(
          { error: '번역 롤백에는 log_id가 필요합니다.' },
          { status: 400 }
        );
      }

      const service = new TranslationCrudService(adminClient);
      result = await service.revertTranslationResult(logId, user.id);

      // Get audit log details for backward compatibility
      const { data } = await adminClient
        .from('translation_audit_logs')
        .select('*')
        .eq('id', logId)
        .single();
      auditLog = data;

    } else if (entityType === 'glossary') {
      // Glossary rollback logic
      const { data, error } = await adminClient
        .from('glossary_audit_logs')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: '용어집 로그를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      auditLog = data;

      // Revert glossary term
      await adminClient
        .from('glossary')
        .update({ translation: data.old_value })
        .eq('id', data.glossary_id);

      result = { reverted: true, entityId: data.glossary_id };
    } else {
      return NextResponse.json(
        { error: '지원하지 않는 entity_type입니다. (translation, glossary)' },
        { status: 400 }
      );
    }

    // Record rollback operation
    const { data: operationRecord } = await adminClient
      .from('rollback_operations')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        operation_type: 'single',
        user_id: user.id,
        user_email: user.email,
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      message: '롤백이 완료되었습니다.',
      result,
      // Backward compatibility fields
      rollbackId: operationRecord?.id,
      rolledBackField: auditLog?.field_name || null,
      restoredValue: auditLog?.old_value || null,
    });

  } catch (error) {
    console.error('Single rollback error:', error);
    return NextResponse.json(
      { error: '롤백 실행에 실패했습니다.' },
      { status: 500 }
    );
  }
}
