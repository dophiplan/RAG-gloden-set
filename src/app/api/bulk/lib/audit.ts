import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Audit Logging Utilities
 * 
 * Audit log 기록 공통 함수
 */

export async function logTranslationAudit(
  adminClient: SupabaseClient,
  params: {
    action: string;
    userId: string;
    userEmail: string;
    affectedIds?: string[];
    newValues?: Record<string, unknown>;
  }
): Promise<void> {
  await adminClient.from('translation_audit_logs').insert({
    action: params.action,
    user_id: params.userId,
    user_email: params.userEmail,
    affected_ids: params.affectedIds,
    new_values: params.newValues,
    timestamp: new Date().toISOString(),
  });
}

export async function logGlossaryAudit(
  adminClient: SupabaseClient,
  params: {
    action: string;
    userId: string;
    userEmail: string;
    glossaryId?: string;
    oldValue?: string | null;
    newValue?: string | null;
    fieldName?: string;
  }
): Promise<void> {
  await adminClient.from('glossary_audit_logs').insert({
    action: params.action,
    user_id: params.userId,
    user_email: params.userEmail,
    glossary_term_id: params.glossaryId,
    old_value: params.oldValue,
    new_value: params.newValue,
    field_name: params.fieldName,
    created_at: new Date().toISOString(),
  });
}
