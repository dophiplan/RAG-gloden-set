import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import { TranslationResultRepository } from '../translation_result_repository';
import type { ITranslationResultRepository } from '../interfaces/translation_result_repository';

/**
 * Factory function to create TranslationResultRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteTranslationResultRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses SupabaseTranslationResultRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<ITranslationResultRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createTranslationResultRepository(supabase);
 * const results = await repo.findByTranslationId('translation-id');
 * ```
 */
export async function createTranslationResultRepository(
  supabase?: SupabaseClient
): Promise<ITranslationResultRepository> {
  const { getDatabaseProviderFromEnv } = await import('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    // Dynamic import for bundle size optimization
    const { SqliteTranslationResultRepository } = await import(
      '../implementations/sqlite/translation_result_repository'
    );
    const { createSqliteClient } = await import('@/lib/database/sqlite');
    const db = createSqliteClient();
    return new SqliteTranslationResultRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Dynamic import for consistency
  const { SupabaseTranslationResultRepository } = await import(
    '../implementations/supabase/translation_result_repository'
  );
  return new SupabaseTranslationResultRepository(supabase);
}

/**
 * Factory function to create TranslationResultRepository (sync version)
 * 
 * Note: This function only works with Supabase provider.
 * For SQLite provider, use createTranslationResultRepository instead.
 * 
 * @deprecated Use createTranslationResultRepository for async provider selection
 */
export function createTranslationResultRepositorySync(
  supabase: SupabaseClient
): ITranslationResultRepository {
  const { getDatabaseProviderFromEnv } = require('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    throw new Error(
      'SQLite provider requires async initialization. Use createTranslationResultRepository instead.'
    );
  }

  // For supabase, we can use the existing TranslationResultRepository directly
  // This maintains backward compatibility
  return new TranslationResultRepository(supabase);
}
