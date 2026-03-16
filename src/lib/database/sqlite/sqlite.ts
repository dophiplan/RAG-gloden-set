/**
 * SQLite Database Client
 * 
 * Node 22+의 내장 `node:sqlite`를 우선 사용하고, `better-sqlite3`를 fallback으로 제공합니다.
 * 모든 쿼리는 prepared statement를 사용하여 SQL 인젝션을 방지합니다.
 * 
 * @example
 * ```typescript
 * // 기본 사용
 * import { createSqliteClient } from '@/lib/database/sqlite';
 * 
 * const db = createSqliteClient('./data/app.db');
 * 
 * // 쿼리 실행
 * const users = db.all<User>('SELECT * FROM users WHERE active = ?', [1]);
 * const user = db.get<User>('SELECT * FROM users WHERE id = ?', [userId]);
 * 
 * // 데이터 수정
 * const result = db.run(
 *   'INSERT INTO users (name, email) VALUES (?, ?)',
 *   ['홍길동', 'hong@example.com']
 * );
 * console.log(result.lastInsertRowid); // 삽입된 ID
 * 
 * // 다중 쿼리 실행
 * db.exec(`
 *   CREATE TABLE IF NOT EXISTS users (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     name TEXT NOT NULL
 *   );
 * `);
 * 
 * // 연결 종료
 * db.close();
 * ```
 */

import { getConnectionManager, ConnectionMode } from './connection';
import type { QueryBuilder, WhereClause, OrderByClause } from './query_builder';

// ============================================================================
// Types
// ============================================================================

/**
 * SQLite 데이터베이스 엔진 타입
 */
export type SqliteEngine = 'node:sqlite' | 'better-sqlite3';

/**
 * SQL 실행 결과
 */
export interface SqliteRunResult {
  /** 영향받은 행 수 */
  changes?: number;
  /** 마지막으로 삽입된 행의 ID */
  lastInsertRowid?: number;
}

/**
 * SQLite 데이터베이스 인터페이스
 */
export interface SqliteDatabase {
  /** 사용 중인 엔진 */
  readonly engine: SqliteEngine;

  /**
   * 여러 행을 조회합니다.
   * @param sql - SQL 쿼리
   * @param params - 바인딩할 파라미터
   * @returns 조회된 행 배열
   */
  all<T>(sql: string, params?: unknown[]): T[];

  /**
   * 단일 행을 조회합니다.
   * @param sql - SQL 쿼리
   * @param params - 바인딩할 파라미터
   * @returns 조회된 행 또는 undefined
   */
  get<T>(sql: string, params?: unknown[]): T | undefined;

  /**
   * 데이터를 수정합니다(INSERT, UPDATE, DELETE).
   * @param sql - SQL 쿼리
   * @param params - 바인딩할 파라미터
   * @returns 실행 결과
   */
  run(sql: string, params?: unknown[]): SqliteRunResult;

  /**
   * 여러 SQL 문을 실행합니다(트랜잭션, DDL 등).
   * @param sql - 실행할 SQL 문자열
   */
  exec(sql: string): void;

  /**
   * 데이터베이스 연결을 종료합니다.
   */
  close(): void;

  /**
   * 새로운 Query Builder를 생성합니다.
   * @param tableName - 조회할 테이블 이름
   */
  query<T = any>(tableName: string): QueryBuilder<T>;

  /**
   * 트랜잭션을 시작합니다.
   * @returns 트랜잭션 객체
   */
  beginTransaction(): SqliteTransaction;

  /**
   * 트랜잭션 내에서 함수를 실행합니다.
   * @param fn - 트랜잭션 내에서 실행할 함수
   * @returns 함수의 반환값
   */
  transaction<T>(fn: (trx: SqliteTransaction) => T): T;
}

/**
 * SQLite 트랜잭션 인터페이스
 */
export interface SqliteTransaction {
  /**
   * 여러 행을 조회합니다.
   */
  all<T>(sql: string, params?: unknown[]): T[];

  /**
   * 단일 행을 조회합니다.
   */
  get<T>(sql: string, params?: unknown[]): T | undefined;

  /**
   * 데이터를 수정합니다.
   */
  run(sql: string, params?: unknown[]): SqliteRunResult;

  /**
   * 트랜잭션을 커밋합니다.
   */
  commit(): void;

  /**
   * 트랜잭션을 롤백합니다.
   */
  rollback(): void;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * SQLite 관련 기본 오류
 */
export class SqliteError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SqliteError';
  }
}

/**
 * 연결 오류
 */
export class SqliteConnectionError extends SqliteError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONNECTION_ERROR', originalError);
    this.name = 'SqliteConnectionError';
  }
}

/**
 * 쿼리 실행 오류
 */
