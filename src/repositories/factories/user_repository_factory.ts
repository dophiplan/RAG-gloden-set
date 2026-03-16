import { SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseProvider } from '@/lib/database/provider';
import type { IUserRepository } from '../interfaces/user_repository';
import { SupabaseUserRepository } from '../implementations/supabase/user_repository';

// Provider type
export type UserRepositoryProvider = 'supabase' | 'sqlite';

/**
 * Factory function to create UserRepository
 * 
 * Supports dynamic provider selection:
 * - 'sqlite': Uses SqliteUserRepository (lazy loaded for bundle optimization)
 * - 'supabase': Uses SupabaseUserRepository (requires SupabaseClient)
 * 
 * @param supabase - SupabaseClient instance (required for supabase provider)
 * @param provider - Provider type override (optional, defaults to auto-detection)
 * @returns Promise<IUserRepository> - Repository instance
 * @throws Error if supabase client is not provided for supabase provider
 * 
 * @example
 * ```typescript
 * // Auto-detect provider from environment
 * const repo = await createUserRepository(supabase);
 * const user = await repo.findById('user-id');
 * 
 * // Explicit provider selection
 * const sqliteRepo = await createUserRepository(undefined, 'sqlite');
 * const user = await sqliteRepo.findById('user-id');
 * ```
 */
export async function createUserRepository(
  supabase?: SupabaseClient,
  provider?: UserRepositoryProvider
): Promise<IUserRepository> {
  const selectedProvider = provider ?? detectProvider();

  if (selectedProvider === 'sqlite') {
    // Dynamic import for bundle size optimization
    // SQLite implementation will be loaded only when needed
    const { SqliteUserRepository } = await import('../implementations/sqlite/user_repository');
    const { getConnection } = await import('@/lib/database/sqlite/connection');
    const db = getConnection();
    return new SqliteUserRepository(db);
  }

  if (!supabase) {
    throw new Error('Supabase client is required for supabase provider');
  }

  // Return Supabase implementation directly (no dynamic import needed as it's the default)
  return new SupabaseUserRepository(supabase);
}

/**
 * Create Supabase User Repository
 * 
 * @param supabase - SupabaseClient instance
 * @returns SupabaseUserRepository instance
 */
export function createSupabaseUserRepository(supabase: SupabaseClient): SupabaseUserRepository {
  return new SupabaseUserRepository(supabase);
}

/**
 * Create SQLite User Repository
 * 
 * @param dbPath - Optional database file path
 * @returns Promise<SqliteUserRepository> instance
 */
export async function createSqliteUserRepository(dbPath?: string): Promise<IUserRepository> {
  const { SqliteUserRepository } = await import('../implementations/sqlite/user_repository');
  const { getConnection } = await import('@/lib/database/sqlite/connection');
  const db = getConnection(dbPath ? { dbPath } : undefined);
  return new SqliteUserRepository(db);
}

/**
 * Detect provider type from environment
 */
function detectProvider(): UserRepositoryProvider {
  // Check for explicit provider setting
  const envProvider = process.env.USER_REPOSITORY_PROVIDER || process.env.DATABASE_PROVIDER;
  
  if (envProvider === 'sqlite') {
    return 'sqlite';
  }
  
  // Default to supabase
  return 'supabase';
}

/**
 * Check if SQLite provider is available
 */
export function isSQLiteAvailable(): boolean {
  try {
    // Check if better-sqlite3 or node:sqlite is available
    require.resolve('better-sqlite3');
    return true;
  } catch {
    // Fall back to checking for node:sqlite (Node.js 22+)
    try {
      const sqlite = require('node:sqlite');
      return !!sqlite.DatabaseSync;
    } catch {
      return false;
    }
  }
}
