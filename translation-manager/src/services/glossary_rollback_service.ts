/**
 * Glossary Rollback Service
 * 
 * Provides rollback functionality for glossary terms with full concurrency control.
 * Uses OptimisticLockService for version checking and implements proper conflict resolution.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { OptimisticLockService } from './optimistic_lock_service';

export type RollbackErrorCode = 'EDIT_CONFLICT' | 'RECORD_NOT_FOUND' | 'AUDIT_NOT_FOUND' | 'AUDIT_MISMATCH' | 'INVALID_FIELD' | 'INVALID_VERSION' | 'ROLLBACK_FAILED';

export interface RollbackResult {
  success: boolean;
  glossaryId: string;
  newVersion?: number;
  revertedField?: string;
  oldValue?: string;
  newValue?: string;
  error?: {
    code: RollbackErrorCode;
    message: string;
    serverVersion?: number;
    currentValue?: string;
    expectedValue?: string;
  };
}

export interface BulkRollbackItem {
  glossaryId: string;
  auditLogId: string;
  expectedVersion?: number;
}

export interface BulkRollbackResult {
  results: RollbackResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    conflicts: number;
  };
  allSuccess: boolean;
}

export interface AuditLogEntry {
  id: string;
  glossary_term_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  is_rollback: boolean;
  rollback_to_log_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export class GlossaryRollbackService {
  private lockService: OptimisticLockService;

  constructor(private supabase: SupabaseClient) {
    this.lockService = new OptimisticLockService(supabase);
  }

  /**
   * Rollback a single field to a previous version
   * 
   * @param glossaryId - The glossary term ID
   * @param auditLogId - The audit log entry to rollback to
   * @param userId - The user performing the rollback
   * @param userName - Optional user name for audit log
   * @param userEmail - Optional user email for audit log
   * @returns RollbackResult with success status and details
   */
  async rollbackField(
    glossaryId: string,
    auditLogId: string,
    userId: string,
    userName?: string | null,
    userEmail?: string
  ): Promise<RollbackResult> {
    try {
      // Use the database function for atomic execution
      const { data, error } = await this.supabase.rpc('execute_glossary_rollback', {
        p_glossary_id: glossaryId,
        p_audit_log_id: auditLogId,
        p_user_id: userId,
        p_user_name: userName || null,
        p_user_email: userEmail || 'unknown',
      });

      if (error) {
        console.error('[GlossaryRollback] RPC error:', error);
        return {
          success: false,
          glossaryId,
          error: {
            code: 'ROLLBACK_FAILED',
            message: `롤백 실행 중 오류: ${error.message}`,
          },
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          glossaryId,
          error: {
            code: 'ROLLBACK_FAILED',
            message: '롤백 결과를 받지 못했습니다.',
          },
        };
      }

      const result = data[0];

      if (!result.success) {
        const errorCode: RollbackErrorCode = result.error_code || 'ROLLBACK_FAILED';
        return {
          success: false,
          glossaryId,
          error: {
            code: errorCode,
            message: result.error_message || '롤백에 실패했습니다.',
          },
        };
      }

      return {
        success: true,
        glossaryId,
        newVersion: result.new_version,
        revertedField: result.reverted_field,
        oldValue: result.old_value,
        newValue: result.new_value,
      };
    } catch (error) {
      console.error('[GlossaryRollback] Unexpected error:', error);
      return {
        success: false,
        glossaryId,
        error: {
          code: 'ROLLBACK_FAILED',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        },
      };
    }
  }

  /**
   * Rollback multiple glossary items
   * 
   * @param items - Array of items to rollback
   * @param userId - The user performing the rollback
   * @param userName - Optional user name for audit log
   * @param userEmail - Optional user email for audit log
   * @param atomic - If true, all must succeed or none (default: false)
   * @returns BulkRollbackResult with individual results and summary
   */
  async bulkRollback(
    items: BulkRollbackItem[],
    userId: string,
    userName?: string | null,
    userEmail?: string,
    atomic: boolean = false
  ): Promise<BulkRollbackResult> {
    const results: RollbackResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let conflictCount = 0;

    for (const item of items) {
      // Check version first if expectedVersion is provided
      if (item.expectedVersion !== undefined) {
        const lockCheck = await this.lockService.checkVersion({
          id: item.glossaryId,
          entityType: 'glossary',
          expectedVersion: item.expectedVersion,
        });

        if (!lockCheck.success) {
          const conflictResult: RollbackResult = {
            success: false,
            glossaryId: item.glossaryId,
            error: {
              code: lockCheck.errorCode || 'EDIT_CONFLICT',
              message: lockCheck.message || '버전 충돌이 발생했습니다.',
              serverVersion: lockCheck.serverVersion,
            },
          };

          results.push(conflictResult);
          failureCount++;
          conflictCount++;

          if (atomic) {
            // In atomic mode, compensate for previous successes
            await this.compensateRollbacks(results, userId, userName, userEmail);
            break;
          }
          continue;
        }
      }

      // Execute rollback
      const result = await this.rollbackField(
        item.glossaryId,
        item.auditLogId,
        userId,
        userName,
        userEmail
      );

      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (result.error?.code === 'EDIT_CONFLICT') {
          conflictCount++;
        }

        if (atomic) {
          // Compensate for previous successes
          await this.compensateRollbacks(results, userId, userName, userEmail);
          break;
        }
      }
    }

    return {
      results,
      summary: {
        total: items.length,
        success: successCount,
        failed: failureCount,
        conflicts: conflictCount,
      },
      allSuccess: failureCount === 0,
    };
  }

  /**
   * Get audit history for a glossary term
   * 
   * @param glossaryId - The glossary term ID
   * @param limit - Maximum number of records to return (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @returns Array of audit log entries
   */
  async getAuditHistory(
    glossaryId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    const { data, error } = await this.supabase.rpc('get_glossary_audit_history', {
      p_glossary_term_id: glossaryId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error('[GlossaryRollback] Failed to get audit history:', error);
      throw new Error(`Failed to get audit history: ${error.message}`);
    }

    return (data || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      glossary_term_id: item.glossary_term_id as string,
      user_id: item.user_id as string,
      user_name: item.user_name as string | null,
      user_email: item.user_email as string,
      action: item.action as string,
      field_name: item.field_name as string | null,
      old_value: item.old_value as string | null,
      new_value: item.new_value as string | null,
      is_rollback: item.is_rollback as boolean,
      rollback_to_log_id: item.rollback_to_log_id as string | null,
      metadata: item.metadata as Record<string, unknown> | null,
      created_at: item.created_at as string,
    }));
  }

  /**
   * Get current version of a glossary term
   * 
   * @param glossaryId - The glossary term ID
   * @returns Current version number or null if not found
   */
  async getCurrentVersion(glossaryId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('glossary')
      .select('version')
      .eq('id', glossaryId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.version || 0;
  }

  /**
   * Validate if a rollback is possible without executing it
   * 
   * @param glossaryId - The glossary term ID
   * @param auditLogId - The audit log entry to validate
   * @returns Validation result with current state
   */
  async validateRollback(
    glossaryId: string,
    auditLogId: string
  ): Promise<{
    valid: boolean;
    currentValue?: string;
    expectedValue?: string;
    currentVersion?: number;
    error?: string;
  }> {
    try {
      // Get audit log
      const { data: auditLog, error: auditError } = await this.supabase
        .from('glossary_audit_logs')
        .select('*')
        .eq('id', auditLogId)
        .single();

      if (auditError || !auditLog) {
        return { valid: false, error: '변경 이력을 찾을 수 없습니다.' };
      }

      if (auditLog.glossary_term_id !== glossaryId) {
        return { valid: false, error: '변경 이력이 해당 용어와 일치하지 않습니다.' };
      }

      // Get current value
      const { data: currentData, error: currentError } = await this.supabase
        .from('glossary')
        .select(auditLog.field_name)
        .eq('id', glossaryId)
        .single();

      if (currentError || !currentData) {
        return { valid: false, error: '용어를 찾을 수 없습니다.' };
      }

      const currentValue = currentData[auditLog.field_name];
      const expectedValue = auditLog.new_value;

      if (currentValue !== expectedValue) {
        return {
          valid: false,
          currentValue,
          expectedValue,
          error: '데이터가 이미 변경되었습니다.',
        };
      }

      // Get current version
      const currentVersion = await this.getCurrentVersion(glossaryId);

      return {
        valid: true,
        currentValue,
        expectedValue,
        currentVersion: currentVersion || undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : '검증 중 오류',
      };
    }
  }

  /**
   * Compensate for previous successful rollbacks in atomic mode
   * This is called when a subsequent rollback fails and we need to undo previous ones
   */
  private async compensateRollbacks(
    results: RollbackResult[],
    userId: string,
    userName?: string | null,
    userEmail?: string
  ): Promise<void> {
    const successfulRollbacks = results.filter(r => r.success);

    for (const rollback of successfulRollbacks) {
      if (!rollback.revertedField || !rollback.oldValue || !rollback.newValue) {
        continue;
      }

      // Create a compensating audit log entry (manual update to restore)
      try {
        await this.supabase.from('glossary_audit_logs').insert({
          glossary_term_id: rollback.glossaryId,
          user_id: userId,
          user_name: userName || 'System',
          user_email: userEmail || 'system@internal',
          action: 'compensate_rollback',
          field_name: rollback.revertedField,
          old_value: rollback.oldValue,
          new_value: rollback.newValue,
          metadata: {
            reason: 'atomic_rollback_compensation',
            original_rollback_target: rollback.glossaryId,
          },
        });

        // Restore the original value
        await this.supabase
          .from('glossary')
          .update({
            [rollback.revertedField]: rollback.newValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rollback.glossaryId);
      } catch (error) {
        console.error('[GlossaryRollback] Compensation failed:', error);
        // Log but don't throw - we're already in error handling
      }
    }
  }
}

/**
 * Factory function to create GlossaryRollbackService
 */
export function createGlossaryRollbackService(supabase: SupabaseClient): GlossaryRollbackService {
  return new GlossaryRollbackService(supabase);
}