export class SqliteQueryError extends SqliteError {
  constructor(
    message: string,
    public readonly sql: string,
    public readonly params: unknown[],
    originalError?: Error
  ) {
    super(message, 'QUERY_ERROR', originalError);
    this.name = 'SqliteQueryError';
  }
}

// ============================================================================
// Node SQLite Implementation (Node 22+)
// ============================================================================

class NodeSqliteDatabase implements SqliteDatabase {
  readonly engine: SqliteEngine = 'node:sqlite';
  private db: any;

  constructor(dbPath?: string) {
    try {
      // Node 22+의 내장 sqlite 모듈 사용
      const { DatabaseSync } = require('node:sqlite');
      
      const path = dbPath || process.env.SQLITE_DB_PATH || './data/app.db';
      
      // 메모리 모드 확인
      if (process.env.SQLITE_MODE === 'memory') {
        this.db = new DatabaseSync(':memory:');
      } else {
        // 파일 경로 확인 및 생성
        const fs = require('fs');
        const pathModule = require('path');
        const dir = pathModule.dirname(path);
        
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new DatabaseSync(path);
      }
    } catch (error) {
      throw new SqliteConnectionError(
        'SQLite 데이터베이스 연결에 실패했습니다.',
        error instanceof Error ? error : undefined
      );
    }
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  get<T>(sql: string, params?: unknown[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...(params || [])) as T | undefined;
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 수정 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw new SqliteQueryError(
        'SQL 실행 중 오류가 발생했습니다.',
        sql,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      throw new SqliteConnectionError(
        '데이터베이스 연결 종료 중 오류가 발생했습니다.',
        error instanceof Error ? error : undefined
      );
    }
  }

  query<T = any>(tableName: string): QueryBuilder<T> {
    const { createQueryBuilder } = require('./query_builder') as { createQueryBuilder: <T>(db: SqliteDatabase, tableName: string) => QueryBuilder<T> };
    return createQueryBuilder<T>(this, tableName);
  }

  beginTransaction(): SqliteTransaction {
    this.exec('BEGIN TRANSACTION');
    return new NodeSqliteTransaction(this.db);
  }

  transaction<T>(fn: (trx: SqliteTransaction) => T): T {
    const trx = this.beginTransaction();
    try {
      const result = fn(trx);
      trx.commit();
      return result;
    } catch (error) {
      trx.rollback();
      throw error;
    }
  }
}

class NodeSqliteTransaction implements SqliteTransaction {
  private db: any;
  private isActive = true;

  constructor(db: any) {
    this.db = db;
  }

  private checkActive(): void {
    if (!this.isActive) {
      throw new SqliteError('트랜잭션이 이미 종료되었습니다.');
    }
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  get<T>(sql: string, params?: unknown[]): T | undefined {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...(params || [])) as T | undefined;
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 수정 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  commit(): void {
    this.checkActive();
    this.db.exec('COMMIT');
    this.isActive = false;
  }

  rollback(): void {
    if (this.isActive) {
      this.db.exec('ROLLBACK');
      this.isActive = false;
    }
  }
}

// ============================================================================
// Better-SQLite3 Implementation (Fallback)
// ============================================================================

class BetterSqliteDatabase implements SqliteDatabase {
  readonly engine: SqliteEngine = 'better-sqlite3';
  private db: any;

  constructor(dbPath?: string) {
    try {
      const Database = require('better-sqlite3');
      
      const path = dbPath || process.env.SQLITE_DB_PATH || './data/app.db';
      
      if (process.env.SQLITE_MODE === 'memory') {
        this.db = new Database(':memory:');
      } else {
        this.db = new Database(path);
      }
      
      // WAL 모드 활성화 (성능 향상)
      this.db.pragma('journal_mode = WAL');
    } catch (error) {
      throw new SqliteConnectionError(
        'better-sqlite3 데이터베이스 연결에 실패했습니다. better-sqlite3가 설치되어 있는지 확인하세요.',
        error instanceof Error ? error : undefined
      );
    }
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  get<T>(sql: string, params?: unknown[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...(params || [])) as T | undefined;
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error) {
      throw new SqliteQueryError(
        '데이터 수정 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw new SqliteQueryError(
        'SQL 실행 중 오류가 발생했습니다.',
        sql,
        [],
        error instanceof Error ? error : undefined
      );
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      throw new SqliteConnectionError(
        '데이터베이스 연결 종료 중 오류가 발생했습니다.',
        error instanceof Error ? error : undefined
      );
    }
  }

  query<T = any>(tableName: string): QueryBuilder<T> {
    const { createQueryBuilder } = require('./query_builder') as { createQueryBuilder: <T>(db: SqliteDatabase, tableName: string) => QueryBuilder<T> };
    return createQueryBuilder<T>(this, tableName);
  }

