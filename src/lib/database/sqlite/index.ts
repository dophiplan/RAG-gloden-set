/**
 * SQLite Database Module
 * 
 * SQLite 데이터베이스 클라이언트 및 관련 유틸리티를 제공합니다.
 * 
 * @example
 * ```typescript
 * // 기본 사용
 * import { createSqliteClient } from '@/lib/database/sqlite';
 * 
 * const db = createSqliteClient('./data/app.db');
 * const users = db.all<User>('SELECT * FROM users WHERE active = ?', [1]);
 * db.close();
 * 
 * // 연결 관리
 * import { getConnection, getTestConnection } from '@/lib/database/sqlite/connection';
 * 
 * const db = getConnection();
 * const testDb = getTestConnection();
 * 
 * // 쿼리 빌더
 * import { createQueryBuilder } from '@/lib/database/sqlite/query_builder';
 * 
 * const users = createQueryBuilder<User>(db, 'users')
 *   .where('active', '=', true)
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .execute();
 * ```
 */

// ============================================================================
// Main Client
// ============================================================================

export {
  // Factory functions
  createSqliteClient,
  createInMemorySqliteClient,
  
  // Error classes
  SqliteError,
  SqliteConnectionError,
  SqliteQueryError,
} from './sqlite';

// Types
export type {
  SqliteDatabase,
  SqliteTransaction,
  SqliteRunResult,
  SqliteEngine,
} from './sqlite';

// ============================================================================
// Connection Manager
// ============================================================================

export {
  // Connection manager
  getConnectionManager,
  getConnection,
  getTestConnection,
  closeAllConnections,
  createProductionConnection,
  createDevelopmentConnection,
} from './connection';

// Types
export type {
  ConnectionConfig,
  ConnectionMode,
  Environment,
} from './connection';

// ============================================================================
// Query Builder
// ============================================================================

export {
  // Query builder
  createQueryBuilder,
  
  // Utility functions
  arrayToJson,
  jsonToArray,
  convertIlike,
  convertSupabaseQuery,
} from './query_builder';

// Types
export type {
  QueryBuilder,
  Operator,
  OrderDirection,
  NullsOption,
  WhereClause,
  OrderByClause,
  JoinClause,
  JoinType,
  AggregateClause,
  QueryResult,
} from './query_builder';
