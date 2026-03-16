/**
 * Database Utilities
 * 
 * 데이터베이스 관련 유틸리티 및 Provider
 * 
 * @example
 * ```typescript
 * // Provider 사용
 * import { 
 *   initializeDatabaseProvider, 
 *   getDatabaseProvider,
 *   useDatabaseProvider 
 * } from '@/lib/database';
 * 
 * // Query Builder 사용
 * import { createQuery } from '@/lib/database/supabase_query_builder';
 * 
 * // Batch Processor 사용
 * import { 
 *   createBatches, 
 *   extractLatestPerTranslation,
 *   groupByTranslationId 
 * } from '@/lib/database/audit_log_batch_processor';
 * ```
 */

// ============================================================================
// Provider
// ============================================================================

export {
  // Main functions
  initializeDatabaseProvider,
  getDatabaseProvider,
  isDatabaseProviderInitialized,
  resetDatabaseProvider,
  createDatabaseProviderFromEnv,
  useDatabaseProvider,
  
  // Environment helpers
  getDatabaseProviderFromEnv,
} from './provider';

// Types
export type {
  DatabaseProvider,
  DatabaseProviderType,
  DatabaseProviderConfig,
  RepositorySet,
  RepositoryFactory,
} from './provider';

// ============================================================================
// Query Builder
// ============================================================================

export { createQuery } from './supabase_query_builder';

// ============================================================================
// Batch Processor
// ============================================================================

export {
  createBatches,
  extractLatestPerTranslation,
  groupByTranslationId,
  validateAuditLog,
} from './audit_log_batch_processor';

export type { ValidationResult } from './audit_log_batch_processor';

// ============================================================================
// SQLite Client
// ============================================================================

export {
  // Main client
  createSqliteClient,
  createInMemorySqliteClient,
  
  // Error classes
  SqliteError,
  SqliteConnectionError,
  SqliteQueryError,
} from './sqlite/sqlite';

export {
  // Connection manager
  getConnectionManager,
  getConnection,
  getTestConnection,
  closeAllConnections,
  createProductionConnection,
  createDevelopmentConnection,
} from './sqlite/connection';

export {
  // Query builder
  createQueryBuilder,
  arrayToJson,
  jsonToArray,
  convertIlike,
  convertSupabaseQuery,
} from './sqlite/query_builder';

// SQLite types
export type {
  SqliteDatabase,
  SqliteTransaction,
  SqliteRunResult,
  SqliteEngine,
} from './sqlite/sqlite';

export type {
  ConnectionConfig,
  ConnectionMode,
  Environment,
} from './sqlite/connection';

export type {
  QueryBuilder as SqliteQueryBuilder,
  Operator,
  OrderDirection,
  NullsOption,
  WhereClause,
  OrderByClause,
  JoinClause,
  JoinType,
  AggregateClause,
  QueryResult,
} from './sqlite/query_builder';
