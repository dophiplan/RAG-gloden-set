/**
 * Integration Test Setup
 * 
 * SQLite 기반 통합 테스트 환경 설정
 * 메모리 DB를 사용하여 빠르고 격리된 테스트 실행
 */

import { createInMemorySqliteClient, SqliteDatabase } from '@/lib/database/sqlite';
import { getConnectionManager } from '@/lib/database/sqlite/connection';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface TestDbContext {
  db: SqliteDatabase;
  schemaApplied: boolean;
}

// ============================================================================
// Schema Management
// ============================================================================

const MIGRATIONS_DIR = path.join(process.cwd(), 'sqlite', 'migrations');

/**
 * SQL 마이그레이션 파일 로드 및 실행
 */
function loadSchemaSQL(): string {
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_add_audit_logs.sql',
  ];

  let combinedSQL = '';

  for (const file of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    if (fs.existsSync(filePath)) {
      combinedSQL += fs.readFileSync(filePath, 'utf-8') + '\n';
    }
  }

  return combinedSQL;
}

/**
 * 테스트용 스키마를 메모리 DB에 적용
 */
function applySchema(db: SqliteDatabase): void {
  const schemaSQL = loadSchemaSQL();
  
  // 개별 SQL 문으로 분리하여 실행
  const statements = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      db.exec(stmt + ';');
    } catch (error) {
      // 일부 문장은 이미 존재할 수 있음 (CREATE TABLE IF NOT EXISTS 등)
      // 무시하고 계속 진행
    }
  }
}

// ============================================================================
// Test Database Lifecycle
// ============================================================================

/**
 * 테스트용 SQLite DB 초기화
 * 메모리 모드로 실행되어 매 테스트마다 격리된 환경 제공
 */
export async function setupTestDb(): Promise<SqliteDatabase> {
  // 기존 연결 정리
  getConnectionManager().closeAll();
  
  // 새 메모리 DB 생성
  const db = createInMemorySqliteClient();
  
  // 스키마 적용
  applySchema(db);
  
  return db;
}

/**
 * 테스트용 SQLite DB 종료
 */
export async function teardownTestDb(db: SqliteDatabase): Promise<void> {
  try {
    db.close();
  } catch (error) {
    // 이미 닫혀있을 수 있음
  }
  
  // 모든 연결 정리
  getConnectionManager().closeAll();
}

/**
 * 테스트 데이터 초기화 (테이블 truncate)
 * Reference 테이블(statuses, priorities, scopes)은 유지
 */
export async function resetTestData(db: SqliteDatabase): Promise<void> {
  // 외래 키 제약조건 일시적으로 비활성화
  db.run('PRAGMA foreign_keys = OFF');
  
  try {
    // 데이터 테이블만 삭제 (reference 테이블 제외)
    const tables = [
      'user_audit_logs',
      'translation_comments',
      'api_key_access_logs',
      'rate_limits',
      'glossary_rollback_history',
      'glossary_transactions',
      'translation_platforms',
      'translator_languages',
      'issues',
      'translation_logs',
      'translation_corrections',
      'user_settings_audit_logs',
      'glossary_audit_logs',
      'translation_audit_logs',
      'ai_provider_keys',
      'organization_settings',
      'user_settings',
      'glossary_products',
      'translation_products',
      'glossary',
      'translation_results',
      'translations',
      'team_members',
      'teams',
      'users',
      // Note: products, languages, translation_statuses, priority_levels, scopes are reference data
    ];

    for (const table of tables) {
      try {
        db.run(`DELETE FROM ${table}`);
      } catch {
        // 테이블이 없을 수 있음
      }
    }
  } finally {
    // 외래 키 제약조건 다시 활성화
    db.run('PRAGMA foreign_keys = ON');
  }
}

/**
 * 특정 테이블의 데이터만 초기화
 */
export async function resetTable(db: SqliteDatabase, tableName: string): Promise<void> {
  db.run('PRAGMA foreign_keys = OFF');
  try {
    db.run(`DELETE FROM ${tableName}`);
  } finally {
    db.run('PRAGMA foreign_keys = ON');
  }
}

// ============================================================================
// Transaction Helpers for Tests
// ============================================================================

/**
 * 테스트용 트랜잭션 래퍼
 * 테스트 후 자동 롤백
 */
export async function withTransaction<T>(
  db: SqliteDatabase,
  fn: (db: SqliteDatabase) => Promise<T>
): Promise<T> {
  const trx = db.beginTransaction();
  try {
    const result = await fn(db);
    trx.rollback(); // 테스트 후 항상 롤백
    return result;
  } catch (error) {
    trx.rollback();
    throw error;
  }
}

/**
 * 테스트용 저장점(Savepoint) 래퍼
 * 더 세밀한 롤백 제어 가능
 */
export async function withSavepoint<T>(
  db: SqliteDatabase,
  fn: (db: SqliteDatabase) => Promise<T>
): Promise<T> {
  db.run('SAVEPOINT test_savepoint');
  try {
    const result = await fn(db);
    db.run('ROLLBACK TO SAVEPOINT test_savepoint');
    return result;
  } catch (error) {
    db.run('ROLLBACK TO SAVEPOINT test_savepoint');
    throw error;
  }
}

// ============================================================================
// Test Context Helper
// ============================================================================

/**
 * 테스트 컨텍스트 생성
 * beforeAll에서 사용
 */
export async function createTestContext(): Promise<TestDbContext> {
  const db = await setupTestDb();
  return {
    db,
    schemaApplied: true,
  };
}

/**
 * 테스트 컨텍스트 정리
 * afterAll에서 사용
 */
export async function destroyTestContext(context: TestDbContext): Promise<void> {
  await teardownTestDb(context.db);
}
