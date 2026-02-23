import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationAuditLog, AuditLogCreateData } from '@/types';
import { createQuery } from '@/lib/database/supabase_query_builder';
import {
  extractLatestPerTranslation,
  groupByTranslationId,
  createBatches,
  validateAuditLog,
} from '@/lib/database/audit_log_batch_processor';

interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  data: T[];
  count: number | null;
}

/**
 * Audit Log Repository
 * 
 * Handles all database operations for translation_audit_logs table.
 * Refactored to use query builder and batch processor for better
 * maintainability and testability.
 * 
 * N+1 Query Prevention:
 * - getLatestByTranslationIds: Single query with IN clause
 * - getByTranslationIds: Batch query with pagination
 * - Bulk inserts use batching
 */
export class AuditLogRepository {
  private readonly TABLE_NAME = 'translation_audit_logs';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Create an audit log entry (non-blocking)
   * 
   * Errors are logged but not thrown to prevent disrupting main operations.
   */
  async create(data: AuditLogCreateData): Promise<void> {
    try {
      // Validate data before insertion
      const validation = validateAuditLog(data);
      if (!validation.valid) {
        console.error('[Audit Log] Validation failed:', validation.errors);
        return;
      }

      const { error } = await this.supabase.from(this.TABLE_NAME).insert(data);

      if (error) {
        console.error('[Audit Log] Failed to create audit log:', error);
      }
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating audit log:', error);
    }
  }

  /**
   * Create multiple audit logs in batches (non-blocking)
   * 
   * Uses batching to prevent query size limits and memory issues.
   */
  async createMany(items: AuditLogCreateData[], batchSize: number = 100): Promise<void> {
    if ((items || []).length === 0) return;

    try {
      // Filter out invalid entries
      const validItems = (items || []).filter((item) => {
        const validation = validateAuditLog(item);
        return validation.valid;
      });

      // Process in batches
      const batches = createBatches(validItems, batchSize);

      for (const batch of batches) {
        const { error } = await this.supabase.from(this.TABLE_NAME).insert(batch);

        if (error) {
          console.error('[Audit Log] Failed to create batch audit logs:', error);
        }
      }
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating batch audit logs:', error);
    }
  }

  /**
   * Get latest audit log for each translation ID
   * 
   * Uses single query with IN clause to prevent N+1 problem.
   * Results are processed to extract latest log per translation.
   */
  async getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>> {
    if ((translationIds || []).length === 0) {
      return new Map();
    }

    try {
      const { data, error } = await createQuery<TranslationAuditLog>(this.supabase)
        .from(this.TABLE_NAME)
        .select('*')
        .in('translation_id', translationIds)
        .order('created_at', { ascending: false })
        .execute();

      if (error) {
        console.error('[Audit Log] Failed to fetch audit logs:', error);
        return new Map();
      }

      // Use batch processor to extract latest per translation
      return extractLatestPerTranslation(data || []);
    } catch (error) {
      console.error('[Audit Log] Unexpected error fetching audit logs:', error);
      return new Map();
    }
  }

  /**
   * Get audit logs for a specific translation
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    const { data, error } = await createQuery<TranslationAuditLog>(this.supabase)
      .from(this.TABLE_NAME)
      .select('*')
      .eq('translation_id', translationId)
      .order('created_at', { ascending: false })
      .execute();

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get audit logs for multiple translations (batched)
   * 
   * Prevents N+1 by using single query or batched queries for large sets.
   */
  async getByTranslationIds(
    translationIds: string[],
    options?: { batchSize?: number }
  ): Promise<TranslationAuditLog[]> {
    if ((translationIds || []).length === 0) {
      return [];
    }

    const batchSize = options?.batchSize || 100;

    // For small sets, use single query
    if (translationIds.length <= batchSize) {
      const { data, error } = await createQuery<TranslationAuditLog>(this.supabase)
        .from(this.TABLE_NAME)
        .select('*')
        .in('translation_id', translationIds)
        .order('created_at', { ascending: false })
        .execute();

      if (error) {
        throw new Error(`Failed to get audit logs: ${error.message}`);
      }

      return data || [];
    }

    // For large sets, batch the queries
    const batches = createBatches(translationIds, batchSize);
    const allLogs: TranslationAuditLog[] = [];

    for (const batch of batches) {
      const { data, error } = await createQuery<TranslationAuditLog>(this.supabase)
        .from(this.TABLE_NAME)
        .select('*')
        .in('translation_id', batch)
        .order('created_at', { ascending: false })
        .execute();

      if (error) {
        throw new Error(`Failed to get audit logs: ${error.message}`);
      }

      if (data) {
        allLogs.push(...data);
      }
    }

    return allLogs;
  }

  /**
   * Get audit logs with pagination
   */
  async getWithPagination(
    params: PaginationParams = { page: 1, limit: 50 }
  ): Promise<PaginatedResult<TranslationAuditLog>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const { data, error, count } = await createQuery<TranslationAuditLog>(this.supabase)
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .execute();

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return { data: data || [], count: count ?? null };
  }

  /**
   * Get audit logs grouped by translation ID
   * 
   * Returns structured data with logs grouped and latest log identified.
   */
  async getGroupedByTranslation(
    translationIds: string[]
  ): Promise<ReturnType<typeof groupByTranslationId>> {
    const logs = await this.getByTranslationIds(translationIds);
    return groupByTranslationId(logs);
  }

  /**
   * Count audit logs for a translation
   */
  async countByTranslationId(translationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to count audit logs: ${error.message}`);
    }

    return count || 0;
  }
}
