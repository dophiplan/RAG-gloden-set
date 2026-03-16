import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import { TranslationRepository } from '../translation_repository';
import type { ITranslationRepository } from '../interfaces/translation_repository';

/**
 * Factory function to create TranslationRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteTranslationRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses SupabaseTranslationRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<ITranslationRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createTranslationRepository(supabase);
 * const translation = await repo.findById('translation-id');
 * ```
 */
export async function createTranslationRepository(
  supabase?: SupabaseClient
): Promise<ITranslationRepository> {
  const { getDatabaseProviderFromEnv } = await import('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    // Dynamic import for bundle size optimization
    const { SqliteTranslationRepository } = await import(
      '../implementations/sqlite/translation_repository'
    );
    const { createSqliteClient } = await import('@/lib/database/sqlite');
    const db = createSqliteClient();
    return new SqliteTranslationRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Dynamic import for consistency
  const { SupabaseTranslationRepository } = await import(
    '../implementations/supabase/translation_repository'
  );
  return new SupabaseTranslationRepository(supabase);
}

/**
 * Factory function to create TranslationRepository (sync version)
 * 
 * Note: This function only works with Supabase provider.
 * For SQLite provider, use createTranslationRepository instead.
 * 
 * @deprecated Use createTranslationRepository for async provider selection
 */
export function createTranslationRepositorySync(supabase: SupabaseClient): ITranslationRepository {
  const { getDatabaseProviderFromEnv } = require('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    throw new Error(
      'SQLite provider requires async initialization. Use createTranslationRepository instead.'
    );
  }

  // For supabase, we can use the existing TranslationRepository directly
  // This maintains backward compatibility
  return new TranslationRepository(supabase);
}
