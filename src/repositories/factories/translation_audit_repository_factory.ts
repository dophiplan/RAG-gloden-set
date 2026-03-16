import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import { getConnection } from '@/lib/database/sqlite/connection';
import { TranslationAuditRepository } from '../translation_audit_repository';
import type { ITranslationAuditRepository, IExtendedTranslationAuditRepository } from '@/repositories/interfaces/audit_log_repository';

/**
 * Factory function to create TranslationAuditRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteTranslationAuditRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses TranslationAuditRepository (requires SupabaseClient)
 * 
 * Note: TranslationAuditRepository is a wrapper/adapter around AuditLogRepository
 * for backward compatibility. Consider using createAuditLogRepository for new code.
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<ITranslationAuditRepository | IExtendedTranslationAuditRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createTranslationAuditRepository(supabase);
 * const logs = await repo.getByTranslationId('translation-id');
 * ```
 * 
 * @deprecated Consider using createAuditLogRepository for new code
 */
export async function createTranslationAuditRepository(
  supabase?: SupabaseClient
): Promise<ITranslationAuditRepository | IExtendedTranslationAuditRepository> {
  const provider = getDatabaseProvider();

  if (provider.type === 'sqlite') {
    // Dynamic import for bundle size optimization
    // SQLite implementation will be loaded only when needed
    const { SqliteTranslationAuditRepository } = await import(
      '@/repositories/implementations/sqlite/translation_audit_repository'
    );
    const db = getConnection();
    return new SqliteTranslationAuditRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Return Supabase implementation directly (no dynamic import needed as it's the default)
  return new TranslationAuditRepository(supabase);
}