  beginTransaction(): SqliteTransaction {
    this.exec('BEGIN TRANSACTION');
    return new BetterSqliteTransaction(this.db);
  }

  transaction<T>(fn: (trx: SqliteTransaction) => T): T {
    // better-sqlite3는 자체 트랜잭션 지원
    try {
      return this.db.transaction(fn)(new BetterSqliteTransaction(this.db));
    } catch (error) {
      throw new SqliteError(
        '트랜잭션 실행 중 오류가 발생했습니다.',
        'TRANSACTION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}

class BetterSqliteTransaction implements SqliteTransaction {
  private db: any;
  private isActive = true;

  constructor(db: any) {
    this.db = db;
  }

  private checkActive(): void {
    if (!this.isActive) {
      throw new SqliteError('트랜잭션이 이미 종료되었습니다.');
    }
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...(params || [])) as T[];
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  get<T>(sql: string, params?: unknown[]): T | undefined {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...(params || [])) as T | undefined;
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 조회 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    this.checkActive();
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    } catch (error) {
      throw new SqliteQueryError(
        '트랜잭션 내 데이터 수정 중 오류가 발생했습니다.',
        sql,
        params || [],
        error instanceof Error ? error : undefined
      );
    }
  }

  commit(): void {
    this.checkActive();
    this.db.exec('COMMIT');
    this.isActive = false;
  }

  rollback(): void {
    if (this.isActive) {
      this.db.exec('ROLLBACK');
      this.isActive = false;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Node 22+의 내장 sqlite 사용 가능 여부 확인
 */
function isNodeSqliteAvailable(): boolean {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

/**
 * better-sqlite3 사용 가능 여부 확인
 */
function isBetterSqlite3Available(): boolean {
  try {
    require('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

/**
 * SQLite 클라이언트를 생성합니다.
 * 
 * 우선순위:
 * 1. Node 22+의 내장 `node:sqlite`
 * 2. `better-sqlite3` (optional dependency)
 * 
 * @param dbPath - 데이터베이스 파일 경로 (기본값: SQLITE_DB_PATH 환경변수 또는 './data/app.db')
 * @returns SQLite 데이터베이스 인스턴스
 * @throws SqliteConnectionError - 연결 실패 시
 * 
 * @example
 * ```typescript
 * // 기본 경로 사용 (환경변수 또는 ./data/app.db)
 * const db = createSqliteClient();
 * 
 * // 특정 경로 지정
 * const db = createSqliteClient('./mydata.db');
 * 
 * // 메모리 모드 (테스트용)
 * // SQLITE_MODE=memory 환경변수 설정
 * const db = createSqliteClient();
 * ```
 */
export function createSqliteClient(dbPath?: string): SqliteDatabase {
  // 환경변수에서 엔진 강제 설정 확인
  const forcedEngine = process.env.SQLITE_ENGINE;

  if (forcedEngine === 'better-sqlite3') {
    if (isBetterSqlite3Available()) {
      return new BetterSqliteDatabase(dbPath);
    }
    throw new SqliteConnectionError(
      'better-sqlite3가 설치되어 있지 않습니다. npm install better-sqlite3를 실행하세요.'
    );
  }

  if (forcedEngine === 'node:sqlite') {
    if (isNodeSqliteAvailable()) {
      return new NodeSqliteDatabase(dbPath);
    }
    throw new SqliteConnectionError(
      'Node.js 버전이 22 이상이어야 node:sqlite를 사용할 수 있습니다.'
    );
  }

  // 자동 감지
  if (isNodeSqliteAvailable()) {
    return new NodeSqliteDatabase(dbPath);
  }

  if (isBetterSqlite3Available()) {
    return new BetterSqliteDatabase(dbPath);
  }

  throw new SqliteConnectionError(
    '사용 가능한 SQLite 라이브러리가 없습니다. ' +
    'Node.js 22+를 사용하거나 better-sqlite3를 설치하세요 (npm install better-sqlite3).'
  );
}

/**
 * 메모리 기반 SQLite 클라이언트를 생성합니다.
 * 테스트에 유용합니다.
 * 
 * @returns 메모리 기반 SQLite 데이터베이스 인스턴스
 */
export function createInMemorySqliteClient(): SqliteDatabase {
  const originalMode = process.env.SQLITE_MODE;
  process.env.SQLITE_MODE = 'memory';
  
  try {
    return createSqliteClient(':memory:');
  } finally {
    if (originalMode !== undefined) {
      process.env.SQLITE_MODE = originalMode;
    } else {
      delete process.env.SQLITE_MODE;
    }
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export type { ConnectionMode } from './connection';
export type { QueryBuilder, WhereClause, OrderByClause } from './query_builder';
