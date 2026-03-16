import { SupabaseClient } from '@supabase/supabase-js';
import { getConnection } from '@/lib/database/sqlite/connection';
import { isEnabled } from '@/lib/config/feature_flags';
import { GlossaryRepository } from '../glossary_repository';
import type { IGlossaryRepository } from '../interfaces/glossary_repository';

/**
 * Factory function to create GlossaryRepository
 * 
 * Supports dynamic provider selection via Feature Flag:
 * - USE_SQLITE_GLOSSARY=true: Uses SqliteGlossaryRepository
 * - USE_SQLITE_GLOSSARY=false (default): Uses GlossaryRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @returns Promise<IGlossaryRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * const repo = await createGlossaryRepository(supabase);
 * const term = await repo.findById('term-id');
 * ```
 */
export async function createGlossaryRepository(
  supabase?: SupabaseClient
): Promise<IGlossaryRepository> {
  // Feature Flag로 SQLite 사용 여부 확인
  if (isEnabled('USE_SQLITE_GLOSSARY')) {
    // Dynamic import for bundle size optimization
    // SQLite implementation will be loaded only when needed
    const { SqliteGlossaryRepository } = await import(
      '../implementations/sqlite/glossary_repository'
    );
    const db = getConnection();
    return new SqliteGlossaryRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Return Supabase implementation directly (no dynamic import needed as it's the default)
  return new GlossaryRepository(supabase);
}
