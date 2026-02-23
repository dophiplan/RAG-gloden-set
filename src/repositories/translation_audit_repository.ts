import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationAuditLog, AuditLogCreateData } from '@/types';
import { AuditLogRepository } from './audit_log_repository';

/**
 * TranslationAuditRepository
 * 
 * Adapter/wrapper around the new AuditLogRepository.
 * Maintains backward compatibility with existing code.
 * 
 * All methods delegate to AuditLogRepository which provides:
 * - Type-safe query building
 * - Batch processing for N+1 prevention
 * - Better error handling
 * 
 * @deprecated Consider using AuditLogRepository directly for new code
 */
export class TranslationAuditRepository {
  private innerRepository: AuditLogRepository;

  constructor(supabase: SupabaseClient) {
    this.innerRepository = new AuditLogRepository(supabase);
  }

  /**
   * Create an audit log entry (non-blocking)
   * Returns a promise but errors are logged, not thrown
   */
  async create(data: AuditLogCreateData): Promise<void> {
    return this.innerRepository.create(data);
  }

  /**
   * Get latest audit logs for translations (one per translation)
   * 
   * Uses single query with IN clause to prevent N+1 problem.
   */
  async getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>> {
    return this.innerRepository.getLatestByTranslationIds(translationIds);
  }

  /**
   * Get audit logs for a specific translation
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    return this.innerRepository.getByTranslationId(translationId);
  }

  /**
   * Get audit logs with pagination
   */
  async getWithPagination(
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: TranslationAuditLog[]; count: number | null }> {
    return this.innerRepository.getWithPagination({ page, limit });
  }
}
