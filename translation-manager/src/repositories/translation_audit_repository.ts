import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationAuditLog, AuditAction } from '@/types';

export interface AuditLogCreateData {
  translation_id?: string | null;
  translation_result_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  action: AuditAction;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
}

/**
 * Repository for TranslationAuditLog database operations
 * Handles audit trail for translation changes
 */
export class TranslationAuditRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create an audit log entry (non-blocking)
   * Returns a promise but errors are logged, not thrown
   */
  async create(data: AuditLogCreateData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('translation_audit_logs')
        .insert(data);

      if (error) {
        console.error('[Audit Log] Failed to create audit log:', error);
        // Don't throw - audit log failure should not break the main operation
      }
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating audit log:', error);
      // Don't throw - audit log failure should not break the main operation
    }
  }

  /**
   * Get latest audit logs for translations (one per translation)
   */
  async getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>> {
    if (translationIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from('translation_audit_logs')
      .select('*')
      .in('translation_id', translationIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Audit Log] Failed to fetch audit logs:', error);
      return new Map();
    }

    // Group by translation_id and take the first (most recent)
    const auditsMap = new Map<string, TranslationAuditLog>();

    if (data) {
      data.forEach((audit) => {
        if (audit.translation_id && !auditsMap.has(audit.translation_id)) {
          auditsMap.set(audit.translation_id, audit);
        }
      });
    }

    return auditsMap;
  }

  /**
   * Get audit logs for a specific translation
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    const { data, error } = await this.supabase
      .from('translation_audit_logs')
      .select('*')
      .eq('translation_id', translationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get audit logs with pagination
   */
  async getWithPagination(
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: TranslationAuditLog[]; count: number | null }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.supabase
      .from('translation_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return { data: data || [], count };
  }
}
