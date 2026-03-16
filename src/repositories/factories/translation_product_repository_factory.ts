import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import { TranslationProductRepository } from '../translation_product_repository';
import type { ITranslationProductRepository } from '../interfaces/translation_product_repository';

/**
 * Factory function to create TranslationProductRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteTranslationProductRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses SupabaseTranslationProductRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<ITranslationProductRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createTranslationProductRepository(supabase);
 * await repo.updateForTranslation('trans-1', ['RC', 'RV']);
 * ```
 */
export async function createTranslationProductRepository(
  supabase?: SupabaseClient
): Promise<ITranslationProductRepository> {
  const { getDatabaseProviderFromEnv } = await import('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    // Dynamic import for bundle size optimization
    const { SqliteTranslationProductRepository } = await import(
      '../implementations/sqlite/translation_product_repository'
    );
    const { createSqliteClient } = await import('@/lib/database/sqlite');
    const db = createSqliteClient();
    return new SqliteTranslationProductRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Dynamic import for consistency
  const { SupabaseTranslationProductRepository } = await import(
    '../implementations/supabase/translation_product_repository'
  );
  return new SupabaseTranslationProductRepository(supabase);
}

/**
 * Factory function to create TranslationProductRepository (sync version)
 * 
 * Note: This function only works with Supabase provider.
 * For SQLite provider, use createTranslationProductRepository instead.
 * 
 * @deprecated Use createTranslationProductRepository for async provider selection
 */
export function createTranslationProductRepositorySync(
  supabase: SupabaseClient
): ITranslationProductRepository {
  const { getDatabaseProviderFromEnv } = require('@/lib/database/provider');
  const provider = getDatabaseProviderFromEnv();

  if (provider === 'sqlite') {
    throw new Error(
      'SQLite provider requires async initialization. Use createTranslationProductRepository instead.'
    );
  }

  // For supabase, we can use the existing TranslationProductRepository directly
  // This maintains backward compatibility
  return new TranslationProductRepository(supabase);
}
