import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import { AuditLogRepository } from '../audit_log_repository';
import type { IAuditLogRepository } from '../interfaces/audit_log_repository';

/**
 * Factory function to create AuditLogRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteAuditLogRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses SupabaseAuditLogRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<IAuditLogRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createAuditLogRepository(supabase);
 * await repo.create({ translation_id: 'id', action: 'update', ... });
 * ```
 */
export async function createAuditLogRepository(
  supabase?: SupabaseClient
): Promise<IAuditLogRepository> {
  const { getDatabaseProviderFromEnv } = await import('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    // Dynamic import for bundle size optimization
    const { SqliteAuditLogRepository } = await import(
      '../implementations/sqlite/audit_log_repository'
    );
    const { createSqliteClient } = await import('@/lib/database/sqlite');
    const db = createSqliteClient();
    return new SqliteAuditLogRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Dynamic import for consistency
  const { SupabaseAuditLogRepository } = await import(
    '../implementations/supabase/audit_log_repository'
  );
  return new SupabaseAuditLogRepository(supabase);
}

/**
 * Factory function to create AuditLogRepository (sync version)
 * 
 * Note: This function only works with Supabase provider.
 * For SQLite provider, use createAuditLogRepository instead.
 * 
 * @deprecated Use createAuditLogRepository for async provider selection
 */
export function createAuditLogRepositorySync(supabase: SupabaseClient): IAuditLogRepository {
  const { getDatabaseProviderFromEnv } = require('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    throw new Error(
      'SQLite provider requires async initialization. Use createAuditLogRepository instead.'
    );
  }

  // Use the new Supabase implementation for consistency
  const { SupabaseAuditLogRepository } = require('../implementations/supabase/audit_log_repository');
  return new SupabaseAuditLogRepository(supabase);
}
