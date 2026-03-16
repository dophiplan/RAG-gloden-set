import { TranslationAuditLog } from '@/types';

/**
 * Audit Log Batch Processor
 * 
 * Handles batch processing of audit logs including:
 * - Grouping by translation ID
 * - Extracting latest log per translation
 * - Formatting for efficient storage
 * 
 * This module is pure (no side effects) and can be fully unit tested.
 */

export interface AuditLogGroup {
  translationId: string;
  logs: TranslationAuditLog[];
  latestLog: TranslationAuditLog;
}

/**
 * Extract the latest audit log for each translation ID
 * 
 * @param logs - Array of audit logs (must be pre-sorted by created_at DESC)
 * @returns Map of translation_id -> latest audit log
 * 
 * @example
 * const logs = [
 *   { id: '2', translation_id: 'A', created_at: '2024-01-02' },
 *   { id: '1', translation_id: 'A', created_at: '2024-01-01' },
 * ];
 * const result = extractLatestPerTranslation(logs);
 * // Map { 'A' => { id: '2', ... } }
 */
export function extractLatestPerTranslation(
  logs: TranslationAuditLog[]
): Map<string, TranslationAuditLog> {
  const auditsMap = new Map<string, TranslationAuditLog>();

  for (const audit of logs) {
    // Skip entries with null translation_id
    if (!audit.translation_id) {
      continue;
    }

    // Only set if not already present (first occurrence is latest due to DESC order)
    if (!auditsMap.has(audit.translation_id)) {
      auditsMap.set(audit.translation_id, audit);
    }
  }

  return auditsMap;
}

/**
 * Group audit logs by translation ID
 * 
 * @param logs - Array of audit logs
 * @returns Array of AuditLogGroup objects
 */
export function groupByTranslationId(
  logs: TranslationAuditLog[]
): AuditLogGroup[] {
  const groupMap = new Map<string, TranslationAuditLog[]>();

  for (const log of logs) {
    if (!log.translation_id) continue;

    const existing = groupMap.get(log.translation_id) || [];
    existing.push(log);
    groupMap.set(log.translation_id, existing);
  }

  return Array.from(groupMap.entries()).map(([translationId, logs]) => ({
    translationId,
    logs,
    latestLog: logs[0], // Assuming logs are sorted by created_at DESC
  }));
}

/**
 * Filter audit logs by translation IDs
 * 
 * @param logs - Array of audit logs
 * @param translationIds - Array of translation IDs to filter by
 * @returns Filtered array of audit logs
 */
export function filterByTranslationIds(
  logs: TranslationAuditLog[],
  translationIds: string[]
): TranslationAuditLog[] {
  const idSet = new Set(translationIds);
  return (logs || []).filter((log) => log.translation_id && idSet.has(log.translation_id));
}

/**
 * Sort audit logs by created_at in descending order (newest first)
 * 
 * @param logs - Array of audit logs
 * @returns Sorted array (new reference)
 */
export function sortByCreatedAtDesc(
  logs: TranslationAuditLog[]
): TranslationAuditLog[] {
  return [...logs].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate audit log data before insertion
 * 
 * @param log - Partial audit log data
 * @returns Validation result
 */
export function validateAuditLog(log: Partial<TranslationAuditLog>): ValidationResult {
  const errors: string[] = [];

  if (!log.action) {
    errors.push('action is required');
  }

  if (log.action && !isValidAction(log.action)) {
    errors.push(`invalid action: ${log.action}`);
  }

  return {
    valid: (errors || []).length === 0,
    errors,
  };
}

/**
 * Check if action is valid
 */
function isValidAction(action: string): boolean {
  const validActions = [
    'create',
    'update',
    'delete',
    'ai_translate',
    'glossary_match',
    'bulk_create',
    'bulk_update',
    'status_change',
    'revert',
  ];
  return validActions.includes(action);
}

/**
 * Batch audit log creation data for efficient insertion
 * 
 * @param logs - Array of audit log data
 * @param batchSize - Size of each batch
 * @returns Array of batches
 */
export function createBatches<T>(items: T[], batchSize: number = 100): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < (items || []).length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
